package handlers

import (
	"bytes"
	"compress/gzip"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/api/middleware"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

// OTLPIngestHandler receives OpenTelemetry OTLP/HTTP protobuf payloads.
type OTLPIngestHandler struct {
	logHandler        *LogIngestHandler
	apiRequestHandler *ApiRequestsHandler
	spanRepo          *database.SpanRepository
	reqRepo           *database.ApiRequestRepository
	agentRepo         *database.AgentRepository
	metricRepo        *database.OtelMetricRepository
	systemMetricRepo  *database.SystemMetricRepository
	ruleRepo          *database.AlertRuleRepository
	alertManager      *alerter.Manager
	ruleEvaluator     *alerter.RuleEvaluator
}

// NewOTLPIngestHandler creates an OTLP ingest handler.
func NewOTLPIngestHandler(evaluators ...*alerter.RuleEvaluator) *OTLPIngestHandler {
	handler := &OTLPIngestHandler{
		logHandler:        NewLogIngestHandler(),
		apiRequestHandler: NewApiRequestsHandler(),
		spanRepo:          database.NewSpanRepository(),
		reqRepo:           database.NewApiRequestRepository(),
		agentRepo:         database.NewAgentRepository(),
		metricRepo:        database.NewOtelMetricRepository(),
		systemMetricRepo:  database.NewSystemMetricRepository(),
		ruleRepo:          database.NewAlertRuleRepository(),
		alertManager:      alerter.NewManager(),
	}
	if len(evaluators) > 0 {
		handler.ruleEvaluator = evaluators[0]
	}
	return handler
}

// evaluateOtelMetricAlerts checks each stored metric point against enabled
// otel_metric threshold rules for its direct or Agent service and dispatches on breach. Instant
// per-datapoint evaluation, mirroring api_status alerts; dedup/cooldown in the
// manager collapses repeats per (rule, service, metric, attribute series).
func (h *OTLPIngestHandler) evaluateOtelMetricAlerts(principal *middleware.IngestPrincipal, rows []models.OtelMetric) {
	if len(rows) == 0 {
		return
	}
	serviceName := rows[0].ServiceName
	rules, err := h.ruleRepo.GetEnabledOtelMetricRules(principal.ServiceID, principal.AgentID, serviceName)
	if err != nil {
		log.Printf("[OTLP] failed to load metric alert rules for %s: %v", serviceName, err)
		return
	}
	if len(rules) == 0 {
		return
	}
	for _, row := range rows {
		for _, rule := range rules {
			if rule.MetricName != row.MetricName {
				continue
			}
			if !compareAlertValue(row.Value, rule.Operator, rule.Threshold) {
				continue
			}
			h.alertManager.DispatchOtelMetricAlertForRule(
				rule, principal.ServiceID, principal.AgentID, row.ServiceName, row.MetricName, string(row.Attributes), row.Value)
		}
	}
}

// IngestLogs handles POST /api/v1/otlp/v1/logs.
func (h *OTLPIngestHandler) IngestLogs(c *fiber.Ctx) error {
	principal, ok := c.Locals("ingestPrincipal").(*middleware.IngestPrincipal)
	if !ok || principal == nil {
		return unauthorizedOTLP(c)
	}

	var req collectorlogspb.ExportLogsServiceRequest
	body, readErr := readOTLPBody(c)
	if readErr != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": readErr.Error(),
			},
		})
	}

	if err := proto.Unmarshal(body, &req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": "Invalid OTLP logs protobuf payload: " + err.Error(),
			},
		})
	}

	processed := 0
	filtered := 0
	failed := 0
	receivedServices := make(map[string]bool)

	for _, resourceLogs := range req.ResourceLogs {
		resourceMap := attrsToMap(resourceLogs.GetResource().GetAttributes())
		resourceJSON := mustJSON(resourceMap)
		serviceName := principal.ResolveServiceName(firstString(resourceMap, "service.name"))

		// Resolve the ingest-time level filter and a stable seed for alert dedup.
		// Agents filter per-service (agent_services.log_level_filter) and key dedup
		// on agentID:serviceName; legacy services carry their own filter + id.
		filter := principal.LogLevelFilter
		alertSeed := principal.ServiceID
		if principal.AgentID != "" {
			filter = h.agentRepo.LogLevelFilterByName(principal.AgentID, serviceName)
			alertSeed = principal.AgentID + ":" + serviceName
		}

		for _, scopeLogs := range resourceLogs.ScopeLogs {
			for _, record := range scopeLogs.LogRecords {
				entry, otel := logRecordToEntry(record, resourceMap)
				logEntry, err := h.logHandler.processEntry(&entry, filter, alertSeed, models.LogSourceOTLP)
				if errors.Is(err, errLogFiltered) {
					filtered++
					continue
				}
				if err != nil {
					log.Printf("[OTLP] log validation failed for service %s: %v", serviceName, err)
					failed++
					continue
				}

				logEntry.ServiceID = principal.ServiceID
				logEntry.AgentID = principal.AgentID
				logEntry.ServiceName = serviceName
				logEntry.TraceID = otel.traceID
				logEntry.SpanID = otel.spanID
				logEntry.SeverityNumber = otel.severityNumber
				logEntry.ObservedAt = otel.observedAt
				logEntry.Resource = resourceJSON
				logEntry.Attributes = otel.attributes
				if otel.timestamp != nil {
					logEntry.CreatedAt = *otel.timestamp
				}

				if err := h.logHandler.logRepo.Create(logEntry); err != nil {
					log.Printf("[OTLP] failed to store log for service %s: %v", serviceName, err)
					failed++
					continue
				}
				h.logHandler.triggerAlertIfNeeded(principal.ServiceID, principal.AgentID, serviceName, logEntry, entry.Metadata)
				processed++
				receivedServices[serviceName] = true
			}
		}
	}

	for name := range receivedServices {
		recordReceipt(principal, name, "logs")
	}
	body, err := proto.Marshal(&collectorlogspb.ExportLogsServiceResponse{})
	if err != nil {
		return err
	}
	c.Set(fiber.HeaderContentType, "application/x-protobuf")
	c.Set("X-EveryUp-Processed", strconv.Itoa(processed))
	c.Set("X-EveryUp-Filtered", strconv.Itoa(filtered))
	c.Set("X-EveryUp-Failed", strconv.Itoa(failed))
	return c.Status(fiber.StatusOK).Send(body)
}

// IngestTraces handles POST /api/v1/otlp/v1/traces.
func (h *OTLPIngestHandler) IngestTraces(c *fiber.Ctx) error {
	principal, ok := c.Locals("ingestPrincipal").(*middleware.IngestPrincipal)
	if !ok || principal == nil {
		return unauthorizedOTLP(c)
	}

	var req collectortracepb.ExportTraceServiceRequest
	body, readErr := readOTLPBody(c)
	if readErr != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": readErr.Error(),
			},
		})
	}

	if err := proto.Unmarshal(body, &req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": "Invalid OTLP traces protobuf payload: " + err.Error(),
			},
		})
	}

	var spans []models.Span
	var requests []models.ApiRequest

	for _, resourceSpans := range req.ResourceSpans {
		resourceMap := attrsToMap(resourceSpans.GetResource().GetAttributes())
		resourceJSON := mustJSON(resourceMap)
		serviceName := principal.ResolveServiceName(firstString(resourceMap, "service.name"))

		for _, scopeSpans := range resourceSpans.ScopeSpans {
			for _, span := range scopeSpans.Spans {
				modelSpan := spanToModel(principal.ServiceID, principal.AgentID, serviceName, resourceJSON, span)
				spans = append(spans, modelSpan)

				if apiReq, ok := spanToAPIRequest(principal.ServiceID, principal.AgentID, serviceName, principal.ApiExcludePaths, span); ok {
					requests = append(requests, apiReq)
				}
			}
		}
	}

	insertedSpans, err := h.spanRepo.CreateBatch(spans)
	if err != nil {
		log.Printf("[OTLP] failed to store spans for %s: %v", principal.Name, err)
		return internalError(c, ErrCodeDatabase, err)
	}

	insertedRequests, err := h.reqRepo.CreateBatch(requests)
	if err != nil {
		log.Printf("[OTLP] failed to store API request projections for %s: %v", principal.Name, err)
		return internalError(c, ErrCodeDatabase, err)
	}
	if insertedRequests > 0 {
		h.apiRequestHandler.evaluateApiRequestAlerts(
			principal.ServiceID, principal.AgentID, requests[0].ServiceName, requests)
	}

	receivedServices := make(map[string]bool)
	for _, span := range spans {
		receivedServices[span.ServiceName] = true
	}
	for name := range receivedServices {
		recordReceipt(principal, name, "traces")
	}
	respBody, err := proto.Marshal(&collectortracepb.ExportTraceServiceResponse{})
	if err != nil {
		return err
	}
	c.Set(fiber.HeaderContentType, "application/x-protobuf")
	c.Set("X-EveryUp-Spans", strconv.Itoa(insertedSpans))
	c.Set("X-EveryUp-Api-Requests", strconv.Itoa(insertedRequests))
	return c.Status(fiber.StatusOK).Send(respBody)
}

// IngestMetrics handles POST /api/v1/otlp/v1/metrics. Data points are
// flattened one row per point; unsupported shapes are counted and skipped.
func (h *OTLPIngestHandler) IngestMetrics(c *fiber.Ctx) error {
	principal, ok := c.Locals("ingestPrincipal").(*middleware.IngestPrincipal)
	if !ok || principal == nil {
		return unauthorizedOTLP(c)
	}

	var req collectormetricspb.ExportMetricsServiceRequest
	body, readErr := readOTLPBody(c)
	if readErr != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": readErr.Error(),
			},
		})
	}

	if err := proto.Unmarshal(body, &req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": "Invalid OTLP metrics protobuf payload: " + err.Error(),
			},
		})
	}

	if principal.InfrastructureResourceID != "" {
		metric, recognized := projectInfrastructureMetric(&req, principal.InfrastructureResourceID)
		if recognized > 0 {
			if previous, err := h.systemMetricRepo.GetLatestByHost(principal.InfrastructureResourceID); err == nil && previous != nil {
				fillMissingInfrastructureValues(metric, previous)
			}
			if err := h.systemMetricRepo.Create(metric); err != nil {
				return internalError(c, ErrCodeDatabase, err)
			}
			recordReceipt(principal, principal.Name, "infrastructure")
			if h.ruleEvaluator != nil {
				go h.ruleEvaluator.EvaluateAgent(principal.InfrastructureResourceID, principal.Name, metric)
			}
		}
		respBody, err := proto.Marshal(&collectormetricspb.ExportMetricsServiceResponse{})
		if err != nil {
			return err
		}
		c.Set(fiber.HeaderContentType, "application/x-protobuf")
		c.Set("X-EveryUp-Infrastructure-Metrics", strconv.Itoa(recognized))
		return c.Status(fiber.StatusOK).Send(respBody)
	}

	var rows []models.OtelMetric
	skipped := 0
	for _, resourceMetrics := range req.ResourceMetrics {
		resourceMap := attrsToMap(resourceMetrics.GetResource().GetAttributes())
		serviceName := principal.ResolveServiceName(firstString(resourceMap, "service.name"))

		for _, scopeMetrics := range resourceMetrics.ScopeMetrics {
			for _, metric := range scopeMetrics.Metrics {
				points, ok := flattenMetric(metric)
				if !ok {
					skipped++
					continue
				}
				for i := range points {
					points[i].ServiceID = principal.ServiceID
					points[i].AgentID = principal.AgentID
					points[i].ServiceName = serviceName
				}
				rows = append(rows, points...)
			}
		}
	}

	inserted, err := h.metricRepo.CreateBatch(rows)
	if err != nil {
		log.Printf("[OTLP] failed to store metrics for %s: %v", principal.Name, err)
		return internalError(c, ErrCodeDatabase, err)
	}

	h.evaluateOtelMetricAlerts(principal, rows)
	receivedServices := make(map[string]bool)
	for _, row := range rows {
		receivedServices[row.ServiceName] = true
	}
	for name := range receivedServices {
		recordReceipt(principal, name, "metrics")
	}

	respBody, err := proto.Marshal(&collectormetricspb.ExportMetricsServiceResponse{})
	if err != nil {
		return err
	}
	c.Set(fiber.HeaderContentType, "application/x-protobuf")
	c.Set("X-EveryUp-Metric-Points", strconv.Itoa(inserted))
	c.Set("X-EveryUp-Skipped", strconv.Itoa(skipped))
	return c.Status(fiber.StatusOK).Send(respBody)
}

// flattenMetric projects one OTLP metric into rows: gauges and sums keep the
// point value; the histogram family stores count + total with value = average.
// Returns ok=false for a metric shape with no supported data.
func flattenMetric(metric *metricspb.Metric) ([]models.OtelMetric, bool) {
	name := metric.GetName()
	if name == "" {
		return nil, false
	}

	var rows []models.OtelMetric
	switch {
	case metric.GetGauge() != nil:
		for _, dp := range metric.GetGauge().GetDataPoints() {
			row := numberPointRow(name, "gauge", metric.GetUnit(), dp)
			attachExemplars(&row, dp.GetExemplars())
			rows = append(rows, row)
		}
	case metric.GetSum() != nil:
		for _, dp := range metric.GetSum().GetDataPoints() {
			row := numberPointRow(name, "sum", metric.GetUnit(), dp)
			attachExemplars(&row, dp.GetExemplars())
			rows = append(rows, row)
		}
	case metric.GetHistogram() != nil:
		temporality := int(metric.GetHistogram().GetAggregationTemporality())
		for _, dp := range metric.GetHistogram().GetDataPoints() {
			row := histogramRow(name, metric.GetUnit(), dp.GetCount(), dp.GetSum(), dp.GetAttributes(), dp.GetTimeUnixNano())
			attachBuckets(&row, dp.GetExplicitBounds(), dp.GetBucketCounts(), temporality)
			attachExemplars(&row, dp.GetExemplars())
			rows = append(rows, row)
		}
	case metric.GetExponentialHistogram() != nil:
		temporality := int(metric.GetExponentialHistogram().GetAggregationTemporality())
		for _, dp := range metric.GetExponentialHistogram().GetDataPoints() {
			row := histogramRow(name, metric.GetUnit(), dp.GetCount(), dp.GetSum(), dp.GetAttributes(), dp.GetTimeUnixNano())
			if bounds, counts, ok := explicitFromExponential(dp); ok {
				attachBuckets(&row, bounds, counts, temporality)
			}
			attachExemplars(&row, dp.GetExemplars())
			rows = append(rows, row)
		}
	case metric.GetSummary() != nil:
		for _, dp := range metric.GetSummary().GetDataPoints() {
			// ponytail: a summary ships pre-computed quantiles that cannot be
			// merged across series or time, so it stays an average here. Its
			// quantiles would need a separate, non-additive read path.
			rows = append(rows, histogramRow(name, metric.GetUnit(), dp.GetCount(), dp.GetSum(), dp.GetAttributes(), dp.GetTimeUnixNano()))
		}
	default:
		return nil, false
	}
	return rows, len(rows) > 0
}

func numberPointRow(name, metricType, unit string, dp *metricspb.NumberDataPoint) models.OtelMetric {
	value := dp.GetAsDouble()
	if _, isInt := dp.GetValue().(*metricspb.NumberDataPoint_AsInt); isInt {
		value = float64(dp.GetAsInt())
	}
	return metricRow(name, metricType, unit, value, 0, 0, dp.GetAttributes(), dp.GetTimeUnixNano())
}

func histogramRow(name, unit string, count uint64, sum float64, attrs []*commonpb.KeyValue, timeUnixNano uint64) models.OtelMetric {
	avg := 0.0
	if count > 0 {
		avg = sum / float64(count)
	}
	return metricRow(name, "histogram", unit, avg, count, sum, attrs, timeUnixNano)
}

// attachExemplars keeps the measurements that carry a trace ID. An exemplar
// without one cannot lead anywhere, so it is dropped rather than stored.
func attachExemplars(row *models.OtelMetric, exemplars []*metricspb.Exemplar) {
	if len(exemplars) == 0 {
		return
	}
	kept := make([]models.MetricExemplar, 0, len(exemplars))
	for _, exemplar := range exemplars {
		traceID := bytesToHex(exemplar.GetTraceId())
		if traceID == "" {
			continue
		}
		value := exemplar.GetAsDouble()
		if _, isInt := exemplar.GetValue().(*metricspb.Exemplar_AsInt); isInt {
			value = float64(exemplar.GetAsInt())
		}
		kept = append(kept, models.MetricExemplar{
			TraceID: traceID,
			SpanID:  bytesToHex(exemplar.GetSpanId()),
			Value:   value,
			Time:    timeFromUnixNano(exemplar.GetTimeUnixNano()),
		})
	}
	if len(kept) == 0 {
		return
	}
	row.Exemplars = mustJSON(kept)
}

// explicitFromExponential rewrites an exponential histogram's scale-encoded
// buckets as explicit bounds, so one quantile implementation serves both
// shapes. Bucket index i covers (base^i, base^(i+1)], so the upper bounds are
// base^(offset+j); the zero bucket becomes the first explicit bucket.
//
// Reports ok=false rather than guessing when the point carries negative
// buckets (which this projection does not represent) or when a bound overflows
// to infinity — a wrong distribution is worse than falling back to the average.
func explicitFromExponential(dp *metricspb.ExponentialHistogramDataPoint) ([]float64, []uint64, bool) {
	if len(dp.GetNegative().GetBucketCounts()) > 0 {
		return nil, nil, false
	}
	positive := dp.GetPositive().GetBucketCounts()
	if len(positive) == 0 {
		return nil, nil, false
	}

	base := math.Pow(2, math.Pow(2, -float64(dp.GetScale())))
	offset := int(dp.GetPositive().GetOffset())

	bounds := make([]float64, 0, len(positive)+1)
	for j := 0; j <= len(positive); j++ {
		bound := math.Pow(base, float64(offset+j))
		if math.IsInf(bound, 0) || math.IsNaN(bound) {
			return nil, nil, false
		}
		bounds = append(bounds, bound)
	}

	// counts[0] is everything at or below the first bound (the zero bucket);
	// the trailing slot is the +Inf overflow, empty by construction here.
	counts := make([]uint64, 0, len(positive)+2)
	counts = append(counts, dp.GetZeroCount())
	counts = append(counts, positive...)
	counts = append(counts, 0)
	return bounds, counts, true
}

// attachBuckets keeps an explicit histogram's bucket vector on the row so
// quantiles stay recoverable later; the flattened average cannot express a
// tail. A malformed vector is dropped and the row keeps its average only.
func attachBuckets(row *models.OtelMetric, bounds []float64, counts []uint64, temporality int) {
	if len(bounds) == 0 || len(counts) != len(bounds)+1 {
		return
	}
	row.BucketBounds = mustJSON(bounds)
	row.BucketCounts = mustJSON(counts)
	row.Temporality = temporality
}

func metricRow(name, metricType, unit string, value float64, count uint64, total float64, attrs []*commonpb.KeyValue, timeUnixNano uint64) models.OtelMetric {
	createdAt := time.Now()
	if timeUnixNano > 0 {
		createdAt = timeFromUnixNano(timeUnixNano)
	}
	return models.OtelMetric{
		MetricName:   name,
		MetricType:   metricType,
		Unit:         unit,
		Attributes:   mustJSON(attrsToMap(attrs)),
		Value:        value,
		Count:        count,
		Total:        total,
		TimeUnixNano: timeUnixNano,
		CreatedAt:    createdAt,
	}
}

type otelLogFields struct {
	traceID        string
	spanID         string
	severityNumber int
	timestamp      *time.Time
	observedAt     *time.Time
	attributes     json.RawMessage
}

func logRecordToEntry(record *logspb.LogRecord, resource map[string]interface{}) (models.LogIngestEntry, otelLogFields) {
	attrs := attrsToMap(record.GetAttributes())
	metadata := map[string]interface{}{
		"attributes": attrs,
		"resource":   resource,
	}

	severityNumber := int(record.GetSeverityNumber())
	level := severityNumberToLevel(severityNumber)
	message := anyValueToString(record.GetBody())
	if message == "" {
		message = record.GetSeverityText()
	}

	var timestamp *time.Time
	if record.GetTimeUnixNano() > 0 {
		t := timeFromUnixNano(record.GetTimeUnixNano())
		timestamp = &t
	}
	var observedAt *time.Time
	if record.GetObservedTimeUnixNano() > 0 {
		t := timeFromUnixNano(record.GetObservedTimeUnixNano())
		observedAt = &t
	}

	return models.LogIngestEntry{
			Level:    level,
			Message:  message,
			Metadata: metadata,
		}, otelLogFields{
			traceID:        bytesToHex(record.GetTraceId()),
			spanID:         bytesToHex(record.GetSpanId()),
			severityNumber: severityNumber,
			timestamp:      timestamp,
			observedAt:     observedAt,
			attributes:     mustJSON(attrs),
		}
}

func severityNumberToLevel(severityNumber int) models.LogLevel {
	switch {
	case severityNumber >= 17:
		return models.LogLevelError
	case severityNumber >= 13:
		return models.LogLevelWarn
	case severityNumber >= 9:
		return models.LogLevelInfo
	case severityNumber >= 5:
		return models.LogLevelDebug
	case severityNumber >= 1:
		return models.LogLevelTrace
	default:
		return models.LogLevelInfo
	}
}

func spanToModel(serviceID, agentID, serviceName string, resource json.RawMessage, span *tracepb.Span) models.Span {
	attrs := attrsToMap(span.GetAttributes())
	start := span.GetStartTimeUnixNano()
	end := span.GetEndTimeUnixNano()
	durationMs := 0
	if end > start {
		durationMs = int((end - start) / uint64(time.Millisecond))
	}

	return models.Span{
		ServiceID:     serviceID,
		AgentID:       agentID,
		ServiceName:   serviceName,
		TraceID:       bytesToHex(span.GetTraceId()),
		SpanID:        bytesToHex(span.GetSpanId()),
		ParentSpanID:  bytesToHex(span.GetParentSpanId()),
		Name:          span.GetName(),
		Kind:          spanKindString(span.GetKind()),
		StartUnixNano: start,
		EndUnixNano:   end,
		DurationMs:    durationMs,
		StatusCode:    spanStatusCodeString(span.GetStatus().GetCode()),
		StatusMessage: span.GetStatus().GetMessage(),
		Attributes:    mustJSON(attrs),
		Events:        mustJSON(spanEventsToSlice(span.GetEvents())),
		Links:         mustJSON(spanLinksToSlice(span.GetLinks())),
		Resource:      resource,
		CreatedAt:     time.Now(),
	}
}

// pathExcluded reports whether a request path matches any rule in the
// service's exclude list. Each rule is either an exact match (/health) or a
// prefix wildcard ending in "*" (/actuator/*). Empty list = nothing excluded.
func pathExcluded(path string, rules []string) bool {
	if path == "" || len(rules) == 0 {
		return false
	}
	for _, rule := range rules {
		if rule == "" {
			continue
		}
		if strings.HasSuffix(rule, "*") {
			prefix := strings.TrimSuffix(rule, "*")
			if strings.HasPrefix(path, prefix) {
				return true
			}
		} else if path == rule {
			return true
		}
	}
	return false
}

func spanToAPIRequest(serviceID, agentID, serviceName string, apiExcludePaths []string, span *tracepb.Span) (models.ApiRequest, bool) {
	if span.GetKind() != tracepb.Span_SPAN_KIND_SERVER {
		return models.ApiRequest{}, false
	}

	attrs := attrsToMap(span.GetAttributes())
	method := firstString(attrs, "http.request.method", "http.method")
	statusCode := firstInt(attrs, "http.response.status_code", "http.status_code")
	if method == "" || statusCode == 0 {
		return models.ApiRequest{}, false
	}

	path := firstString(attrs, "url.path", "http.target", "http.route")
	if path == "" {
		path = span.GetName()
	}
	if pathExcluded(path, apiExcludePaths) {
		return models.ApiRequest{}, false
	}
	route := firstString(attrs, "http.route")
	pathTemplate := route
	if pathTemplate == "" {
		pathTemplate = NormalizePath(path)
	}

	start := span.GetStartTimeUnixNano()
	end := span.GetEndTimeUnixNano()
	durationMs := 0
	if end > start {
		durationMs = int((end - start) / uint64(time.Millisecond))
		if durationMs == 0 {
			// Sub-millisecond spans carry real timing; floor-to-0 would render
			// as "unknown" (the frontend treats <=0 as no data — only synthetic
			// access-log spans, which genuinely lack duration, should show that).
			durationMs = 1
		}
	}

	errMsg := span.GetStatus().GetMessage()
	isError := statusCode >= 500 || span.GetStatus().GetCode() == tracepb.Status_STATUS_CODE_ERROR

	return models.ApiRequest{
		ServiceID:    serviceID,
		AgentID:      agentID,
		ServiceName:  serviceName,
		RequestID:    bytesToHex(span.GetSpanId()),
		TraceID:      bytesToHex(span.GetTraceId()),
		SpanID:       bytesToHex(span.GetSpanId()),
		Method:       strings.ToUpper(method),
		Path:         path,
		PathTemplate: pathTemplate,
		Route:        route,
		StatusCode:   statusCode,
		DurationMs:   durationMs,
		ClientIP:     firstString(attrs, "client.address", "net.peer.ip", "http.client_ip"),
		Error:        errMsg,
		IsError:      isError,
		CreatedAt:    timeFromUnixNano(start),
	}, true
}

func attrsToMap(attrs []*commonpb.KeyValue) map[string]interface{} {
	out := make(map[string]interface{}, len(attrs))
	for _, attr := range attrs {
		out[attr.GetKey()] = anyValueToInterface(attr.GetValue())
	}
	maskOTelAttrs(out)
	return out
}

func anyValueToInterface(v *commonpb.AnyValue) interface{} {
	switch val := v.GetValue().(type) {
	case *commonpb.AnyValue_StringValue:
		return val.StringValue
	case *commonpb.AnyValue_BoolValue:
		return val.BoolValue
	case *commonpb.AnyValue_IntValue:
		return val.IntValue
	case *commonpb.AnyValue_DoubleValue:
		return val.DoubleValue
	case *commonpb.AnyValue_BytesValue:
		return bytesToHex(val.BytesValue)
	case *commonpb.AnyValue_ArrayValue:
		items := val.ArrayValue.GetValues()
		out := make([]interface{}, 0, len(items))
		for _, item := range items {
			out = append(out, anyValueToInterface(item))
		}
		return out
	case *commonpb.AnyValue_KvlistValue:
		return attrsToMap(val.KvlistValue.GetValues())
	default:
		return nil
	}
}

func anyValueToString(v *commonpb.AnyValue) string {
	if v == nil {
		return ""
	}
	if s, ok := anyValueToInterface(v).(string); ok {
		return s
	}
	data, err := json.Marshal(anyValueToInterface(v))
	if err != nil {
		return fmt.Sprint(anyValueToInterface(v))
	}
	return string(data)
}

// maxStoredBodyBytes caps captured-body span events at ingest. Well-behaved
// clients truncate before export (EVERYUP_BODY_MAX_BYTES, default 8KiB); this
// is the server-side backstop against misconfigured or hostile senders filling
// the spans table within the 4MiB OTLP request limit.
const maxStoredBodyBytes = 64 << 10

func spanEventsToSlice(events []*tracepb.Span_Event) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(events))
	for _, event := range events {
		attrs := attrsToMap(event.GetAttributes())
		if capturedBodyEventNames[event.GetName()] {
			if body, ok := attrs["body"].(string); ok && len(body) > maxStoredBodyBytes {
				attrs["body"] = body[:maxStoredBodyBytes]
				attrs["body_truncated"] = true
			}
		}
		out = append(out, map[string]interface{}{
			"name":         event.GetName(),
			"timeUnixNano": event.GetTimeUnixNano(),
			"attributes":   attrs,
		})
	}
	return out
}

func spanLinksToSlice(links []*tracepb.Span_Link) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(links))
	for _, link := range links {
		out = append(out, map[string]interface{}{
			"traceId":    bytesToHex(link.GetTraceId()),
			"spanId":     bytesToHex(link.GetSpanId()),
			"traceState": link.GetTraceState(),
			"attributes": attrsToMap(link.GetAttributes()),
		})
	}
	return out
}

func firstString(m map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if v, ok := m[key]; ok {
			switch value := v.(type) {
			case string:
				return value
			case fmt.Stringer:
				return value.String()
			}
		}
	}
	return ""
}

func firstInt(m map[string]interface{}, keys ...string) int {
	for _, key := range keys {
		if v, ok := m[key]; ok {
			switch value := v.(type) {
			case int:
				return value
			case int64:
				return int(value)
			case float64:
				return int(value)
			case string:
				i, _ := strconv.Atoi(value)
				return i
			}
		}
	}
	return 0
}

func spanKindString(kind tracepb.Span_SpanKind) string {
	return strings.TrimPrefix(kind.String(), "SPAN_KIND_")
}

func spanStatusCodeString(code tracepb.Status_StatusCode) string {
	return strings.TrimPrefix(code.String(), "STATUS_CODE_")
}

func bytesToHex(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	return hex.EncodeToString(b)
}

func timeFromUnixNano(nano uint64) time.Time {
	return time.Unix(0, int64(nano)).UTC()
}

func mustJSON(v interface{}) json.RawMessage {
	data, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return data
}

func unauthorizedOTLP(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"success": false,
		"error": fiber.Map{
			"code":    "UNAUTHORIZED",
			"message": "Service not found in context",
		},
	})
}

// maxOTLPDecodedSize caps the size of a decompressed OTLP payload. Compressed
// payloads are already bounded by the Fiber BodyLimit, but a small gzipped
// body can expand orders of magnitude (gzip bomb). Anything beyond this limit
// is rejected before it can pressure memory.
const maxOTLPDecodedSize = 16 << 20 // 16 MiB

func readOTLPBody(c *fiber.Ctx) ([]byte, error) {
	body := c.Body()
	if !strings.EqualFold(c.Get("Content-Encoding"), "gzip") {
		return body, nil
	}
	if len(body) < 2 || body[0] != 0x1f || body[1] != 0x8b {
		// fasthttp may already decode compressed request bodies while leaving
		// the header intact; treat a non-gzip byte stream as already decoded.
		return body, nil
	}
	return decodeGzipOTLP(body)
}

func decodeGzipOTLP(body []byte) ([]byte, error) {
	reader, err := gzip.NewReader(bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("invalid gzip OTLP payload: %w", err)
	}
	defer reader.Close()

	// Read one byte past the limit so we can distinguish "exactly limit" from "exceeded".
	limited := io.LimitReader(reader, maxOTLPDecodedSize+1)
	decoded, err := io.ReadAll(limited)
	if err != nil {
		return nil, fmt.Errorf("failed to read gzip OTLP payload: %w", err)
	}
	if len(decoded) > maxOTLPDecodedSize {
		return nil, fmt.Errorf("gzip OTLP payload exceeds %d bytes after decompression", maxOTLPDecodedSize)
	}
	return decoded, nil
}

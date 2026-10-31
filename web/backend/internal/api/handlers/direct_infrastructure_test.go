package handlers_test

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
)

func TestDirectInfrastructureCollectorSetupProjectionAlertsAndDelete(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, projectResult := ts.doRequest(t, "POST", "/api/v1/projects", map[string]interface{}{"name": "Production"}, auth...)
	if !projectResult.Success {
		t.Fatalf("create project: %+v", projectResult.Error)
	}
	var project models.Project
	if err := json.Unmarshal(projectResult.Data, &project); err != nil {
		t.Fatal(err)
	}

	_, createResult := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources", map[string]interface{}{
		"name": "edge-host-01", "projectId": project.ID,
	}, auth...)
	if !createResult.Success {
		t.Fatalf("create infrastructure resource: %+v", createResult.Error)
	}
	var created models.InfrastructureResourceSetup
	if err := json.Unmarshal(createResult.Data, &created); err != nil {
		t.Fatal(err)
	}
	if created.Adapter != models.InfrastructureAdapterOTelCollector || created.ApiKey == "" {
		t.Fatalf("unexpected setup: %+v", created)
	}

	var agentCount int
	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM agents`).Scan(&agentCount); err != nil {
		t.Fatal(err)
	}
	if agentCount != 0 {
		t.Fatalf("collector setup created %d Agent rows, want 0", agentCount)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", created.ApiKey, &collectorlogspb.ExportLogsServiceRequest{}); status != 403 {
		t.Fatalf("infrastructure key logs status=%d, want 403", status)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/traces", created.ApiKey, &collectortracepb.ExportTraceServiceRequest{}); status != 403 {
		t.Fatalf("infrastructure key traces status=%d, want 403", status)
	}

	stamp := uint64(time.Now().UTC().UnixNano())
	request := &collectormetricspb.ExportMetricsServiceRequest{ResourceMetrics: []*metricspb.ResourceMetrics{{
		ScopeMetrics: []*metricspb.ScopeMetrics{{Metrics: []*metricspb.Metric{
			hostGauge("system.cpu.utilization", "1", 0.25, stamp, "state", "idle"),
			hostGauge("system.memory.usage", "By", 6*1024*1024*1024, stamp, "state", "used"),
			hostGauge("system.memory.usage", "By", 2*1024*1024*1024, stamp, "state", "free"),
			hostGauge("system.filesystem.usage", "By", 40*1024*1024*1024, stamp, "type", "used", "mountpoint", "/"),
			hostGauge("system.filesystem.usage", "By", 60*1024*1024*1024, stamp, "type", "free", "mountpoint", "/"),
		}}},
	}}}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/metrics", created.ApiKey, request); status != 200 {
		t.Fatalf("infrastructure metrics status=%d, want 200", status)
	}
	assertSetupReceipt(t, ts, token, "/api/v1/infrastructure-resources/"+created.ID, "infrastructure")

	latest, err := database.NewSystemMetricRepository().GetLatestByHost(created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if latest == nil || latest.CPUUsage != 75 || latest.MemUsage != 75 || latest.DiskUsage != 40 {
		t.Fatalf("unexpected projected host metric: %+v", latest)
	}

	_, listResult := ts.doRequest(t, "GET", "/api/v1/infrastructure-resources", nil, auth...)
	var resources []models.InfrastructureResource
	if err := json.Unmarshal(listResult.Data, &resources); err != nil {
		t.Fatal(err)
	}
	if len(resources) != 1 || resources[0].ID != created.ID || resources[0].CPUUsage == nil || *resources[0].CPUUsage != 75 {
		t.Fatalf("unexpected infrastructure list: %+v", resources)
	}

	_, infoResult := ts.doRequest(t, "GET", "/api/v1/hosts/"+created.ID+"/system/info", nil, auth...)
	var info models.SystemInfo
	if err := json.Unmarshal(infoResult.Data, &info); err != nil {
		t.Fatal(err)
	}
	if info.Hostname != "edge-host-01" || info.CPU.Usage != 75 || info.Memory.Usage != 75 || info.Disk.Usage != 40 {
		t.Fatalf("unexpected system info: %+v", info)
	}
	_, historyResult := ts.doRequest(t, "GET", "/api/v1/hosts/"+created.ID+"/system/metrics?range=1h", nil, auth...)
	if !historyResult.Success {
		t.Fatalf("get infrastructure history: %+v", historyResult.Error)
	}

	_, alertResult := ts.doRequest(t, "POST", "/api/v1/alert-rules", map[string]interface{}{
		"name": "edge CPU", "type": "resource", "agentId": created.ID,
		"metric": "cpu", "operator": "gt", "threshold": 70,
	}, auth...)
	if !alertResult.Success {
		t.Fatalf("create direct infrastructure alert: %+v", alertResult.Error)
	}
	rules, err := database.NewAlertRuleRepository().GetEnabledByAgentID(created.ID)
	if err != nil || len(rules) != 1 {
		t.Fatalf("direct infrastructure alert selection: rules=%+v err=%v", rules, err)
	}

	_, projectsResult := ts.doRequest(t, "GET", "/api/v1/projects", nil, auth...)
	var projects []models.Project
	if err := json.Unmarshal(projectsResult.Data, &projects); err != nil {
		t.Fatal(err)
	}
	if len(projects) != 1 || projects[0].InfrastructureResourceCount != 1 {
		t.Fatalf("project infrastructure count: %+v", projects)
	}

	_, rotateResult := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources/"+created.ID+"/rotate-key", nil, auth...)
	var rotated models.InfrastructureResourceSetup
	if err := json.Unmarshal(rotateResult.Data, &rotated); err != nil {
		t.Fatal(err)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/metrics", created.ApiKey, request); status != 401 {
		t.Fatalf("old collector key after rotation status=%d, want 401", status)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/metrics", rotated.ApiKey, request); status != 200 {
		t.Fatalf("rotated collector key status=%d, want 200", status)
	}
	_, revokeResult := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources/"+created.ID+"/revoke-key", nil, auth...)
	if !revokeResult.Success {
		t.Fatalf("revoke collector key: %+v", revokeResult.Error)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/metrics", rotated.ApiKey, request); status != 403 {
		t.Fatalf("revoked collector key status=%d, want 403", status)
	}

	deleteRequest := httptest.NewRequest("DELETE", "/api/v1/infrastructure-resources/"+created.ID, nil)
	deleteRequest.Header.Set(auth[0], auth[1])
	deleteResponse, err := ts.App.Test(deleteRequest, -1)
	if err != nil {
		t.Fatal(err)
	}
	deleteResponse.Body.Close()
	if deleteResponse.StatusCode != 204 {
		t.Fatalf("delete resource status=%d, want 204", deleteResponse.StatusCode)
	}
	for table, column := range map[string]string{"hosts": "id", "system_metrics": "host_id", "alert_rules": "agent_id"} {
		var count int
		if err := database.DB.QueryRow("SELECT COUNT(*) FROM "+table+" WHERE "+column+" = ?", created.ID).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatalf("%s rows after deletion = %d, want 0", table, count)
		}
	}
}

func TestDirectInfrastructureListOmitsUsageTheCollectorNeverSent(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, createResult := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources", map[string]interface{}{"name": "cpu-only"}, auth...)
	var created models.InfrastructureResourceSetup
	if err := json.Unmarshal(createResult.Data, &created); err != nil {
		t.Fatal(err)
	}
	stamp := uint64(time.Now().UTC().UnixNano())
	request := &collectormetricspb.ExportMetricsServiceRequest{ResourceMetrics: []*metricspb.ResourceMetrics{{
		ScopeMetrics: []*metricspb.ScopeMetrics{{Metrics: []*metricspb.Metric{
			hostGauge("system.cpu.utilization", "1", 0.75, stamp, "state", "idle"),
		}}},
	}}}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/metrics", created.ApiKey, request); status != 200 {
		t.Fatalf("metrics status=%d, want 200", status)
	}

	_, listResult := ts.doRequest(t, "GET", "/api/v1/infrastructure-resources", nil, auth...)
	var resources []models.InfrastructureResource
	if err := json.Unmarshal(listResult.Data, &resources); err != nil {
		t.Fatal(err)
	}
	_, detailResult := ts.doRequest(t, "GET", "/api/v1/infrastructure-resources/"+created.ID, nil, auth...)
	var detail models.InfrastructureResource
	if err := json.Unmarshal(detailResult.Data, &detail); err != nil {
		t.Fatal(err)
	}
	for _, resource := range []models.InfrastructureResource{resources[0], detail} {
		if resource.CPUUsage == nil || *resource.CPUUsage != 25 {
			t.Fatalf("cpuUsage = %v, want 25", resource.CPUUsage)
		}
		if resource.MemoryUsage != nil || resource.DiskUsage != nil {
			t.Fatalf("unsent usage reported: memory=%v disk=%v, want nil", resource.MemoryUsage, resource.DiskUsage)
		}
	}
}

func TestDirectInfrastructureNetworkRateRoundingAndUsageHistory(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, createResult := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources", map[string]interface{}{"name": "net-host"}, auth...)
	var created models.InfrastructureResourceSetup
	if err := json.Unmarshal(createResult.Data, &created); err != nil {
		t.Fatal(err)
	}
	const mib = 1024 * 1024
	start := time.Now().UTC().Add(-time.Minute)
	send := func(at time.Time, received, transmitted float64) {
		stamp := uint64(at.UnixNano())
		request := &collectormetricspb.ExportMetricsServiceRequest{ResourceMetrics: []*metricspb.ResourceMetrics{{
			ScopeMetrics: []*metricspb.ScopeMetrics{{Metrics: []*metricspb.Metric{
				hostGauge("system.memory.usage", "By", 6.123456*1024*mib, stamp, "state", "used"),
				hostGauge("system.memory.usage", "By", 2*1024*mib, stamp, "state", "free"),
				hostGauge("system.filesystem.usage", "By", 40*1024*mib, stamp, "type", "used", "mountpoint", "/"),
				hostGauge("system.filesystem.usage", "By", 60*1024*mib, stamp, "type", "free", "mountpoint", "/"),
				hostSum("system.network.io", "By", received, stamp, "device", "eth0", "direction", "receive"),
				hostSum("system.network.io", "By", transmitted, stamp, "device", "eth0", "direction", "transmit"),
				// Loopback traffic never leaves the host, so it is not the host's network.
				hostSum("system.network.io", "By", received*10, stamp, "device", "lo", "direction", "receive"),
			}}},
		}}}
		if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/metrics", created.ApiKey, request); status != 200 {
			t.Fatalf("metrics status=%d, want 200", status)
		}
	}
	send(start, 100*mib, 50*mib)
	send(start.Add(30*time.Second), 160*mib, 80*mib)

	latest, err := database.NewSystemMetricRepository().GetLatestByHost(created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if latest.NetIn != 2 || latest.NetOut != 1 {
		t.Fatalf("network rate in=%v out=%v MB/s, want 2 and 1", latest.NetIn, latest.NetOut)
	}
	if latest.MemUsed != 6.12 || latest.MemTotal != 8.12 {
		t.Fatalf("memory GiB used=%v total=%v, want 6.12 and 8.12", latest.MemUsed, latest.MemTotal)
	}

	_, historyResult := ts.doRequest(t, "GET", "/api/v1/hosts/"+created.ID+"/system/metrics?range=1h", nil, auth...)
	var history struct {
		Points []models.SystemMetricPoint `json:"points"`
	}
	if err := json.Unmarshal(historyResult.Data, &history); err != nil {
		t.Fatal(err)
	}
	if len(history.Points) == 0 || history.Points[0].DiskUsage != 40 || history.Points[0].MemUsage == 0 {
		t.Fatalf("history lacks usage percents: %+v", history.Points)
	}
}

func hostSum(name, unit string, value float64, stamp uint64, attributes ...string) *metricspb.Metric {
	gauge := hostGauge(name, unit, value, stamp, attributes...)
	return &metricspb.Metric{Name: name, Unit: unit, Data: &metricspb.Metric_Sum{Sum: &metricspb.Sum{
		DataPoints:             gauge.GetGauge().GetDataPoints(),
		AggregationTemporality: metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_CUMULATIVE,
		IsMonotonic:            true,
	}}}
}

func hostGauge(name, unit string, value float64, stamp uint64, attributes ...string) *metricspb.Metric {
	attrs := make([]*commonpb.KeyValue, 0, len(attributes)/2)
	for i := 0; i+1 < len(attributes); i += 2 {
		attrs = append(attrs, &commonpb.KeyValue{Key: attributes[i], Value: stringValue(attributes[i+1])})
	}
	return &metricspb.Metric{Name: name, Unit: unit, Data: &metricspb.Metric_Gauge{Gauge: &metricspb.Gauge{DataPoints: []*metricspb.NumberDataPoint{{
		Attributes: attrs, TimeUnixNano: stamp, Value: &metricspb.NumberDataPoint_AsDouble{AsDouble: value},
	}}}}}
}

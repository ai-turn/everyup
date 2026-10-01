package webclient

import (
	"context"
	"time"

	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	"google.golang.org/protobuf/proto"
)

// SendOTLPGauges posts one gauge point per service (service.name → value) to
// the web metrics endpoint, where it lands in that service's metrics view like
// any app-exported metric.
func (c *Client) SendOTLPGauges(ctx context.Context, name, unit string, values map[string]float64, at time.Time) error {
	if len(values) == 0 {
		return nil
	}
	req := &collectormetricspb.ExportMetricsServiceRequest{}
	for service, value := range values {
		req.ResourceMetrics = append(req.ResourceMetrics, &metricspb.ResourceMetrics{
			Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{{Key: "service.name", Value: stringValue(service)}}},
			ScopeMetrics: []*metricspb.ScopeMetrics{{Metrics: []*metricspb.Metric{{
				Name: name,
				Unit: unit,
				Data: &metricspb.Metric_Gauge{Gauge: &metricspb.Gauge{DataPoints: []*metricspb.NumberDataPoint{{
					TimeUnixNano: uint64(at.UnixNano()),
					Value:        &metricspb.NumberDataPoint_AsDouble{AsDouble: value},
				}}}},
			}}}},
		})
	}
	data, err := proto.Marshal(req)
	if err != nil {
		return err
	}
	return c.SendOTLPProtobuf(ctx, "metrics", data)
}

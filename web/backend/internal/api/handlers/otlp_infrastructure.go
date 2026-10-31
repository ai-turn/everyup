package handlers

import (
	"encoding/json"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/aiturn/everyup/internal/models"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
)

type filesystemUsage struct {
	used  float64
	total float64
}

// system.network.io is a running byte total, so a rate needs the previous batch's total.
type networkCounter struct {
	received, transmitted float64
	at                    time.Time
}

// ponytail: in-memory, so the first batch after a restart records 0 MB/s; persist the
// counters if that gap ever matters.
var (
	networkCountersMu sync.Mutex
	networkCounters   = map[string]networkCounter{}
)

func projectInfrastructureMetric(req *collectormetricspb.ExportMetricsServiceRequest, resourceID string) (*models.SystemMetric, int) {
	metric := &models.SystemMetric{HostID: resourceID, CreatedAt: time.Now()}
	cpuIdle := make([]float64, 0)
	cpuBusyByCore := make(map[string]float64)
	memStates := make(map[string]float64)
	filesystems := make(map[string]*filesystemUsage)
	var cpuDirect, memPercent, diskPercent *float64
	var network *networkCounter
	recognized := 0

	for _, resourceMetrics := range req.ResourceMetrics {
		for _, scopeMetrics := range resourceMetrics.ScopeMetrics {
			for _, otelMetric := range scopeMetrics.Metrics {
				rows, ok := flattenMetric(otelMetric)
				if !ok {
					continue
				}
				for _, row := range rows {
					attrs := map[string]interface{}{}
					_ = json.Unmarshal(row.Attributes, &attrs)
					state := strings.ToLower(firstMetricAttribute(attrs, "state", "type"))
					switch row.MetricName {
					case "system.cpu.utilization", "system.cpu.logical.utilization":
						recognized++
						value := ratioPercent(row.Value)
						if state == "idle" {
							cpuIdle = append(cpuIdle, value)
						} else if state == "" {
							cpuDirect = &value
						} else {
							core := firstMetricAttribute(attrs, "cpu.logical_number", "cpu")
							cpuBusyByCore[core] += value
						}
					case "system.cpu.usage":
						recognized++
						value := ratioPercent(row.Value)
						cpuDirect = &value
					case "system.memory.utilization":
						recognized++
						value := ratioPercent(row.Value)
						if state == "used" || state == "" {
							memPercent = &value
						} else if state == "free" && memPercent == nil {
							used := 100 - value
							memPercent = &used
						}
					case "system.memory.usage":
						recognized++
						memStates[state] += row.Value
					case "system.filesystem.utilization":
						recognized++
						if state == "used" || state == "" {
							value := ratioPercent(row.Value)
							if diskPercent == nil || value > *diskPercent {
								diskPercent = &value
							}
						}
					case "system.filesystem.usage":
						recognized++
						key := firstMetricAttribute(attrs, "mountpoint", "device")
						usage := filesystems[key]
						if usage == nil {
							usage = &filesystemUsage{}
							filesystems[key] = usage
						}
						usage.total += row.Value
						if state == "used" {
							usage.used += row.Value
						}
					case "system.network.io":
						recognized++
						if firstMetricAttribute(attrs, "device") == "lo" {
							continue
						}
						if network == nil {
							network = &networkCounter{}
						}
						switch firstMetricAttribute(attrs, "direction") {
						case "receive":
							network.received += row.Value
						case "transmit":
							network.transmitted += row.Value
						}
						if row.CreatedAt.After(network.at) {
							network.at = row.CreatedAt
						}
					}
					if row.CreatedAt.After(metric.CreatedAt) {
						metric.CreatedAt = row.CreatedAt
					}
				}
			}
		}
	}

	switch {
	case len(cpuIdle) > 0:
		metric.CPUUsage = clampPercent(100 - average(cpuIdle))
	case cpuDirect != nil:
		metric.CPUUsage = clampPercent(*cpuDirect)
	case len(cpuBusyByCore) > 0:
		values := make([]float64, 0, len(cpuBusyByCore))
		for _, value := range cpuBusyByCore {
			values = append(values, value)
		}
		metric.CPUUsage = clampPercent(average(values))
	}

	if len(memStates) > 0 {
		var total float64
		for _, value := range memStates {
			total += value
		}
		used := memStates["used"]
		if used == 0 {
			used = total - memStates["free"]
		}
		metric.MemTotal = bytesToGiB(total)
		metric.MemUsed = bytesToGiB(used)
		if total > 0 {
			metric.MemUsage = clampPercent(used / total * 100)
		}
	} else if memPercent != nil {
		metric.MemUsage = clampPercent(*memPercent)
	}

	for _, usage := range filesystems {
		if usage.total <= 0 {
			continue
		}
		percent := clampPercent(usage.used / usage.total * 100)
		if percent >= metric.DiskUsage {
			metric.DiskUsage = percent
			metric.DiskTotal = bytesToGiB(usage.total)
			metric.DiskUsed = bytesToGiB(usage.used)
		}
	}
	if diskPercent != nil && *diskPercent > metric.DiskUsage {
		metric.DiskUsage = clampPercent(*diskPercent)
	}
	if network != nil {
		metric.NetIn, metric.NetOut = networkRate(resourceID, *network)
	}
	return metric, recognized
}

// networkRate turns two consecutive byte totals into MB/s. A first batch or a counter
// reset (Collector restart) has nothing to subtract from and reads 0.
func networkRate(resourceID string, current networkCounter) (float64, float64) {
	networkCountersMu.Lock()
	previous, ok := networkCounters[resourceID]
	networkCounters[resourceID] = current
	networkCountersMu.Unlock()

	seconds := current.at.Sub(previous.at).Seconds()
	if !ok || seconds <= 0 || current.received < previous.received || current.transmitted < previous.transmitted {
		return 0, 0
	}
	return mbPerSecond(current.received-previous.received, seconds), mbPerSecond(current.transmitted-previous.transmitted, seconds)
}

func mbPerSecond(bytes, seconds float64) float64 {
	return math.Round(bytes/(1024*1024)/seconds*1000) / 1000
}

func fillMissingInfrastructureValues(metric, previous *models.SystemMetric) {
	if metric.CPUUsage == 0 {
		metric.CPUUsage = previous.CPUUsage
	}
	if metric.MemTotal == 0 {
		metric.MemTotal, metric.MemUsed = previous.MemTotal, previous.MemUsed
		if metric.MemUsage == 0 {
			metric.MemUsage = previous.MemUsage
		}
	}
	if metric.DiskTotal == 0 {
		metric.DiskTotal, metric.DiskUsed = previous.DiskTotal, previous.DiskUsed
		if metric.DiskUsage == 0 {
			metric.DiskUsage = previous.DiskUsage
		}
	}
}

func firstMetricAttribute(attrs map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := attrs[key].(string); ok && value != "" {
			return value
		}
	}
	return ""
}

func ratioPercent(value float64) float64 {
	if math.Abs(value) <= 1 {
		return value * 100
	}
	return value
}

func clampPercent(value float64) float64 {
	return math.Max(0, math.Min(100, value))
}

func average(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var total float64
	for _, value := range values {
		total += value
	}
	return total / float64(len(values))
}

// Two decimals — the gauges print this value as is.
func bytesToGiB(value float64) float64 {
	return math.Round(value/(1024*1024*1024)*100) / 100
}

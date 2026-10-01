package agent

import (
	"testing"

	"github.com/aiturn/everyup/agent/internal/discovery"
)

func TestThrottleSamplerRatioPerInterval(t *testing.T) {
	var s throttleSampler
	if got := s.sample(map[string]discovery.CPUThrottling{
		"c1": {ServiceName: "api", Periods: 100, ThrottledPeriods: 10},
	}); len(got) != 0 {
		t.Fatalf("first sample has no interval, got %v", got)
	}

	got := s.sample(map[string]discovery.CPUThrottling{
		"c1": {ServiceName: "api", Periods: 300, ThrottledPeriods: 60},  // 50/200 = 25%
		"c2": {ServiceName: "worker", Periods: 50, ThrottledPeriods: 5}, // new replica, no baseline
	})
	if len(got) != 1 || got["api"] != 25 {
		t.Fatalf("got %v, want api=25", got)
	}

	got = s.sample(map[string]discovery.CPUThrottling{
		"c1": {ServiceName: "api", Periods: 300, ThrottledPeriods: 60},    // idle: 0 periods ran
		"c2": {ServiceName: "worker", Periods: 150, ThrottledPeriods: 85}, // 80/100 = 80%
		"c3": {ServiceName: "api", Periods: 10, ThrottledPeriods: 0},      // recreated, no baseline
	})
	if got["api"] != 0 || got["worker"] != 80 {
		t.Fatalf("got %v, want api=0 worker=80", got)
	}
}

// Replicas report the worst one; an average would hide a throttled replica.
func TestThrottleSamplerTakesMaxAcrossReplicas(t *testing.T) {
	s := throttleSampler{prev: map[string]discovery.CPUThrottling{
		"a": {ServiceName: "api", Periods: 0},
		"b": {ServiceName: "api", Periods: 0},
	}}
	got := s.sample(map[string]discovery.CPUThrottling{
		"a": {ServiceName: "api", Periods: 100, ThrottledPeriods: 5},
		"b": {ServiceName: "api", Periods: 100, ThrottledPeriods: 70},
	})
	if got["api"] != 70 {
		t.Fatalf("api = %v, want 70", got["api"])
	}
}

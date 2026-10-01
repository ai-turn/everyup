package agent

import (
	"context"
	"log"
	"time"

	"github.com/aiturn/everyup/agent/internal/discovery"
)

// cpuThrottledMetric is the share of CFS periods a container spent stopped at
// its CPU limit. CPU usage never shows this: it records time spent running, not
// time spent waiting for the next period — yet it stretches tail latency.
const cpuThrottledMetric = "container.cpu.throttled"

// throttleSampler turns Docker's cumulative counters into a per-sync ratio.
type throttleSampler struct {
	prev map[string]discovery.CPUThrottling
}

// sample returns throttled % per service since the previous sample. Replicas
// of one service report their maximum: an average would hide the one replica
// that is being throttled.
func (s *throttleSampler) sample(cur map[string]discovery.CPUThrottling) map[string]float64 {
	out := make(map[string]float64)
	for id, c := range cur {
		p, ok := s.prev[id]
		if !ok || c.Periods < p.Periods || c.ThrottledPeriods < p.ThrottledPeriods {
			continue // first sight or counters restarted — no interval to judge
		}
		ratio := 0.0
		if periods := c.Periods - p.Periods; periods > 0 {
			ratio = float64(c.ThrottledPeriods-p.ThrottledPeriods) * 100 / float64(periods)
		}
		if prev, seen := out[c.ServiceName]; !seen || ratio > prev {
			out[c.ServiceName] = ratio
		}
	}
	s.prev = cur
	return out
}

func (a *Agent) flushContainerThrottling(ctx context.Context) {
	if a.docker == nil || a.web == nil || !a.web.Enabled() {
		return
	}
	counters, err := a.docker.CPUThrottlingMap(ctx)
	if err != nil {
		log.Printf("container CPU throttling collection failed: %v", err)
		return
	}
	ratios := a.throttle.sample(counters)
	if err := a.web.SendOTLPGauges(ctx, cpuThrottledMetric, "%", ratios, time.Now()); err != nil {
		log.Printf("EveryUp Web throttling metrics sync failed: %v", err)
	}
}

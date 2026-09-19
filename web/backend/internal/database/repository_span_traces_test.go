package database_test

import (
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

const msNano = uint64(time.Millisecond)

// ListTraces is the only way to reach a trace the api_requests projection drops
// (it keeps HTTP SERVER spans with a method and status). These fixtures are
// deliberately non-HTTP for that reason.
func TestSpanRepo_ListTraces(t *testing.T) {
	openTestDB(t)
	repo := database.NewSpanRepository()
	now := time.Now()

	span := func(traceID, spanID, parent, name, kind, status string, startMs, durMs uint64, at time.Time) models.Span {
		start := uint64(at.UnixNano()) + startMs*msNano
		return models.Span{
			AgentID: "agent-x", ServiceName: "api",
			TraceID: traceID, SpanID: spanID, ParentSpanID: parent,
			Name: name, Kind: kind, StatusCode: status,
			StartUnixNano: start, EndUnixNano: start + durMs*msNano,
			DurationMs: int(durMs), CreatedAt: at,
		}
	}

	recent := now.Add(-time.Minute)
	older := now.Add(-10 * time.Minute)
	if _, err := repo.CreateBatch([]models.Span{
		// A Kafka consumer trace: no HTTP method, so api_requests never sees it.
		span("t-consumer", "s1", "", "orders.process", "CONSUMER", "OK", 0, 900, recent),
		span("t-consumer", "s2", "s1", "db.insert", "CLIENT", "OK", 100, 400, recent),
		// A failing batch job, slowest of the three.
		span("t-batch", "s3", "", "nightly.reconcile", "INTERNAL", "ERROR", 0, 4000, recent),
		// An older, fast trace whose root belongs to an uncollected upstream:
		// every stored span has a parent, so a root-only query would miss it.
		span("t-orphan", "s4", "upstream-span", "grpc.Charge", "SERVER", "OK", 0, 120, older),
	}); err != nil {
		t.Fatalf("CreateBatch: %v", err)
	}

	scope := func() *models.TraceFilter {
		return &models.TraceFilter{AgentID: "agent-x", ServiceName: "api"}
	}

	t.Run("collapses spans into one row per trace", func(t *testing.T) {
		traces, err := repo.ListTraces(scope())
		if err != nil {
			t.Fatalf("ListTraces: %v", err)
		}
		if len(traces) != 3 {
			t.Fatalf("got %d traces, want 3: %+v", len(traces), traces)
		}
		// Newest first: the two recent traces precede the older one.
		if traces[2].TraceID != "t-orphan" {
			t.Errorf("oldest trace = %s, want t-orphan", traces[2].TraceID)
		}
		byID := map[string]models.TraceSummary{}
		for _, trace := range traces {
			byID[trace.TraceID] = trace
		}
		consumer := byID["t-consumer"]
		if consumer.SpanCount != 2 {
			t.Errorf("t-consumer spanCount = %d, want 2", consumer.SpanCount)
		}
		// Trace duration spans the earliest start to the latest end (100+400 < 900).
		if consumer.DurationMs != 900 {
			t.Errorf("t-consumer duration = %dms, want 900", consumer.DurationMs)
		}
		if consumer.Name != "orders.process" || consumer.Kind != "CONSUMER" {
			t.Errorf("t-consumer described by %q/%q, want orders.process/CONSUMER", consumer.Name, consumer.Kind)
		}
		if consumer.ErrorCount != 0 {
			t.Errorf("t-consumer errorCount = %d, want 0", consumer.ErrorCount)
		}
		// Reachable although no stored span is the trace root.
		if byID["t-orphan"].Name != "grpc.Charge" {
			t.Errorf("orphan trace missing or misnamed: %+v", byID["t-orphan"])
		}
		if byID["t-batch"].ErrorCount != 1 {
			t.Errorf("t-batch errorCount = %d, want 1", byID["t-batch"].ErrorCount)
		}
	})

	t.Run("slowest first", func(t *testing.T) {
		filter := scope()
		filter.SortBySlowest = true
		traces, err := repo.ListTraces(filter)
		if err != nil {
			t.Fatalf("ListTraces: %v", err)
		}
		if traces[0].TraceID != "t-batch" || traces[0].DurationMs != 4000 {
			t.Fatalf("slowest = %+v, want t-batch at 4000ms", traces[0])
		}
	})

	t.Run("errors only", func(t *testing.T) {
		filter := scope()
		filter.ErrorsOnly = true
		traces, err := repo.ListTraces(filter)
		if err != nil {
			t.Fatalf("ListTraces: %v", err)
		}
		if len(traces) != 1 || traces[0].TraceID != "t-batch" {
			t.Fatalf("got %+v, want only t-batch", traces)
		}
	})

	t.Run("minimum duration", func(t *testing.T) {
		filter := scope()
		filter.MinDurationMs = 1000
		traces, err := repo.ListTraces(filter)
		if err != nil {
			t.Fatalf("ListTraces: %v", err)
		}
		if len(traces) != 1 || traces[0].TraceID != "t-batch" {
			t.Fatalf("got %+v, want only t-batch over 1000ms", traces)
		}
	})

	t.Run("time window", func(t *testing.T) {
		filter := scope()
		filter.From = now.Add(-5 * time.Minute)
		traces, err := repo.ListTraces(filter)
		if err != nil {
			t.Fatalf("ListTraces: %v", err)
		}
		if len(traces) != 2 {
			t.Fatalf("got %d traces, want the 2 recent ones: %+v", len(traces), traces)
		}
	})

	t.Run("other services are not visible", func(t *testing.T) {
		filter := scope()
		filter.ServiceName = "other"
		traces, err := repo.ListTraces(filter)
		if err != nil {
			t.Fatalf("ListTraces: %v", err)
		}
		if len(traces) != 0 {
			t.Fatalf("got %+v, want none", traces)
		}
	})
}

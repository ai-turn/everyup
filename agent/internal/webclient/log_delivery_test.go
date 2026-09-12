package webclient

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	"google.golang.org/protobuf/proto"
)

func TestLogsSplitBelowBackendLimit(t *testing.T) {
	count := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		data, _ := io.ReadAll(r.Body)
		if len(data) > 4<<20 {
			w.WriteHeader(413)
			return
		}
		var req collectorlogspb.ExportLogsServiceRequest
		if err := proto.Unmarshal(data, &req); err != nil {
			t.Error(err)
			return
		}
		for _, resource := range req.ResourceLogs {
			for _, scope := range resource.ScopeLogs {
				count += len(scope.LogRecords)
			}
		}
	}))
	defer server.Close()
	client := New(server.URL, "test", time.Second, nil)
	batch := OTLPLogBatch{ServiceName: "api"}
	for i := 0; i < 600; i++ {
		batch.Entries = append(batch.Entries, OTLPLogEntry{Body: strings.Repeat("a", 8192)})
	}
	if err := client.SendOTLPLogs(t.Context(), []OTLPLogBatch{batch}); err != nil {
		t.Fatal(err)
	}
	if count != 600 {
		t.Fatalf("received %d, want 600", count)
	}
}

func TestLogBatchAcknowledgesOnlySuccessfulRequests(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		if requests == 2 {
			w.WriteHeader(503)
		}
	}))
	defer server.Close()
	client := New(server.URL, "test", time.Second, nil)
	batch := OTLPLogBatch{ServiceName: "api"}
	for i := 0; i < 600; i++ {
		batch.Entries = append(batch.Entries, OTLPLogEntry{Body: strings.Repeat("a", 8192)})
	}
	accepted := 0
	err := client.SendOTLPLogBatch(t.Context(), batch, func(count int) error { accepted = count; return nil })
	if err == nil || accepted != 300 || requests != 2 {
		t.Fatalf("accepted=%d requests=%d error=%v", accepted, requests, err)
	}
}

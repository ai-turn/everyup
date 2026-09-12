package agent

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/aiturn/everyup/agent/internal/config"
	"github.com/aiturn/everyup/agent/internal/discovery"
	"github.com/aiturn/everyup/agent/internal/state"
	"github.com/aiturn/everyup/agent/internal/webclient"
	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	"google.golang.org/protobuf/proto"
)

func TestLongKoreanLogDelivery(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	defer server.Close()
	client := webclient.New(server.URL, "test", time.Second, nil)
	for _, body := range []string{strings.Repeat("한", 3000), "broken\xfflog"} {
		if err := client.SendOTLPLogs(t.Context(), []webclient.OTLPLogBatch{{ServiceName: "api", Entries: []webclient.OTLPLogEntry{{Body: trimText(body, 8192)}}}}); err != nil {
			t.Fatal(err)
		}
	}
}

func TestContainerLogsResumeAfterPartialFailureAndRestart(t *testing.T) {
	stamp := time.Date(2026, 9, 12, 0, 0, 0, 0, time.UTC)
	counts := map[string]int{"one": 251, "two": 251}
	docker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := strings.Split(r.URL.Path, "/")[2]
		if r.URL.Query().Get("tail") != "all" {
			t.Error("resume must read all remaining logs")
		}
		for i := 0; i < counts[id]; i++ {
			fmt.Fprintf(w, "%s %s-%d\n", stamp.Format(time.RFC3339Nano), id, i)
		}
	}))
	defer docker.Close()
	received := make(map[string]int)
	requests := 0
	web := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		if requests == 2 {
			w.WriteHeader(503)
			return
		}
		data, _ := io.ReadAll(r.Body)
		var req collectorlogspb.ExportLogsServiceRequest
		if err := proto.Unmarshal(data, &req); err != nil {
			t.Error(err)
			return
		}
		for _, resource := range req.ResourceLogs {
			for _, scope := range resource.ScopeLogs {
				for _, record := range scope.LogRecords {
					received[record.Body.GetStringValue()]++
				}
			}
		}
	}))
	defer web.Close()
	cfg := config.Config{DataDir: t.TempDir(), DockerDiscoveryEnabled: true, DockerLogsEnabled: true, DockerLogTailLines: 100, DockerSocketPath: "tcp://" + strings.TrimPrefix(docker.URL, "http://"), WebBaseURL: web.URL, AgentAPIKey: "test", HTTPTimeout: 5 * time.Second}
	a, _ := New(cfg)
	targets := []discovery.Target{{ID: "one", Key: "app:api", ServiceName: "api"}, {ID: "two", Key: "app:api", ServiceName: "api"}}
	for _, target := range targets {
		if err := a.persistLogCursor(target.ID, state.LogCursor{At: stamp}); err != nil {
			t.Fatal(err)
		}
	}
	a.forwardDockerLogs(t.Context(), targets)
	if a.logCursors["one"].Count != 100 || a.logCursors["two"].Count != 251 {
		t.Fatalf("wrong acknowledged cursors: %+v", a.logCursors)
	}
	restarted, _ := New(cfg)
	if err := restarted.loadState(); err != nil {
		t.Fatal(err)
	}
	counts["two"]++ // A new, distinct record at the exact same timestamp.
	restarted.forwardDockerLogs(t.Context(), targets)
	for id, count := range counts {
		for i := 0; i < count; i++ {
			key := id + "-" + strconv.Itoa(i)
			if received[key] != 1 {
				t.Fatalf("%s delivered %d times", key, received[key])
			}
		}
	}
}

func TestInitialFailureResumesBeyondTail(t *testing.T) {
	stamp := time.Date(2026, 9, 12, 0, 0, 0, 0, time.UTC)
	count := 100
	docker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		first := 0
		if r.URL.Query().Get("tail") == "100" {
			first = max(0, count-100)
		}
		for i := first; i < count; i++ {
			fmt.Fprintf(w, "%s line-%d\n", stamp.Add(time.Duration(i)*time.Millisecond).Format(time.RFC3339Nano), i)
		}
	}))
	defer docker.Close()
	fail := true
	received := 0
	web := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if fail {
			w.WriteHeader(503)
			return
		}
		data, _ := io.ReadAll(r.Body)
		var req collectorlogspb.ExportLogsServiceRequest
		if err := proto.Unmarshal(data, &req); err != nil {
			t.Error(err)
		}
		for _, resource := range req.ResourceLogs {
			for _, scope := range resource.ScopeLogs {
				received += len(scope.LogRecords)
			}
		}
	}))
	defer web.Close()
	a, _ := New(config.Config{DataDir: t.TempDir(), DockerDiscoveryEnabled: true, DockerLogsEnabled: true, DockerLogTailLines: 100, DockerSocketPath: "tcp://" + strings.TrimPrefix(docker.URL, "http://"), WebBaseURL: web.URL, AgentAPIKey: "test", HTTPTimeout: 5 * time.Second})
	target := discovery.Target{ID: "one", Key: "api", ServiceName: "api"}
	if err := a.forwardContainerLogs(t.Context(), target); err == nil {
		t.Fatal("expected delivery failure")
	}
	count = 250
	fail = false
	if err := a.forwardContainerLogs(t.Context(), target); err != nil {
		t.Fatal(err)
	}
	if received != 250 {
		t.Fatalf("received %d, want 250", received)
	}
}

func TestDiscoveryFailurePreservesCursors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) }))
	defer server.Close()
	a, _ := New(config.Config{DataDir: t.TempDir(), DockerDiscoveryEnabled: true, DockerSocketPath: "tcp://" + strings.TrimPrefix(server.URL, "http://"), HTTPTimeout: time.Second})
	a.states["api"] = &targetState{serviceName: "api"}
	a.logCursors["one"] = state.LogCursor{At: time.Now(), Count: 1}
	a.runChecks(t.Context())
	if len(a.states) != 1 || len(a.logCursors) != 1 {
		t.Fatal("discovery failure erased state")
	}
}

func TestReplicaHealthUsesUnhealthyMember(t *testing.T) {
	targets := []discovery.Target{{ID: "one", Key: "api", HealthType: "docker", State: "exited"}, {ID: "two", Key: "api", HealthType: "docker", State: "running"}}
	for i := 0; i < 2; i++ {
		checks := healthCheckTargets(targets)
		if len(checks) != 1 || checks[0].State != "exited" {
			t.Fatalf("unexpected replica health: %+v", checks)
		}
		targets[0], targets[1] = targets[1], targets[0]
	}
}

func TestLogCursorSaveFailureDoesNotAdvance(t *testing.T) {
	a, _ := New(config.Config{DataDir: t.TempDir()})
	// A path under an existing regular file cannot be used as a state directory.
	file := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(file, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	a.store = state.NewStore(filepath.Join(file, "state.json"))
	if err := a.persistLogCursor("one", state.LogCursor{At: time.Now()}); err == nil {
		t.Fatal("expected save failure")
	}
	if len(a.logCursors) != 0 {
		t.Fatal("failed persistence advanced cursor")
	}
}

func TestReplicaCollectionTargets(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `[{"Id":"one","Names":["/app-api-1"],"Labels":{"com.docker.compose.project":"app","com.docker.compose.service":"api"}},{"Id":"two","Names":["/app-api-2"],"Labels":{"com.docker.compose.project":"app","com.docker.compose.service":"api"}}]`)
	}))
	defer server.Close()
	a, _ := New(config.Config{DockerDiscoveryEnabled: true, DockerSocketPath: "tcp://" + strings.TrimPrefix(server.URL, "http://"), HTTPTimeout: time.Second})
	if got := len(a.targets(t.Context())); got != 2 {
		t.Fatalf("collected %d of 2 replicas", got)
	}
}

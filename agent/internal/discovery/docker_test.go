package discovery

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func TestTargetFromContainerUsesComposeServiceName(t *testing.T) {
	target := TargetFromContainer("abcdef1234567890", "shop-api-1", map[string]string{
		ComposeProjectLabel: "shop",
		ComposeServiceLabel: "api",
	})
	if target.ServiceName != "api" {
		t.Fatalf("ServiceName = %q, want api", target.ServiceName)
	}
	if target.Key != "shop:api" {
		t.Fatalf("Key = %q, want shop:api", target.Key)
	}
	if target.HealthType != "docker" {
		t.Fatalf("HealthType = %q, want docker", target.HealthType)
	}
}

func TestTargetFromContainerUsesContainerNameWithoutLabels(t *testing.T) {
	target := TargetFromContainer("abcdef1234567890", "demo-prod", nil)
	if target.ServiceName != "demo-prod" {
		t.Fatalf("ServiceName = %q, want demo-prod", target.ServiceName)
	}
	if target.Key != "demo-prod" {
		t.Fatalf("Key = %q, want demo-prod", target.Key)
	}
	if target.ID != "abcdef1234567890" {
		t.Fatalf("ID = %q", target.ID)
	}
}

func TestTargetFromContainerFallsBackToShortID(t *testing.T) {
	target := TargetFromContainer("abcdef1234567890", "", nil)
	if target.ServiceName != "abcdef123456" {
		t.Fatalf("ServiceName = %q, want short ID", target.ServiceName)
	}
	if target.Key != "abcdef1234567890" {
		t.Fatalf("Key = %q, want full ID fallback", target.Key)
	}
}

func TestSplitDockerLogLinesPlainText(t *testing.T) {
	lines := splitDockerLogLines([]byte("one\n\ntwo\r\n"))
	if len(lines) != 2 || lines[0] != "one" || lines[1] != "two" {
		t.Fatalf("lines = %#v", lines)
	}
}

func TestSplitDockerLogLinesStripsMultiplexHeaders(t *testing.T) {
	payload := []byte{
		1, 0, 0, 0, 0, 0, 0, 4,
		'o', 'n', 'e', '\n',
		2, 0, 0, 0, 0, 0, 0, 4,
		't', 'w', 'o', '\n',
	}
	lines := splitDockerLogLines(payload)
	if len(lines) != 2 || lines[0] != "one" || lines[1] != "two" {
		t.Fatalf("lines = %#v", lines)
	}
}

func TestNewDockerClientAcceptsTCPProxyPath(t *testing.T) {
	client := NewDockerClient("tcp://docker-socket-proxy:2375", 0)
	if client.socketPath != "tcp://docker-socket-proxy:2375" {
		t.Fatalf("socketPath = %q", client.socketPath)
	}
}

func TestContainerStateByName(t *testing.T) {
	client := NewDockerClient("tcp://unused", 0)
	client.client.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		body := io.NopCloser(strings.NewReader(`[{"Id":"1","Names":["/everyup-ebpf"],"State":"running"}]`))
		return &http.Response{StatusCode: http.StatusOK, Body: body, Header: make(http.Header)}, nil
	})

	state, found, err := client.ContainerStateByName(t.Context(), "everyup-ebpf")
	if err != nil || !found || state != "running" {
		t.Fatalf("state=%q found=%t err=%v", state, found, err)
	}
}

func TestCPUThrottlingMapSkipsUnlimitedAndStopped(t *testing.T) {
	client := NewDockerClient("tcp://unused", 0)
	client.client.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		body := `[{"Id":"lim","Names":["/p-api-1"],"State":"running","Labels":{"com.docker.compose.service":"api"}},` +
			`{"Id":"free","Names":["/db"],"State":"running"},{"Id":"down","Names":["/old"],"State":"exited"}]`
		switch req.URL.Path {
		case "/containers/lim/stats":
			body = `{"cpu_stats":{"throttling_data":{"periods":120,"throttled_periods":30}}}`
		case "/containers/free/stats":
			body = `{"cpu_stats":{"throttling_data":{"periods":0,"throttled_periods":0}}}`
		case "/containers/down/stats":
			t.Errorf("stats requested for a stopped container")
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	got, err := client.CPUThrottlingMap(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got["lim"] != (CPUThrottling{ServiceName: "api", Periods: 120, ThrottledPeriods: 30}) {
		t.Fatalf("got %+v", got)
	}
}

func TestServiceIPMapIdentifiesObserverByContainerName(t *testing.T) {
	client := NewDockerClient("tcp://unused", 0)
	client.client.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		body := `[{"Id":"1","Names":["/everyup-ebpf"],"State":"running","NetworkSettings":{"Networks":{"mon":{"IPAddress":"172.19.0.2","GlobalIPv6Address":"fd00::2"}}}},` +
			`{"Id":"2","Names":["/app"],"State":"running","Labels":{"com.docker.compose.service":"everyup-ebpf"},"NetworkSettings":{"Networks":{"mon":{"IPAddress":"172.19.0.3"}}}}]`
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	services, observers, err := client.ServiceIPMap(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if services["172.19.0.2"] != "everyup-ebpf" || services["fd00::2"] != "everyup-ebpf" || !observers["172.19.0.2"] || !observers["fd00::2"] || observers["172.19.0.3"] {
		t.Fatalf("services=%v observers=%v", services, observers)
	}
}

func TestParseDockerLogLinesWithTimestamp(t *testing.T) {
	lines := parseDockerLogLines([]byte("2026-06-26T01:02:03.000000004Z hello world\nplain line\n"))
	if len(lines) != 2 {
		t.Fatalf("lines = %#v", lines)
	}
	if lines[0].Time.IsZero() || lines[0].Message != "hello world" {
		t.Fatalf("first line = %#v", lines[0])
	}
	if !lines[1].Time.IsZero() || lines[1].Message != "plain line" {
		t.Fatalf("second line = %#v", lines[1])
	}
}

func TestParseTopRows(t *testing.T) {
	titles := []string{"UID", "PID", "PPID", "CMD"}
	processes := [][]string{
		{"root", "768", "740", "java -jar /app.jar"},
		{"root", "not-a-pid", "740", "zombie"},
		{"root", "801"}, // short row: PID column present, CMD missing
		{"root"},        // short row: PID column missing, skipped
	}
	pids, cmds := parseTopRows(titles, processes)
	if len(pids) != 2 || pids[0] != 768 || pids[1] != 801 {
		t.Fatalf("pids = %v, want [768 801]", pids)
	}
	if len(cmds) != 2 || cmds[0] != "java -jar /app.jar" {
		t.Fatalf("cmds = %v", cmds)
	}

	if pids, _ := parseTopRows([]string{"UID", "CMD"}, processes); pids != nil {
		t.Fatalf("no PID column should yield nil, got %v", pids)
	}
}

func TestDetectRuntime(t *testing.T) {
	cases := []struct {
		image string
		cmds  []string
		want  string
	}{
		{"mycompany/api:1.2", []string{"java -jar /app.jar"}, "java"}, // custom image, cmd wins
		{"mycompany/web:latest", []string{"sh -c start", "/usr/bin/node server.js"}, "node"},
		{"backend:2", []string{"gunicorn app:app -w 4"}, "python"},
		{"tool:1", []string{"/usr/local/bin/python3.12 -m http.server"}, "python"},
		{"eclipse-temurin:17-jre", nil, "java"},            // image fallback
		{"node:20-alpine", []string{"/whoami"}, "node"},    // unknown cmd -> image
		{"traefik/whoami:latest", []string{"/whoami"}, ""}, // Go binary: unknown, by design
		{"python:3.12", nil, "python"},
		{"mcr.microsoft.com/dotnet/aspnet:8.0", nil, "dotnet"},
	}
	for _, tc := range cases {
		if got := detectRuntime(tc.image, tc.cmds); got != tc.want {
			t.Fatalf("detectRuntime(%q, %v) = %q, want %q", tc.image, tc.cmds, got, tc.want)
		}
	}
}

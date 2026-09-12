package discovery

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestIncrementalLogsNotLimitedToTail(t *testing.T) {
	c := NewDockerClient("", time.Second)
	c.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		count := 150
		if r.URL.Query().Get("tail") != "all" {
			count = 100
		}
		var body strings.Builder
		for i := 0; i < count; i++ {
			fmt.Fprintf(&body, "2026-09-12T00:00:01Z line%d\n", i)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body.String()))}, nil
	})
	count := 0
	err := c.ReadLogsSince(t.Context(), "one", time.Now().Add(-time.Minute), 100, func(DockerLogLine) error { count++; return nil })
	if err != nil {
		t.Fatal(err)
	}
	if count != 150 {
		t.Fatalf("read %d of 150 incremental logs", count)
	}
}

func TestDockerLogStreamBeyondFourMiB(t *testing.T) {
	var stream bytes.Buffer
	for i := 0; i < 700; i++ {
		line := fmt.Sprintf("2026-09-12T00:00:01Z %s-%d\n", strings.Repeat("a", 8192), i)
		writeLogFrame(&stream, []byte(line))
	}
	count := 0
	err := readDockerLogs(&stream, func(line DockerLogLine) error {
		count++
		if line.Time.IsZero() {
			t.Error("lost timestamp")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if count != 700 {
		t.Fatalf("read %d of 700 logs", count)
	}
}

func TestDockerLogStreamFrameBoundaries(t *testing.T) {
	var stream bytes.Buffer
	writeLogFrame(&stream, []byte("2026-09-12T00:00:01Z hel"))
	writeLogFrame(&stream, []byte("lo\n2026-09-12T00:00:02Z world\n"))
	var messages []string
	if err := readDockerLogs(&stream, func(line DockerLogLine) error { messages = append(messages, line.Message); return nil }); err != nil {
		t.Fatal(err)
	}
	if strings.Join(messages, ",") != "hello,world" {
		t.Fatalf("messages=%v", messages)
	}
}

func TestDockerLogStreamRejectsIncompleteFrame(t *testing.T) {
	var stream bytes.Buffer
	writeLogFrame(&stream, []byte("2026-09-12T00:00:01Z incomplete\n"))
	data := stream.Bytes()
	count := 0
	err := readDockerLogs(bytes.NewReader(data[:len(data)-5]), func(DockerLogLine) error { count++; return nil })
	if err == nil || count != 0 {
		t.Fatalf("incomplete frame: count=%d err=%v", count, err)
	}
}

func TestDockerLogStreamDrainsOversizedLine(t *testing.T) {
	input := "2026-09-12T00:00:01Z " + strings.Repeat("x", 2<<20) + "\n2026-09-12T00:00:02Z next\n"
	var messages []string
	if err := readDockerLogs(strings.NewReader(input), func(line DockerLogLine) error { messages = append(messages, line.Message); return nil }); err != nil {
		t.Fatal(err)
	}
	if len(messages) != 2 || len(messages[0]) > 64<<10 || messages[1] != "next" {
		t.Fatal("oversized record corrupted following line")
	}
}

func writeLogFrame(buffer *bytes.Buffer, payload []byte) {
	var header [8]byte
	header[0] = 1
	binary.BigEndian.PutUint32(header[4:], uint32(len(payload)))
	buffer.Write(header[:])
	buffer.Write(payload)
}

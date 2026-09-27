package state

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type AuditLogger struct {
	path string
	mu   sync.Mutex
}

type AuditEvent struct {
	Time        time.Time              `json:"time"`
	Type        string                 `json:"type"`
	ServiceName string                 `json:"serviceName,omitempty"`
	TargetKey   string                 `json:"targetKey,omitempty"`
	Message     string                 `json:"message,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

func NewAuditLogger(path string) *AuditLogger {
	return &AuditLogger{path: path}
}

func (l *AuditLogger) Append(event AuditEvent) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.path == "" {
		return nil
	}
	if event.Time.IsZero() {
		event.Time = time.Now()
	}

	if err := os.MkdirAll(filepath.Dir(l.path), 0o755); err != nil {
		return fmt.Errorf("create audit directory: %w", err)
	}

	file, err := os.OpenFile(l.path, os.O_CREATE|os.O_APPEND|os.O_RDWR, 0o644)
	if err != nil {
		return fmt.Errorf("open audit file: %w", err)
	}
	defer file.Close()
	if info, err := file.Stat(); err != nil {
		return fmt.Errorf("stat audit file: %w", err)
	} else if info.Size() > 0 {
		var last [1]byte
		if _, err := file.ReadAt(last[:], info.Size()-1); err != nil {
			return fmt.Errorf("read audit tail: %w", err)
		}
		if last[0] != '\n' {
			if _, err := file.Write([]byte{'\n'}); err != nil {
				return fmt.Errorf("finish partial audit line: %w", err)
			}
		}
	}

	encoded, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("encode audit event: %w", err)
	}
	if _, err := file.Write(append(encoded, '\n')); err != nil {
		return fmt.Errorf("write audit event: %w", err)
	}
	return nil
}

// TailOffset finds the start of the last limit lines without loading the
// entire audit file. Version 1 used an in-memory queue capped at 500 events.
func (l *AuditLogger) TailOffset(limit int) (int64, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	file, err := os.Open(l.path)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return 0, err
	}
	if limit <= 0 {
		return info.Size(), nil
	}
	var buf [4096]byte
	seen := 0
	end := info.Size()
	ignoreFinalNewline := true
	for end > 0 {
		start := max(int64(0), end-int64(len(buf)))
		chunk := buf[:end-start]
		if _, err := file.ReadAt(chunk, start); err != nil {
			return 0, err
		}
		for i := len(chunk) - 1; i >= 0; i-- {
			if ignoreFinalNewline {
				ignoreFinalNewline = false
				if chunk[i] == '\n' {
					continue
				}
			}
			if chunk[i] == '\n' {
				seen++
				if seen == limit {
					return start + int64(i) + 1, nil
				}
			}
		}
		end = start
	}
	return 0, nil
}

// ReadBatch returns only complete JSON lines. The caller commits nextOffset
// after Web accepts the batch, making retries safe across process restarts.
func (l *AuditLogger) ReadBatch(offset int64, limit int) ([]AuditEvent, int64, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	file, err := os.Open(l.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, offset, nil
	}
	if err != nil {
		return nil, offset, err
	}
	defer file.Close()
	if info, err := file.Stat(); err != nil {
		return nil, offset, err
	} else if offset > info.Size() {
		// The audit file was replaced or truncated; begin with its new contents.
		offset = 0
	}
	if _, err := file.Seek(offset, io.SeekStart); err != nil {
		return nil, offset, err
	}
	reader := bufio.NewReader(file)
	events := make([]AuditEvent, 0, limit)
	next := offset
	for lines := 0; lines < limit; lines++ {
		line, err := reader.ReadBytes('\n')
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, offset, err
		}
		var event AuditEvent
		if err := json.Unmarshal(line, &event); err != nil {
			log.Printf("skipping malformed audit event at offset %d: %v", next, err)
			next += int64(len(line))
			continue
		}
		events = append(events, event)
		next += int64(len(line))
	}
	return events, next, nil
}

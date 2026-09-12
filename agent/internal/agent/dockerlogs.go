package agent

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/aiturn/everyup/agent/internal/discovery"
	"github.com/aiturn/everyup/agent/internal/state"
	"github.com/aiturn/everyup/agent/internal/webclient"
)

func (a *Agent) forwardDockerLogs(ctx context.Context, targets []discovery.Target) {
	if !a.cfg.DockerLogsEnabled || a.docker == nil || a.web == nil || !a.web.Enabled() {
		return
	}
	for _, target := range targets {
		if target.ID == "" || strings.HasPrefix(target.ID, "env:") {
			continue
		}
		if err := a.forwardContainerLogs(ctx, target); err != nil {
			log.Printf("docker log delivery failed: service=%s container=%s err=%v", target.ServiceName, target.ID, err)
		}
		if ctx.Err() != nil {
			return
		}
	}
}

func (a *Agent) forwardContainerLogs(ctx context.Context, target discovery.Target) error {
	a.mu.RLock()
	start, exists := a.logCursors[target.ID]
	a.mu.RUnlock()
	if !exists {
		// Old versions only saved a service timestamp. Replay its boundary
		// rather than assuming every replica had already been collected.
		start.At = a.targetState(target).lastDockerLogAt
		if !start.At.IsZero() {
			if err := a.persistLogCursor(target.ID, start); err != nil {
				return err
			}
		}
	}
	readStarted := time.Now()
	next := start
	boundarySeen := 0
	emitSynthetic := a.traced == nil || !a.traced.isTraced(target.ServiceName)
	batch := webclient.OTLPLogBatch{ServiceName: target.ServiceName, ContainerID: target.ID, ContainerName: targetKey(target)}
	var positions []state.LogCursor
	var spans []webclient.OTLPSpanEntry
	flush := func() error {
		if len(batch.Entries) == 0 {
			return nil
		}
		if err := a.web.SendOTLPLogBatch(ctx, batch, func(accepted int) error {
			return a.persistLogCursor(target.ID, positions[accepted-1])
		}); err != nil {
			return err
		}
		// Synthetic API signals remain best-effort and cannot block log delivery.
		if len(spans) > 0 {
			if err := a.web.SendOTLPSpans(ctx, []webclient.OTLPSpanBatch{{ServiceName: target.ServiceName, ContainerID: target.ID, ContainerName: targetKey(target), Spans: spans}}); err != nil {
				log.Printf("access-log span delivery failed: container=%s err=%v", target.ID, err)
			}
		}
		batch.Entries, positions, spans = batch.Entries[:0], positions[:0], spans[:0]
		return nil
	}
	err := a.docker.ReadLogsSince(ctx, target.ID, start.At, a.cfg.DockerLogTailLines, func(line discovery.DockerLogLine) error {
		stamp := line.Time
		if stamp.IsZero() {
			return fmt.Errorf("Docker log missing valid timestamp")
		}
		if stamp.Before(start.At) {
			return nil
		}
		if stamp.Equal(start.At) {
			boundarySeen++
			if boundarySeen <= start.Count {
				return nil
			}
		}
		if next.At.IsZero() {
			// Persist the initial tail boundary BEFORE attempting delivery, so
			// a failed first send also resumes with tail=all on the next run.
			next.At = stamp
			if err := a.persistLogCursor(target.ID, next); err != nil {
				return err
			}
		}
		if stamp.After(next.At) {
			next = state.LogCursor{At: stamp}
		}
		if stamp.Equal(next.At) {
			next.Count++
		}
		body := trimText(line.Message, 8192)
		severity, number := inferLogSeverity(body)
		batch.Entries = append(batch.Entries, webclient.OTLPLogEntry{Timestamp: stamp, Body: body, SeverityText: severity, SeverityNumber: number, Attributes: map[string]string{"everyup.target.key": targetKey(target)}})
		positions = append(positions, next)
		if method, path, status, ok := parseAccessLog(body); ok && emitSynthetic {
			spans = append(spans, webclient.OTLPSpanEntry{Method: method, Path: path, StatusCode: status, Timestamp: stamp})
		}
		// Bound collection memory as well as each outbound request. The client
		// additionally checks the actual encoded size before sending.
		if len(batch.Entries) >= 100 {
			return flush()
		}
		return nil
	})
	if err != nil {
		return err
	}
	if err := flush(); err != nil {
		return err
	}
	if next.At.IsZero() {
		return a.persistLogCursor(target.ID, state.LogCursor{At: readStarted})
	}
	return nil
}

func (a *Agent) persistLogCursor(id string, cursor state.LogCursor) error {
	a.mu.Lock()
	if a.logCursors == nil {
		a.logCursors = make(map[string]state.LogCursor)
	}
	previous, existed := a.logCursors[id]
	a.logCursors[id] = cursor
	a.mu.Unlock()
	if err := a.saveState(); err != nil {
		a.mu.Lock()
		if existed {
			a.logCursors[id] = previous
		} else {
			delete(a.logCursors, id)
		}
		a.mu.Unlock()
		return err
	}
	return nil
}

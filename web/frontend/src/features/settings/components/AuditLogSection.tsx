import { useEffect, useState } from 'react';
import { api, type AuditEvent } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { env } from '../../../config/env';
import { SectionCard } from './SectionCard';

const BODY_VIEW_ACTION = 'trace.body.view';
// Audit rows are human actions kept for the body-capture retention window, so
// this covers the whole trail in practice. The heading says "최근 N건" rather
// than a total, because the endpoint reports no unpaged count.
const AUDIT_LIMIT = 200;

function bodyCountOf(metadata?: string): number | undefined {
  if (!metadata) return undefined;
  try {
    const parsed = JSON.parse(metadata) as { capturedBodyEvents?: number };
    return parsed.capturedBodyEvents;
  } catch {
    return undefined;
  }
}

// Admin-only audit trail of captured-body views. Renders nothing for
// non-admins or in mock mode, so it can be dropped into the settings views
// unconditionally.
export function AuditLogSection() {

  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin || env.useMock) return;
    api
      .getAuditEvents({ action: BODY_VIEW_ACTION, limit: AUDIT_LIMIT })
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <SectionCard title="바디 열람 감사 로그" subtitle="관리자가 캡처된 요청/응답 본문을 열람한 기록">
      {events.length === 0 ? (
        <p className="text-sm text-text-muted">열람 기록이 없습니다</p>
      ) : (
        <>
        <p className="mb-2 text-xs text-text-dim">{`최근 ${events.length}건`}</p>
        <ul className="divide-y divide-ui-border-soft">
          {events.map((event) => {
            const count = bodyCountOf(event.metadata);
            return (
              <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-medium text-text-secondary">{event.username}</span>
                <span className="min-w-0 flex-1 truncate text-text-muted" title={event.traceId}>
                  {`Trace ${(event.traceId ?? '').slice(0, 12)} 본문 열람`}
                </span>
                {typeof count === 'number' && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {`본문 ${count}건`}
                  </span>
                )}
                <span className="text-xs text-text-dim">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </SectionCard>
  );
}

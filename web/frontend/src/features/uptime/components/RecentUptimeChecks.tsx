import { useState, type KeyboardEvent } from 'react';
import type { UptimeMonitorMetric } from '../../../services/api';
import { Tooltip } from '../../../components/common';

export function RecentUptimeChecks({ metrics, paused = false, stale = false }: { metrics: UptimeMonitorMetric[]; paused?: boolean; stale?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const checks = [...metrics].sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt)).slice(-10);
  if (checks.length === 0) return null;
  const index = Math.min(selected ?? checks.length - 1, checks.length - 1);
  const check = checks[index];
  const checkedAt = new Date(check.checkedAt);
  const time = checkedAt.toDateString() === new Date().toDateString()
    ? checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    : checkedAt.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
  const result = [paused ? '정지 전 기록' : '', time, check.status === 'failure' ? '실패' : check.statusCode ? '' : '정상',
    check.statusCode ? `HTTP ${check.statusCode}` : '', check.status === 'success' ? `${Math.round(check.responseTime).toLocaleString()}ms` : check.errorMessage].filter(Boolean).join(' · ');
  const detail = `${stale ? '이전에 불러온 기록입니다. ' : ''}최근 체크 ${checks.length}회. ${checkedAt.toLocaleString()} ${check.status === 'success' ? '정상' : '실패'} · ${result}`;
  const move = (event: KeyboardEvent) => {
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: checks.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setSelected(Math.max(0, Math.min(checks.length - 1, next)));
  };
  return (
    <Tooltip content={detail}>
    <div className="min-w-0" role="group" tabIndex={0} aria-label={`최근 체크 ${checks.length}회. 방향키로 체크를 옮깁니다`} onKeyDown={move} onMouseLeave={() => setSelected(null)} onBlur={() => setSelected(null)}>
      <div className="flex gap-0.5">
        {checks.map((item, slot) => (
          <span key={item.id} onMouseEnter={() => setSelected(slot)}
            className={`h-3 min-w-0 flex-1 rounded-sm ${item.status === 'success' ? 'bg-status-healthy-fill' : 'bg-status-error-fill'} ${slot === index ? 'opacity-75' : ''}`} />
        ))}
      </div>
      <p className="mt-1 truncate type-caption text-text-muted" aria-live="polite">{result}</p>
    </div>
    </Tooltip>
  );
}

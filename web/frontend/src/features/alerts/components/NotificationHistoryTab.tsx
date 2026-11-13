import { useState, useEffect, useMemo } from 'react';
import { ButtonLink, MaterialIcon, Pagination, SegmentedControl, SearchInput, ListToolbar, Select, IconButton, StatusLight } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { api, type AlertRule, type NotificationChannel, type NotificationHistory, type NotificationStats } from '../../../services/api';
import { getChannelStyle } from '../utils/channelMeta';
import { SeverityBadge } from './SeverityBadge';
import { historyStatus } from '../ruleDisplay';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useListView } from '../../../hooks/useListView';
import { getErrorMessage } from '../../../utils/errors';
import { LoadErrorBanner } from './LoadErrorBanner';

// 유형 이름은 규칙 탭의 카테고리와 같은 말을 쓴다(A-11). 헬스체크는 저장값 두 개(endpoint·healthcheck)를 묶는다.
const HISTORY_TYPE_LABELS: Record<string, string> = {
  endpoint: '헬스체크',
  healthcheck: '헬스체크',
  api_request: 'API 요청',
  log: '로그',
  otel_metric: '메트릭',
  resource: '인프라',
  system: '시스템',
};

const HISTORY_TYPE_FILTERS = [
  { value: 'endpoint,healthcheck', label: '헬스체크' },
  { value: 'api_request', label: 'API 요청' },
  { value: 'log', label: '로그' },
  { value: 'otel_metric', label: '메트릭' },
  { value: 'resource', label: '인프라' },
  { value: 'system', label: '시스템' },
];

const PAGE_SIZE = 25;

const typeLabel = (type: string) => HISTORY_TYPE_LABELS[type] ?? type;

const dateGroupLabel = (d: Date) => {
  const dayLabel = format(d, 'M월 d일', { locale: ko });
  if (isToday(d)) return `오늘 · ${dayLabel}`;
  if (isYesterday(d)) return `어제 · ${dayLabel}`;
  return dayLabel;
};


type StatusFilter = 'all' | 'sent' | 'failed';
type PeriodDays = 1 | 7 | 30;



interface NotificationHistoryTabProps {
  channels: NotificationChannel[];
  /** 이력의 ruleId를 규칙 이름으로 보인다. */
  rules: AlertRule[];
  initialStatus?: StatusFilter;
}

/** 실패한 발송의 사유와 채널 수정 링크. 사유는 줄바꿈해 끝까지 보인다(A-10). */
function FailureReason({ item }: { item: NotificationHistory }) {
  if (!item.errorMessage) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <p className="min-w-0 break-words type-caption text-status-error">
        {item.errorMessage}
        {item.retryCount > 0 && ` · ${item.retryCount}회 재시도`}
      </p>
      {item.status === 'failed' && (
        <ButtonLink variant="ghost" size="sm" to={`/alerts/channels/${item.channelId}/edit`}>채널 수정</ButtonLink>
      )}
    </div>
  );
}

function ruleName(item: NotificationHistory, rules: AlertRule[]): string | null {
  if (!item.ruleId) return null;
  return rules.find(rule => rule.id === item.ruleId)?.name ?? '삭제된 규칙';
}

type HistoryRow = { kind: 'group'; label: string; key: string } | { kind: 'item'; item: NotificationHistory };

function HistoryCards({ rows, loading, rules }: { rows: HistoryRow[]; loading: boolean; rules: AlertRule[] }) {
  if (loading) return <p className="p-6 text-sm text-text-muted">로딩 중…</p>;
  if (rows.length === 0) return <p className="p-6 text-sm text-text-muted">알림 히스토리가 없습니다</p>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(row => row.kind === 'group' ? <h2 key={`g-${row.key}`} className="col-span-full type-label text-text-muted">{row.label}</h2> : <HistoryCard key={row.item.id} item={row.item} rules={rules} />)}</div>;
}

function HistoryCard({ item, rules }: { item: NotificationHistory; rules: AlertRule[] }) {
  const rule = ruleName(item, rules);
  return <article aria-label={item.message} className="min-w-0 rounded-xl border border-ui-border bg-bg-surface p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><StatusLight {...historyStatus(item.status)} />{item.severity && <SeverityBadge severity={item.severity} />}</div>
    <p className="mt-3 break-words text-sm text-text-base">{item.message}</p><p className="mt-2 flex flex-wrap gap-x-3 break-words type-caption text-text-muted">{rule && <span>{rule}</span>}<span>{item.channelName}</span><span>{typeLabel(item.alertType)}</span></p>
    <div className="mt-2"><FailureReason item={item} /></div>
    <p className="mt-3 type-caption text-text-muted">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ko })} · {format(new Date(item.createdAt), 'M월 d일 HH:mm')}</p>
  </article>;
}

export function NotificationHistoryTab({ channels, rules, initialStatus }: NotificationHistoryTabProps) {
  const { view } = useListView();

  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus ?? 'all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [periodDays, setPeriodDays] = useState<PeriodDays>(7);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);



  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  // Any filter change resets to page 1
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 기존 패턴. i18n 제거로 린트가 이 컴포넌트를 분석하게 되면서 드러났을 뿐, 별건으로 정리한다.
    setPage(1);
  }, [statusFilter, typeFilter, channelFilter, periodDays, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 위와 동일. 페치 시작 시 로딩 플래그를 세우는 기존 동작 유지.
    setLoading(true);
    api.getNotificationHistory({
      status: statusFilter === 'all' ? undefined : statusFilter,
      alert_type: typeFilter === 'all' ? undefined : typeFilter,
      channel_id: channelFilter === 'all' ? undefined : channelFilter,
      q: debouncedSearch || undefined,
      from: new Date(Date.now() - periodDays * 86400_000).toISOString(),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
      .then(response => {
        if (cancelled) return;
        setHistory(response.items || []);
        setTotal(response.total || 0);
        setError(null);
      })
      // 실패를 빈 이력으로 보이지 않는다 — 그 자리에 다시 시도 배너를 띄운다(A-05).
      .catch(requestError => { if (!cancelled) setError(getErrorMessage(requestError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter, typeFilter, channelFilter, periodDays, debouncedSearch, page, reloadKey]);

  useEffect(() => {
    api.getNotificationHistoryStats(periodDays)
      .then(setStats)
      .catch(error => console.error('Failed to load stats:', error));
  }, [periodDays]);

  const totalSent = stats?.totalSent ?? 0;
  const totalFailed = stats?.totalFailed ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Rows interleaved with date-group headers
  const groupedRows = useMemo(() => {
    const rows: HistoryRow[] = [];
    let prevDay = '';
    for (const item of history) {
      const d = new Date(item.createdAt);
      const day = format(d, 'yyyy-MM-dd');
      if (day !== prevDay) {
        rows.push({ kind: 'group', label: dateGroupLabel(d), key: day });
        prevDay = day;
      }
      rows.push({ kind: 'item', item });
    }
    return rows;
  }, [history]);

  const thClass = 'px-4 py-3 text-left text-xs font-medium text-text-muted';

  return (
    <div className="space-y-3">
      {/* Filter bar — status segments + type/channel/period + search */}
      <ListToolbar search={
        <div className="relative">
          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="메시지 검색" aria-label="알림 메시지 검색"
            className="pr-10"
          />
          {search && (
            <IconButton icon="close" label="검색어 지우기" tone="quiet" size="sm" onClick={() => setSearch('')} className="absolute right-1 top-1/2 -translate-y-1/2" />
          )}
        </div>
      }>
        <SegmentedControl
          size="md"
          ariaLabel="상태"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: `전체 ${totalSent + totalFailed}` },
            { value: 'sent', label: `성공 ${totalSent}` },
            { value: 'failed', label: `실패 ${totalFailed}` },
          ]}
        />

        <Select
          aria-label="알림 유형"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          wrapperClassName="w-36"
        >
          <option value="all">전체 유형</option>
          {HISTORY_TYPE_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>

        <Select
          aria-label="전체 채널"
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
          wrapperClassName="w-36"
        >
          <option value="all">전체 채널</option>
          {channels.map(ch => (
            <option key={ch.id} value={ch.id}>{ch.name}</option>
          ))}
        </Select>

        <Select
          aria-label="최근 7일"
          value={periodDays}
          onChange={e => setPeriodDays(Number(e.target.value) as PeriodDays)}
          wrapperClassName="w-36"
        >
          <option value={1}>최근 24시간</option>
          <option value={7}>최근 7일</option>
          <option value={30}>최근 30일</option>
        </Select>
      </ListToolbar>

      {error && <LoadErrorBanner title="발송 이력을 불러오지 못했습니다" message={error} onRetry={() => setReloadKey(key => key + 1)} />}
      {/* History Table */}
      {!error && <div className={view === 'card' ? 'space-y-3' : 'bg-bg-surface rounded-xl border border-ui-border overflow-hidden'}>
        {view === 'card' ? <HistoryCards rows={groupedRows} loading={loading} rules={rules} /> : (
        <div className="overflow-x-auto">
          <table aria-label="알림 로그 그리드" className="w-full min-w-[960px] table-fixed">
            <thead className="bg-ui-table-header">
              <tr className="border-b border-ui-border">
                <th className={`${thClass} w-[110px]`}>상태</th>
                <th className={`${thClass} w-[160px]`}>규칙</th>
                <th className={`${thClass} w-[190px]`}>채널</th>
                <th className={thClass}>메시지</th>
                <th className={`${thClass} w-[110px]`}>심각도</th>
                <th className={`${thClass} w-[170px] text-right`}>시간</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                    <MaterialIcon size={36} name="sync" className="animate-spin mx-auto mb-2" />
                    <p>로딩 중…</p>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-dim">
                    <MaterialIcon size={36} name="inbox" className="mx-auto mb-2" />
                    <p className="text-sm">알림 히스토리가 없습니다</p>
                  </td>
                </tr>
              ) : (
                groupedRows.map(row => {
                  if (row.kind === 'group') {
                    return (
                      <tr key={`g-${row.key}`}>
                        <td colSpan={6} className="px-4 py-1.5 border-t border-ui-border-soft bg-ui-hover-soft text-xs text-text-muted">
                          {row.label}
                        </td>
                      </tr>
                    );
                  }
                  const { item } = row;
                  const rule = ruleName(item, rules);
                  const channelStyle = getChannelStyle(item.channelType);
                  const created = new Date(item.createdAt);
                  return (
                    <tr
                      key={item.id}
                      // 실패는 상태 칸의 점·문구가 말한다 — 행 전체를 붉게 칠하지 않는다(DESIGN §9.3).
                      className="border-t border-ui-border-soft transition-colors hover:bg-ui-hover-soft"
                    >
                      <td className="px-4 py-2.5">
                        <StatusLight {...historyStatus(item.status)} />
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="truncate text-sm text-text-secondary">{rule ?? typeLabel(item.alertType)}</p>
                        {rule && <p className="truncate type-caption text-text-muted">{typeLabel(item.alertType)}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${channelStyle.bg}`}>
                            <ChannelIcon type={item.channelType} size={13} className={channelStyle.text} />
                          </div>
                          <span className="truncate text-sm text-text-secondary">{item.channelName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="truncate text-sm text-text-base">{item.message}</p>
                        <FailureReason item={item} />
                      </td>
                      <td className="px-4 py-2.5">
                        {item.severity && (
                          <SeverityBadge severity={item.severity} />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm text-text-muted whitespace-nowrap">
                        {formatDistanceToNow(created, { addSuffix: true, locale: ko })}
                        <span className="text-text-dim"> · {format(created, 'HH:mm')}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t border-ui-border bg-ui-hover-soft/60 px-4 py-2.5">
            <p className="text-xs text-text-muted">
              {`총 ${total}건 중 ${(page - 1) * PAGE_SIZE + 1}~${Math.min(page * PAGE_SIZE, total)}`}
            </p>
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              previousLabel="이전"
              nextLabel="다음"
            />
          </div>
        )}
      </div>}
    </div>
  );
}

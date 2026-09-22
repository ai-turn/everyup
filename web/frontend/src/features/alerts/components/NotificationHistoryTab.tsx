import { useState, useEffect, useMemo } from 'react';
import { MaterialIcon, Pagination, SegmentedControl, SearchInput, ListToolbar, Select } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { api, NotificationChannel, NotificationHistory, NotificationStats } from '../../../services/api';
import { getChannelStyle } from '../utils/channelMeta';
import { SeverityBadge } from './SeverityBadge';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';

const HISTORY_TYPE_LABELS: Record<string, string> = {
  resource: '리소스',
  healthcheck: '헬스체크',
  endpoint: '엔드포인트',
  log: '로그',
  scheduled: '스케줄',
  system: '시스템',
};

const PAGE_SIZE = 25;

const typeLabel = (type: string) =>
  HISTORY_TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);

const dateGroupLabel = (d: Date) => {
  const dayLabel = format(d, 'M월 d일', { locale: ko });
  if (isToday(d)) return `오늘 · ${dayLabel}`;
  if (isYesterday(d)) return `어제 · ${dayLabel}`;
  return dayLabel;
};


type StatusFilter = 'all' | 'sent' | 'failed';
type PeriodDays = 1 | 7 | 30;

const STATUS_META: Record<string, { dot: string; text: string }> = {
  sent: { dot: 'bg-status-healthy', text: 'text-status-healthy' },
  failed: { dot: 'bg-status-error', text: 'text-status-error' },
  pending: { dot: 'bg-status-warn', text: 'text-status-warn' },
};


interface NotificationHistoryTabProps {
  channels: NotificationChannel[];
  initialStatus?: StatusFilter;
}

export function NotificationHistoryTab({ channels, initialStatus }: NotificationHistoryTabProps) {

  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

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
      })
      .catch(error => console.error('Failed to load notification history:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter, typeFilter, channelFilter, periodDays, debouncedSearch, page]);

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
    const rows: ({ kind: 'group'; label: string; key: string } | { kind: 'item'; item: NotificationHistory })[] = [];
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

  const thClass = 'px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider';

  return (
    <div className="space-y-3">
      {/* Filter bar — status segments + type/channel/period + search */}
      <ListToolbar search={
        <div className="relative">
          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="메시지 검색" aria-label="알림 메시지 검색"
            className="pr-7"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700"
              aria-label="검색어 지우기" title="검색어 지우기"
            >
              <MaterialIcon size={20} name="close" />
            </button>
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
          aria-label="전체 타입"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          wrapperClassName="w-36"
        >
          <option value="all">전체 타입</option>
          <option value="resource">리소스</option>
          <option value="healthcheck">헬스체크</option>
          <option value="endpoint">엔드포인트</option>
          <option value="log">로그</option>
          <option value="scheduled">스케줄</option>
          <option value="system">시스템</option>
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

      {/* History Table */}
      <div className="bg-bg-surface rounded-xl border border-ui-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-fixed">
            <thead className="bg-ui-hover-soft/40">
              <tr className="border-b border-ui-border">
                <th className={`${thClass} w-[110px]`}>상태</th>
                <th className={`${thClass} w-[120px]`}>알림 타입</th>
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
                    <p>로딩 중...</p>
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
                        <td colSpan={6} className="px-4 py-1.5 border-t border-ui-border-soft/50 bg-ui-hover-soft/30 text-xs text-text-muted">
                          {row.label}
                        </td>
                      </tr>
                    );
                  }
                  const { item } = row;
                  const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending;
                  const channelStyle = getChannelStyle(item.channelType);
                  const created = new Date(item.createdAt);
                  const failed = item.status === 'failed';
                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-ui-border-soft/50 transition-colors ${
                        failed
                          ? 'bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/15'
                          : 'hover:bg-ui-hover-soft/40'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-sm capitalize ${statusMeta.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {typeLabel(item.alertType)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${channelStyle.bg}`}>
                            <ChannelIcon type={item.channelType} size={13} className={channelStyle.text} />
                          </div>
                          <span className="truncate text-sm text-text-secondary">{item.channelName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate text-sm text-text-base">{item.message}</p>
                        {item.errorMessage && (
                          <p className="mt-0.5 truncate text-xs text-red-600 dark:text-red-400">
                            {item.errorMessage}
                            {item.retryCount > 0 && ` · ${`${item.retryCount}회 재시도`}`}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.severity && (
                          <SeverityBadge severity={item.severity} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-text-muted whitespace-nowrap">
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

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t border-ui-border bg-ui-hover-soft/60 px-4 py-2.5">
            <p className="text-xs text-text-muted">
              {`총 ${total}건 중 ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}`}
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
      </div>
    </div>
  );
}

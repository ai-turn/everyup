import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ConnectionSourceBadge, EmptyState, ListToolbar, MaterialIcon, PageHeader, Pagination, ResourceCardHeader, SearchInput, Select } from '../../components/common';
import { LEVEL_STYLE } from '../../features/healthcheck/logLevelStyle';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import { api, type AgentServiceFlat, type LogEntry, type ObservedService } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

const PAGE_SIZE = 25;
// Sample the card sections read from — wider than one page so the source
// directory does not shrink to whatever the table happens to be showing.
const OVERVIEW_SAMPLE = 100;

function formatTime(ts: string) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function LogsPage() {

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  // Unfiltered snapshot the card sections read from — they are a directory of
  // sources, so they must not shrink when the table is filtered.
  const [overview, setOverview] = useState<LogEntry[]>([]);
  const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
  const [directServices, setDirectServices] = useState<ObservedService[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getAllAgentServicesFlat(),
      api.getObservedServices('logs'),
      api.getLogs({ limit: OVERVIEW_SAMPLE }),
    ])
      .then(([agentRows, directRows, sample]) => {
        if (!alive) return;
        setAgentServices(agentRows ?? []);
        setDirectServices(directRows ?? []);
        setOverview(sample?.data ?? []);
      })
      .catch((requestError) => { if (alive) setError(getErrorMessage(requestError)); });
    return () => { alive = false; };
  }, [reloadKey]);

  // Filters go to the server: the client only ever holds LOG_LIMIT rows, so
  // filtering here would search the loaded page and call the rest non-existent.
  useEffect(() => {
    let alive = true;
    api.getLogs({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      search: search || undefined,
      serviceName: serviceFilter || undefined,
    })
      .then(result => {
        if (!alive) return;
        setError(null);
        setLogs(result?.data ?? []);
        setTotal(result?.total ?? 0);
      })
      .catch((requestError) => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [search, serviceFilter, page, reloadKey]);

  // Registered sources plus whatever the unfiltered snapshot actually carried —
  // a log's serviceName comes off the OTLP resource and need not match a
  // registered service. Never derived from the filtered result: a filter whose
  // choices depend on its own output can't be un-narrowed.
  const serviceNames = useMemo(() => [...new Set([
    ...agentServices.map(service => service.name),
    ...directServices.map(service => service.name),
    ...overview.map(log => log.serviceName).filter(Boolean) as string[],
  ])].sort(), [agentServices, directServices, overview]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const agentPaths = useMemo(() => new Map(
    agentServices.map(service => [`${service.agentId}:${service.name}`, service]),
  ), [agentServices]);
  const directPaths = useMemo(() => new Map(
    directServices.map(service => [service.id, service]),
  ), [directServices]);

  // Docker-collected services get the same card grid as the direct ones — derived from
  // the logs already in hand, so the section costs no extra request.
  const agentCards = useMemo(() => {
    const byKey = new Map<string, { service: AgentServiceFlat; total: number; error: number; warn: number }>();
    for (const log of overview) {
      if (!log.agentId) continue;
      const key = `${log.agentId}:${log.serviceName ?? ''}`;
      const service = agentPaths.get(key);
      if (!service) continue;
      const row = byKey.get(key) ?? { service, total: 0, error: 0, warn: 0 };
      row.total += 1;
      if (log.level === 'error') row.error += 1;
      if (log.level === 'warn') row.warn += 1;
      byKey.set(key, row);
    }
    return [...byKey.values()].sort((a, b) => b.error - a.error || b.total - a.total);
  }, [overview, agentPaths]);

  return (
    <div>
      <PageHeader title="로그" subtitle="서비스에서 발생한 오류와 주요 기록을 검색해 문제 원인을 확인합니다.">
        <MonitoringConnection capability="logs" onConnected={reload} />
      </PageHeader>

      <ListToolbar search={
        <form onSubmit={event => { event.preventDefault(); setSearch(inputValue); setPage(1); }} className="flex w-full gap-2">
          <SearchInput
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            placeholder="메시지 검색 후 Enter"
            aria-label="로그 검색"
            wrapperClassName="min-w-0 flex-1"
          />
          {search && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(''); setInputValue(''); setPage(1); }} aria-label="검색어 지우기" title="검색어 지우기">
              <MaterialIcon name="close" />
            </Button>
          )}
        </form>
      }>
        <Select
          value={serviceFilter}
          onChange={event => { setServiceFilter(event.target.value); setPage(1); }}
          aria-label="서비스 필터"
          wrapperClassName="w-full sm:w-48"
        >
          <option value="">전체 서비스</option>
          {serviceNames.map(name => <option key={name} value={name}>{name}</option>)}
        </Select>
      </ListToolbar>

      {!loading && directServices.length + agentCards.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">로그 서비스</h2>
            <span className="font-mono text-xs text-text-dim">{directServices.length + agentCards.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {directServices.map(service => (
              <Link key={service.id} to={`/logs/${service.id}`} className="card-interactive rounded-xl border border-ui-border bg-bg-surface p-4">
                <ResourceCardHeader
                  icon="article"
                  title={<h3 className="truncate type-card-title text-text-base">{service.name}</h3>}
                  badge={<ConnectionSourceBadge source="direct" />}
                  status={
                    <span
                      className={`mt-1 block h-2.5 w-2.5 shrink-0 rounded-full ${service.isActive ? 'bg-status-healthy' : 'bg-status-error'}`}
                      role="img"
                      aria-label={service.isActive ? '수집 가능' : '중지됨'}
                    />
                  }
                />
                <p className="mt-3 text-xs text-text-secondary">
                  {service.lastSeenAt
                    ? `마지막 수집: ${new Date(service.lastSeenAt).toLocaleString()}`
                    : '아직 수집된 로그가 없습니다'}
                </p>
                <p className="mt-1 truncate font-mono text-xs text-text-dim">{service.apiKeyMasked || '—'}</p>
              </Link>
            ))}
            {agentCards.map(({ service, total, error, warn }) => (
              <Link
                key={`${service.agentId}:${service.key}`}
                to={`/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=logs`}
                className="card-interactive rounded-xl border border-ui-border bg-bg-surface p-4"
              >
                <ResourceCardHeader
                  icon="article"
                  title={<h3 className="truncate type-card-title text-text-base">{service.name}</h3>}
                  badge={<ConnectionSourceBadge source="docker" />}
                  subtitle={service.agentName}
                />
                <p className="mt-3 text-xs text-text-secondary">
                  {`최근 ${total}건 · ERROR ${error} · WARN ${warn}`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="h-72 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
      ) : error ? (
        <EmptyState icon="error_outline" title="로그를 불러오지 못했습니다" description={error} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon="article"
          title={search || serviceFilter ? '검색 결과가 없습니다' : '아직 수집된 로그가 없습니다'}
          description={search || serviceFilter ? '검색어나 서비스 필터를 바꾸어 다시 시도해 보세요.' : '기존 Docker 환경을 선택하거나 앱을 OpenTelemetry로 직접 연결하면 여기에 표시됩니다.'}
        >
          {!search && !serviceFilter && <MonitoringConnection capability="logs" onConnected={reload} />}
        </EmptyState>
      ) : (
        <>
          <p className="mb-2 text-xs text-text-dim">
            {`총 ${total.toLocaleString()}건 중 ${((page - 1) * PAGE_SIZE + 1).toLocaleString()}–${Math.min(page * PAGE_SIZE, total).toLocaleString()}`}
          </p>
          <div className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-ui-border bg-ui-hover-soft">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">시간</th>
                    <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">레벨</th>
                    <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">서비스</th>
                    <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">메시지</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border-soft">
                  {logs.map(log => {
                    const agentService = log.agentId ? agentPaths.get(`${log.agentId}:${log.serviceName ?? ''}`) : undefined;
                    const directService = !log.agentId && log.serviceId ? directPaths.get(log.serviceId) : undefined;
                    const serviceHref = agentService
                      ? `/services/${agentService.agentId}/${encodeURIComponent(agentService.key)}?tab=logs`
                      : directService ? `/logs/${directService.id}` : undefined;
                    return (
                      <tr key={log.id} className="hover:bg-ui-hover-soft">
                        <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-text-dim">{formatTime(log.createdAt)}</td>
                        <td className="px-4 py-3 align-top"><span className={`badge ${LEVEL_STYLE[log.level] ?? LEVEL_STYLE.info}`}>{log.level.toUpperCase()}</span></td>
                        <td className="whitespace-nowrap px-4 py-3 align-top">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                            <MaterialIcon size={16}
                              name={log.agentId ? 'deployed_code' : 'sensors'}
                              className="text-text-dim"
                            />
                            {serviceHref
                              ? <Link to={serviceHref} className="hover:text-primary">{log.serviceName}</Link>
                              : log.serviceName || '—'}
                          </span>
                        </td>
                        <td className="max-w-xl px-4 py-3 align-top font-mono text-xs text-text-secondary">{log.message}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-end border-t border-ui-border bg-ui-hover-soft/60 px-4 py-2.5">
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
        </>
      )}

    </div>
  );
}

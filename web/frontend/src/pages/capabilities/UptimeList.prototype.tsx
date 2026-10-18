// THROWAWAY — A: comparable rows, B: list + inspector, C: environment groups.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink, MaterialIcon, SearchInput, Select, StatusLight } from '../../components/common';
import type { AgentServiceFlat, UptimeMonitor } from '../../services/api';
import { dockerUptimeState } from '../../utils/operationalStatus';
import { formatIncidentTime } from '../../utils/incidentFormat';

type State = 'up' | 'down' | 'waiting' | 'stale' | 'paused' | 'unknown';
interface Target {
  id: string; name: string; endpoint: string; group: string; source: string; protocol: string; to: string; state: State; lastCheck?: string; latency?: string; error?: string; interval?: number;
}
interface Props {
  variant: string; services: AgentServiceFlat[]; monitors: UptimeMonitor[];
  errors: { services?: string; monitors?: string }; query: string; onQueryChange: (value: string) => void;
}
const states = {
  up: { label: '정상', tone: 'healthy' }, down: { label: '장애', tone: 'error' }, waiting: { label: '확인 대기', tone: 'idle' },
  stale: { label: '수집 지연', tone: 'warn' }, paused: { label: '일시정지', tone: 'idle' }, unknown: { label: '확인 불가', tone: 'warn' },
} as const;
const order: Record<State, number> = { down: 0, unknown: 1, stale: 1, waiting: 2, up: 3, paused: 4 };

function targetsFrom(data: Props): Target[] {
  return [
    ...data.monitors.map((monitor): Target => ({ id: monitor.id, name: monitor.name, endpoint: monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url, group: monitor.type === 'tcp' ? '직접 TCP 체크' : '직접 HTTP 체크', source: '직접 추가', protocol: monitor.type.toUpperCase(), to: `/uptime/${monitor.id}`, state: data.errors.monitors ? 'unknown' : !monitor.isActive ? 'paused' : monitor.status === 'healthy' ? 'up' : monitor.status === 'unhealthy' ? 'down' : 'waiting', lastCheck: monitor.lastCheckAt, latency: monitor.responseTime === undefined ? undefined : `${monitor.responseTime}ms`, interval: monitor.interval })),
    ...data.services.map((service): Target => ({ id: `${service.agentId}/${service.key}`, name: service.name, endpoint: service.endpoint || service.key, group: service.agentName, source: 'Docker', protocol: service.checkType.toUpperCase(), to: `/services/${service.agentId}/${encodeURIComponent(service.key)}`, state: data.errors.services ? 'unknown' : dockerUptimeState(service), lastCheck: service.observedAt, latency: service.lastLatency, error: service.lastError })),
  ];
}

function StateFilter({ targets, value, onChange }: { targets: Target[]; value: string; onChange: (value: string) => void }) {
  const options = [ ['all', '전체', targets.length], ['down', '장애', targets.filter((item) => item.state === 'down').length], ['attention', '확인 필요', targets.filter((item) => ['unknown', 'waiting', 'stale'].includes(item.state)).length], ['up', '정상', targets.filter((item) => item.state === 'up').length], ['paused', '일시정지', targets.filter((item) => item.state === 'paused').length] ] as const;
  return <div className="flex flex-wrap gap-1" role="group" aria-label="대상 상태 필터">{options.map(([key, label, count]) => <Button key={key} size="sm" variant={value === key ? 'secondary' : 'ghost'} aria-pressed={value === key} onClick={() => onChange(key)}>{label}<span className="ml-1 tabular-nums text-text-muted">{count}</span></Button>)}</div>;
}

function UptimeTable({ targets, search }: { targets: Target[]; search: string }) {
  const [sort, setSort] = useState<'state' | 'name' | 'recent'>('state');
  const ordered = [...targets].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'recent' ? (Date.parse(b.lastCheck ?? '') || 0) - (Date.parse(a.lastCheck ?? '') || 0) : order[a.state] - order[b.state] || a.name.localeCompare(b.name));
  return <section className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4"><h2 className="type-card-title">모니터링 대상 <span className="ml-2 text-sm font-normal text-text-muted">{targets.length}</span></h2><label className="flex items-center gap-2 text-sm text-text-muted"><span className="shrink-0">정렬</span><Select aria-label="대상 정렬" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="min-w-36"><option value="state">상태 우선</option><option value="name">이름순</option><option value="recent">최근 확인순</option></Select></label></div>
    {targets.length === 0 ? <p className="p-6 text-sm text-text-muted">{search.trim() ? '검색 조건과 일치하는 대상이 없습니다.' : '표시할 대상이 없습니다.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-3xl table-fixed text-left text-sm"><thead className="bg-ui-hover-soft text-text-muted"><tr><th className="w-28 px-4 py-3 font-medium">상태</th><th className="w-56 px-4 py-3 font-medium">대상</th><th className="px-4 py-3 font-medium">체크 대상</th><th className="w-36 px-4 py-3 font-medium">마지막 확인</th><th className="w-24 px-4 py-3 font-medium">방식</th></tr></thead><tbody>{ordered.map((item) => <tr key={item.id} className="border-t border-ui-border-soft transition-colors hover:bg-ui-hover-soft"><td className="px-4 py-4"><StatusLight {...states[item.state]} /></td><td className="px-4 py-4"><Link to={item.to} className="block truncate font-medium text-action">{item.name}</Link><p className="mt-1 truncate type-caption text-text-muted">{item.source} · {item.group}</p></td><td className="px-4 py-4"><p className="truncate font-mono text-xs text-text-muted" title={item.endpoint}>{item.endpoint}</p>{item.error && <p className="mt-1 truncate type-caption text-text-secondary" title={item.error}>{item.error}</p>}</td><td className="px-4 py-4 text-text-muted">{item.lastCheck ? formatIncidentTime(item.lastCheck) : '아직 없음'}</td><td className="px-4 py-4 text-text-muted">{item.protocol}{item.interval && <span className="mt-1 block type-caption">{item.interval}초 간격</span>}</td></tr>)}</tbody></table></div>}
  </section>;
}

function UptimeInspector({ targets }: { targets: Target[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const ordered = [...targets].sort((a, b) => order[a.state] - order[b.state]);
  const chosen = targets.find((item) => item.id === selected) ?? ordered[0];
  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
    <section className="min-w-0 overflow-hidden rounded-xl border border-ui-border bg-bg-surface"><div className="flex items-center justify-between border-b border-ui-border p-4"><h2 className="type-card-title">대상 선택</h2><span className="text-sm text-text-muted">{targets.length}</span></div><ul className="max-h-80 divide-y divide-ui-border-soft overflow-y-auto lg:max-h-[560px]">{ordered.map((item) => <li key={item.id}><button type="button" aria-pressed={chosen === item} onClick={() => setSelected(item.id)} className={`flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-ui-hover-soft ${chosen === item ? 'bg-ui-hover-soft' : ''}`}><span className="min-w-0"><span className="block truncate font-medium text-text-base">{item.name}</span><span className="mt-1 block truncate type-caption text-text-muted">{item.group} · {item.protocol}</span></span><span className="shrink-0"><StatusLight {...states[item.state]} /></span></button></li>)}</ul>{targets.length === 0 && <p className="p-6 text-sm text-text-muted">조건에 맞는 대상이 없습니다.</p>}</section>
    <section id="prototype-target-inspector" className="min-w-0 rounded-xl border border-ui-border bg-bg-surface p-6"><p className="type-caption text-text-muted">빠른 확인</p>{chosen ? <><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><h2 className="break-words type-section-title">{chosen.name}</h2><StatusLight {...states[chosen.state]} /></div><p className="mt-1 text-sm text-text-muted">{chosen.group} · {chosen.source}</p><p className="mt-5 break-all rounded-lg bg-ui-hover-soft p-4 font-mono text-xs text-text-secondary">{chosen.endpoint}</p><dl className="mt-5 grid gap-x-6 sm:grid-cols-2">{[['체크 방식', chosen.protocol], ['마지막 확인', chosen.lastCheck ? formatIncidentTime(chosen.lastCheck) : '수신 기록 없음'], ['체크 간격', chosen.interval ? `${chosen.interval}초` : 'Collector 설정'], ['최근 응답', chosen.state === 'up' ? chosen.latency || '목록에 제공되지 않음' : '정상 응답 확인 안 됨']].map(([label, value]) => <div key={label} className="border-b border-ui-border-soft py-3"><dt className="type-caption text-text-muted">{label}</dt><dd className="mt-1 text-sm text-text-base">{value}</dd></div>)}</dl>{chosen.error && <div className="mt-5"><h3 className="type-label">관측된 메시지</h3><p className="mt-2 break-words text-sm text-text-secondary">{chosen.error}</p></div>}<div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-text-muted">체크 이력과 응답 추이를 이어서 확인하세요.</p><ButtonLink variant="secondary" to={chosen.to}>상세 조사 <MaterialIcon name="arrow_forward" /></ButtonLink></div></> : <p className="mt-4 text-sm text-text-muted">목록에서 대상을 선택하세요.</p>}</section>
  </div>;
}

function UptimeGroups({ targets }: { targets: Target[] }) {
  const grouped = [...new Set(targets.map((item) => item.group))].map((name) => ({ name, items: targets.filter((item) => item.group === name) }));
  return <div className="space-y-4">{grouped.map((group) => <details key={group.name} open className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4"><span><span className="block type-card-title">{group.name}</span><span className="mt-1 block type-caption text-text-muted">표시 중인 대상 {group.items.length}개</span></span><span className="flex flex-wrap items-center gap-4 text-sm"><span className="text-text-muted">정상 {group.items.filter((item) => item.state === 'up').length}</span><span className={group.items.some((item) => item.state === 'down') ? 'text-status-error' : 'text-text-muted'}>장애 {group.items.filter((item) => item.state === 'down').length}</span><MaterialIcon name="expand_more" size={20} /></span></summary><ul className="divide-y divide-ui-border-soft">{group.items.map((item) => <li key={item.id}><Link to={item.to} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 transition-colors hover:bg-ui-hover-soft"><span className="w-24 shrink-0"><StatusLight {...states[item.state]} /></span><span className="min-w-0 flex-1"><span className="block truncate type-label text-action">{item.name}</span><span className="mt-1 block truncate font-mono text-xs text-text-muted">{item.endpoint}</span></span><span className="shrink-0 text-right type-caption text-text-muted"><span className="block">{item.protocol}</span><span className="mt-1 block">{item.lastCheck ? `${formatIncidentTime(item.lastCheck)} 확인` : '확인 기록 없음'}</span></span></Link></li>)}</ul></details>)}{grouped.length === 0 && <p className="rounded-xl border border-ui-border p-6 text-sm text-text-muted">조건에 맞는 대상이 없습니다.</p>}</div>;
}

export function UptimeListPrototype(data: Props) {
  const [filter, setFilter] = useState('all');
  const targets = targetsFrom(data);
  const query = data.query.trim().toLocaleLowerCase();
  const filtered = targets.filter((item) => (!query || `${item.name} ${item.endpoint} ${item.group}`.toLocaleLowerCase().includes(query)) && (filter === 'all' || (filter === 'attention' ? ['unknown', 'waiting', 'stale'].includes(item.state) : item.state === filter)));
  const titles = { A: ['업타임 대상 비교', '같은 열에서 여러 대상의 상태와 최근 확인을 비교합니다.'], B: ['대상을 고르고 바로 확인', '목록의 위치를 유지하며 대상의 상태와 설정을 살펴봅니다.'], C: ['환경에서 서비스까지', '어느 환경에 어떤 상태가 모여 있는지 확인합니다.'] };
  const [title, subtitle] = titles[data.variant as keyof typeof titles] ?? titles.A;
  return <div className="space-y-5 pb-36">
    <header className="border-b border-ui-border pb-4"><p className="mb-1 type-caption text-text-muted">업타임</p><h1 className="type-page-title">{title}</h1><p className="mt-2 text-sm text-text-muted">{subtitle}</p></header>
    {(data.errors.services || data.errors.monitors) && <p role="status" className="border-b border-ui-border pb-4 text-sm text-status-warn">{[data.errors.services && 'Docker 서비스', data.errors.monitors && '직접 모니터'].filter(Boolean).join(' · ')} 조회 실패. 해당 영역의 최신 상태를 확인할 수 없습니다.</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><StateFilter targets={targets} value={filter} onChange={setFilter} /><SearchInput aria-label="대상 검색" placeholder="대상, 주소, 환경명 검색" value={data.query} onChange={(event) => data.onQueryChange(event.target.value)} wrapperClassName="w-full sm:w-72" /></div>
    {data.variant === 'B' ? <UptimeInspector targets={filtered} /> : data.variant === 'C' ? <UptimeGroups targets={filtered} /> : <UptimeTable targets={filtered} search={data.query} />}
  </div>;
}

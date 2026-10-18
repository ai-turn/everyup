// THROWAWAY — A: environment/service state board, B: inventory matrix, C: temporal investigation.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink, MaterialIcon, StatusLight } from '../../components/common';
import type { AgentServiceFlat, ConnectedAgent, InfrastructureResource, ObservedService, TimelineIncident, UptimeMonitor } from '../../services/api';
import { formatDuration, formatIncidentTime } from '../../utils/incidentFormat';
import { dockerUptimeState, isCollectorFresh } from '../../utils/operationalStatus';

interface Attention {
  id: string; title: string; detail: string; to: string; tone: 'warn' | 'error'; icon: string; observedAt?: string; timeLabel?: string;
}
interface Props {
  variant: string;
  attention: Attention[];
  timeline: TimelineIncident[];
  agents: ConnectedAgent[];
  services: AgentServiceFlat[];
  monitors: UptimeMonitor[];
  observed: ObservedService[];
  infrastructure: InfrastructureResource[];
  failedSources: string[];
  updatedAt: Date;
  onRefresh: () => void;
}

function Intro({ title, question, updatedAt, onRefresh }: { title: string; question: string; updatedAt: Date; onRefresh: () => void }) {
  return <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ui-border pb-4">
    <div><p className="mb-1 type-caption text-text-muted">모니터링 개요</p><h1 className="type-page-title text-text-base">{title}</h1><p className="mt-2 text-sm text-text-muted">{question}</p></div>
    <div className="flex items-center gap-2"><span className="type-caption text-text-muted">{updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준</span><Button variant="secondary" size="sm" onClick={onRefresh}><MaterialIcon name="refresh" />갱신</Button></div>
  </header>;
}

function DataNotice({ failedSources }: { failedSources: string[] }) {
  return failedSources.length > 0 ? <p role="status" className="border-b border-ui-border py-3 text-sm text-status-warn">일부 데이터를 불러오지 못했습니다. 아래 정보는 확인된 범위이며, 실패한 소스의 이전 데이터가 포함될 수 있습니다.</p> : null;
}

type BoardState = 'up' | 'down' | 'paused' | 'waiting' | 'stale' | 'unknown';
interface BoardTarget { id: string; name: string; to: string; state: BoardState; protocol: string }
const boardStates = {
  up: { tone: 'healthy', label: '정상' }, down: { tone: 'error', label: '장애' },
  paused: { tone: 'idle', label: '일시정지' }, waiting: { tone: 'idle', label: '확인 대기' },
  stale: { tone: 'warn', label: '수집 지연' }, unknown: { tone: 'warn', label: '확인 불가' },
} as const;

function TargetTiles({ targets }: { targets: BoardTarget[] }) {
  return <ul className="grid gap-2 sm:grid-cols-2">{targets.map((target) => <li key={target.id} className="min-w-0">
    <Link to={target.to} className="flex h-full min-h-20 items-center justify-between gap-3 rounded-lg border border-ui-border-soft p-3 transition-colors hover:border-ui-border hover:bg-ui-hover-soft">
      <span className="min-w-0"><span className="block truncate type-card-title text-text-base" title={target.name}>{target.name}</span><span className="mt-1 block type-caption text-text-muted">{target.protocol}</span></span>
      <StatusLight {...boardStates[target.state]} />
    </Link>
  </li>)}</ul>;
}

function GroupSummary({ targets }: { targets: BoardTarget[] }) {
  const counts = new Map<BoardState, number>();
  targets.forEach((target) => counts.set(target.state, (counts.get(target.state) ?? 0) + 1));
  return <div className="flex flex-wrap gap-x-4 gap-y-2">{(['down', 'unknown', 'stale', 'waiting', 'up', 'paused'] as const).filter((state) => counts.has(state)).map((state) => <StatusLight key={state} tone={boardStates[state].tone} label={`${boardStates[state].label} ${counts.get(state)}`} />)}</div>;
}

function DirectMonitorPanel({ targets, failed }: { targets: BoardTarget[]; failed: boolean }) {
  return <section aria-label="직접 추가한 업타임 모니터" className="rounded-xl border border-ui-border bg-bg-surface p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="type-section-title">직접 추가한 모니터</h2><p className="mt-1 type-caption text-text-muted">외부 HTTP·TCP 응답 체크 · {failed ? '최신 상태 확인 불가' : `${targets.length}개`}</p></div><GroupSummary targets={targets} /></div>
    {targets.length > 0 ? <TargetTiles targets={targets} /> : <p className="text-sm text-text-muted">{failed ? '모니터 상태를 불러오지 못했습니다.' : '직접 추가한 업타임 모니터가 없습니다.'}</p>}
  </section>;
}

function DataConnections({ data }: { data: Props }) {
  const failed = new Set(data.failedSources);
  return (
    <section aria-label="데이터 수집 연결">
      <div className="mb-3"><h2 className="type-section-title">데이터 수집 연결</h2><p className="mt-1 text-sm text-text-muted">로그·메트릭과 인프라 수집 상태입니다. 위의 가용성 체크와 구분합니다.</p></div>
      <div className="grid gap-4 xl:grid-cols-2">
        <article className="min-w-0 rounded-xl border border-ui-border bg-bg-surface p-4 sm:p-5"><h3 className="type-card-title">직접 연결 서비스 <span className="ml-1 font-normal text-text-muted">{failed.has('observed') ? '확인 불가' : data.observed.length}</span></h3><ul className="mt-3 divide-y divide-ui-border-soft">{data.observed.map((service) => <li key={service.id}><Link to={`/logs/${service.id}`} className="flex min-h-16 items-center justify-between gap-3 py-3 hover:text-action"><span className="min-w-0"><span className="block truncate type-label">{service.name}</span><span className="mt-1 block type-caption text-text-muted">{service.signals.join(' · ') || 'Telemetry'}</span></span><StatusLight tone={failed.has('observed') || (service.isActive && !service.lastSeenAt) ? 'warn' : 'idle'} label={failed.has('observed') ? '확인 불가' : !service.isActive ? '일시정지' : service.lastSeenAt ? '수신 기록 있음' : '수신 대기'} /></Link></li>)}</ul>{data.observed.length === 0 && <p className="mt-3 text-sm text-text-muted">{failed.has('observed') ? '연결 목록 확인 불가' : '연결한 서비스 없음'}</p>}</article>
        <article className="min-w-0 rounded-xl border border-ui-border bg-bg-surface p-4 sm:p-5"><h3 className="type-card-title">인프라 리소스 <span className="ml-1 font-normal text-text-muted">{failed.has('infrastructure') ? '확인 불가' : data.infrastructure.length}</span></h3><ul className="mt-3 divide-y divide-ui-border-soft">{data.infrastructure.map((resource) => <li key={resource.id}><Link to={`/infrastructure/${resource.id}`} className="flex min-h-16 items-center justify-between gap-3 py-3 hover:text-action"><span className="min-w-0"><span className="block truncate type-label">{resource.name}</span><span className="mt-1 block type-caption text-text-muted">{resource.lastSeenAt ? `${formatIncidentTime(resource.lastSeenAt)} 수신` : '수신 기록 없음'}</span></span><StatusLight tone={failed.has('infrastructure') || (resource.isActive && !isCollectorFresh(resource.lastSeenAt)) ? 'warn' : resource.isActive ? 'healthy' : 'idle'} label={failed.has('infrastructure') ? '확인 불가' : !resource.isActive ? '일시정지' : isCollectorFresh(resource.lastSeenAt) ? '수신 중' : '수집 확인'} /></Link></li>)}</ul>{data.infrastructure.length === 0 && <p className="mt-3 text-sm text-text-muted">{failed.has('infrastructure') ? '연결 목록 확인 불가' : '연결한 리소스 없음'}</p>}</article>
      </div>
    </section>
  );
}

function OverviewStateBoard(data: Props) {
  const failed = new Set(data.failedSources);
  const servicesByAgent = new Map<string, AgentServiceFlat[]>();
  data.services.forEach((service) => servicesByAgent.set(service.agentId, [...(servicesByAgent.get(service.agentId) ?? []), service]));
  const agentMap = new Map(data.agents.map((agent) => [agent.id, agent]));
  const environmentIds = [...new Set([...agentMap.keys(), ...servicesByAgent.keys()])];
  const dockerTargets = (services: AgentServiceFlat[]): BoardTarget[] => services.map((service) => ({
    id: `${service.agentId}/${service.key}`, name: service.name, to: `/services/${service.agentId}/${encodeURIComponent(service.key)}`,
    state: failed.has('services') ? 'unknown' : dockerUptimeState(service), protocol: service.checkType.toUpperCase(),
  }));
  const directTargets: BoardTarget[] = data.monitors.map((monitor) => ({
    id: monitor.id, name: monitor.name, to: `/uptime/${monitor.id}`, protocol: monitor.type.toUpperCase(),
    state: failed.has('monitors') ? 'unknown' : !monitor.isActive ? 'paused' : monitor.status === 'healthy' ? 'up' : monitor.status === 'unhealthy' ? 'down' : 'waiting',
  }));
  const allTargets = [...dockerTargets(data.services), ...directTargets];
  const empty = environmentIds.length + data.monitors.length + data.observed.length + data.infrastructure.length === 0;
  return <div className="space-y-6 pb-36">
    <Intro title="서비스·환경 현황" question="어느 환경에서 어떤 서비스가 동작하고 있는지 한눈에 확인하세요." {...data} />
    <DataNotice failedSources={data.failedSources} />
    <section aria-label="서비스 체크 현황" className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border pb-4">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2"><h2 className="type-section-title text-text-base">업타임 체크 <span className="ml-1 tabular-nums">{failed.has('services') || failed.has('monitors') ? '조회된 ' : ''}{allTargets.length}</span></h2><GroupSummary targets={allTargets} /></div>
      <ButtonLink variant="ghost" size="sm" to="/uptime">전체 목록 <MaterialIcon name="arrow_forward" size={16} /></ButtonLink>
    </section>
    {empty && !data.failedSources.some((source) => source !== 'timeline') && <section className="rounded-xl border border-ui-border bg-bg-surface p-6"><h2 className="type-section-title">아직 연결한 대상이 없습니다</h2><p className="mt-2 text-sm text-text-muted">Docker 환경을 연결하거나 업타임 모니터를 추가하면 서비스 상태가 이곳에 표시됩니다.</p><div className="mt-4 flex flex-wrap gap-2"><ButtonLink variant="secondary" to="/environments">Docker 연결</ButtonLink><ButtonLink variant="ghost" to="/uptime">업타임 추가</ButtonLink></div></section>}
    <section aria-label="Docker 환경별 서비스 상태">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 className="type-section-title">Docker 환경 <span className="ml-1 text-sm font-normal text-text-muted">{failed.has('agents') ? '목록 확인 불가' : `${environmentIds.length}개 표시`}</span></h2><p className="type-caption text-text-muted">Collector 수신과 서비스 체크를 각각 표시합니다</p></div>
      <div className="grid items-start gap-4 xl:grid-cols-2">{environmentIds.map((id) => {
        const agent = agentMap.get(id);
        const services = servicesByAgent.get(id) ?? [];
        const targets = dockerTargets(services);
        const fresh = isCollectorFresh(agent?.lastSeenAt);
        return <article key={id} className="min-w-0 rounded-xl border border-ui-border bg-bg-surface p-4 sm:p-5" aria-label={agent?.name ?? services[0]?.agentName ?? '환경 미확인'}>
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="truncate type-section-title"><Link to={`/agents/${id}`} className="text-text-base hover:text-action">{agent?.name ?? services[0]?.agentName ?? '환경 미확인'}</Link></h3><p className="mt-1 type-caption text-text-muted">서비스 체크 {failed.has('services') ? '확인 불가' : `${targets.length}개`}</p></div>
            <div className="text-right"><StatusLight tone={!failed.has('agents') && fresh ? 'healthy' : 'warn'} label={failed.has('agents') || !agent ? 'Collector 확인 불가' : fresh ? 'Collector 수신 중' : 'Collector 수집 지연'} /><p className="mt-1 type-caption text-text-muted">{agent?.lastSeenAt ? `${formatIncidentTime(agent.lastSeenAt)} 수신` : '수신 기록 없음'}</p></div>
          </header>
          {targets.length > 0 ? <><div className="mb-3"><GroupSummary targets={targets} /></div><TargetTiles targets={targets} /></> : <p className="rounded-lg bg-ui-hover-soft p-4 text-sm text-text-muted">{failed.has('services') ? '서비스 상태를 불러오지 못했습니다.' : '이 환경에 등록된 서비스 체크가 없습니다.'}</p>}
        </article>;
      })}</div>
      {environmentIds.length === 0 && <p className="rounded-xl border border-ui-border p-4 text-sm text-text-muted">{failed.has('agents') || failed.has('services') ? '환경과 서비스 상태를 확인할 수 없습니다.' : '연결한 Docker 환경이 없습니다.'}</p>}
    </section>
    <DirectMonitorPanel targets={directTargets} failed={failed.has('monitors')} />
    <DataConnections data={data} />
    <details className="rounded-xl border border-ui-border bg-bg-surface p-4"><summary className="cursor-pointer type-label">최근 장애·복구 기록 {failed.has('timeline') ? '확인 불가' : `${data.timeline.length}개`}</summary><p className="mt-3 type-caption text-text-muted">최근 7일 중 조회된 최신 6개까지의 기록입니다.</p><ul className="mt-2 divide-y divide-ui-border-soft">{data.timeline.map((event) => <li key={`${event.targetPath}/${event.startedAt}`}><Link to={event.targetPath} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="text-action">{event.targetName}</span><span className="text-text-muted">{event.active ? '진행 중' : '복구'} · {formatIncidentTime(event.startedAt)} · {formatDuration(event.durationSec)}</span></Link></li>)}</ul>{data.timeline.length === 0 && <p className="mt-3 text-sm text-text-muted">{failed.has('timeline') ? '기록을 불러오지 못했습니다.' : '조회된 장애 기록이 없습니다.'}</p>}</details>
  </div>;
}

function OverviewMatrix(data: Props) {
  const failedSources = new Set(data.failedSources);
  return <div className="space-y-5 pb-36">
    <Intro title="어디까지 확인하고 있나요?" question="환경별 서비스 상태와 수집 연결을 나란히 비교합니다." {...data} />
    <DataNotice failedSources={data.failedSources} />
    <section className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
      <div className="border-b border-ui-border p-4"><h2 className="type-card-title">Docker 환경별 비교</h2><p className="mt-1 text-sm text-text-muted">환경의 연결 상태와 내부 서비스 체크는 서로 다른 신호입니다.</p></div>
      {data.agents.length === 0 ? <p className="p-6 text-sm text-text-muted">{failedSources.has('agents') ? '환경 목록 확인 불가' : '연결한 Docker 환경이 없습니다.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-2xl text-left text-sm"><thead className="border-b border-ui-border bg-ui-hover-soft text-text-muted"><tr>{['환경', 'Collector 수신', '서비스 체크', '마지막 수신', '탐색'].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{data.agents.map((agent) => {
        const services = data.services.filter((service) => service.agentId === agent.id);
        const states = services.map(dockerUptimeState);
        const upCount = states.filter((state) => state === 'up').length;
        const downCount = states.filter((state) => state === 'down').length;
        const fresh = isCollectorFresh(agent.lastSeenAt);
        return <tr key={agent.id} className="border-t border-ui-border-soft"><td className="px-4 py-5 font-medium"><Link to={`/agents/${agent.id}`} className="text-action">{agent.name}</Link></td><td className="px-4 py-5"><StatusLight tone={failedSources.has('agents') ? 'warn' : fresh ? 'healthy' : 'warn'} label={failedSources.has('agents') ? '확인 불가' : fresh ? '수신 중' : '수집 지연'} /></td><td className="px-4 py-5">{failedSources.has('services') ? '확인 불가' : <div className="flex flex-wrap gap-x-4 gap-y-1"><span>{upCount} 정상</span><span className={downCount > 0 ? 'text-status-error' : ''}>{downCount} 장애</span><span className="text-text-muted">{states.length - upCount - downCount} 대기·중지·지연</span></div>}</td><td className="px-4 py-5 text-text-muted">{agent.lastSeenAt ? formatIncidentTime(agent.lastSeenAt) : '없음'}</td><td className="px-4 py-5"><ButtonLink size="sm" variant="ghost" to={`/agents/${agent.id}`}>환경 탐색</ButtonLink></td></tr>;
      })}</tbody></table></div>}
    </section>
    <section><div className="mb-3 flex flex-wrap items-baseline justify-between gap-3"><h2 className="type-section-title">직접 연결한 대상</h2><p className="text-sm text-text-muted">HTTP/TCP 상태와 Telemetry 수신을 구분합니다.</p></div><div className="grid gap-4 lg:grid-cols-3">
      <article className="rounded-xl border border-ui-border bg-bg-surface p-4"><h3 className="type-card-title">업타임 모니터</h3><p className="mt-1 text-sm text-text-muted">외부 HTTP/TCP 응답 확인</p><ul className="mt-3 divide-y divide-ui-border-soft">{data.monitors.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><Link to={`/uptime/${item.id}`} className="min-w-0 truncate text-sm text-action">{item.name}</Link><StatusLight tone={failedSources.has('monitors') ? 'warn' : !item.isActive ? 'idle' : item.status === 'unhealthy' ? 'error' : item.status === 'healthy' ? 'healthy' : 'idle'} label={failedSources.has('monitors') ? '확인 불가' : !item.isActive ? '중지' : item.status === 'unhealthy' ? '장애' : item.status === 'healthy' ? '정상' : '대기'} /></li>)}</ul>{data.monitors.length === 0 && <p className="mt-4 text-sm text-text-muted">{failedSources.has('monitors') ? '목록 확인 불가' : '등록한 대상 없음'}</p>}</article>
      <article className="rounded-xl border border-ui-border bg-bg-surface p-4"><h3 className="type-card-title">직접 연결 서비스</h3><p className="mt-1 text-sm text-text-muted">Telemetry 수신 여부</p><ul className="mt-3 divide-y divide-ui-border-soft">{data.observed.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><Link to={`/logs/${item.id}`} className="truncate text-sm text-action">{item.name}</Link><span className="shrink-0 type-caption text-text-muted">{failedSources.has('observed') ? '확인 불가' : !item.isActive ? '중지' : item.lastSeenAt ? '수신 기록 있음' : '수신 대기'}</span></li>)}</ul>{data.observed.length === 0 && <p className="mt-4 text-sm text-text-muted">{failedSources.has('observed') ? '목록 확인 불가' : '등록한 대상 없음'}</p>}</article>
      <article className="rounded-xl border border-ui-border bg-bg-surface p-4"><h3 className="type-card-title">인프라 리소스</h3><p className="mt-1 text-sm text-text-muted">Collector 마지막 수신</p><ul className="mt-3 divide-y divide-ui-border-soft">{data.infrastructure.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><Link to={`/infrastructure/${item.id}`} className="truncate text-sm text-action">{item.name}</Link><span className="shrink-0 type-caption text-text-muted">{failedSources.has('infrastructure') ? '확인 불가' : !item.isActive ? '중지' : isCollectorFresh(item.lastSeenAt) ? '수신 중' : '수집 확인'}</span></li>)}</ul>{data.infrastructure.length === 0 && <p className="mt-4 text-sm text-text-muted">{failedSources.has('infrastructure') ? '목록 확인 불가' : '등록한 대상 없음'}</p>}</article>
    </div></section>
  </div>;
}

function OverviewChronology(data: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState(1);
  const span = range * 86400_000;
  const now = data.updatedAt.getTime();
  const from = now - span;
  const visible = data.timeline.filter((item) => (item.endedAt ? Date.parse(item.endedAt) : now) >= from);
  const chosen = visible.find((item) => `${item.targetPath}${item.startedAt}` === selected) ?? visible[0];
  return <div className="space-y-5 pb-36">
    <Intro title="장애의 흐름을 살펴보세요" question="어떤 대상에서 언제 장애가 시작됐고, 얼마나 지속됐나요?" {...data} />
    <DataNotice failedSources={data.failedSources} />
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-ui-border bg-bg-surface"><div className="border-b border-ui-border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="type-card-title">조회된 최근 기록 · 이 범위에 {visible.length}개</h2><div className="flex gap-1" role="group" aria-label="이력 표시 범위">{[[1, '24시간'], [7, '7일']].map(([value, label]) => <Button key={value} size="sm" variant={range === value ? 'secondary' : 'ghost'} aria-pressed={range === value} onClick={() => setRange(Number(value))}>{label}</Button>)}</div></div><p className="mt-1 text-sm text-text-muted">최근 7일의 최신6개 이력에서 표시합니다. 빈 구간의 정상 여부는 이 데이터로 판단하지 않습니다.</p></div>
        {visible.length === 0 ? <p className="p-6 text-sm text-text-muted">{data.failedSources.includes('timeline') ? '이력 확인 불가' : '이 범위에서 조회된 장애 기록이 없습니다.'}</p> : <ul className="divide-y divide-ui-border-soft">{visible.map((item) => {
          const key = `${item.targetPath}${item.startedAt}`;
          const start = Math.max(0, (Date.parse(item.startedAt) - from) / span * 100);
          const end = Math.min(100, ((item.endedAt ? Date.parse(item.endedAt) : now) - from) / span * 100);
          return <li key={key}><button type="button" aria-pressed={chosen === item} onClick={() => setSelected(key)} className={`grid w-full gap-3 p-4 text-left hover:bg-ui-hover-soft sm:grid-cols-[140px_minmax(0,1fr)_100px] ${chosen === item ? 'bg-ui-hover-soft' : ''}`}><span><span className="block truncate type-label">{item.targetName}</span><span className="mt-1 block type-caption text-text-muted">{formatIncidentTime(item.startedAt)} 시작</span></span><span className="relative my-auto block h-7 border-x border-ui-border bg-ui-hover-soft"><span className={`absolute top-2 h-3 min-w-1 rounded-sm ${item.active ? 'bg-status-error' : 'bg-status-warn'}`} style={{ left: `${Math.min(99, start)}%`, width: `${Math.max(0.5, end - start)}%` }} /></span><span className="text-sm sm:text-right">{formatDuration(item.durationSec)}<span className={`mt-1 block type-caption ${item.active ? 'text-status-error' : 'text-text-muted'}`}>{item.active ? '진행 중' : '복구 기록'}</span></span></button></li>;
        })}</ul>}
        <div className="flex justify-between px-4 py-3 type-caption text-text-muted"><span>{range === 7 ? '7일 전' : '24시간 전'}</span><span>현재</span></div>
      </section>
      <aside className="space-y-5"><section className="rounded-xl border border-ui-border bg-bg-surface p-4"><h2 className="type-card-title">선택한 기록</h2>{chosen ? <div className="mt-4 space-y-3"><StatusLight tone={chosen.active ? 'error' : 'idle'} label={chosen.active ? '진행 중' : '복구 기록'} /><p className="type-section-title">{chosen.targetName}</p><p className="break-words text-sm text-text-muted">{chosen.message || 'Docker 상태에서 관측한 장애 구간입니다.'}</p><dl className="space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-text-muted">시작</dt><dd>{formatIncidentTime(chosen.startedAt)}</dd></div><div className="flex justify-between gap-3"><dt className="text-text-muted">지속</dt><dd>{formatDuration(chosen.durationSec)}</dd></div></dl><ButtonLink variant="secondary" to={chosen.targetPath}>상세 조사 <MaterialIcon name="arrow_forward" /></ButtonLink></div> : <p className="mt-3 text-sm text-text-muted">기록을 선택하면 세부 내용이 표시됩니다.</p>}</section><section><h2 className="type-card-title">현재 다른 확인 신호</h2><ul className="mt-3 space-y-3">{data.attention.slice(0, 4).map((item) => <li key={item.id}><Link to={item.to} className="block text-sm text-action">{item.title}</Link><p className="mt-1 text-sm text-text-muted">{item.detail}</p></li>)}</ul>{data.attention.length === 0 && <p className="mt-3 text-sm text-text-muted">{data.failedSources.some((source) => source !== 'timeline') ? '일부 상태 확인 불가' : '추가 확인 신호 없음'}</p>}</section></aside>
    </div>
  </div>;
}

export function OverviewPrototype(data: Props) {
  if (data.variant === 'B') return <OverviewMatrix {...data} />;
  if (data.variant === 'C') return <OverviewChronology {...data} />;
  return <OverviewStateBoard {...data} />;
}

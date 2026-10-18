// THROWAWAY — A: incident worklist, B: inventory matrix, C: temporal investigation.
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

function ScopeLinks({ data }: { data: Props }) {
  const rows = [['Docker 환경', data.agents.length, '/environments', 'agents'], ['업타임 모니터', data.monitors.length, '/uptime', 'monitors'], ['직접 연결 서비스', data.observed.length, '/logs', 'observed'], ['인프라 리소스', data.infrastructure.length, '/infrastructure', 'infrastructure']] as const;
  return <ul className="divide-y divide-ui-border-soft">{rows.map(([label, value, to, source]) => <li key={source}><Link to={to} className="flex min-h-12 items-center justify-between gap-3 py-3 text-sm hover:text-action"><span>{label}</span><span className="tabular-nums text-text-muted">{data.failedSources.includes(source) ? '확인 불가' : value}<MaterialIcon name="chevron_right" size={16} className="ml-2 inline" /></span></Link></li>)}</ul>;
}

function OverviewWorklist(data: Props) {
  const [filter, setFilter] = useState('all');
  const issues = data.attention.filter((item) => filter === 'all' || item.tone === filter);
  const active = new Map(data.timeline.filter((item) => item.active).map((item) => [item.targetPath, item]));
  const errors = data.attention.filter((item) => item.tone === 'error').length;
  return <div className="space-y-5 pb-36">
    <Intro title="지금 조사할 대상" question="어디에서 어떤 신호가 발생했고, 언제부터 이어지고 있나요?" {...data} />
    <DataNotice failedSources={data.failedSources} />
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-ui-border pb-4 text-sm">
      <p><strong className="mr-2 text-3xl font-bold tabular-nums text-text-base">{errors}</strong>장애 신호 대상</p><p><strong className="mr-2 text-2xl font-medium tabular-nums text-text-base">{data.attention.length - errors}</strong>수집 확인 대상</p>
      <p className="text-text-muted">같은 환경의 신호도 각각 표시됩니다.</p>
    </div>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_264px]">
      <section aria-label="조사할 대상" className="min-w-0 overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4"><h2 className="type-card-title">확인할 신호</h2><div className="flex flex-wrap gap-1" role="group" aria-label="신호 종류">{[['all', '전체'], ['error', '장애 신호'], ['warn', '수집 확인']].map(([value, label]) => <Button key={value} size="sm" variant={filter === value ? 'secondary' : 'ghost'} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</Button>)}</div></div>
        {issues.length === 0 ? <div className="p-6 text-sm text-text-muted">{data.failedSources.some((source) => source !== 'timeline') ? '조회되지 않은 상태가 있습니다. 전체 정상 여부는 아직 확인할 수 없습니다.' : '선택한 분류에서 확인할 신호가 없습니다.'}</div> : <ul className="divide-y divide-ui-border-soft">{issues.map((item) => {
          const episode = active.get(item.to.split('?')[0]);
          const related = data.timeline.filter((event) => event.targetPath === item.to.split('?')[0]);
          const environment = data.services.find((service) => `/services/${service.agentId}/${encodeURIComponent(service.key)}` === item.to.split('?')[0])?.agentName;
          return <li key={item.id}><Link to={item.to} className="grid gap-3 p-4 transition-colors hover:bg-ui-hover-soft sm:grid-cols-[minmax(0,1fr)_132px]">
            <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-3"><StatusLight tone={item.tone} label={item.tone === 'error' ? '장애 신호' : '수집 확인'} /><span className="type-caption text-text-muted">{item.to.startsWith('/uptime') ? '직접 체크' : item.to.startsWith('/services') ? `Docker 서비스 · ${environment ?? '환경 미확인'}` : '수집 연결'}</span></div><p className="break-words type-card-title text-text-base">{item.title}</p><p className="mt-1 break-words text-sm text-text-muted">{episode?.message || item.detail}</p>{related.length > 0 && <p className="mt-2 type-caption text-text-muted">최근 조회 이력에 {related.length}회 등장 · 이력과 함께 조사</p>}</div>
            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end"><p className="text-sm text-text-secondary">{episode ? <><span className="block">{formatIncidentTime(episode.startedAt)} 시작</span><span className="mt-1 block font-medium">{formatDuration(episode.durationSec)} 경과</span></> : item.timeLabel || (item.observedAt ? `${formatIncidentTime(item.observedAt)} 확인` : '시작 시각 없음')}</p><span className="type-caption text-action">대상 조사 <MaterialIcon name="arrow_forward" size={16} className="inline" /></span></div>
          </Link></li>;
        })}</ul>}
      </section>
      <aside className="min-w-0 space-y-6"><section><h2 className="type-card-title">확인 중인 범위</h2><ScopeLinks data={data} /></section><section className="border-t border-ui-border pt-4"><h2 className="type-card-title">최근 복구</h2><p className="mt-1 type-caption text-text-muted">최근 7일 중 조회된 이력</p><ul className="mt-3 space-y-4">{data.timeline.filter((item) => !item.active).slice(0, 3).map((item) => <li key={`${item.targetPath}${item.startedAt}`}><Link to={item.targetPath} className="block text-sm text-action">{item.targetName}</Link><p className="mt-1 type-caption text-text-muted">{formatIncidentTime(item.endedAt ?? item.startedAt)} · {formatDuration(item.durationSec)} 지속</p></li>)}</ul>{!data.timeline.some((item) => !item.active) && <p className="mt-3 text-sm text-text-muted">{data.failedSources.includes('timeline') ? '이력 확인 불가' : '조회된 복구 기록 없음'}</p>}</section></aside>
    </div>
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
  return <OverviewWorklist {...data} />;
}

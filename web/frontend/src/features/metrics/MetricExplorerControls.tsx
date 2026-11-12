import { useId, useState } from 'react';
import { Button, Input, MaterialIcon, SearchInput, Select, SegmentedControl } from '../../components/common';
import { Tooltip } from '../../components/common/Tooltip';
import type { MetricQueryResult } from '../../services/api';
import { metricSeriesLabel } from './metricSeries';
import { useMetricQuery } from './useMetricQuery';

function readFilters(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { return {}; }
}

export function MetricExplorerControls({ data, pending, sum, mode }: { data: MetricQueryResult | null; pending: boolean; sum: boolean; mode: 'raw' | 'rate' }) {
  const query = useMetricQuery();
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [valueType, setValueType] = useState('string');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const filters = readFilters(query.attributes);
  const setFilters = (next: Record<string, unknown>) => query.update({ metricAttributes: Object.keys(next).length ? JSON.stringify(next) : null, metricSeries: null });
  const selected = data?.selectedSeries ?? [];
  const [open, setOpen] = useState<'filter' | 'series' | null>(null);
  const panelId = useId();
  const filterCount = Object.keys(filters).length;
  const toggle = (panel: 'filter' | 'series') => ({
    variant: open === panel ? 'secondary' as const : 'ghost' as const,
    'aria-expanded': open === panel,
    'aria-controls': open === panel ? panelId : undefined,
    onClick: () => setOpen(current => current === panel ? null : panel),
  });
  const visible = data?.series.filter(item => metricSeriesLabel(item.attributes, item.streamKey, item.streamLabel).toLowerCase().includes(search.toLowerCase())) ?? [];

  // 차트 제목 아래 한 줄: 값 표시 · 필터 · 시리즈 버튼과 적용한 필터 칩. 필터·시리즈 목록은 그 아래로 펼친다.
  return <div className="mb-3 space-y-3">
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="탐색 조건">
      {sum && <>
        <SegmentedControl size="md" ariaLabel="메트릭 값 표시" value={mode} options={[{ value: 'raw', label: '원값' }, { value: 'rate', label: '초당 증가량' }]} onChange={next => query.update({ metricMode: next })} />
        {mode === 'rate' && <Tooltip content="단조 증가하는 sum만 계산합니다. 누적 시작 정보가 없거나 수집이 재시작된 지점은 비워 둡니다. 알림 임계값은 원값 기준입니다." focusable>
          <span role="img" aria-label="초당 증가량 계산 기준" className="inline-flex h-11 w-8 items-center justify-center rounded-md text-text-muted sm:h-9"><MaterialIcon name="info" /></span>
        </Tooltip>}
      </>}
      <Button size="md" {...toggle('filter')}><MaterialIcon name="chevron_right" className={open === 'filter' ? 'rotate-90' : undefined} />Attribute 필터{filterCount ? ` (${filterCount})` : ''}</Button>
      <Button size="md" {...toggle('series')}><MaterialIcon name="chevron_right" className={open === 'series' ? 'rotate-90' : undefined} />시리즈 선택 ({selected.length}/{data?.series.length ?? 0}{data?.seriesTruncated ? '+' : ''})</Button>
      {Object.entries(filters).map(([name, val]) => <Button key={name} variant="secondary" size="md" className="max-w-full" aria-label={`${name} 필터 제거`} onClick={() => { const next = { ...filters }; delete next[name]; setFilters(next); }}><span className="min-w-0 truncate font-mono">{name}={JSON.stringify(val)}</span><MaterialIcon name="close" className="shrink-0" /></Button>)}
      {(query.attributes || query.series || query.mode !== null) && <Button variant="ghost" size="md" onClick={() => query.update({ metricAttributes: null, metricSeries: null, metricMode: null })}>메트릭 조회 초기화</Button>}
    </div>
    {open === 'filter' && <div id={panelId} className="space-y-3 rounded-lg border border-ui-border p-4">
        <p className="type-body text-text-muted">모든 조건에 정확히 일치하는 시리즈를 조회합니다. 문자열과 숫자를 구분합니다.</p>
        <form onSubmit={event => {
          event.preventDefault();
          let parsed: unknown = value;
          if (!key.trim()) { setError('Attribute key를 입력해 주세요.'); return; }
          if (valueType === 'number') {
            if (!value.trim() || !Number.isFinite(Number(value))) { setError('숫자를 입력해 주세요.'); return; }
            parsed = Number(value);
          }
          if (valueType === 'boolean') {
            if (value !== 'true' && value !== 'false') { setError('true 또는 false를 입력해 주세요.'); return; }
            parsed = value === 'true';
          }
          if (valueType === 'null') parsed = null;
          const next = { ...filters, [key.trim()]: parsed };
          if (Object.keys(next).length > 8) { setError('필터는 8개까지 추가할 수 있습니다.'); return; }
          if (new TextEncoder().encode(JSON.stringify(next)).length > 4096) { setError('필터가 너무 깁니다. key나 값을 줄여 주세요.'); return; }
          setFilters(next); setKey(''); setValue(''); setError('');
        }} className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 basis-48 space-y-1.5 type-label">Attribute key<Input mono value={key} onChange={event => setKey(event.target.value)} placeholder="http.request.method" /></label>
          <label className="min-w-0 flex-1 basis-48 space-y-1.5 type-label">값<Input mono value={value} disabled={valueType === 'null'} onChange={event => setValue(event.target.value)} placeholder={valueType === 'boolean' ? 'true 또는 false' : 'GET'} /></label>
          <label className="w-32 space-y-1.5 type-label">값 타입<Select aria-label="Attribute 값 타입" value={valueType} onChange={event => setValueType(event.target.value)}><option value="string">문자열</option><option value="number">숫자</option><option value="boolean">참·거짓</option><option value="null">null</option></Select></label>
          <Button type="submit" variant="secondary">필터 적용</Button>
        </form>
        {error && <p role="alert" className="type-body text-status-error">{error}</p>}
    </div>}
    {open === 'series' && <div id={panelId} className="space-y-3 rounded-lg border border-ui-border p-4">
        <div className="flex flex-wrap items-center gap-3"><p className="type-body text-text-muted">차트와 분포에 최대 6개를 함께 표시합니다.</p><Button variant="ghost" size="sm" onClick={() => query.update({ metricSeries: null })}>기본 선택</Button></div>
        <SearchInput aria-label="Attribute 조합으로 시리즈 찾기" placeholder="Attribute 조합으로 찾기" value={search} onChange={event => setSearch(event.target.value)} />
        <div className="max-h-64 space-y-2 overflow-y-auto" aria-label="시리즈 목록" aria-busy={pending}>
          {visible.map(item => <Button key={item.id} variant={selected.includes(item.id) ? 'secondary' : 'quiet'} size="md" className="w-full justify-start" title={metricSeriesLabel(item.attributes, item.streamKey, item.streamLabel)} aria-pressed={selected.includes(item.id)} disabled={pending || (!selected.includes(item.id) && selected.length >= 6)} onClick={() => {
            const next = selected.includes(item.id) ? selected.filter(id => id !== item.id) : [...selected, item.id];
            query.update({ metricSeries: JSON.stringify(next) });
          }}><MaterialIcon name={selected.includes(item.id) ? 'check' : 'add'} className="shrink-0" /><span className="min-w-0 truncate text-left font-mono">{metricSeriesLabel(item.attributes, item.streamKey, item.streamLabel)}</span></Button>)}
          {visible.length === 0 && <p className="type-body text-text-muted">일치하는 시리즈가 없습니다.</p>}
        </div>
        {selected.some(id => !data?.series.some(item => item.id === id)) && <p className="type-body text-text-muted">선택한 시리즈 일부가 현재 목록에 없습니다. 기본 선택으로 돌아가거나 Attribute 필터를 좁혀 주세요.</p>}
        {data?.seriesTruncated && <p className="type-body text-text-muted">시리즈 목록은 처음 200개까지 표시합니다. Attribute 필터를 좁혀 다른 시리즈를 찾아 주세요.</p>}
    </div>}
  </div>;
}

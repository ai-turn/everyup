import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errors';
import { Button, IconButton, MaterialIcon, EmptyState, ConfirmDialog, Toggle, SegmentedControl, SearchInput, ListToolbar, Select } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { api, type AlertRule, type NotificationChannel, type AgentServiceFlat, type ConnectedAgent, type InfrastructureResource, type ObservedService } from '../../../services/api';
import { getChannelStyle } from '../utils/channelMeta';
import { AlertRuleForm } from './AlertRuleForm';
import { FormSidePanel } from './FormSidePanel';
import { SeverityBadge } from './SeverityBadge';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { matchesAlertTarget, type AlertTarget } from '../alertTarget';

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const ENDPOINT_METRICS = new Set(['http_status', 'response_time']);

const OPERATOR_SYMBOLS: Record<string, string> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  eq: '=',
};

type CategoryKey = 'all' | 'endpoint' | 'log' | 'resource' | 'system';

function ruleCategory(rule: AlertRule): Exclude<CategoryKey, 'all'> {
  if (rule.isSystem) return 'system';
  if (rule.type === 'service') return 'endpoint';
  if (rule.type === 'log') return 'log';
  return 'resource';
}

function targetLabel(rule: AlertRule, agentServices: AgentServiceFlat[], agents: ConnectedAgent[], directServices: ObservedService[], infrastructureResources: InfrastructureResource[]): string {
  if (rule.type === 'service' || rule.type === 'log') {
    if (rule.serviceId) return directServices.find(service => service.id === rule.serviceId)?.name ?? rule.serviceId;
    if (rule.agentId && rule.serviceKey) {
      const svc = agentServices.find(s => s.agentId === rule.agentId && s.key === rule.serviceKey);
      return svc ? `${svc.agentName} / ${svc.name}` : rule.serviceKey;
    }
    return rule.type === 'log' ? '전체 로그 서비스' : '전체 헬스체크';
  }
  if (rule.agentId) return infrastructureResources.find(resource => resource.id === rule.agentId)?.name ?? agents.find(a => a.id === rule.agentId)?.name ?? rule.agentId;
  return '전체 인프라';
}

const CATEGORY_LABELS: Record<Exclude<CategoryKey, 'all'>, string> = {
  endpoint: '헬스체크',
  log: '로그',
  resource: '인프라',
  system: '시스템',
};

const METRIC_LABELS: Record<string, string> = {
  cpu: 'CPU',
  memory: '메모리',
  disk: '디스크',
  status_change: '상태 변경',
  http_status: 'HTTP 상태',
  response_time: '응답 시간',
  log_level: '로그 레벨',
  api_status_code: 'API 상태',
};

// 연산자별 서술어. 없는 연산자는 기호 표기로 폴백한다.
const OPERATOR_WORDS: Record<string, string> = {
  gt: '초과',
  gte: '이상',
  lt: '미만',
  lte: '이하',
  eq: '같음',
};

function categoryLabel(category: Exclude<CategoryKey, 'all'>): string {
  return CATEGORY_LABELS[category];
}

function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric;
}

function thresholdValue(rule: AlertRule): string {
  const unit = rule.metric === 'response_time' ? 'ms' : ENDPOINT_METRICS.has(rule.metric) || rule.metric === 'log_level' || rule.metric === 'api_status_code' ? '' : '%';
  return `${rule.threshold}${unit}`;
}

function conditionExpr(rule: AlertRule): string {
  const metric = metricLabel(rule.metric);
  const value = thresholdValue(rule);
  const word = OPERATOR_WORDS[rule.operator];
  if (word) return `${metric} ${value} ${word}`;
  return `${metric} ${OPERATOR_SYMBOLS[rule.operator] ?? rule.operator} ${value}`;
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}시간`;
  }
  return `${minutes}분`;
}

function formatSeconds(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    return `${seconds / 3600}시간`;
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60}분`;
  }
  return `${seconds}초`;
}

function evaluationSummary(rule: AlertRule): string {
  if (rule.type === 'service') {
    return '헬스체크 결과가 조건에 맞을 때마다 평가';
  }
  if (rule.type === 'log') {
    return '로그/API 이벤트마다 평가';
  }
  if (rule.isSystem) {
    return '시스템에서 자동 평가';
  }
  return `${formatMinutes(rule.duration)} 동안 지속 · ${formatSeconds(rule.cooldown)} 쿨다운`;
}

function compactTrigger(rule: AlertRule): string {
  if (rule.isSystem) {
    return '시스템에서 자동 평가';
  }
  if (rule.type === 'log') {
    return `${conditionExpr(rule)} · 즉시`;
  }
  if (rule.type === 'service') {
    return `${conditionExpr(rule)} · ${rule.duration}회 연속`;
  }
  return `${conditionExpr(rule)} · ${formatMinutes(rule.duration)} 지속`;
}

type SortKey = 'severity' | 'name' | 'target' | 'category';
type SortDir = 'asc' | 'desc';

interface AlertRulesTabProps {
  addTrigger?: number;
  target?: AlertTarget | null;
}

export function AlertRulesTab({ addTrigger, target }: AlertRulesTabProps) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [directServices, setDirectServices] = useState<ObservedService[]>([]);
  const [infrastructureResources, setInfrastructureResources] = useState<InfrastructureResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Rule form — right slide-over panel
  const [formOpen, setFormOpen] = useState(false);
  const [formRule, setFormRule] = useState<AlertRule | undefined>(undefined);
  const [formLoading, setFormLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'on' | 'off'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const loadData = async () => {
    try {
      const [rulesData, channelsData, agentSvcs, agts, directRows, infrastructureRows] = await Promise.all([
        api.getAlertRules(),
        api.getNotificationChannels(),
        api.getAllAgentServicesFlat(),
        api.getAgents(),
        api.getObservedServices(),
        api.getInfrastructureResources(),
      ]);
      setRules(rulesData);
      setChannels(channelsData);
      setAgentServices(agentSvcs ?? []);
      setAgents(agts ?? []);
      setDirectServices(directRows ?? []);
      setInfrastructureResources(infrastructureRows ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (addTrigger) handleAddRule();
  }, [addTrigger]);

  const handleToggle = async (id: string) => {
    setTogglingIds(prev => new Set(prev).add(id));
    try {
      const result = await api.toggleAlertRule(id);
      setRules(prev => prev.map(r => r.id === id ? { ...r, isEnabled: result.isEnabled } : r));
      toast.success(result.isEnabled ? '규칙이 활성화되었습니다' : '규칙이 비활성화되었습니다');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await api.deleteAlertRule(deleteTargetId);
      toast.success('규칙이 삭제되었습니다');
      setDeleteTargetId(null);
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const closeForm = () => { setFormOpen(false); setFormRule(undefined); };
  const onFormSuccess = () => { closeForm(); loadData(); };

  const handleAddRule = () => { setFormRule(undefined); setFormLoading(false); setFormOpen(true); };

  // Edit fetches the full rule (list rows may omit channelIds) — same as the old page.
  const handleEdit = async (rule: AlertRule) => {
    setFormRule(undefined);
    setFormOpen(true);
    setFormLoading(true);
    try {
      setFormRule(await api.getAlertRuleById(rule.id));
    } catch (error) {
      toast.error(getErrorMessage(error));
      closeForm();
    } finally {
      setFormLoading(false);
    }
  };

  const filteredRules = useMemo(() => {
    const filtered = rules.filter(r => {
      if (target && !matchesAlertTarget(r, target)) return false;
      if (categoryFilter !== 'all' && ruleCategory(r) !== categoryFilter) return false;
      if (severityFilter !== 'all' && r.severity !== severityFilter) return false;
      if (enabledFilter !== 'all' && (enabledFilter === 'on' ? !r.isEnabled : r.isEnabled)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const target = targetLabel(r, agentServices, agents, directServices, infrastructureResources).toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !target.includes(q)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let v = 0;
      if (sortKey === 'severity') v = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      else if (sortKey === 'name') v = a.name.localeCompare(b.name);
      else if (sortKey === 'target') v = targetLabel(a, agentServices, agents, directServices, infrastructureResources).localeCompare(targetLabel(b, agentServices, agents, directServices, infrastructureResources));
      else if (sortKey === 'category') v = ruleCategory(a).localeCompare(ruleCategory(b));
      return sortDir === 'asc' ? v : -v;
    });
  }, [rules, categoryFilter, severityFilter, enabledFilter, searchQuery, sortKey, sortDir, agentServices, agents, directServices, infrastructureResources, target]);

  const selectedTargetLabel = target?.kind === 'direct'
    ? directServices.find((service) => service.id === target.serviceId)?.name ?? target.serviceId
    : target
      ? (() => {
          const service = agentServices.find((item) => item.agentId === target.agentId && item.key === target.serviceKey);
          return service ? `${service.agentName} / ${service.name}` : target.serviceKey;
        })()
      : null;
  const targetNotice = selectedTargetLabel && (
    <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary" role="status">
      <MaterialIcon size={20} name="filter_alt" />
      <span className="truncate">대상: {selectedTargetLabel}</span>
    </div>
  );

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const clearFilters = () => {
    setCategoryFilter('all');
    setSeverityFilter('all');
    setEnabledFilter('all');
    setSearchQuery('');
  };

  // Inline expanding form — reuses AlertRuleForm; submit button lives here and
  // targets the form via form="alert-rule-form" (same wiring as the old page).
  const formActions = (
    <div className="flex items-center gap-2 shrink-0">
      <Button type="button" variant="secondary" onClick={closeForm}>
        취소
      </Button>
      <Button
        type="submit"
        form="alert-rule-form"
        disabled={formLoading || isSubmitting}
      >
        {isSubmitting ? (
          <MaterialIcon size={20} name="sync" className="animate-spin" />
        ) : (
          <>
            <MaterialIcon size={20} name="check" />
            {formRule ? '저장' : '규칙 생성'}
          </>
        )}
      </Button>
    </div>
  );

  const formPanel = (
    <FormSidePanel
      open={formOpen}
      icon="rule"
      title={formRule
        ? '알림 규칙 수정'
        : '새 알림 규칙'}
      onClose={closeForm}
      footer={formActions}
    >
      {formLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <MaterialIcon size={32} name="sync" className="text-primary animate-spin" />
        </div>
      ) : (
        <AlertRuleForm
          rule={formRule}
          channels={channels}
          onSuccess={onFormSuccess}
          onCancel={closeForm}
          onSubmittingChange={setIsSubmitting}
        />
      )}
    </FormSidePanel>
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <MaterialIcon size={32} name="sync" className="text-primary animate-spin mx-auto mb-2 block" />
        로딩 중...
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <>
        {formPanel}
        {targetNotice}
        <div className="bg-bg-surface border border-ui-border rounded-xl">
          <EmptyState
            icon="rule"
            title="구성된 알림 규칙이 없습니다"
            action={{ label: '추가하기', onClick: handleAddRule }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {formPanel}
      {targetNotice}
      {/* Filter bar — category pills + severity/enabled + search */}
      <ListToolbar search={
        <div className="relative">
          <SearchInput
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="규칙 이름 또는 대상 검색"
            placeholder="규칙 이름 · 대상 검색"
            className="pr-7"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700"
              aria-label="검색어 지우기"
              title="검색어 지우기"
            >
              <MaterialIcon size={20} name="close" />
            </button>
          )}
        </div>
      }>
        <SegmentedControl
          size="md"
          ariaLabel="카테고리"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: 'all', label: '전체' },
            { value: 'endpoint', label: '헬스체크' },
            { value: 'log', label: '로그' },
            { value: 'resource', label: '인프라' },
            { value: 'system', label: '시스템 규칙' },
          ]}
        />

        <Select
          aria-label="전체 심각도"
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value as typeof severityFilter)}
          wrapperClassName="w-36"
        >
          <option value="all">전체 심각도</option>
          <option value="critical">심각</option>
          <option value="warning">경고</option>
          <option value="info">정보</option>
        </Select>

        <Select
          aria-label="전체 상태"
          value={enabledFilter}
          onChange={e => setEnabledFilter(e.target.value as typeof enabledFilter)}
          wrapperClassName="w-36"
        >
          <option value="all">전체 상태</option>
          <option value="on">활성</option>
          <option value="off">비활성</option>
        </Select>
      </ListToolbar>

      {/* Table */}
      <div className="bg-bg-surface border border-ui-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] table-fixed text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-bg-surface-dark/50 border-b border-ui-border">
                <SortableTH className="w-[260px]" label="규칙" active={sortKey === 'name'} dir={sortDir} onClick={() => onSort('name')} />
                <SortableTH className="w-[110px]" label="심각도" active={sortKey === 'severity'} dir={sortDir} onClick={() => onSort('severity')} />
                <SortableTH className="w-[200px]" label="대상" active={sortKey === 'target'} dir={sortDir} onClick={() => onSort('target')} />
                <th className="w-[250px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  발생 조건
                </th>
                <th className="w-[120px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  채널
                </th>
                <th className="w-[120px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  최근 발동
                </th>
                <th className="w-[120px] px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-text-muted">
                    조건에 맞는 규칙이 없습니다{' · '}
                    <button onClick={clearFilters} className="text-primary hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded">
                      필터 초기화
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRules.map(rule => {
                  const cat = ruleCategory(rule);
                  return (
                    <tr
                      key={rule.id}
                      className={`border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-ui-border-dark/50 dark:hover:bg-ui-hover-dark/40 ${!rule.isEnabled ? 'bg-ui-hover-soft/60' : ''}`}
                    >
                      <td className="px-4 py-2.5 align-middle">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`truncate font-medium ${rule.isEnabled ? 'text-text-base' : 'text-text-muted'}`}>
                            {rule.name}
                          </span>
                          {rule.isSystem && (
                            <MaterialIcon size={20} name="lock" className="shrink-0 text-slate-400" />
                          )}
                        </div>
                        <p className="truncate text-xs text-text-dim">
                          {rule.isSystem
                            ? '시스템 기본 규칙 · 삭제 불가, 채널만 변경 가능'
                            : categoryLabel(cat)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <SeverityBadge severity={rule.severity} />
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <span
                          className="inline-block max-w-full truncate rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-ui-hover-dark dark:text-text-base-dark"
                          title={targetLabel(rule, agentServices, agents, directServices, infrastructureResources)}
                        >
                          {targetLabel(rule, agentServices, agents, directServices, infrastructureResources)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-middle text-sm">
                        <p className="truncate text-text-secondary" title={evaluationSummary(rule)}>
                          {compactTrigger(rule)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <ChannelAvatars rule={rule} channels={channels} />
                      </td>
                      <td className="px-4 py-2.5 align-middle text-sm text-text-muted whitespace-nowrap">
                        {rule.lastTriggeredAt
                          ? formatDistanceToNow(new Date(rule.lastTriggeredAt), { addSuffix: true, locale: ko })
                          : <span className="text-text-dim">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right align-middle whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Toggle
                            checked={rule.isEnabled}
                            onChange={() => handleToggle(rule.id)}
                            disabled={togglingIds.has(rule.id)}
                            title={rule.isEnabled ? '비활성화' : '활성화'}
                          />
                          <IconButton icon="edit" label="수정" size="sm" onClick={() => handleEdit(rule)} />
                          <IconButton
                            icon="delete_outline"
                            label={rule.isSystem ? '시스템 규칙은 삭제할 수 없습니다' : '삭제'}
                            size="sm"
                            tone="danger"
                            disabled={rule.isSystem || isDeleting}
                            onClick={() => setDeleteTargetId(rule.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDeleteConfirm}
        title="알림 규칙 삭제"
        message={`"${rules.find(r => r.id === deleteTargetId)?.name ?? deleteTargetId}" 규칙을 삭제하시겠습니까?`}
        description="이 작업은 되돌릴 수 없습니다."
        variant="danger"
        isProcessing={isDeleting}
      />
    </>
  );
}

function SortableTH({ label, active, dir, onClick, className = '' }: { label: string; active: boolean; dir: SortDir; onClick: () => void; className?: string }) {
  return (
    <th
      aria-sort={active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}
      className={`select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex cursor-pointer items-center gap-1 uppercase tracking-wider ${active ? 'text-text-base' : ''}`}
      >
        {label}
        <span className={active ? 'opacity-100' : 'opacity-30'}>{active && dir === 'desc' ? '↓' : '↑'}</span>
      </button>
    </th>
  );
}

const MAX_CHANNEL_AVATARS = 4;

function ChannelAvatars({ rule, channels }: { rule: AlertRule; channels: NotificationChannel[] }) {

  // Empty channelIds = the rule notifies all channels
  const ruleChannels = !rule.channelIds || rule.channelIds.length === 0
    ? channels
    : rule.channelIds
        .map(cid => channels.find(c => c.id === cid))
        .filter((c): c is NotificationChannel => !!c);

  if (ruleChannels.length === 0) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 text-sm text-text-dim">
        <MaterialIcon size={20} name="notifications_off" className="shrink-0" />
        <span className="truncate">등록된 알림 채널이 없습니다</span>
      </span>
    );
  }

  const visible = ruleChannels.slice(0, MAX_CHANNEL_AVATARS);
  const overflow = ruleChannels.length - visible.length;
  const names = ruleChannels.map(c => c.name).join(', ');

  return (
    <div className="flex items-center" title={names}>
      {visible.map((ch, i) => {
        const style = getChannelStyle(ch.type);
        return (
          <div
            key={ch.id}
            className={`flex h-6 w-6 items-center justify-center rounded-md ring-2 ring-white dark:ring-bg-surface-dark ${style.bg} ${i > 0 ? '-ml-1.5' : ''}`}
          >
            <ChannelIcon type={ch.type} size={13} className={style.text} />
          </div>
        );
      })}
      {overflow > 0 && (
        <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500 ring-2 ring-white dark:bg-ui-hover-dark dark:text-text-muted-dark dark:ring-bg-surface-dark">
          +{overflow}
        </span>
      )}
    </div>
  );
}

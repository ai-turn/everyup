import { Tooltip } from '../../../components/common/Tooltip';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errors';
import { Button, IconButton, MaterialIcon, EmptyState, ConfirmDialog, Toggle, SegmentedControl, SearchInput, ListToolbar, Select } from '../../../components/common';
import { api, type AlertRule, type NotificationChannel } from '../../../services/api';
import { alertTargetName, categoryLabel, compactTrigger, evaluationSummary, ruleCategory, SEVERITY_ORDER, targetLabel, useTargetNames, type CategoryKey } from '../ruleDisplay';
import { ChannelAvatars } from './ChannelAvatars';
import { LoadErrorBanner } from './LoadErrorBanner';
import { AlertRuleForm, type AlertRuleFormInitial } from './AlertRuleForm';
import { FormSidePanel } from './FormSidePanel';
import { FormActions } from './FormLayout';
import { SeverityBadge } from './SeverityBadge';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { alertTargetInitial, matchesAlertTarget, type AlertTarget } from '../alertTarget';
import { useListView } from '../../../hooks/useListView';

type SortKey = 'severity' | 'name' | 'target' | 'category';
type SortDir = 'asc' | 'desc';

/** 상단 `추가`나 URL(`new=metric`)이 규칙 폼을 열 때 보내는 요청. 탭이 받아 폼을 연 뒤 onAddRequestHandled로 비운다. */
export interface RuleAddRequest { initial?: AlertRuleFormInitial }

interface AlertRulesTabProps {
  /** 규칙·채널은 AlertsPage 한 곳이 갖는다 — 탭 숫자와 목록이 같은 값을 본다(A-14). */
  rules: AlertRule[];
  channels: NotificationChannel[];
  rulesLoading: boolean;
  rulesError: string | null;
  onReloadRules: () => void;
  onToggleRule: (id: string) => void;
  togglingIds: Set<string>;
  addRequest?: RuleAddRequest | null;
  onAddRequestHandled?: () => void;
  target?: AlertTarget | null;
  onClearTarget?: () => void;
}

export function AlertRulesTab({ rules, channels, rulesLoading, rulesError, onReloadRules, onToggleRule, togglingIds, addRequest, onAddRequestHandled, target, onClearTarget }: AlertRulesTabProps) {
  const { view } = useListView();
  const names = useTargetNames();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Rule form — right slide-over panel
  const [formOpen, setFormOpen] = useState(false);
  const [formRule, setFormRule] = useState<AlertRule | undefined>(undefined);
  const [formInitial, setFormInitial] = useState<AlertRuleFormInitial | undefined>(undefined);
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

  // 요청을 비워 두면 탭을 다시 열 때 폼이 또 열리지 않는다.
  useEffect(() => {
    if (!addRequest) return;
    onAddRequestHandled?.();
    handleAddRule(addRequest.initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 요청이 올 때 한 번만 연다. 대상 등은 그 시점의 값을 쓴다.
  }, [addRequest]);

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await api.deleteAlertRule(deleteTargetId);
      toast.success('규칙이 삭제되었습니다');
      setDeleteTargetId(null);
      onReloadRules();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const closeForm = () => { setFormOpen(false); setFormRule(undefined); };
  const onFormSuccess = () => { closeForm(); onReloadRules(); };

  // 대상 필터가 걸린 목록에서 추가하면 그 대상을 폼에 채운다(A-09).
  const handleAddRule = (initial?: AlertRuleFormInitial) => {
    setFormRule(undefined);
    setFormInitial({ ...alertTargetInitial(target ?? null), ...initial });
    setFormLoading(false);
    setFormOpen(true);
  };

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
        const target = targetLabel(r, names).toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !target.includes(q)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let v = 0;
      if (sortKey === 'severity') v = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      else if (sortKey === 'name') v = a.name.localeCompare(b.name);
      else if (sortKey === 'target') v = targetLabel(a, names).localeCompare(targetLabel(b, names));
      else if (sortKey === 'category') v = ruleCategory(a).localeCompare(ruleCategory(b));
      return sortDir === 'asc' ? v : -v;
    });
  }, [rules, categoryFilter, severityFilter, enabledFilter, searchQuery, sortKey, sortDir, names, target]);

  const selectedTargetLabel = target ? alertTargetName(target, names) : null;
  const targetNotice = selectedTargetLabel && (
    <div className="flex items-center gap-2 rounded-xl border border-ui-border bg-bg-surface px-3 py-2 text-sm text-text-secondary" role="status">
      <MaterialIcon size={20} name="filter_alt" className="text-action" />
      <span className="min-w-0 flex-1 truncate">대상: {selectedTargetLabel}</span>
      {onClearTarget && <Button variant="ghost" size="sm" onClick={onClearTarget}>대상 해제</Button>}
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
    <FormActions formId="alert-rule-form" isEdit={!!formRule} isSubmitting={isSubmitting} disabled={formLoading} onCancel={closeForm} />
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
          <MaterialIcon size={32} name="sync" className="text-action animate-spin" />
        </div>
      ) : (
        <AlertRuleForm
          rule={formRule}
          initial={formInitial}
          channels={channels}
          onSuccess={onFormSuccess}
          onCancel={closeForm}
          onSubmittingChange={setIsSubmitting}
        />
      )}
    </FormSidePanel>
  );

  if (rulesLoading) {
    return (
      <div className="p-8 text-center text-text-muted">
        <MaterialIcon size={32} name="sync" className="text-action animate-spin mx-auto mb-2 block" />
        로딩 중…
      </div>
    );
  }

  const errorBanner = rulesError && <LoadErrorBanner title="알림 규칙을 불러오지 못했습니다" message={rulesError} onRetry={onReloadRules} />;

  // 조회에 실패했으면 빈 상태 대신 배너만 보인다 — "규칙이 없다"고 말하지 않는다.
  if (rules.length === 0) {
    return (
      <>
        {formPanel}
        {targetNotice}
        {errorBanner}
        {!rulesError && <div className="bg-bg-surface border border-ui-border rounded-xl">
          <EmptyState
            icon="rule"
            title="구성된 알림 규칙이 없습니다"
            action={{ label: '추가', onClick: () => handleAddRule() }}
          />
        </div>}
      </>
    );
  }

  return (
    <>
      {formPanel}
      {targetNotice}
      {errorBanner}
      {/* Filter bar — category pills + severity/enabled + search */}
      <ListToolbar search={
        <div className="relative">
          <SearchInput
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="규칙 이름 또는 대상 검색"
            placeholder="규칙 이름 · 대상 검색"
            className="pr-10"
          />
          {searchQuery && (
            <IconButton icon="close" label="검색어 지우기" tone="quiet" size="sm" onClick={() => setSearchQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2" />
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
            { value: 'request', label: 'API 요청' },
            { value: 'log', label: '로그' },
            { value: 'metric', label: '메트릭' },
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
      {view === 'card' ? <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="규칙 정렬">{([{ key: 'name', label: '이름' }, { key: 'severity', label: '심각도' }, { key: 'target', label: '대상' }] as const).map(({ key, label }) => <Button key={key} variant={sortKey === key ? 'secondary' : 'ghost'} size="sm" aria-pressed={sortKey === key} onClick={() => onSort(key)}>{label}{sortKey === key ? sortDir === 'asc' ? ' ↑' : ' ↓' : ''}</Button>)}</div>
        {filteredRules.length === 0 ? <p className="rounded-xl border border-ui-border p-5 text-sm text-text-muted">조건에 맞는 규칙이 없습니다 <Button variant="ghost" size="sm" onClick={clearFilters}>필터 초기화</Button></p> :
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredRules.map(rule => <article key={rule.id} aria-label={rule.name} className="min-w-0 rounded-xl border border-ui-border bg-bg-surface p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate type-card-title">{rule.name}</h2><p className="mt-1 type-caption text-text-muted">{rule.isSystem ? '시스템 기본 규칙 · 삭제 불가' : categoryLabel(ruleCategory(rule))}</p></div><SeverityBadge severity={rule.severity} /></div>
            <p className="mt-4 break-words text-sm text-text-secondary">{targetLabel(rule, names)}</p><Tooltip content={evaluationSummary(rule)} focusable><p className="mt-2 break-words text-sm text-text-muted">{compactTrigger(rule)}</p></Tooltip>
            <div className="mt-3"><ChannelAvatars rule={rule} channels={channels} /></div><p className="mt-3 type-caption text-text-muted">최근 발동 {rule.lastTriggeredAt ? formatDistanceToNow(new Date(rule.lastTriggeredAt), { addSuffix: true, locale: ko }) : '없음'}</p>
            <div className="mt-4 flex items-center justify-end gap-2"><Toggle checked={rule.isEnabled} onChange={() => onToggleRule(rule.id)} disabled={togglingIds.has(rule.id)} ariaLabel={rule.name} /><IconButton icon="edit" label="수정" onClick={() => handleEdit(rule)} /><IconButton icon="delete_outline" label={rule.isSystem ? '시스템 규칙은 삭제할 수 없습니다' : '삭제'} tone="danger" aria-disabled={rule.isSystem || undefined} disabled={isDeleting} onClick={() => { if (!rule.isSystem) setDeleteTargetId(rule.id); }} /></div>
          </article>)}</div>}
      </div> : (
      <div className="bg-bg-surface border border-ui-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table aria-label="알림 규칙 그리드" className="w-full min-w-[1180px] table-fixed text-sm">
            <thead>
              <tr className="bg-ui-table-header border-b border-ui-border">
                <SortableTH className="w-[260px]" label="규칙" active={sortKey === 'name'} dir={sortDir} onClick={() => onSort('name')} />
                <SortableTH className="w-[110px]" label="심각도" active={sortKey === 'severity'} dir={sortDir} onClick={() => onSort('severity')} />
                <SortableTH className="w-[200px]" label="대상" active={sortKey === 'target'} dir={sortDir} onClick={() => onSort('target')} />
                <th className="w-[250px] px-4 py-3 text-left text-xs font-medium text-text-muted">
                  발생 조건
                </th>
                <th className="w-[120px] px-4 py-3 text-left text-xs font-medium text-text-muted">
                  채널
                </th>
                <th className="w-[120px] px-4 py-3 text-left text-xs font-medium text-text-muted">
                  최근 발동
                </th>
                {/* 1180px 테이블이 노트북 폭에서 가로 스크롤될 때도 작업 열은 보이게 오른쪽에 고정한다. */}
                <th className="sticky right-0 w-[120px] border-l border-ui-border-soft bg-ui-table-header px-4 py-3 text-right text-xs font-medium text-text-muted">
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-text-muted">
                    조건에 맞는 규칙이 없습니다{' · '}
                    <Button variant="ghost" size="sm" onClick={clearFilters}>필터 초기화</Button>
                  </td>
                </tr>
              ) : (
                filteredRules.map(rule => {
                  const cat = ruleCategory(rule);
                  return (
                    <tr
                      key={rule.id}
                      className={`group border-t border-ui-border-soft transition-colors hover:bg-ui-hover-soft ${!rule.isEnabled ? 'bg-ui-hover-soft/60' : ''}`}
                    >
                      <td className="px-4 py-2.5 align-middle">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`truncate font-medium ${rule.isEnabled ? 'text-text-base' : 'text-text-muted'}`}>
                            {rule.name}
                          </span>
                          {rule.isSystem && (
                            <MaterialIcon size={20} name="lock" className="shrink-0 text-text-dim" />
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
                        {/* 잘린 이름을 마우스로 볼 수 있게만 한다. 글자는 DOM에 있어 낭독되므로 Tab 정지점을 만들지 않는다(A-15). */}
                        {/* 대상은 분류라 칩이 아니라 맨 텍스트다(§5.3 칩은 상태 전용). */}
                        <Tooltip content={targetLabel(rule, names)}><span
                          className="block max-w-full truncate text-sm text-text-secondary"
                        >
                          {targetLabel(rule, names)}
                        </span></Tooltip>
                      </td>
                      <td className="px-4 py-2.5 align-middle text-sm">
                        <Tooltip content={evaluationSummary(rule)} focusable><p className="truncate text-text-secondary">
                          {compactTrigger(rule)}
                        </p></Tooltip>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <ChannelAvatars rule={rule} channels={channels} />
                      </td>
                      <td className="px-4 py-2.5 align-middle text-sm text-text-muted whitespace-nowrap">
                        {rule.lastTriggeredAt
                          ? formatDistanceToNow(new Date(rule.lastTriggeredAt), { addSuffix: true, locale: ko })
                          : <span className="text-text-dim">-</span>}
                      </td>
                      <td className="sticky right-0 border-l border-ui-border-soft bg-bg-surface px-4 py-2 text-right align-middle whitespace-nowrap transition-colors group-hover:bg-ui-hover-soft">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Toggle
                            checked={rule.isEnabled}
                            onChange={() => onToggleRule(rule.id)}
                            disabled={togglingIds.has(rule.id)}
                            title={rule.isEnabled ? '비활성화' : '활성화'}
                            ariaLabel={rule.name}
                          />
                          <IconButton icon="edit" label="수정" size="sm" onClick={() => handleEdit(rule)} />
                          <IconButton
                            icon="delete_outline"
                            label={rule.isSystem ? '시스템 규칙은 삭제할 수 없습니다' : '삭제'}
                            size="sm"
                            tone="danger"
                            // 시스템 규칙은 aria-disabled — 키보드로도 삭제 불가 이유를 확인한다.
                            aria-disabled={rule.isSystem || undefined}
                            disabled={isDeleting}
                            onClick={() => { if (!rule.isSystem) setDeleteTargetId(rule.id); }}
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
      )}

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
      className={`select-none px-4 py-3 text-left text-xs font-medium text-text-muted ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex cursor-pointer items-center gap-1 ${active ? 'text-text-base' : ''}`}
      >
        {label}
        <span className={active ? 'opacity-100' : 'opacity-30'}>{active && dir === 'desc' ? '↓' : '↑'}</span>
      </button>
    </th>
  );
}

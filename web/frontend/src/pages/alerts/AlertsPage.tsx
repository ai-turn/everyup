import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errors';
import { api, type NotificationChannel, type AlertRule, type NotificationHistory, type NotificationStats, type NotificationChannelHealth } from '../../services/api';
import { AlertsDesktopView } from '../../features/alerts/components/AlertsDesktopView';
import { AlertsMobileView } from '../../features/alerts/components/AlertsMobileView';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { ConfirmDialog } from '../../components/common';
import { alertTargetInitial, parseAlertTarget } from '../../features/alerts/alertTarget';
import { FormSidePanel } from '../../features/alerts/components/FormSidePanel';
import type { ChannelTestOutcome } from '../../features/alerts/components/ChannelHealthMeta';
import { FormActions } from '../../features/alerts/components/FormLayout';
import { AlertRuleForm, type AlertRuleFormInitial } from '../../features/alerts/components/AlertRuleForm';
import type { RuleAddRequest } from '../../features/alerts/components/AlertRulesTab';

type TabType = 'channels' | 'rules' | 'history';

function parseTabParam(value: string | null): TabType {
  // 메뉴에 들어온 이유(무엇을 감시하고 무엇이 발동했는가)가 첫 화면에 오도록 규칙이 기본이다(A-18).
  return value === 'rules' || value === 'history' || value === 'channels'
    ? value
    : 'rules';
}

export function AlertsPage() {

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const alertTarget = useMemo(() => parseAlertTarget(searchParams), [searchParams]);

  const [activeTab, setActiveTab] = useState<TabType>(() => parseTabParam(searchParams.get('tab')));
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [channelHealth, setChannelHealth] = useState<Record<string, NotificationChannelHealth>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  // 모바일은 규칙 표(AlertRulesTab)를 쓰지 않으므로 생성 폼 패널을 여기서 띄운다.
  const [mobileRuleFormOpen, setMobileRuleFormOpen] = useState(false);
  const [mobileRuleSubmitting, setMobileRuleSubmitting] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, ChannelTestOutcome>>({});
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [ruleAddRequest, setRuleAddRequest] = useState<RuleAddRequest | null>(null);
  const [mobileRuleInitial, setMobileRuleInitial] = useState<AlertRuleFormInitial | undefined>(undefined);
  // 모바일 규칙 카드의 수정·삭제(A-06). 수정은 목록 행에 없는 channelIds까지 받으려고 규칙을 다시 읽는다.
  const [mobileEditRule, setMobileEditRule] = useState<AlertRule | null>(null);
  const [pendingDeleteRuleId, setPendingDeleteRuleId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Data fetching ---
  const loadChannels = async () => {
    setChannelsError(null);
    try {
      const data = await api.getNotificationChannels();
      setChannels(data);
    } catch (error) {
      setChannelsError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const loadChannelHealth = async () => {
    try {
      const data = await api.getNotificationChannelHealth(7);
      const map: Record<string, NotificationChannelHealth> = {};
      for (const h of data) map[h.channelId] = h;
      setChannelHealth(map);
    } catch {
      // health is non-critical
    }
  };

  const loadRules = async () => {
    setRulesError(null);
    try {
      const data = await api.getAlertRules();
      setRules(data);
    } catch (error) {
      setRulesError(getErrorMessage(error));
    } finally {
      setRulesLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryError(null);
    try {
      const response = await api.getNotificationHistory({ limit: 30, offset: 0 });
      setHistory(response.items || []);
    } catch (error) {
      setHistoryError(getErrorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.getNotificationHistoryStats(7);
      setStats(data);
    } catch {
      // stats are non-critical
    }
  };

  useEffect(() => {
    loadChannels();
    loadChannelHealth();
    loadRules();
    loadHistory();
    loadStats();
  }, []);

  useEffect(() => {
    setActiveTab(parseTabParam(searchParams.get('tab')));
  }, [searchParams]);

  // `new=metric&metricName=…`(메트릭 단독 보기의 `알림 추가`)는 미리 채운 규칙 폼을 연다.
  // 연 뒤에는 URL에서 지워 새로고침해도 다시 열리지 않게 한다. 대상(target…)은 목록 필터로 남긴다.
  useEffect(() => {
    if (searchParams.get('new') !== 'metric') return;
    const initial: AlertRuleFormInitial = { ruleCategory: 'metric', metricName: searchParams.get('metricName') ?? '' };
    if (isMobile) { setMobileRuleInitial({ ...alertTargetInitial(alertTarget), ...initial }); setMobileRuleFormOpen(true); }
    else setRuleAddRequest({ initial });
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    next.delete('metricName');
    next.set('tab', 'rules');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isMobile, alertTarget]);

  const clearTarget = () => {
    const next = new URLSearchParams(searchParams);
    for (const key of ['target', 'serviceId', 'agentId', 'serviceKey', 'resourceId']) next.delete(key);
    setSearchParams(next);
  };

  const handleSetActiveTab = (tab: TabType) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  // --- Handlers ---
  const handleToggleChannel = async (id: string) => {
    setTogglingIds(prev => new Set(prev).add(id));
    try {
      const result = await api.toggleNotificationChannel(id);
      setChannels(prev =>
        prev.map(ch => ch.id === id ? { ...ch, isEnabled: result.isEnabled } : ch)
      );
      toast.success(result.isEnabled ? '채널이 활성화되었습니다' : '채널이 비활성화되었습니다');
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

  const handleDeleteChannel = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDeleteChannel = async () => {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    try {
      await api.deleteNotificationChannel(pendingDeleteId);
      toast.success('채널이 삭제되었습니다');
      setPendingDeleteId(null);
      refreshChannels();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const pendingDeleteChannel = pendingDeleteId
    ? channels.find(c => c.id === pendingDeleteId) ?? null
    : null;

  const handleTestChannel = async (id: string) => {
    setTestingIds(prev => new Set(prev).add(id));
    try {
      await api.testNotificationChannel(id);
      setTestResults(prev => ({ ...prev, [id]: { ok: true, at: new Date().toISOString() } }));
      toast.success('테스트 알림을 보냈습니다');
    } catch (error) {
      const message = getErrorMessage(error);
      setTestResults(prev => ({ ...prev, [id]: { ok: false, at: new Date().toISOString(), message } }));
      toast.error(message);
    } finally {
      setTestingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggleRule = async (id: string) => {
    setTogglingIds(prev => new Set(prev).add(id));
    try {
      const result = await api.toggleAlertRule(id);
      setRules(prev => prev.map(rule => rule.id === id ? { ...rule, isEnabled: result.isEnabled } : rule));
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

  const refreshChannels = () => {
    loadChannels();
    loadChannelHealth();
  };

  const handleAddChannel = () => {
    navigate('/alerts/channels/new');
  };

  const handleEditChannel = (channel: NotificationChannel) => {
    navigate(`/alerts/channels/${channel.id}/edit`);
  };

  const handleAddRule = () => {
    setRuleAddRequest({});
  };

  const openMobileRuleEdit = async (rule: AlertRule) => {
    try {
      setMobileEditRule(await api.getAlertRuleById(rule.id));
      setMobileRuleFormOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const closeMobileRuleForm = () => {
    setMobileRuleFormOpen(false);
    setMobileEditRule(null);
  };

  const confirmDeleteRule = async () => {
    if (!pendingDeleteRuleId) return;
    setIsDeleting(true);
    try {
      await api.deleteAlertRule(pendingDeleteRuleId);
      toast.success('규칙이 삭제되었습니다');
      setPendingDeleteRuleId(null);
      void loadRules();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };
  // --- Render ---
  const deleteDialog = (
    <ConfirmDialog
      isOpen={pendingDeleteChannel !== null}
      onClose={() => setPendingDeleteId(null)}
      onConfirm={confirmDeleteChannel}
      title="채널 삭제"
      message={
        <span>
          {''}
          <span className="text-text-base">{pendingDeleteChannel?.name}</span>
          {' 채널을 삭제하시겠습니까?'}
        </span>
      }
      description="이 작업은 되돌릴 수 없으며, 연결된 알림 규칙에서도 제거됩니다."
      confirmLabel="삭제"
      variant="danger"
      isProcessing={isDeleting}
    />
  );

  if (isMobile) {
    return (
      <>
        <AlertsMobileView
          channels={channels}
          channelHealth={channelHealth}
          rules={rules}
          alertTarget={alertTarget}
          history={history}
          stats={stats}
          isLoading={isLoading}
          rulesLoading={rulesLoading}
          historyLoading={historyLoading}
          activeTab={activeTab}
          setActiveTab={handleSetActiveTab}
          onAddChannel={handleAddChannel}
          onAddRule={() => { setMobileEditRule(null); setMobileRuleInitial(alertTargetInitial(alertTarget)); setMobileRuleFormOpen(true); }}
          onEditRule={(rule) => void openMobileRuleEdit(rule)}
          onDeleteRule={setPendingDeleteRuleId}
          onClearTarget={clearTarget}
          onEditChannel={handleEditChannel}
          onDeleteChannel={handleDeleteChannel}
          onToggleChannel={handleToggleChannel}
          onTestChannel={handleTestChannel}
          onToggleRule={handleToggleRule}
          togglingIds={togglingIds}
          testingIds={testingIds}
          testResults={testResults}
          errors={{ channels: channelsError, rules: rulesError, history: historyError }}
          onRetry={{ channels: refreshChannels, rules: loadRules, history: loadHistory }}
        />
        <FormSidePanel
          open={mobileRuleFormOpen}
          icon="rule"
          title={mobileEditRule ? '알림 규칙 수정' : '새 알림 규칙'}
          onClose={closeMobileRuleForm}
          footer={<FormActions formId="alert-rule-form" isEdit={!!mobileEditRule} isSubmitting={mobileRuleSubmitting} onCancel={closeMobileRuleForm} />}
        >
          <AlertRuleForm
            rule={mobileEditRule ?? undefined}
            channels={channels}
            initial={mobileRuleInitial}
            onSuccess={() => { closeMobileRuleForm(); void loadRules(); }}
            onCancel={closeMobileRuleForm}
            onSubmittingChange={setMobileRuleSubmitting}
          />
        </FormSidePanel>
        <ConfirmDialog
          isOpen={pendingDeleteRuleId !== null}
          onClose={() => setPendingDeleteRuleId(null)}
          onConfirm={confirmDeleteRule}
          title="알림 규칙 삭제"
          message={`"${rules.find(rule => rule.id === pendingDeleteRuleId)?.name ?? pendingDeleteRuleId}" 규칙을 삭제하시겠습니까?`}
          description="이 작업은 되돌릴 수 없습니다."
          variant="danger"
          isProcessing={isDeleting}
        />
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <AlertsDesktopView
        channels={channels}
        channelHealth={channelHealth}
        rules={rules}
        history={history}
        stats={stats}
        isLoading={isLoading}
        rulesLoading={rulesLoading}
        channelsError={channelsError}
        rulesError={rulesError}
        onRetryChannels={refreshChannels}
        onReloadRules={() => void loadRules()}
        onToggleRule={handleToggleRule}
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        togglingIds={togglingIds}
        testingIds={testingIds}
        testResults={testResults}
        ruleAddRequest={ruleAddRequest}
        onRuleAddRequestHandled={() => setRuleAddRequest(null)}
        alertTarget={alertTarget}
        onClearTarget={clearTarget}
        onChannelsChanged={refreshChannels}
        onDeleteChannel={handleDeleteChannel}
        onToggleChannel={handleToggleChannel}
        onTestChannel={handleTestChannel}
        onAddRule={handleAddRule}
      />
      {deleteDialog}
    </>
  );
}

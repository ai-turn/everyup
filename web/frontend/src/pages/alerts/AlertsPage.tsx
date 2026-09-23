import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errors';
import { api, type NotificationChannel, type AlertRule, type NotificationHistory, type NotificationStats, type NotificationChannelHealth } from '../../services/api';
import { AlertsDesktopView } from '../../features/alerts/components/AlertsDesktopView';
import { AlertsMobileView } from '../../features/alerts/components/AlertsMobileView';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { Button, ConfirmDialog, MaterialIcon } from '../../components/common';
import { parseAlertTarget } from '../../features/alerts/alertTarget';
import { FormSidePanel } from '../../features/alerts/components/FormSidePanel';
import { FormActions } from '../../features/alerts/components/FormLayout';
import { AlertRuleForm } from '../../features/alerts/components/AlertRuleForm';

type TabType = 'channels' | 'rules' | 'history';

function parseTabParam(value: string | null): TabType {
  return value === 'rules' || value === 'history' || value === 'channels'
    ? value
    : 'channels';
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
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [rulesAddTrigger, setRulesAddTrigger] = useState(0);
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
      toast.success('테스트 알림이 전송되었습니다!');
    } catch (error) {
      toast.error(getErrorMessage(error));
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
    setRulesAddTrigger(n => n + 1);
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

  const loadWarning = (channelsError || rulesError || historyError) ? (
    <section className="mb-5 flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
      <div className="flex items-start gap-3"><MaterialIcon size={20} name="sync_problem" className="mt-0.5 text-status-warn" /><div><p className="text-sm font-medium text-text-base">일부 알림 정보를 불러오지 못했습니다</p><p className="mt-0.5 text-xs text-text-muted">성공한 정보는 계속 표시합니다. 탭별 오류 영역에서 다시 시도할 수 있습니다.</p></div></div>
      <Button size="sm" variant="secondary" onClick={() => { void loadChannels(); void loadRules(); void loadHistory(); }}>모두 다시 시도</Button>
    </section>
  ) : null;

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
          onAddRule={() => setMobileRuleFormOpen(true)}
          onEditChannel={handleEditChannel}
          onDeleteChannel={handleDeleteChannel}
          onToggleChannel={handleToggleChannel}
          onTestChannel={handleTestChannel}
          onToggleRule={handleToggleRule}
          togglingIds={togglingIds}
          testingIds={testingIds}
          errors={{ channels: channelsError, rules: rulesError, history: historyError }}
          onRetry={{ channels: refreshChannels, rules: loadRules, history: loadHistory }}
        />
        <FormSidePanel
          open={mobileRuleFormOpen}
          icon="rule"
          title="새 알림 규칙"
          onClose={() => setMobileRuleFormOpen(false)}
          footer={<FormActions formId="alert-rule-form" isEdit={false} isSubmitting={mobileRuleSubmitting} onCancel={() => setMobileRuleFormOpen(false)} />}
        >
          <AlertRuleForm
            channels={channels}
            onSuccess={() => { setMobileRuleFormOpen(false); void loadRules(); }}
            onCancel={() => setMobileRuleFormOpen(false)}
            onSubmittingChange={setMobileRuleSubmitting}
          />
        </FormSidePanel>
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      {loadWarning}
      <AlertsDesktopView
        channels={channels}
        channelHealth={channelHealth}
        rules={rules}
        history={history}
        stats={stats}
        isLoading={isLoading}
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        togglingIds={togglingIds}
        rulesAddTrigger={rulesAddTrigger}
        alertTarget={alertTarget}
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

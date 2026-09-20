import { useState } from 'react';
import { Button, MaterialIcon, PageHeader, EmptyState, Toggle } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { AlertRulesTab } from './AlertRulesTab';
import { ChannelForm } from './ChannelForm';
import { FormSidePanel } from './FormSidePanel';
import { NotificationHistoryTab } from './NotificationHistoryTab';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import type {
  NotificationChannel,
  NotificationChannelHealth,
  AlertRule,
  NotificationHistory,
  NotificationStats,
} from '../../../services/api';
import { getChannelStyle, getChannelSubtitle } from '../utils/channelMeta';
import type { AlertTarget } from '../alertTarget';

type TabType = 'channels' | 'rules' | 'history';

interface AlertsDesktopViewProps {
  channels: NotificationChannel[];
  channelHealth: Record<string, NotificationChannelHealth>;
  rules: AlertRule[];
  history: NotificationHistory[];
  stats: NotificationStats | null;
  isLoading: boolean;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  togglingIds: Set<string>;
  rulesAddTrigger: number;
  alertTarget: AlertTarget | null;
  onChannelsChanged: () => void;
  onDeleteChannel: (id: string) => void;
  onToggleChannel: (id: string) => void;
  onTestChannel: (id: string) => void;
  onAddRule: () => void;
}

export function AlertsDesktopView({
  channels,
  channelHealth,
  rules,
  stats,
  isLoading,
  activeTab,
  setActiveTab,
  togglingIds,
  rulesAddTrigger,
  alertTarget,
  onChannelsChanged,
  onDeleteChannel,
  onToggleChannel,
  onTestChannel,
  onAddRule,
}: AlertsDesktopViewProps) {

  // Channel form — right slide-over panel (same pattern as the rules tab)
  const [channelFormOpen, setChannelFormOpen] = useState(false);
  const [channelFormTarget, setChannelFormTarget] = useState<NotificationChannel | undefined>(undefined);
  const [channelSubmitting, setChannelSubmitting] = useState(false);

  const openChannelForm = (channel?: NotificationChannel) => {
    setChannelFormTarget(channel);
    setChannelFormOpen(true);
  };
  const closeChannelForm = () => {
    setChannelFormOpen(false);
    setChannelFormTarget(undefined);
  };

  // 'failed' only for the history-tab mount triggered by the failed-logs link;
  // any normal tab click clears it (the key remounts the tab either way).
  const [historyStatus, setHistoryStatus] = useState<'failed' | undefined>(undefined);
  const selectTab = (tab: TabType) => {
    setHistoryStatus(undefined);
    setActiveTab(tab);
  };
  const viewFailedLogs = () => {
    setHistoryStatus('failed');
    setActiveTab('history');
  };

  const enabledRules = rules.filter(r => r.isEnabled).length;
  const totalSent = stats?.totalSent ?? 0;
  const totalFailed = stats?.totalFailed ?? 0;
  const successRate = stats ? Math.round(stats.successRate) : null;
  const totalNotifications = totalSent + totalFailed;
  const rateBarColor = successRate == null ? 'bg-slate-300'
    : successRate >= 95 ? 'bg-status-healthy'
    : successRate >= 80 ? 'bg-status-warn'
    : 'bg-status-error';

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'channels', label: '알림 채널', count: channels.length },
    { key: 'rules',    label: '알림 규칙',    count: rules.length },
    { key: 'history',  label: '알림 로그', count: totalNotifications || undefined },
  ];

  return (
    <>
      <PageHeader
        title="알림"
        subtitle="이상을 감지할 규칙과 알림을 받을 채널을 관리하고, 발송 이력을 확인합니다."
      >
        {activeTab !== 'history' && (
          <Button onClick={activeTab === 'rules' ? onAddRule : () => openChannelForm()}>
            <MaterialIcon size={16} name="add" />
            추가하기
          </Button>
        )}
      </PageHeader>

      {/* KPI stat bar — one card, divider-separated cells */}
      <div className="mb-5 grid grid-cols-5 divide-x divide-ui-border-soft rounded-xl border border-ui-border bg-bg-surface py-3.5">
        <div className="flex flex-col gap-0.5 px-5">
          <span className="text-xs text-text-muted">발송 (7일)</span>
          <span className="text-xl tabular-nums text-text-base">{totalSent}</span>
        </div>
        <div className="flex flex-col gap-0.5 px-5">
          <span className="text-xs text-text-muted">실패 (7일)</span>
          <span className="flex items-baseline gap-2.5">
            <span className={`text-xl tabular-nums ${totalFailed > 0 ? 'text-red-600 dark:text-red-400' : 'text-text-base'}`}>
              {totalFailed}
            </span>
            {totalFailed > 0 && (
              <button
                onClick={viewFailedLogs}
                className="text-xs font-medium text-primary hover:underline"
              >
                실패 로그 보기 →
              </button>
            )}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 px-5">
          <span className="text-xs text-text-muted">성공률</span>
          <span className="flex items-center gap-2">
            <span className="text-xl tabular-nums text-text-base">
              {successRate != null ? `${successRate}%` : '—'}
            </span>
            {successRate != null && (
              <span className="h-1 w-12 overflow-hidden rounded-full bg-ui-hover">
                <span className={`block h-full ${rateBarColor}`} style={{ width: `${successRate}%` }} />
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 px-5">
          <span className="text-xs text-text-muted">활성 규칙</span>
          <span className="text-xl tabular-nums text-text-base">{enabledRules}/{rules.length}</span>
        </div>
        <div className="flex flex-col gap-0.5 px-5">
          <span className="text-xs text-text-muted">활성 채널</span>
          <span className="text-xl tabular-nums text-text-base">
            {channels.filter(c => c.isEnabled).length}/{channels.length}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-end border-b border-ui-border mb-5">
        <div role="tablist" aria-label="알림" className="flex gap-0">
          {tabs.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => selectTab(tab.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
                activeTab === tab.key
                  ? 'text-text-base border-primary'
                  : 'text-text-muted border-transparent hover:text-text-base'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {tab.label}
                {tab.count != null && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                    activeTab === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-ui-hover text-text-muted'
                  }`}>{tab.count}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'history' ? (
        <NotificationHistoryTab key={historyStatus ?? 'default'} channels={channels} initialStatus={historyStatus} />
      ) : activeTab === 'channels' ? (
        <>
          <FormSidePanel
            open={channelFormOpen}
            icon="notifications"
            title={channelFormTarget
              ? '채널 편집'
              : '채널 추가'}
            onClose={closeChannelForm}
            footer={
              <ChannelFormActions
                isSubmitting={channelSubmitting}
                isEdit={!!channelFormTarget}
                onCancel={closeChannelForm}
              />
            }
          >
            <ChannelForm
              channel={channelFormTarget}
              onSuccess={onChannelsChanged}
              onCancel={closeChannelForm}
              onSubmittingChange={setChannelSubmitting}
            />
          </FormSidePanel>
          <ChannelsTable
            channels={channels}
            channelHealth={channelHealth}
            isLoading={isLoading}
            togglingIds={togglingIds}
            onAdd={() => openChannelForm()}
            onEdit={openChannelForm}
            onDelete={onDeleteChannel}
            onToggle={onToggleChannel}
            onTest={onTestChannel}
          />
        </>
      ) : (
        <AlertRulesTab addTrigger={rulesAddTrigger} target={alertTarget} />
      )}
    </>
  );
}

function ChannelFormActions({ isSubmitting, isEdit, onCancel }: { isSubmitting: boolean; isEdit: boolean; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button type="button" variant="secondary" onClick={onCancel}>
        취소
      </Button>
      <Button type="submit" form="channel-form" disabled={isSubmitting}>
        {isSubmitting ? (
          <MaterialIcon size={16} name="sync" className="animate-spin" />
        ) : (
          <>
            <MaterialIcon size={16} name="check" />
            {isEdit ? '저장' : '추가하기'}
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Channels grid ─────────────────────────────────────────────────

interface ChannelsGridProps {
  channels: NotificationChannel[];
  channelHealth: Record<string, NotificationChannelHealth>;
  isLoading: boolean;
  togglingIds: Set<string>;
  onAdd: () => void;
  onEdit: (channel: NotificationChannel) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onTest: (id: string) => void;
}

function ChannelsTable({ channels, channelHealth, isLoading, togglingIds, onAdd, onEdit, onDelete, onToggle, onTest }: ChannelsGridProps) {

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
        <div className="divide-y divide-ui-border-soft">
          {[1, 2, 3].map(i => (
            <div key={i} className="grid grid-cols-[minmax(220px,1.6fr)_90px_150px_110px_150px_180px] gap-4 px-4 py-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-ui-hover" />
                <div className="space-y-2">
                  <div className="h-3 w-32 rounded bg-ui-hover" />
                  <div className="h-2.5 w-20 rounded bg-ui-hover" />
                </div>
              </div>
              <div className="h-5 rounded bg-ui-hover" />
              <div className="h-5 rounded bg-ui-hover" />
              <div className="h-5 rounded bg-ui-hover" />
              <div className="h-5 rounded bg-ui-hover" />
              <div className="h-7 rounded bg-ui-hover" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="rounded-xl border border-ui-border bg-bg-surface">
        <EmptyState
          icon="notifications_off"
          title="구성된 알림 채널이 없습니다"
          description="Slack, Discord, Telegram 채널을 추가해 알림을 받아보세요."
          action={{ label: '추가하기', onClick: onAdd }}
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ui-border bg-bg-surface">
      <table className="w-full min-w-[960px] table-fixed">
        <thead className="bg-ui-hover-soft/40">
          <tr className="border-b border-ui-border">
            <th className="w-[280px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">채널</th>
            <th className="w-[90px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">상태</th>
            <th className="w-[150px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">7일 발송 / 실패</th>
            <th className="w-[110px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">연결 규칙</th>
            <th className="w-[160px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">최근 발송</th>
            <th className="w-[180px] px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-muted">작업</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ui-border-soft">
          {channels.map(channel => {
            const style = getChannelStyle(channel.type);
            const health = channelHealth[channel.id];
            const sent = health?.successCount ?? 0;
            const failed = health?.failedCount ?? 0;
            const total = sent + failed;
            const lastSent = health?.lastSentAt ? new Date(health.lastSentAt) : null;

            return (
              <tr
                key={channel.id}
                className={`transition-colors hover:bg-ui-hover-soft/40 ${!channel.isEnabled ? 'opacity-70' : ''}`}
              >
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.bg}`}>
                      <ChannelIcon type={channel.type} size={18} className={style.text} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text-base">{channel.name}</p>
                      <p className="truncate text-xs text-text-dim">
                        {getChannelSubtitle(channel.type)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={channel.isEnabled}
                    onChange={() => onToggle(channel.id)}
                    disabled={togglingIds.has(channel.id)}
                    title={channel.isEnabled ? '비활성화' : '활성화'}
                    ariaLabel={`${channel.name} ${channel.isEnabled ? '비활성화' : '활성화'}`}
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium tabular-nums">
                  {total > 0 ? (
                    <span className="text-text-base">
                      {sent}
                      {failed > 0 && (
                        <span className="text-red-600 dark:text-red-400"> · {`실패 ${failed}`}</span>
                      )}
                    </span>
                  ) : (
                    <span className="font-normal text-text-dim">이력 없음</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-text-secondary">
                  {`규칙 ${health?.ruleCount ?? 0}개`}
                </td>
                <td className="px-4 py-3 text-sm text-text-muted">
                  {lastSent
                    ? formatDistanceToNow(lastSent, { addSuffix: true, locale: ko })
                    : <span className="text-text-dim">— 테스트로 확인</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onTest(channel.id)}
                      disabled={!channel.isEnabled}
                      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ui-border-dark dark:bg-bg-surface-dark dark:text-text-base-dark dark:hover:bg-ui-hover-dark"
                    >
                      <MaterialIcon size={16} name="send" />
                      테스트
                    </button>
                    <button
                      onClick={() => onEdit(channel)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-ui-hover-dark dark:hover:text-white"
                      aria-label="수정" title="수정"
                    >
                      <MaterialIcon size={16} name="edit" />
                    </button>
                    <button
                      onClick={() => onDelete(channel.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                      aria-label="삭제" title="삭제"
                    >
                      <MaterialIcon size={16} name="delete_outline" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

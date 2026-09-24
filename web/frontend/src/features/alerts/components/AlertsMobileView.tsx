import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button, IconButton, MaterialIcon, PageHeader, Toggle } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { getChannelStyle } from '../utils/channelMeta';
import { ChannelHealthMeta } from './ChannelHealthMeta';
import type { NotificationChannel, NotificationChannelHealth, AlertRule, NotificationHistory, NotificationStats } from '../../../services/api';
import { severityLabel } from '../utils/severityLabel';
import { matchesAlertTarget, type AlertTarget } from '../alertTarget';

type MobileTab = 'channels' | 'rules' | 'history';

interface AlertsMobileViewProps {
  channels: NotificationChannel[];
  channelHealth: Record<string, NotificationChannelHealth>;
  rules: AlertRule[];
  alertTarget?: AlertTarget | null;
  history: NotificationHistory[];
  stats: NotificationStats | null;
  isLoading: boolean;
  rulesLoading: boolean;
  historyLoading: boolean;
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;
  onAddChannel: () => void;
  onAddRule: () => void;
  onEditChannel: (channel: NotificationChannel) => void;
  onDeleteChannel: (id: string) => void;
  onToggleChannel: (id: string) => void;
  onTestChannel: (id: string) => void;
  onToggleRule: (id: string) => void;
  togglingIds: Set<string>;
  testingIds: Set<string>;
  errors: { channels: string | null; rules: string | null; history: string | null };
  onRetry: { channels: () => void; rules: () => void; history: () => void };
}

const severityColors: Record<string, { text: string; bg: string }> = {
  critical: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  warning: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  info: { text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
};

const historyStatusConfig: Record<string, { icon: string; color: string }> = {
  sent: { icon: 'check_circle', color: 'text-status-healthy' },
  failed: { icon: 'error', color: 'text-status-error' },
  pending: { icon: 'schedule', color: 'text-status-warn' },
};

export function AlertsMobileView({
  channels,
  channelHealth,
  rules,
  alertTarget,
  history,
  stats,
  isLoading,
  rulesLoading,
  historyLoading,
  activeTab,
  setActiveTab,
  onAddChannel,
  onAddRule,
  onEditChannel,
  onDeleteChannel,
  onToggleChannel,
  onTestChannel,
  onToggleRule,
  togglingIds,
  testingIds,
  errors,
  onRetry,
}: AlertsMobileViewProps) {

  const visibleRules = alertTarget ? rules.filter((rule) => matchesAlertTarget(rule, alertTarget)) : rules;
  const targetDescription = alertTarget?.kind === 'direct'
    ? `직접 서비스 ${alertTarget.serviceId}`
    : alertTarget?.kind === 'infrastructure'
    ? `인프라 ${alertTarget.resourceId}`
    : alertTarget ? `Docker 서비스 ${alertTarget.serviceKey}` : undefined;

  const tabs: { key: MobileTab; label: string; icon: string; count?: number }[] = [
    { key: 'channels', label: '알림 채널', icon: 'notifications', count: channels.length },
    { key: 'rules', label: '알림 규칙', icon: 'rule', count: visibleRules.length },
    { key: 'history', label: '알림 로그', icon: 'history' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader title="알림" subtitle="이상을 감지할 규칙과 알림을 받을 채널을 관리하고, 발송 이력을 확인합니다.">
        {activeTab !== 'history' && (
          <Button className="w-full" onClick={activeTab === 'rules' ? onAddRule : onAddChannel}>
            <MaterialIcon size={20} name="add" />
            추가
          </Button>
        )}
      </PageHeader>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-bg-surface border border-ui-border rounded-xl p-3">
            <p className="text-sm text-text-muted truncate">
              성공률
            </p>
            <p className="text-xl text-text-base">{stats.successRate.toFixed(0)}%</p>
          </div>
          <div className="bg-bg-surface border border-ui-border rounded-xl p-3">
            <p className="text-sm text-status-healthy truncate">
              발송
            </p>
            <p className="text-xl text-status-healthy">{stats.totalSent}</p>
          </div>
          <div className="bg-bg-surface border border-ui-border rounded-xl p-3">
            <p className="text-sm text-status-error truncate">
              실패
            </p>
            <p className="text-xl text-status-error">{stats.totalFailed}</p>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div role="tablist" aria-label="알림" className="flex rounded-xl border border-ui-border bg-ui-hover p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`alerts-mobile-panel-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm transition-all ${
              activeTab === tab.key
                ? 'bg-bg-surface text-text-base shadow-sm'
                : 'text-text-muted'
            }`}
          >
            <MaterialIcon size={20} name={tab.icon} />
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs bg-ui-active text-text-secondary px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Channels Tab */}
      {activeTab === 'channels' && (
        <div id="alerts-mobile-panel-channels" role="tabpanel" className="space-y-3">
          {errors.channels && <InlineError message={errors.channels} onRetry={onRetry.channels} />}
          {isLoading ? (
            [1, 2].map(i => (
              <div key={i} className="h-20 rounded-xl bg-ui-hover animate-pulse" />
            ))
          ) : channels.length === 0 ? (
            <div className="py-8 text-center">
              <MaterialIcon size={36} name="notifications_off" className="text-text-dim" />
              <p className="text-sm text-text-dim mt-2">
                구성된 알림 채널이 없습니다
              </p>
              <Button variant="ghost" className="mt-3" onClick={onAddChannel}>추가</Button>
            </div>
          ) : (
            channels.map(channel => {
              const meta = getChannelStyle(channel.type);
              return (
                <div
                  key={channel.id}
                  className="bg-bg-surface border border-ui-border rounded-xl p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.bg} ${!channel.isEnabled ? 'opacity-50' : ''}`}>
                      <ChannelIcon type={channel.type} size={20} className={meta.text} />
                    </div>
                    <div className={`flex-1 min-w-0 ${!channel.isEnabled ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-text-base truncate">{channel.name}</p>
                        {!channel.isEnabled && (
                          <span className="px-1.5 py-0.5 text-xs uppercase tracking-wider bg-ui-active text-text-secondary rounded-full shrink-0">
                            비활성
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${meta.text}`}>{channel.type}</p>
                    </div>
                    <Toggle checked={channel.isEnabled} onChange={() => onToggleChannel(channel.id)} disabled={togglingIds.has(channel.id)} ariaLabel={`${channel.name} ${channel.isEnabled ? '비활성화' : '활성화'}`} />
                  </div>
                  <div className="mb-3 pb-3 border-b border-ui-border-soft/50">
                    <ChannelHealthMeta health={channelHealth[channel.id]} compact />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => onTestChannel(channel.id)} disabled={!channel.isEnabled || testingIds.has(channel.id)} className="flex-1">
                      <MaterialIcon size={20} name="send" />
                      {testingIds.has(channel.id) ? '전송 중' : '테스트'}
                    </Button>
                    <IconButton icon="edit" label="채널 편집" onClick={() => onEditChannel(channel)} />
                    <IconButton icon="delete_outline" label="채널 삭제" tone="danger" onClick={() => onDeleteChannel(channel.id)} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div id="alerts-mobile-panel-rules" role="tabpanel" className="space-y-2">
          {targetDescription && <div className="flex items-center gap-2 rounded-xl border border-ui-border bg-bg-surface px-3 py-2 text-sm text-text-secondary" role="status"><MaterialIcon size={20} name="filter_alt" className="text-action" /><span className="truncate">대상: {targetDescription}</span></div>}
          {errors.rules && <InlineError message={errors.rules} onRetry={onRetry.rules} />}
          {rulesLoading ? (
            [1, 2].map(i => (
              <div key={i} className="h-16 rounded-xl bg-ui-hover animate-pulse" />
            ))
          ) : visibleRules.length === 0 ? (
            <div className="py-8 text-center">
              <MaterialIcon size={36} name="rule" className="text-text-dim" />
              <p className="text-sm text-text-dim mt-2">
                등록된 알림 규칙이 없습니다
              </p>
              <Button variant="ghost" className="mt-3" onClick={onAddRule}>추가</Button>
            </div>
          ) : (
            visibleRules.map(rule => {
              const sev = severityColors[rule.severity] ?? severityColors.info;
              return (
                <div
                  key={rule.id}
                  className={`bg-bg-surface border border-ui-border rounded-xl p-4 ${!rule.isEnabled ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${sev.bg} flex items-center justify-center shrink-0`}>
                      <span className={`text-xs ${sev.text}`}>
                        {rule.metric?.toUpperCase().slice(0, 3)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-base truncate">{rule.name}</p>
                      <p className="text-sm text-text-muted capitalize">
                        {severityLabel(rule.severity)} · {rule.metric} {rule.operator} {rule.threshold}
                      </p>
                    </div>
                    <Toggle checked={rule.isEnabled} onChange={() => onToggleRule(rule.id)} disabled={togglingIds.has(rule.id)} ariaLabel={`${rule.name} ${rule.isEnabled ? '비활성화' : '활성화'}`} />
                  </div>
                  <p className="mt-2 text-xs text-text-muted">{rule.isEnabled ? '활성화됨' : '비활성화됨'}</p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div id="alerts-mobile-panel-history" role="tabpanel" className="space-y-2">
          {errors.history && <InlineError message={errors.history} onRetry={onRetry.history} />}
          {historyLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-ui-hover animate-pulse" />
            ))
          ) : history.length === 0 ? (
            <div className="py-8 text-center">
              <MaterialIcon size={36} name="history" className="text-text-dim" />
              <p className="text-sm text-text-dim mt-2">
                알림 히스토리가 없습니다
              </p>
            </div>
          ) : (
            history.map(item => {
              const statusConf = historyStatusConfig[item.status] ?? historyStatusConfig.pending;
              return (
                <div
                  key={item.id}
                  className="bg-bg-surface border border-ui-border rounded-xl p-3"
                >
                  <div className="flex items-start gap-3">
                    <MaterialIcon size={20} name={statusConf.icon} className={`mt-0.5 shrink-0 ${statusConf.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-base truncate">
                        {item.hostName || item.serviceName || item.channelName}
                      </p>
                      <p className="text-sm text-text-muted truncate mt-0.5">
                        {item.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-text-dim">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ko })}
                        </span>
                        <span className="text-sm capitalize text-text-dim">
                          {item.channelType}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ui-border bg-bg-surface p-3" role="alert">
      <MaterialIcon size={20} name="sync_problem" className="mt-0.5 text-status-warn" />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-text-base">불러오지 못했습니다</p><p className="mt-0.5 type-body text-text-muted">{message}</p></div>
      <Button size="sm" variant="secondary" onClick={onRetry}>다시 시도</Button>
    </div>
  );
}

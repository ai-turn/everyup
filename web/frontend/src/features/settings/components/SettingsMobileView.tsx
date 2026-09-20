import { Button, ConfirmDialog, MaterialIcon } from '../../../components/common';
import { SectionCard } from './SectionCard';
import { AccountSection } from './AccountSection';
import { AlertsSection } from './AlertsSection';
import { AuditLogSection } from './AuditLogSection';
import { retentionLabel, intervalLabel } from '../retentionLabel';
import { env } from '../../../config/env';

const METRICS_RETENTION_OPTIONS = ['7d', '30d', '90d', '1y'];
const LOGS_RETENTION_OPTIONS = ['1d', '3d', '7d', '30d'];
const COLLECT_INTERVAL_OPTIONS = [15, 30, 60, 300];

interface SettingsMobileViewProps {
  theme: 'light' | 'dark';
  metricsRetention: string;
  logsRetention: string;
  collectInterval: number;
  consecutiveFailures: number;
  backendLoading: boolean;
  settingsError: string | null;
  showResetConfirm: boolean;
  resetting: boolean;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onMetricsRetentionChange: (value: string) => void;
  onLogsRetentionChange: (value: string) => void;
  onCollectIntervalChange: (seconds: number) => void;
  onConsecutiveFailuresChange: (n: number) => void;
  onResetClick: () => void;
  onResetConfirm: () => void;
  onResetCancel: () => void;
  onRetryLoad: () => void;
}

export function SettingsMobileView({
  theme,
  metricsRetention,
  logsRetention,
  collectInterval,
  consecutiveFailures,
  backendLoading,
  settingsError,
  showResetConfirm,
  resetting,
  onThemeChange,
  onMetricsRetentionChange,
  onLogsRetentionChange,
  onCollectIntervalChange,
  onConsecutiveFailuresChange,
  onResetClick,
  onResetConfirm,
  onResetCancel,
  onRetryLoad,
}: SettingsMobileViewProps) {

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-base">환경 설정</h1>
        <p className="text-sm text-text-muted mt-0.5">계정, 화면, 데이터 보존, 알림 기준 등 운영 환경을 관리합니다.</p>
      </div>
      {settingsError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-status-warn/30 bg-status-warn/10 px-3 py-2.5 text-sm text-text-secondary">
          <MaterialIcon name="sync_problem" className="text-status-warn" />
          <span className="min-w-0 flex-1">일부 설정을 불러오지 못했습니다.</span>
          <Button size="sm" variant="secondary" onClick={onRetryLoad}>다시 시도</Button>
        </div>
      )}

      {/* Account (ver2: 계정 · 인증) */}
      <AccountSection />

      {/* Interface */}
      <SectionCard title="인터페이스" subtitle="테마, 시간대 설정">
        {/* Theme */}
        <div className="space-y-2">
          <p className="text-sm text-text-base">테마</p>
          <p className="text-sm text-text-muted">라이트 또는 다크 모드를 선택합니다</p>
          <div className="flex gap-1 bg-ui-hover p-1 rounded-lg">
            {(['light', 'dark'] as const).map((t_) => (
              <button
                key={t_}
                onClick={() => onThemeChange(t_)}
                className={`flex-1 cursor-pointer flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  theme === t_
                    ? 'bg-ui-raised text-primary shadow-sm'
                    : 'text-text-muted'
                }`}
              >
                <MaterialIcon size={16} name={t_ === 'light' ? 'light_mode' : 'dark_mode'} />
                {t_ === 'light' ? '라이트' : '다크'}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Data Retention */}
      <SectionCard title="데이터 수집 및 보존" subtitle="메트릭 수집 주기와 데이터 보존 기간">
        {backendLoading ? (
          <div className="space-y-3">
            <div className="h-14 bg-ui-hover rounded-lg animate-pulse" />
            <div className="h-14 bg-ui-hover rounded-lg animate-pulse" />
          </div>
        ) : (
          <>
            {/* Collect interval */}
            <div className="space-y-2">
              <p className="text-sm text-text-base">수집 주기</p>
              <p className="text-sm text-text-muted">시스템 메트릭을 수집하는 간격 · 다음 시작 시 적용됩니다</p>
              <div className="flex gap-1 flex-wrap bg-ui-hover p-1 rounded-lg">
                {(COLLECT_INTERVAL_OPTIONS.includes(collectInterval)
                  ? COLLECT_INTERVAL_OPTIONS
                  : [...COLLECT_INTERVAL_OPTIONS, collectInterval].sort((a, b) => a - b)
                ).map((sec) => (
                  <button
                    key={sec}
                    onClick={() => onCollectIntervalChange(sec)}
                    className={`flex-1 cursor-pointer px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      collectInterval === sec
                        ? 'bg-ui-raised text-primary shadow-sm'
                        : 'text-text-muted'
                    }`}
                  >
                    {intervalLabel(sec)}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-ui-border-soft my-3" />

            {/* Metrics */}
            <div className="space-y-2">
              <p className="text-sm text-text-base">메트릭 보존 기간</p>
              <p className="text-sm text-text-muted">수집된 시스템 메트릭 데이터 보존 기간</p>
              <div className="flex gap-1 flex-wrap bg-ui-hover p-1 rounded-lg">
                {METRICS_RETENTION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onMetricsRetentionChange(opt)}
                    className={`flex-1 cursor-pointer px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      metricsRetention === opt
                        ? 'bg-ui-raised text-primary shadow-sm'
                        : 'text-text-muted'
                    }`}
                  >
                    {retentionLabel(opt)}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-ui-border-soft my-3" />

            {/* Logs */}
            <div className="space-y-2">
              <p className="text-sm text-text-base">로그 보존 기간</p>
              <p className="text-sm text-text-muted">에러 로그 데이터 보존 기간</p>
              <div className="flex gap-1 flex-wrap bg-ui-hover p-1 rounded-lg">
                {LOGS_RETENTION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onLogsRetentionChange(opt)}
                    className={`flex-1 cursor-pointer px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      logsRetention === opt
                        ? 'bg-ui-raised text-primary shadow-sm'
                        : 'text-text-muted'
                    }`}
                  >
                    {retentionLabel(opt)}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-3 type-body text-text-muted">
              보존 기간을 줄이면 기간을 초과한 기존 데이터는 다음 정리 주기에 삭제됩니다.
            </p>
          </>
        )}
      </SectionCard>

      {/* Alert threshold — 선택 즉시 저장 */}
      <AlertsSection value={consecutiveFailures} loading={backendLoading} onChange={onConsecutiveFailuresChange} />

      {/* Body access audit log (admin-only) */}
      <AuditLogSection />

      {/* Account Reset — ver2 프로토타입 오마주: 중립 카드 + 붉은 텍스트 액션 */}
      <SectionCard title="계정 초기화" subtitle="관리자 계정을 삭제하고 최초 설정 상태로 초기화합니다">
        <div className="flex items-center justify-between gap-4">
          <p className="type-body text-text-muted">
            {env.useMock ? '데모 환경에서는 계정 초기화를 사용할 수 없습니다.' : '모든 계정 정보가 삭제되며, 다시 계정을 생성해야 합니다. 이 작업은 되돌릴 수 없습니다.'}
          </p>
          <button
            onClick={onResetClick}
            disabled={env.useMock}
            className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            계정 초기화
          </button>
        </div>
      </SectionCard>

      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={onResetCancel}
        onConfirm={onResetConfirm}
        title="정말 초기화하시겠습니까?"
        message="모든 계정 정보가 삭제되며, 다시 계정을 생성해야 합니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="초기화"
        cancelLabel="취소"
        isProcessing={resetting}
      />
    </div>
  );
}

import { Button, ConfirmDialog, MaterialIcon } from '../../../components/common';
import { useAuth } from '../../../contexts/AuthContext';
import { SectionCard } from './SectionCard';
import { SettingRow } from './SettingRow';
import { AccountSection } from './AccountSection';
import { AlertsSection } from './AlertsSection';
import { AuditLogSection } from './AuditLogSection';
import { retentionLabel, intervalLabel } from '../retentionLabel';
import { env } from '../../../config/env';

const METRICS_RETENTION_OPTIONS = ['7d', '30d', '90d', '1y'];
const LOGS_RETENTION_OPTIONS = ['1d', '3d', '7d', '30d'];
const COLLECT_INTERVAL_OPTIONS = [15, 30, 60, 300];

// 트랙 패딩을 포함해 40px로 맞춘 설정 선택 버튼.
const segmentedButtonClass = (active: boolean) =>
  `cursor-pointer h-9 px-3 rounded-md type-label transition-all ${
    active
      ? 'bg-ui-raised text-primary shadow-sm'
      : 'text-text-muted hover:text-text-secondary'
  }`;

interface SettingsDesktopViewProps {
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

export function SettingsDesktopView({
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
}: SettingsDesktopViewProps) {
  const { user } = useAuth();
  const collectOptions = COLLECT_INTERVAL_OPTIONS.includes(collectInterval)
    ? COLLECT_INTERVAL_OPTIONS
    : [...COLLECT_INTERVAL_OPTIONS, collectInterval].sort((a, b) => a - b);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-text-base">환경 설정</h1>
        <p className="text-sm text-text-muted mt-1">계정, 화면, 데이터 보존, 알림 기준 등 운영 환경을 관리합니다.</p>
      </div>
      {settingsError && (
        <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-status-warn/30 bg-status-warn/10 px-4 py-3 text-sm text-text-secondary">
          <MaterialIcon name="sync_problem" className="text-status-warn" />
          <span className="min-w-0 flex-1">일부 설정을 불러오지 못했습니다. {settingsError}</span>
          <Button size="sm" variant="secondary" onClick={onRetryLoad}>다시 시도</Button>
        </div>
      )}

      <div>
        <div className="min-w-0 w-full max-w-4xl space-y-5">
          {user && (
            <div id="sec-account" className="scroll-mt-4">
              <AccountSection />
            </div>
          )}

          <section id="sec-ui" className="scroll-mt-4">
            <SectionCard title="인터페이스" subtitle="테마, 시간대 설정">
              <SettingRow label="테마" description="라이트 또는 다크 모드를 선택합니다">
                <div className="flex gap-1 bg-ui-hover p-0.5 rounded-lg">
                  {(['light', 'dark'] as const).map((t_) => (
                    <button
                      key={t_}
                      onClick={() => onThemeChange(t_)}
                      className={`flex items-center gap-1.5 ${segmentedButtonClass(theme === t_)}`}
                    >
                      <MaterialIcon size={20} name={t_ === 'light' ? 'light_mode' : 'dark_mode'} />
                      {t_ === 'light' ? '라이트' : '다크'}
                    </button>
                  ))}
                </div>
              </SettingRow>
            </SectionCard>
          </section>

          <section id="sec-data" className="scroll-mt-4">
            <SectionCard title="데이터 수집 및 보존" subtitle="메트릭 수집 주기와 데이터 보존 기간">
              {backendLoading ? (
                <div className="space-y-3">
                  <div className="h-10 bg-ui-hover rounded-lg animate-pulse" />
                  <div className="h-10 bg-ui-hover rounded-lg animate-pulse" />
                </div>
              ) : (
                <>
                  <SettingRow label="수집 주기" description="시스템 메트릭을 수집하는 간격 · 다음 시작 시 적용됩니다">
                    <div className="flex gap-1 flex-wrap justify-end bg-ui-hover p-0.5 rounded-lg">
                      {collectOptions.map((sec) => (
                        <button
                          key={sec}
                          onClick={() => onCollectIntervalChange(sec)}
                          className={`font-mono ${segmentedButtonClass(collectInterval === sec)}`}
                        >
                          {intervalLabel(sec)}
                        </button>
                      ))}
                    </div>
                  </SettingRow>

                  <SettingRow label="메트릭 보존 기간" description="수집된 시스템 메트릭 데이터 보존 기간">
                    <div className="flex gap-1 flex-wrap justify-end bg-ui-hover p-0.5 rounded-lg">
                      {METRICS_RETENTION_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => onMetricsRetentionChange(opt)}
                          className={`font-mono ${segmentedButtonClass(metricsRetention === opt)}`}
                        >
                          {retentionLabel(opt)}
                        </button>
                      ))}
                    </div>
                  </SettingRow>

                  <SettingRow label="로그 보존 기간" description="에러 로그 데이터 보존 기간">
                    <div className="flex gap-1 flex-wrap justify-end bg-ui-hover p-0.5 rounded-lg">
                      {LOGS_RETENTION_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => onLogsRetentionChange(opt)}
                          className={`font-mono ${segmentedButtonClass(logsRetention === opt)}`}
                        >
                          {retentionLabel(opt)}
                        </button>
                      ))}
                    </div>
                  </SettingRow>

                  <p className="pt-3 type-body text-text-muted">
                    보존 기간을 줄이면 기간을 초과한 기존 데이터는 다음 정리 주기에 삭제됩니다.
                  </p>
                </>
              )}
            </SectionCard>
          </section>

          {/* Alert threshold — 선택 즉시 저장 */}
          <section id="sec-alert" className="scroll-mt-4">
            <AlertsSection value={consecutiveFailures} loading={backendLoading} onChange={onConsecutiveFailuresChange} />
          </section>

          {/* Body access audit log — 컴포넌트가 admin 아닐 때 스스로 숨는다 */}
          <AuditLogSection />

          {/* Account Reset — ver2 프로토타입 오마주: 중립 카드 + 우측 붉은 텍스트 액션 */}
          <section id="sec-danger" className="scroll-mt-4">
            <SectionCard title="계정 초기화" subtitle="관리자 계정을 삭제하고 최초 설정 상태로 초기화합니다">
              <div className="flex items-center justify-between gap-4">
                <p className="type-body text-text-muted">
                  {env.useMock ? '데모 환경에서는 계정 초기화를 사용할 수 없습니다.' : '모든 계정 정보가 삭제되며, 다시 계정을 생성해야 합니다. 이 작업은 되돌릴 수 없습니다.'}
                </p>
                <button
                  onClick={onResetClick}
                  disabled={env.useMock}
                  className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline cursor-pointer"
                >
                  계정 초기화
                </button>
              </div>
            </SectionCard>
          </section>

        </div>
      </div>

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

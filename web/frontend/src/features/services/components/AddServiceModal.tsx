import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/common/Button';
import { CopyButton } from '../../../components/common/CopyButton';
import { MaterialIcon } from '../../../components/common/MaterialIcon';
import { Input } from '../../../components/common/Input';
import { SegmentedControl } from '../../../components/common/SegmentedControl';
import { Toggle } from '../../../components/common/Toggle';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import {
  api,
  type AgentCollectionCapability,
  type AgentProfile,
  type AgentProfileKind,
  type AgentServiceSnapshot,
  type ConnectedAgent,
} from '../../../services/api';
import { COPY_ACTION_PRIMARY } from '../../../components/common';
import { copyTextToClipboard } from '../../../hooks/useClipboardCopy';
import { getErrorMessage } from '../../../utils/errors';
import { toast } from 'react-hot-toast';
import { MonitoringSetupPanel } from './MonitoringSetupPanel';
import { useConnectionAddress } from '../useConnectionAddress';
import { ConnectionAddressField } from './ConnectionAddressField';
import type { CollectorSetupStatus } from '../../../services/api/agents';

interface Props {
  onClose: () => void;
  onCreated: () => void;
  initialProfile?: AgentProfile;
  existingAgent?: { id: string; name: string };
  onOpenProject?: (agentId: string) => void;
  onConfigureInstrumentation?: (agentId: string) => void;
}

type Step = 'form' | 'install';

function SetupProgress({ step, connected, diagnosed }: { step: Step; connected: boolean; diagnosed: boolean }) {
  const steps = [
    { label: 'Docker 환경', complete: step === 'install', active: step === 'form' },
    { label: '수집기 설치', complete: connected, active: step === 'install' && !connected },
    { label: '기능 확인', complete: diagnosed, active: connected && !diagnosed },
    { label: '상세 계측', complete: false, active: diagnosed },
  ];
  return (
    <div className="border-b border-ui-border-soft px-6 py-3">
      <div className="grid grid-cols-4 gap-1">
        {steps.map((item, index) => (
          <div key={item.label} className="flex min-w-0 items-center gap-1.5">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
              item.complete
                ? 'bg-emerald-500 text-white'
                : item.active ? 'bg-primary text-white' : 'bg-ui-hover text-text-dim'
            }`}>
              {item.complete ? <MaterialIcon size={16} name="check" /> : index + 1}
            </span>
            <span className={`truncate text-xs font-medium ${item.active ? 'text-primary' : item.complete ? 'text-text-secondary' : 'text-text-dim'}`}>
              {item.label}
            </span>
            {index < steps.length - 1 && <span className="hidden h-px flex-1 bg-ui-border sm:block" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function buildInstallCommand(webBaseUrl: string, joinCode: string): string {
  const baseUrl = webBaseUrl.trim().replace(/\/+$/, '') || 'http://EVERYUP_WEB_SERVER:3001';
  return `curl -fsSL ${shellQuote(`${baseUrl}/api/v1/agents/install.sh`)} | sudo sh -s -- ${shellQuote(baseUrl)} ${shellQuote(joinCode)}`;
}

async function copyInstallCommand(text: string): Promise<boolean> {
  // copyTextToClipboard falls back to a textarea + execCommand on plain HTTP,
  // where navigator.clipboard is unavailable (non-secure context).
  try {
    await copyTextToClipboard(text);
    return true;
  } catch {
    toast.error('복사에 실패했습니다. 내용을 직접 선택해 복사하세요.');
    return false;
  }
}

const PROFILE_OPTIONS: { label: string; value: AgentProfileKind }[] = [
  { label: '전체', value: 'all-in-one' },
  { label: '기본', value: 'basic' },
  { label: '사용자 지정', value: 'custom' },
];

const CAPABILITY_OPTIONS: { capability: AgentCollectionCapability; label: string; description: string }[] = [
  { capability: 'uptime', label: '업타임', description: 'Docker 서비스 상태와 헬스체크를 수집합니다.' },
  { capability: 'logs', label: '로그', description: 'Docker stdout·stderr 로그를 읽습니다.' },
  { capability: 'infrastructure', label: '인프라', description: '호스트 CPU·메모리·디스크를 수집합니다.' },
  { capability: 'api', label: 'API', description: 'privileged eBPF Observer로 요청 추적을 수집합니다.' },
  { capability: 'metrics', label: '메트릭', description: 'OTLP 메트릭을 수신할 수 있게 합니다.' },
];

function AgentForm({
  name,
  submitting,
  profileKind,
  customCapabilities,
  onNameChange,
  onProfileKindChange,
  onCustomCapabilitiesChange,
  onClose,
  onSubmit,
}: {
  name: string;
  submitting: boolean;
  profileKind: AgentProfileKind;
  customCapabilities: AgentCollectionCapability[];
  onNameChange: (name: string) => void;
  onProfileKindChange: (profile: AgentProfileKind) => void;
  onCustomCapabilitiesChange: (capabilities: AgentCollectionCapability[]) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {

  const toggleCapability = (capability: AgentCollectionCapability, enabled: boolean) => {
    const next = new Set(customCapabilities);
    if (enabled) next.add(capability);
    else next.delete(capability);
    if (capability === 'logs' || capability === 'api') next.add('uptime');
    onCustomCapabilitiesChange(CAPABILITY_OPTIONS
      .map((option) => option.capability)
      .filter((option) => next.has(option)));
  };
  const uptimeRequired = customCapabilities.includes('logs') || customCapabilities.includes('api');

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="new-project-name" className="text-sm text-text-secondary">
          Docker 환경 이름
        </label>
        <Input
          id="new-project-name"
          type="text"
          value={name}
          onChange={event => onNameChange(event.target.value)}
          placeholder="예: my-api, payment-service"
        />
        <p className="type-body text-text-muted">
          대시보드에서 Docker 호스트를 구분할 이름입니다
        </p>
      </div>
      <div className="space-y-2">
        <div>
          <span className="text-sm text-text-secondary">수집 범위</span>
          <p className="mt-0.5 type-body text-text-muted">필요한 권한과 수집기만 설치합니다.</p>
        </div>
        <SegmentedControl
          options={PROFILE_OPTIONS}
          value={profileKind}
          onChange={onProfileKindChange}
          size="md"
          ariaLabel="Docker 수집 프로필"
        />
        {profileKind === 'all-in-one' && (
          <p className="type-body text-text-muted">업타임, 로그, 인프라, API, 메트릭을 한 번에 수집합니다.</p>
        )}
        {profileKind === 'basic' && (
          <p className="type-body text-text-muted">업타임과 로그만 수집합니다. Docker socket은 읽기 전용으로 사용합니다.</p>
        )}
        {profileKind === 'custom' && (
          <div role="group" aria-label="사용자 지정 수집 기능" className="divide-y divide-ui-border rounded-xl border border-ui-border">
            {CAPABILITY_OPTIONS.map((option) => {
              const checked = customCapabilities.includes(option.capability);
              const disabled = option.capability === 'uptime' && uptimeRequired;
              return (
                <div key={option.capability} className="flex items-center gap-3 px-3 py-2.5">
                  <Toggle
                    checked={checked}
                    onChange={(enabled) => toggleCapability(option.capability, enabled)}
                    disabled={disabled}
                    ariaLabel={`${option.label} 수집 ${checked ? '사용' : '사용 안 함'}`}
                    title={disabled ? '로그 또는 API 추적에 필요합니다' : undefined}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-base">{option.label}</p>
                    <p className="type-body text-text-muted">{option.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
          취소
        </Button>
        <Button type="submit" disabled={!name.trim() || submitting || (profileKind === 'custom' && customCapabilities.length === 0)} className="flex-1">
          {submitting ? '생성 중...' : '생성'}
        </Button>
      </div>
    </form>
  );
}

function AgentInstallCommand({
  connected,
  expanded,
  expiryLabel,
  refreshingCode,
  address,
  installCommand,
  codeUnavailable,
  onRefreshCode,
}: {
  connected: boolean;
  expanded: boolean;
  expiryLabel: string;
  refreshingCode: boolean;
  address: ReturnType<typeof useConnectionAddress>;
  installCommand: string;
  codeUnavailable: boolean;
  onRefreshCode: () => void;
}) {
  return (
    <details open={expanded} className="group rounded-xl border border-ui-border bg-bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-text-base">
        <MaterialIcon size={20} name="terminal" className="text-primary" />
        Docker 수집기 설치 명령
        <span className="ml-auto text-xs font-normal text-text-dim">
          {connected ? '재설치할 때 사용' : 'Linux Docker 서버에서 실행'}
        </span>
        <MaterialIcon size={16} name="expand_more" className="text-text-dim transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-ui-border-soft p-4">
        <div className="flex items-start gap-3 rounded-xl border border-ui-border bg-ui-hover-soft p-3">
          <MaterialIcon size={20} name="timer" className="mt-0.5 shrink-0 text-status-warn" />
          <div className="min-w-0 flex-1">
            <p className="type-label text-text-base">일회용 연결 코드</p>
            <p className="mt-0.5 type-body text-text-muted">
              {expiryLabel || '10분 후'}까지 한 번만 사용할 수 있습니다. 장기 API 키는 서버에 직접 저장됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshCode}
            disabled={refreshingCode}
            className="shrink-0 text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            {refreshingCode ? '발급 중' : '새 코드'}
          </button>
        </div>

        <ConnectionAddressField address={address} />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="type-label text-text-base">설치 명령</p>
              <p className="mt-0.5 type-body text-text-muted">검사, 설정 백업, Docker 수집기·eBPF 시작을 한 번에 처리합니다.</p>
            </div>
            <CopyButton
              onCopy={() => copyInstallCommand(installCommand)}
              title={address.valid ? '설치 명령 복사' : '연결 주소를 먼저 입력하세요'}
              disabled={!address.valid || codeUnavailable}
              className={COPY_ACTION_PRIMARY}
            >
              <span>복사</span>
            </CopyButton>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-900 px-4 py-3 font-mono text-xs text-slate-100 dark:bg-slate-950">
            {codeUnavailable ? '사용 가능한 연결 코드가 필요합니다. 새 코드를 발급해 주세요.' : installCommand}
          </pre>
        </div>

        <div className="grid gap-2 text-xs text-text-muted sm:grid-cols-3">
          {[
            ['rule', '환경 검사', 'Docker와 Compose 조건을 먼저 확인'],
            ['backup', '안전한 설치', '기존 설정을 백업하고 새 설정 저장'],
            ['sensors', '자동 발견', 'Docker 수집기와 eBPF Observer를 함께 시작'],
          ].map(([icon, title, description]) => (
            <div key={title} className="rounded-lg bg-ui-hover-soft p-2.5">
              <MaterialIcon size={16} name={icon} className="text-primary" />
              <p className="mt-1 font-medium text-text-secondary">{title}</p>
              <p className="mt-0.5 type-body text-text-muted">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export function AddServiceModal({
  onClose,
  onCreated,
  initialProfile,
  existingAgent,
  onOpenProject,
  onConfigureInstrumentation,
}: Props) {
  const [step, setStep] = useState<Step>(existingAgent ? 'install' : 'form');
  const [name, setName] = useState(existingAgent?.name ?? '');
  const [profileKind, setProfileKind] = useState<AgentProfileKind>(initialProfile?.kind ?? 'all-in-one');
  const [customCapabilities, setCustomCapabilities] = useState<AgentCollectionCapability[]>(() => {
    const capabilities = initialProfile?.capabilities ?? ['uptime'];
    const set = new Set(capabilities);
    if (set.has('logs') || set.has('api')) set.add('uptime');
    return CAPABILITY_OPTIONS.map((option) => option.capability).filter((capability) => set.has(capability));
  });
  const [submitting, setSubmitting] = useState(false);
  const [refreshingCode, setRefreshingCode] = useState(Boolean(existingAgent));
  const [agentId, setAgentId] = useState(existingAgent?.id ?? '');
  const [joinCode, setJoinCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const address = useConnectionAddress();
  const webBaseUrl = address.baseUrl;
  const [setupStatus, setSetupStatus] = useState<CollectorSetupStatus | null>(null);
  const [setupError, setSetupError] = useState('');
  const [codeExpired, setCodeExpired] = useState(false);
  const [connectedAgent, setConnectedAgent] = useState<ConnectedAgent | null>(null);
  const [detectedServices, setDetectedServices] = useState<AgentServiceSnapshot[]>([]);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const existingAgentId = existingAgent?.id;
  const announcedConnection = useRef(false);
  const checkedConnectionOnce = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setCodeExpired(false);
    if (!expiresAt) return;
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) { setCodeExpired(true); return; }
    const timer = window.setTimeout(() => setCodeExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    if (!existingAgentId) return;
    let active = true;
    api.createAgentJoinCode(existingAgentId)
      .then((res) => {
        if (!active) return;
        setJoinCode(res.joinCode);
        setExpiresAt(res.expiresAt);
      })
      .catch((err) => {
        if (active) toast.error(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setRefreshingCode(false);
      });
    return () => { active = false; };
  }, [existingAgentId]);

  const refreshConnection = useCallback(async (showLoading = false) => {
    if (!agentId) return;
    if (showLoading) setCheckingConnection(true);
    try {
      const [agents, serviceList, status] = await Promise.all([
        api.getAgents(),
        api.getAgentServices(agentId),
        api.getCollectorSetupStatus(agentId),
      ]);
      const current = (agents ?? []).find((candidate) => candidate.id === agentId);
      setSetupStatus(status);
      setSetupError('');
      const firstCheck = !checkedConnectionOnce.current;
      checkedConnectionOnce.current = true;
      if (!current) { setConnectedAgent(null); return; }
      setConnectedAgent(current);
      setDetectedServices(serviceList ?? []);
      const installationConfirmed = !existingAgent || Boolean(expiresAt && status.lastEnrolledAt && new Date(status.lastEnrolledAt).getTime() >= new Date(expiresAt).getTime() - 600_000);
      if (status.connected && status.configApplied && installationConfirmed && !announcedConnection.current) {
        announcedConnection.current = true;
        if (!firstCheck) toast.success('Docker 수집기 연결을 확인했습니다');
        onCreated();
      }
    } catch (error) {
      setSetupError(getErrorMessage(error));
      if (showLoading) toast.error(getErrorMessage(error));
    } finally {
      if (showLoading) setCheckingConnection(false);
    }
  }, [agentId, existingAgent, expiresAt, onCreated]);

  useEffect(() => {
    if (step !== 'install' || !agentId) return;
    void refreshConnection(false);
    const timer = window.setInterval(() => void refreshConnection(false), 5_000);
    return () => window.clearInterval(timer);
  }, [agentId, refreshConnection, step]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const profile: AgentProfile = {
        kind: profileKind,
        capabilities: profileKind === 'custom' ? customCapabilities : [],
      };
      const res = await api.createAgent(trimmed, profile);
      setAgentId(res.id);
      setJoinCode(res.joinCode);
      setExpiresAt(res.expiresAt);
      setStep('install');
      onCreated();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshCode = async () => {
    if (!agentId) return;
    setRefreshingCode(true);
    try {
      const res = await api.createAgentJoinCode(agentId);
      setJoinCode(res.joinCode);
      setExpiresAt(res.expiresAt);
      toast.success('새 연결 코드를 발급했습니다');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRefreshingCode(false);
    }
  };

  const installCommand = buildInstallCommand(webBaseUrl, joinCode);
  const codeUnavailable = !joinCode || refreshingCode || codeExpired;
  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const reinstalled = !existingAgent || Boolean(expiresAt && setupStatus?.lastEnrolledAt && new Date(setupStatus.lastEnrolledAt).getTime() >= new Date(expiresAt).getTime() - 600_000);
  const connected = !setupError && Boolean(setupStatus?.connected && setupStatus.configApplied && reinstalled);
  const diagnosed = connected && Boolean(setupStatus?.profile.capabilities.every(capability => setupStatus.signals.some(signal => signal.signal === (capability === 'api' ? 'traces' : capability))));
  const injectableCount = detectedServices.filter(
    (service) => service.runtime === 'java' || service.runtime === 'node',
  ).length;

  return (
    <dialog
      ref={dialogRef}
      className={`fixed inset-0 z-50 m-auto h-full max-h-none w-full max-w-none items-center justify-center bg-transparent p-4 open:flex ${SCRIM_MODAL_DIALOG}`}
      aria-label={step === 'form' ? 'Docker 연결' : 'Docker 수집기 설치 및 모니터링 설정'}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className={`w-full ${step === 'install' ? 'max-w-2xl' : 'max-w-md'} max-h-[92vh] bg-bg-surface rounded-xl shadow-2xl border border-ui-border overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-soft">
          <h2 className="type-card-title text-text-base">
            {step === 'form' ? 'Docker 연결' : 'Docker 수집기 설치'}
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1 rounded-lg text-text-dim hover:text-text-base transition-colors">
            <MaterialIcon size={20} name="close" />
          </button>
        </div>

        <SetupProgress step={step} connected={connected} diagnosed={diagnosed} />

        {step === 'form' ? (
          <AgentForm
            name={name}
            submitting={submitting}
            profileKind={profileKind}
            customCapabilities={customCapabilities}
            onNameChange={setName}
            onProfileKindChange={setProfileKind}
            onCustomCapabilitiesChange={setCustomCapabilities}
            onClose={onClose}
            onSubmit={handleCreate}
          />
        ) : (
          <div className="p-6 space-y-5 overflow-y-auto">
            {setupError && <p role="alert" className="text-sm text-status-warn">{setupError}</p>}
            {codeExpired && !connected && <p role="alert" className="text-sm text-status-warn">설치 명령이 만료됐습니다. 아래에서 새 코드를 발급해 주세요.</p>}
            {connected ? (
              <div className="flex items-start gap-3 rounded-xl border border-ui-border bg-ui-hover-soft p-4">
                <MaterialIcon size={20} name="check_circle" className="mt-0.5 shrink-0 text-status-healthy" />
                <div>
                  <p className="text-sm text-text-base">Docker 수집기 연결을 확인했습니다</p>
                  <p className="mt-1 type-body text-text-muted">
                    기능 호환성과 발견된 서비스를 자동으로 확인했습니다. 이 화면에서 선택 계측까지 이어서 설정할 수 있습니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-base">Docker 수집기 연결을 기다리는 중</p>
                  <p className="mt-0.5 type-body text-text-muted">명령을 실행하면 최대 5초 간격으로 자동 확인합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshConnection(true)}
                  disabled={checkingConnection}
                  className="shrink-0 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {checkingConnection ? '확인 중' : '지금 확인'}
                </button>
              </div>
            )}

            {connectedAgent && (
              <MonitoringSetupPanel
                agent={connectedAgent}
                services={detectedServices}
                setupStatus={setupError ? null : setupStatus}
                compact
                onInstrument={injectableCount > 0 && onConfigureInstrumentation
                  ? () => onConfigureInstrumentation(agentId)
                  : undefined}
              />
            )}

            <AgentInstallCommand
              connected={connected}
              expanded={!connected || Boolean(existingAgent)}
              expiryLabel={expiryLabel}
              refreshingCode={refreshingCode}
              address={address}
              installCommand={installCommand}
              codeUnavailable={codeUnavailable}
              onRefreshCode={handleRefreshCode}
            />

            <div className="flex gap-2">
              {connected ? (
                <>
                  {injectableCount > 0 && onConfigureInstrumentation && (
                    <Button
                      variant="secondary"
                      onClick={() => onConfigureInstrumentation(agentId)}
                      className="flex-1"
                    >
                      상세 계측 설정
                    </Button>
                  )}
                  <Button
                    onClick={() => onOpenProject ? onOpenProject(agentId) : onClose()}
                    className="flex-1"
                  >
                    {onOpenProject ? 'Docker 환경 열기' : '완료'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={onClose} className="flex-1">
                    나중에 확인
                  </Button>
                  <Button
                    onClick={() => void refreshConnection(true)}
                    disabled={checkingConnection}
                    className="flex-1"
                  >
                    {checkingConnection ? '연결 확인 중...' : '연결 확인'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

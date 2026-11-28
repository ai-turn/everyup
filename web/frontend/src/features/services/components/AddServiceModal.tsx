import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../../components/common/Button';
import { IconButton } from '../../../components/common/IconButton';
import { CopyButton } from '../../../components/common/CopyButton';
import { MaterialIcon } from '../../../components/common/MaterialIcon';
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
  type MergeInfrastructure,
} from '../../../services/api';
import { InfraSourceChoice } from '../../servers/components/InfraSourceChoice';
import { useActiveOtelInfrastructure } from '../../servers/useInfrastructureSources';
import { COPY_ACTION_PRIMARY } from '../../../components/common';
import { copyTextToClipboard } from '../../../hooks/useClipboardCopy';
import { getErrorMessage } from '../../../utils/errors';
import { toast } from 'react-hot-toast';
import { MonitoringSetupPanel } from './MonitoringSetupPanel';
import { useConnectionAddress } from '../useConnectionAddress';
import { ConnectionAddressField } from './ConnectionAddressField';
import type { CollectorSetupStatus } from '../../../services/api/agents';
import { env } from '../../../config/env';
import { QUICKSTART_URL } from '../../../components/layout/DemoHelpLinks';
import { formatClock } from '../../../utils/incidentFormat';
import { ApplyScope } from '../../connections/ApplyScope';
import { APPLY_SCOPE, DOCKER_CAPABILITY_NAME, DOCKER_INSTALL } from '../../connections/connectCopy';

interface Props {
  onClose: () => void;
  onCreated: () => void;
  existingAgent?: { id: string; name: string };
  /**
   * 이 서버에 Docker Collector를 설치한다(서버 추가에서 Docker를 고른 뒤, 기존 서버의 `Docker Collector 설치`). 이름은 서버의 것이고
   * 새 서버를 만들지 않는다(ADR 0012). 이미 있는 Docker Collector의 다시 설치·적용 명령은 existingAgent다.
   */
  server?: { id: string; name: string };
  /** 설치한 Docker Collector에 바뀐 수집 설정을 적용하는 명령이다(기능 연결 뒤). 다시 설치하는 것이 아니다. */
  purpose?: 'install' | 'apply';
  onConfigureInstrumentation?: (agentId: string) => void;
}

type Step = 'form' | 'install';

function SetupProgress({ step, connected, diagnosed }: { step: Step; connected: boolean; diagnosed: boolean }) {
  const steps = [
    { label: '수집 범위', complete: step === 'install', active: step === 'form' },
    { label: 'Docker Collector 설치', complete: connected, active: step === 'install' && !connected },
    { label: '기능 확인', complete: diagnosed, active: connected && !diagnosed },
    { label: '상세 수집', complete: false, active: diagnosed },
  ];
  return (
    <div className="border-b border-border px-6 py-3">
      <div className="grid grid-cols-4 gap-1">
        {steps.map((item, index) => (
          <div key={item.label} className="flex min-w-0 items-center gap-1.5">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
              item.complete
                ? 'bg-ok text-surface'
                : item.active ? 'bg-accent text-accent-text' : 'bg-surface-hover text-text-muted'
            }`}>
              {item.complete ? <MaterialIcon size={20} name="check" /> : index + 1}
            </span>
            <span className={`truncate type-label-sm ${item.active ? 'text-text' : item.complete ? 'text-text' : 'text-text-faint'}`}>
              {item.label}
            </span>
            {index < steps.length - 1 && <span className="hidden h-px flex-1 bg-border sm:block" />}
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
  { capability: 'uptime', label: DOCKER_CAPABILITY_NAME.uptime, description: '컨테이너 실행 상태와 응답 확인 결과를 수집합니다.' },
  { capability: 'logs', label: DOCKER_CAPABILITY_NAME.logs, description: 'Docker stdout·stderr 로그를 읽습니다.' },
  { capability: 'infrastructure', label: DOCKER_CAPABILITY_NAME.infrastructure, description: '호스트 CPU·메모리·디스크를 수집합니다.' },
  { capability: 'api', label: DOCKER_CAPABILITY_NAME.api, description: 'privileged eBPF Observer로 API 요청을 수집합니다.' },
  { capability: 'metrics', label: DOCKER_CAPABILITY_NAME.metrics, description: 'OTLP 메트릭을 수신할 수 있게 합니다.' },
];

function AgentForm({
  serverName,
  extra,
  blocked = false,
  submitting,
  profileKind,
  customCapabilities,
  onProfileKindChange,
  onCustomCapabilitiesChange,
  onClose,
  onSubmit,
}: {
  /** Docker Collector를 설치할 서버. 이름은 서버의 것이다. */
  serverName: string;
  /** 수집 범위 아래의 추가 선택(호스트 지표 출처). */
  extra?: ReactNode;
  /** 추가 선택을 마치기 전에는 설치하지 않는다. */
  blocked?: boolean;
  submitting: boolean;
  profileKind: AgentProfileKind;
  customCapabilities: AgentCollectionCapability[];
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
    // 본문(p-6)과 바닥 줄(구분선 + px-6 py-4)을 나눈다 — 다른 대화 상자와 같은 골격(DESIGN.md §3.7 패딩, §6).
    <form onSubmit={onSubmit}>
      <div className="space-y-item p-6">
        <ApplyScope>{APPLY_SCOPE.docker}</ApplyScope>
        <p className="type-body text-text">서버 <span className="font-medium">{serverName}</span>에 Docker Collector를 설치합니다.</p>
        <div className="space-y-label">
          <div>
            <span className="block type-label text-text-muted">수집 범위</span>
            <p data-gap="intra" className="mt-intra type-body text-text-muted">필요한 권한과 Docker Collector만 설치합니다.</p>
          </div>
          <SegmentedControl
            options={PROFILE_OPTIONS}
            value={profileKind}
            onChange={onProfileKindChange}
            size="md"
            ariaLabel="Docker 수집 프로필"
          />
          {profileKind === 'all-in-one' && (
            <p className="type-body text-text-muted">컨테이너 상태·로그·호스트 자원·API 요청을 수집하고 OTLP 메트릭을 받을 수 있습니다. 앱 메트릭은 별도 전송 설정이 필요합니다.</p>
          )}
          {profileKind === 'basic' && (
            <p className="type-body text-text-muted">컨테이너 상태와 로그만 수집합니다. Docker socket은 읽기 전용으로 사용합니다.</p>
          )}
          {profileKind === 'custom' && (
            <div role="group" aria-label="사용자 지정 수집 기능" className="-mx-3">
              {CAPABILITY_OPTIONS.map((option) => {
                const checked = customCapabilities.includes(option.capability);
                const disabled = option.capability === 'uptime' && uptimeRequired;
                return (
                  <div key={option.capability} className="flex items-center gap-3 px-3 py-2.5">
                    <Toggle
                      checked={checked}
                      onChange={(enabled) => toggleCapability(option.capability, enabled)}
                      disabled={disabled}
                      ariaLabel={`${option.label} 수집`}
                      title={disabled ? '로그 또는 API 요청 수집에 필요합니다' : undefined}
                    />
                    <div className="min-w-0">
                      <p className="type-label text-text">{option.label}</p>
                      <p className="type-body text-text-muted">{option.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {extra}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={blocked || (profileKind === 'custom' && customCapabilities.length === 0)} loading={submitting}>
          <MaterialIcon name="add" />
          추가
        </Button>
      </div>
    </form>
  );
}

function AgentInstallCommand({
  title,
  connected,
  expanded,
  expiryLabel,
  refreshingCode,
  address,
  installCommand,
  codeUnavailable,
  onRefreshCode,
}: {
  title: string;
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
    <details open={expanded} className="group">
      <summary className="-mx-3 flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-3 type-control text-text transition-colors hover:bg-surface-hover">
        <MaterialIcon size={20} name="terminal" className="text-text" />
        {title}
        <span className="ml-auto type-caption text-text-faint">
          {env.isDemoMode ? '실행할 수 없는 예시 명령' : connected ? '재설치할 때 사용' : 'Linux Docker 서버에서 실행'}
        </span>
        <MaterialIcon size={20} name="expand_more" className="text-text-faint transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-heading pt-2">
        <div className="flex items-start gap-3 rounded-md bg-surface-hover p-3">
          <MaterialIcon size={20} name="timer" className="icon-lead shrink-0 text-attn-text" />
          <div className="min-w-0 flex-1">
            <p className="type-label text-text">일회용 연결 코드</p>
            <p className="mt-intra type-body text-text-muted">
              {expiryLabel || '10분 후'}까지 한 번만 사용할 수 있습니다. 장기 API Key는 서버에 직접 저장됩니다.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefreshCode} loading={refreshingCode}>새 코드</Button>
        </div>

        <ConnectionAddressField address={address} />

        <div className="space-y-label">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="type-label text-text">설치 명령</p>
              <p className="mt-intra type-body text-text-muted">검사, 설정 백업, Docker Collector·eBPF 시작을 한 번에 처리합니다.</p>
            </div>
            <CopyButton
              onCopy={() => copyInstallCommand(installCommand)}
              title={env.isDemoMode ? '예시 설치 명령 복사' : address.valid ? '설치 명령 복사' : '연결 주소를 먼저 입력하세요'}
              disabled={!address.valid || codeUnavailable}
              className={COPY_ACTION_PRIMARY}
            >
              <span>복사</span>
            </CopyButton>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap break-all rounded-md bg-surface-hover px-4 py-3 font-mono text-xs text-text">
            {codeUnavailable ? '사용 가능한 연결 코드가 필요합니다. 새 코드를 발급해 주세요.' : installCommand}
          </pre>
        </div>

        <div className="grid gap-2 type-caption text-text-muted sm:grid-cols-3">
          {[
            ['rule', '환경 검사', 'Docker와 Compose 조건을 먼저 확인'],
            ['backup', '안전한 설치', '기존 설정을 백업하고 새 설정 저장'],
            ['sensors', '자동 발견', 'Docker Collector와 eBPF Observer를 함께 시작'],
          ].map(([icon, title, description]) => (
            <div key={title} className="rounded-md bg-surface-hover p-2.5">
              <MaterialIcon size={20} name={icon} className="text-text" />
              <p className="mt-1 font-medium text-text">{title}</p>
              <p className="mt-intra type-body text-text-muted">{description}</p>
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
  existingAgent,
  server,
  purpose = 'install',
  onConfigureInstrumentation,
}: Props) {
  const title = purpose === 'apply' ? '적용 명령' : DOCKER_INSTALL;
  const [step, setStep] = useState<Step>(existingAgent ? 'install' : 'form');
  const name = existingAgent?.name ?? server?.name ?? '';
  const [profileKind, setProfileKind] = useState<AgentProfileKind>('all-in-one');
  const [customCapabilities, setCustomCapabilities] = useState<AgentCollectionCapability[]>(['uptime']);
  // 서버당 호스트 지표 출처는 하나다(ADR 0012). 이 서버에 OpenTelemetry Collector 인프라가 있고 고른 수집 범위가 호스트 지표를
  // 모으면 하나를 고른다.
  const otelInfrastructure = useActiveOtelInfrastructure(server?.id) === true;
  const collectsInfrastructure = profileKind === 'all-in-one' || (profileKind === 'custom' && customCapabilities.includes('infrastructure'));
  const needsInfraSource = otelInfrastructure && collectsInfrastructure;
  const [infraSource, setInfraSource] = useState<MergeInfrastructure | null>(null);
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
        if (!firstCheck) toast.success('Docker Collector 연결을 확인했습니다');
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
    if (!trimmed || !server) return;
    setSubmitting(true);
    try {
      const profile: AgentProfile = {
        kind: profileKind,
        capabilities: profileKind === 'custom' ? customCapabilities : [],
      };
      const res = await api.createAgent(trimmed, profile, { serverId: server.id, ...(needsInfraSource && infraSource ? { infrastructure: infraSource } : {}) });
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
    ? formatClock(expiresAt)
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
      aria-label={title}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className={`w-full ${step === 'install' ? 'max-w-2xl' : 'max-w-md'} max-h-[92vh] bg-surface rounded-xl shadow-lg border border-border overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="type-card-title text-text">
            {title}
          </h2>
          <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} />
        </div>

        <SetupProgress step={step} connected={connected} diagnosed={diagnosed} />

        {step === 'form' ? (
          <AgentForm
            serverName={name}
            blocked={needsInfraSource && !infraSource}
            extra={needsInfraSource && (
              <InfraSourceChoice value={infraSource} onChange={setInfraSource} descriptions={{
                docker: 'Docker Collector가 호스트 지표를 모읍니다. 이 서버의 OpenTelemetry Collector 리소스는 연결을 중지합니다. 수집한 기록은 남습니다.',
                otel: '지금처럼 OpenTelemetry Collector가 호스트 지표를 모읍니다. Docker Collector의 수집에서 인프라를 뺍니다.',
              }} />
            )}
            submitting={submitting}
            profileKind={profileKind}
            customCapabilities={customCapabilities}
            onProfileKindChange={setProfileKind}
            onCustomCapabilitiesChange={setCustomCapabilities}
            onClose={onClose}
            onSubmit={handleCreate}
          />
        ) : (
          <div className="p-6 space-y-item overflow-y-auto">
            {env.isDemoMode && (
              <div className="space-y-label rounded-md bg-surface-hover p-4">
                <p className="type-body text-text">예시 설치 화면입니다. 이 데모에서는 서버를 연결할 수 없습니다.</p>
                <p className="type-caption text-text-muted">추가한 예시 환경은 새로고침하면 초기화됩니다.</p>
                <a href={QUICKSTART_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center type-body text-text hover:underline">실제 설치 방법 보기</a>
              </div>
            )}
            {setupError && <p role="alert" className="type-body text-attn-text">{setupError}</p>}
            {codeExpired && !connected && <p role="alert" className="type-body text-attn-text">설치 명령이 만료됐습니다. 아래에서 새 코드를 발급해 주세요.</p>}
            {connected ? (
              <div className="flex items-start gap-3 rounded-md bg-surface-hover p-4">
                <MaterialIcon size={20} name="check_circle" className="icon-lead shrink-0 text-ok-text" />
                <div>
                  <p className="type-body text-text">Docker Collector 연결을 확인했습니다</p>
                  <p className="mt-1 type-body text-text-muted">
                    기능 호환성과 발견된 컨테이너를 자동으로 확인했습니다. 이 화면에서 상세 수집까지 이어서 설정할 수 있습니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-md bg-accent/5 p-4">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="type-body text-text">Docker Collector 연결을 기다리는 중</p>
                  <p className="mt-intra type-body text-text-muted">명령을 실행하면 최대 5초 간격으로 자동 확인합니다.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void refreshConnection(true)} loading={checkingConnection}>
                  지금 확인
                </Button>
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
              title={purpose === 'apply' ? '적용 명령' : 'Docker Collector 설치 명령'}
              connected={connected}
              expanded={!connected || Boolean(existingAgent)}
              expiryLabel={expiryLabel}
              refreshingCode={refreshingCode}
              address={address}
              installCommand={installCommand}
              codeUnavailable={codeUnavailable}
              onRefreshCode={handleRefreshCode}
            />

            <div className="flex justify-end gap-2">
              {connected ? (
                <>
                  {injectableCount > 0 && onConfigureInstrumentation && (
                    <Button
                      variant="secondary"
                      onClick={() => onConfigureInstrumentation(agentId)}
                    >
                      상세 수집 설정
                    </Button>
                  )}
                  <Button onClick={onClose}>완료</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={onClose}>
                    나중에 확인
                  </Button>
                  <Button
                    onClick={() => void refreshConnection(true)}
                    loading={checkingConnection}
                  >
                    연결 확인
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

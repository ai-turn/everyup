import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DOCKER_SERVERS_PATH } from '../../servers/serverPaths';
import { toast } from 'react-hot-toast';
import { Button, Input, LoadErrorBanner, SegmentedControl, Select } from '../../../components/common';
import { api, type ObservedService, type TelemetrySignal } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { readLatest } from '../../../utils/readLatest';
import { Field } from '../../alerts/components/FormLayout';
import { ApplyScope } from '../../connections/ApplyScope';
import { DockerHostNote } from '../../connections/DockerHostNote';
import { APPLY_SCOPE, SIGNAL_TARGET, connectName, connectObject } from '../../connections/connectCopy';
import type { TelemetryConnectionResult } from './DirectTelemetrySetupResult';

type SetupMode = 'new' | 'existing';

const MODE_OPTIONS: { value: SetupMode; label: string }[] = [
  { value: 'new', label: '새 앱' },
  { value: 'existing', label: '기존 앱' },
];

/** 이 데이터 유형을 더할 수 있는 이 서버의 활성 앱(기존 앱 후보). 불러오기에 실패하면 다시 시도할 수 있다. */
function useAttachCandidates(signal: TelemetrySignal, serverId: string) {
  const [services, setServices] = useState<ObservedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const serviceRows = await api.getObservedServices();
        if (active) setServices((serviceRows ?? []).filter(service => service.isActive && !service.signals.includes(signal) && service.serverId === serverId));
      } catch (cause) {
        if (active) setError(getErrorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [signal, serverId, retryKey]);
  return { services, loading, error, retry: () => setRetryKey(key => key + 1) };
}

/**
 * 직접 연결 대화 상자의 입력 단계: 새 앱을 만들거나 이 서버의 기존 앱에 데이터 유형을 더한다. 성공하면 결과(한 번만 보이는 키,
 * 더한 권한)를 `onResult`로 넘기고, 대화 상자가 결과 화면으로 바꾼다. 제출 중인지는 대화 상자의 닫기와 함께 쓰므로 위에서 받는다.
 */
export function DirectTelemetrySetupForm({ signal, serverId, serverName, attachToId, submitting, onSubmittingChange, onResult, onCancel }: {
  signal: TelemetrySignal;
  serverId: string;
  serverName: string;
  attachToId?: string;
  submitting: boolean;
  onSubmittingChange: (submitting: boolean) => void;
  onResult: (result: TelemetryConnectionResult) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<SetupMode>(attachToId ? 'existing' : 'new');
  const [name, setName] = useState('');
  const [existingId, setExistingId] = useState(attachToId ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const candidates = useAttachCandidates(signal, serverId);

  // 기존 앱으로 고를 수 있는 이 서버의 앱이 없다. 앱 페이지에서 연 경우(attachToId)는 그 앱이 정해져 있다.
  const noCandidates = mode === 'existing' && !attachToId && !candidates.loading && candidates.services.length === 0;
  const selected = useMemo(
    () => candidates.services.find(service => service.id === existingId),
    [existingId, candidates.services],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // 브라우저 기본 검증(말풍선) 대신 입력 아래에 오류를 둔다(폼은 noValidate, UI/UX 점검 A5).
    // 이전에는 비어 있으면 추가 버튼이 이유 없이 비활성이었다.
    const missing = mode === 'new' ? !name.trim() && '앱 이름을 입력하세요' : !selected && '앱을 선택하세요';
    if (missing) {
      setFieldError(missing);
      document.getElementById(mode === 'new' ? `direct-${signal}-service-name` : `direct-${signal}-existing-service`)?.focus();
      return;
    }
    onSubmittingChange(true);
    try {
      const result = await connect(signal, serverId, mode === 'new' ? { name: name.trim() } : { existing: selected });
      if (result) onResult(result);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      onSubmittingChange(false);
    }
  };

  const clearError = () => setFieldError(null);
  return (
    <form onSubmit={submit} noValidate className="space-y-item p-6">
      {candidates.loading && <p role="status" className="type-body text-text-muted">연결 정보를 확인하고 있습니다…</p>}
      {candidates.error && <LoadErrorBanner inline title="연결 정보를 불러오지 못했습니다" message={candidates.error} onRetry={candidates.retry} />}
      <ApplyScope>{mode === 'existing' ? APPLY_SCOPE.directAttach : APPLY_SCOPE.directNew}</ApplyScope>
      <DockerNotes signal={signal} serverName={serverName} attaching={Boolean(attachToId)} />
      {/* 기존 앱은 이 서버의 앱만 고를 수 있다(연결 진입점 정리 D4). 고를 앱이 없어도 선택지는 보이고, 고르면 이유를 말한다. */}
      {!attachToId && !candidates.loading && !candidates.error && (
        <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={(next) => { setMode(next); clearError(); }} size="md" ariaLabel="앱 선택 방식" />
      )}

      {mode === 'new'
        ? <NewAppField signal={signal} name={name} error={fieldError} onChange={(next) => { setName(next); clearError(); }} />
        : <ExistingAppField signal={signal} services={candidates.services} value={existingId} error={fieldError} noCandidates={noCandidates}
          onChange={(next) => { setExistingId(next); clearError(); }} />}

      <div className="flex justify-end gap-2 border-t border-ui-border pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>취소</Button>
        <Button type="submit" disabled={candidates.loading || Boolean(candidates.error) || noCandidates} loading={submitting}>
          연결
        </Button>
      </div>
    </form>
  );
}

/**
 * 새 앱을 만들거나(키를 한 번 발급) 기존 앱에 데이터 유형을 더한다. 기존 앱이 정해지지 않았으면 아무것도 하지 않는다.
 * 기존 앱은 목록을 받은 뒤에 신호가 바뀌었을 수 있다. 지금의 앱에 신호를 더한다(그 사이의 연결 해제를 되돌리지 않게).
 */
async function connect(signal: TelemetrySignal, serverId: string, app: { name: string } | { existing?: ObservedService }): Promise<TelemetryConnectionResult | null> {
  if ('name' in app) {
    const service = await api.createObservedService({ name: app.name, serverId, signals: [signal] });
    return { kind: 'issued', service };
  }
  if (!app.existing) return null;
  const existing = app.existing;
  const latest = await readLatest(() => api.getObservedService(existing.id), '연결');
  const signals = latest.signals.includes(signal) ? latest.signals : [...latest.signals, signal];
  const service = await api.updateObservedService(latest.id, { name: latest.name, serverId, signals });
  return { kind: 'attached', service, signal };
}

/** 컨테이너 stdout 로그는 Docker 환경의 일이라는 안내(로그만)와, 같은 호스트의 Docker 환경 안내(새 앱일 때만). */
function DockerNotes({ signal, serverName, attaching }: { signal: TelemetrySignal; serverName: string; attaching: boolean }) {
  return <>
    {signal === 'logs' && (
      <p className="type-body text-text-muted">
        컨테이너가 stdout으로 내보내는 로그는 <Link to={DOCKER_SERVERS_PATH} className="text-action underline underline-offset-2">Docker 환경</Link>에서 연결합니다. 여기서는 앱이 OpenTelemetry로 직접 보내는 로그를 연결합니다.
      </p>
    )}
    {!attaching && <DockerHostNote serverName={serverName} sameNameOnly={signal === 'logs'} />}
  </>;
}

function NewAppField({ signal, name, error, onChange }: { signal: TelemetrySignal; name: string; error: string | null; onChange: (name: string) => void }) {
  return (
    <Field label="앱 이름" htmlFor={`direct-${signal}-service-name`} required error={error ?? undefined} hint="앱이 보내는 service.name과 관계없이 이 이름으로 표시하며, 연결 설정의 OTEL_SERVICE_NAME에도 들어갑니다.">
      <Input id={`direct-${signal}-service-name`} name="name" autoComplete="off" maxLength={200} invalid={Boolean(error)} value={name} onChange={event => onChange(event.target.value)} placeholder="예: orders-api" />
    </Field>
  );
}

/** 기존 앱 선택. 고를 앱이 없으면 선택을 막고 이유와 방법(그 앱 페이지에서 이 서버로 옮기기)을 말한다. */
function ExistingAppField({ signal, services, value, error, noCandidates, onChange }: {
  signal: TelemetrySignal; services: ObservedService[]; value: string; error: string | null; noCandidates: boolean; onChange: (id: string) => void;
}) {
  const target = SIGNAL_TARGET[signal];
  return (
    <Field label="앱" htmlFor={`direct-${signal}-existing-service`} required error={error ?? undefined}
      hint={noCandidates ? `이 서버에 ${connectObject(target)} 더할 수 있는 앱이 없습니다. 다른 서버의 앱은 그 앱 페이지에서 이 서버로 옮긴 뒤 연결하세요.` : `이 앱의 API Key에 ${connectName(target)} 권한을 더합니다.`}>
      <Select id={`direct-${signal}-existing-service`} value={value} disabled={noCandidates} onChange={event => onChange(event.target.value)}>
        <option value="">{noCandidates ? '연결할 수 있는 앱 없음' : '앱 선택'}</option>
        {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
      </Select>
    </Field>
  );
}

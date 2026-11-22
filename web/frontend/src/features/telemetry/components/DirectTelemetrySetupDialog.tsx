import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button, Input, LoadErrorBanner, SegmentedControl, Select, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import {
  api,
  type ObservedService,
  type TelemetrySignal,
} from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { ApplyScope } from '../../connections/ApplyScope';
import { DockerHostNote } from '../../connections/DockerHostNote';
import { APPLY_SCOPE, SIGNAL_TARGET, connectAction, connectAttached, connectName, connectObject, connectReady, connectView } from '../../connections/connectCopy';
import { readLatest } from '../../../utils/readLatest';
import { Field } from '../../alerts/components/FormLayout';
import { DirectTelemetrySetupResult, type TelemetryConnectionResult } from './DirectTelemetrySetupResult';

interface DirectTelemetrySetupDialogProps {
  signal: TelemetrySignal;
  description: string;
  onClose: () => void;
  onCreated: (service: ObservedService) => void;
  /** 앱을 만들었거나 신호를 더했다(결과 화면이 열렸다). 닫기만 해도 다시 불러올 것이 생겼다. */
  onIssued?: () => void;
  /** 새 앱을 이 서버에 만들고, 기존 앱 후보를 이 서버의 앱으로 좁힌다. 그룹은 서버의 것이다. */
  serverId: string;
  /** 같은 이름의 Docker 환경을 찾아 안내한다(`DockerHostNote`). */
  serverName: string;
  /** 앱 페이지의 `연결 전` 탭에서 열었다. 새 앱을 만들지 않고 이 앱에 데이터 유형을 더한다(고를 것이 없다). */
  attachToId?: string;
}

type SetupMode = 'new' | 'existing';

export function DirectTelemetrySetupDialog({
  signal,
  description,
  onClose,
  onCreated,
  onIssued,
  serverId,
  serverName,
  attachToId,
}: DirectTelemetrySetupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // 제목·결과·완료 버튼은 시작 버튼과 같은 말이다(DESIGN.md §9.17).
  const target = SIGNAL_TARGET[signal];
  const [mode, setMode] = useState<SetupMode>(attachToId ? 'existing' : 'new');
  const [name, setName] = useState('');
  const [existingId, setExistingId] = useState(attachToId ?? '');
  const [existingServices, setExistingServices] = useState<ObservedService[]>([]);
  const [result, setResult] = useState<TelemetryConnectionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsRetryKey, setOptionsRetryKey] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setOptionsLoading(true);
      setOptionsError(null);
      try {
        const serviceRows = await api.getObservedServices();
        if (active) setExistingServices((serviceRows ?? []).filter(service => service.isActive && !service.signals.includes(signal) && service.serverId === serverId));
      } catch (error) {
        if (active) setOptionsError(getErrorMessage(error));
      } finally {
        if (active) setOptionsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [signal, serverId, optionsRetryKey]);

  // 기존 앱으로 고를 수 있는 이 서버의 앱이 없다. 앱 페이지에서 연 경우(attachToId)는 그 앱이 정해져 있다.
  const noCandidates = mode === 'existing' && !attachToId && !optionsLoading && existingServices.length === 0;
  const selected = useMemo(
    () => existingServices.find(service => service.id === existingId),
    [existingId, existingServices],
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
    setSubmitting(true);
    try {
      if (mode === 'new') {
        const service = await api.createObservedService({ name: name.trim(), serverId, signals: [signal] });
        setResult({ kind: 'issued', service });
        onIssued?.();
      } else if (selected) {
        // 목록을 받은 뒤에 앱의 신호가 바뀌었을 수 있다. 지금의 앱에 신호를 더한다(그 사이의 연결 해제를 되돌리지 않게).
        const latest = await readLatest(() => api.getObservedService(selected.id), '연결');
        const signals = latest.signals.includes(signal) ? latest.signals : [...latest.signals, signal];
        const service = await api.updateObservedService(latest.id, { name: latest.name, serverId, signals });
        setResult({ kind: 'attached', service, signal });
        onIssued?.();
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const done = () => {
    const service = result?.service;
    if (service) onCreated(service);
    onClose();
  };

  const modeOptions: { value: SetupMode; label: string }[] = [
    { value: 'new', label: '새 앱' },
    { value: 'existing', label: '기존 앱' },
  ];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`direct-${signal}-dialog-title`}
      onCancel={(event) => { event.preventDefault(); if (!submitting) onClose(); }}
      // The new key is shown once — a stray click outside must not close it away.
      onClick={(event) => { if (event.target === event.currentTarget && !submitting && result?.kind !== 'issued') onClose(); }}
      className={`m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ui-border bg-bg-surface px-6 py-4">
        <div>
          <h2 id={`direct-${signal}-dialog-title`} className="type-card-title text-text-base">{connectAction(target)}</h2>
          <p className="mt-intra type-body text-text-muted">{description}</p>
        </div>
        <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={submitting} />
      </div>

      {result ? (
        <DirectTelemetrySetupResult
          connection={result}
          title={result.kind === 'issued' ? connectReady(target) : connectAttached(target, result.service.name)}
          doneLabel={connectView(target)}
          onDone={done}
        />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-item p-6">
          {optionsLoading && <p role="status" className="type-body text-text-muted">연결 정보를 확인하고 있습니다…</p>}
          {optionsError && <LoadErrorBanner inline title="연결 정보를 불러오지 못했습니다" message={optionsError} onRetry={() => setOptionsRetryKey(key => key + 1)} />}
          <ApplyScope>{mode === 'existing' ? APPLY_SCOPE.directAttach : APPLY_SCOPE.directNew}</ApplyScope>
          {signal === 'logs' && (
            <p className="type-body text-text-muted">
              컨테이너가 stdout으로 내보내는 로그는 <Link to="/environments" className="text-action underline underline-offset-2">Docker 환경</Link>에서 연결합니다. 여기서는 앱이 OpenTelemetry로 직접 보내는 로그를 연결합니다.
            </p>
          )}
          {!attachToId && <DockerHostNote serverName={serverName} sameNameOnly={signal === 'logs'} />}
          {/* 기존 앱은 이 서버의 앱만 고를 수 있다(연결 진입점 정리 D4). 고를 앱이 없어도 선택지는 보이고, 고르면 이유를 말한다. */}
          {!attachToId && !optionsLoading && !optionsError && (
            <SegmentedControl options={modeOptions} value={mode} onChange={(next) => { setMode(next); setFieldError(null); }} size="md" ariaLabel="앱 선택 방식" />
          )}

          {mode === 'new' ? (
            <Field label="앱 이름" htmlFor={`direct-${signal}-service-name`} required error={fieldError ?? undefined} hint="앱이 보내는 service.name과 관계없이 이 이름으로 표시하며, 연결 설정의 OTEL_SERVICE_NAME에도 들어갑니다.">
              <Input id={`direct-${signal}-service-name`} name="name" autoComplete="off" maxLength={200} invalid={Boolean(fieldError)} value={name} onChange={event => { setName(event.target.value); setFieldError(null); }} placeholder="예: orders-api" />
            </Field>
          ) : (
            <Field label="앱" htmlFor={`direct-${signal}-existing-service`} required error={fieldError ?? undefined}
              hint={noCandidates ? `이 서버에 ${connectObject(target)} 더할 수 있는 앱이 없습니다. 다른 서버의 앱은 그 앱 페이지에서 이 서버로 옮긴 뒤 연결하세요.` : `이 앱의 API Key에 ${connectName(target)} 권한을 더합니다.`}>
              <Select id={`direct-${signal}-existing-service`} value={existingId} disabled={noCandidates} onChange={event => { setExistingId(event.target.value); setFieldError(null); }}>
                <option value="">{noCandidates ? '연결할 수 있는 앱 없음' : '앱 선택'}</option>
                {existingServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
              </Select>
            </Field>
          )}

          <div className="flex justify-end gap-2 border-t border-ui-border pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>취소</Button>
            <Button type="submit" disabled={optionsLoading || Boolean(optionsError) || noCandidates} loading={submitting}>
              연결
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}

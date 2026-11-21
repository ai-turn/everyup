import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button, Input, LoadErrorBanner, MaterialIcon, SegmentedControl, Select, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import {
  api,
  type ObservedService,
  type TelemetrySignal,
} from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { readLatest } from '../../../utils/readLatest';
import { Field } from '../../alerts/components/FormLayout';
import { DirectTelemetrySetupResult, type TelemetryConnectionResult } from './DirectTelemetrySetupResult';

interface DirectTelemetrySetupDialogProps {
  signal: TelemetrySignal;
  capabilityLabel: string;
  title: string;
  description: string;
  onClose: () => void;
  onCreated: (service: ObservedService) => void;
  /** 앱을 만들었거나 신호를 더했다(결과 화면이 열렸다). 닫기만 해도 다시 불러올 것이 생겼다. */
  onIssued?: () => void;
  /** 새 앱을 이 서버에 만들고, 기존 앱 후보를 이 서버의 앱으로 좁힌다. 그룹은 서버의 것이다. */
  serverId: string;
}

type SetupMode = 'new' | 'existing';

export function DirectTelemetrySetupDialog({
  signal,
  capabilityLabel,
  title,
  description,
  onClose,
  onCreated,
  onIssued,
  serverId,
}: DirectTelemetrySetupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<SetupMode>('new');
  const [name, setName] = useState('');
  const [existingId, setExistingId] = useState('');
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
          <h2 id={`direct-${signal}-dialog-title`} className="type-card-title text-text-base">{title}</h2>
          <p className="mt-intra type-body text-text-muted">{description}</p>
        </div>
        <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={submitting} />
      </div>

      {result ? (
        <DirectTelemetrySetupResult
          connection={result}
          // 조사가 이름의 받침에 따라 갈리지 않는 문장으로 쓴다("메트릭를"이 됐었다).
          title={result.kind === 'issued' ? `${capabilityLabel} 연결이 준비되었습니다` : `기존 앱에 ${capabilityLabel} 연결을 추가했습니다`}
          doneLabel={`${capabilityLabel} 보기`}
          onDone={done}
        />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-item p-6">
          {optionsLoading && <p role="status" className="type-body text-text-muted">연결 정보를 확인하고 있습니다…</p>}
          {optionsError && <LoadErrorBanner inline title="연결 정보를 불러오지 못했습니다" message={optionsError} onRetry={() => setOptionsRetryKey(key => key + 1)} />}
          {signal === 'logs' && (
            <p className="type-body text-text-muted">
              컨테이너가 stdout으로 내보내는 로그는 <Link to="/environments" className="text-action underline underline-offset-2">Docker 환경</Link>에서 연결합니다. 여기서는 앱이 OpenTelemetry로 직접 보내는 로그를 연결합니다.
            </p>
          )}
          {/* Offered only when some service can take this signal on. */}
          {existingServices.length > 0 && (
            <SegmentedControl options={modeOptions} value={mode} onChange={(next) => { setMode(next); setFieldError(null); }} size="md" ariaLabel="앱 선택 방식" />
          )}

          {mode === 'new' ? (
            <Field label="앱 이름" htmlFor={`direct-${signal}-service-name`} required error={fieldError ?? undefined} hint="앱이 보내는 service.name과 관계없이 이 이름으로 표시하며, 연결 설정의 OTEL_SERVICE_NAME에도 들어갑니다.">
              <Input id={`direct-${signal}-service-name`} name="name" autoComplete="off" maxLength={200} invalid={Boolean(fieldError)} value={name} onChange={event => { setName(event.target.value); setFieldError(null); }} placeholder="예: orders-api" />
            </Field>
          ) : (
            <Field label="앱" htmlFor={`direct-${signal}-existing-service`} required error={fieldError ?? undefined} hint={`기존 연결 키에 ${capabilityLabel} 권한을 추가합니다.`}>
              <Select id={`direct-${signal}-existing-service`} value={existingId} onChange={event => { setExistingId(event.target.value); setFieldError(null); }}>
                <option value="">앱 선택</option>
                {existingServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
              </Select>
            </Field>
          )}

          <div className="flex justify-end gap-2 border-t border-ui-border pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>취소</Button>
            <Button type="submit" disabled={optionsLoading || Boolean(optionsError)} loading={submitting}>
              <MaterialIcon name="add" />
              추가
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}

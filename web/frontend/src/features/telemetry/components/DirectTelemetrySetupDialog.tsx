import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button, Input, LoadErrorBanner, MaterialIcon, SegmentedControl, Select, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import {
  api,
  type ObservedService,
  type Project,
  type TelemetrySignal,
} from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { readLatest } from '../../../utils/readLatest';
import { DirectTelemetrySetupResult, type TelemetryConnectionResult } from './DirectTelemetrySetupResult';

interface DirectTelemetrySetupDialogProps {
  signal: TelemetrySignal;
  capabilityLabel: string;
  title: string;
  description: string;
  onClose: () => void;
  onCreated: (service: ObservedService) => void;
  /** 서버 화면에서 열었다: 새 앱을 이 서버에 만들고, 기존 서비스 후보를 이 서버의 앱으로 좁히며, 그룹은 서버의 것을 쓴다. */
  serverId?: string;
}

type SetupMode = 'new' | 'existing';

export function DirectTelemetrySetupDialog({
  signal,
  capabilityLabel,
  title,
  description,
  onClose,
  onCreated,
  serverId,
}: DirectTelemetrySetupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<SetupMode>('new');
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [existingId, setExistingId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [existingServices, setExistingServices] = useState<ObservedService[]>([]);
  const [result, setResult] = useState<TelemetryConnectionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsRetryKey, setOptionsRetryKey] = useState(0);

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
        const [projectRows, serviceRows] = await Promise.all([serverId ? null : api.getProjects(), api.getObservedServices()]);
        if (active) {
          setProjects(projectRows ?? []);
          setExistingServices((serviceRows ?? []).filter(service => service.isActive && !service.signals.includes(signal) && (!serverId || service.serverId === serverId)));
        }
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
    setSubmitting(true);
    try {
      if (mode === 'new') {
        const service = await api.createObservedService(serverId
          ? { name: name.trim(), serverId, signals: [signal] }
          : { name: name.trim(), projectId: projectId || undefined, signals: [signal] });
        setResult({ kind: 'issued', service });
      } else if (selected) {
        // 목록을 받은 뒤에 앱의 신호가 바뀌었을 수 있다. 지금의 앱에 신호를 더한다(그 사이의 연결 해제를 되돌리지 않게).
        const latest = await readLatest(() => api.getObservedService(selected.id), '연결');
        const signals = latest.signals.includes(signal) ? latest.signals : [...latest.signals, signal];
        // serverId를 빼면 백엔드가 옛 화면의 요청으로 보고 서버의 그룹을 바꾼다.
        const service = await api.updateObservedService(latest.id, serverId
          ? { name: latest.name, serverId, signals }
          : { name: latest.name, projectId: latest.projectId, signals });
        setResult({ kind: 'attached', service, signal });
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  // 서버 화면은 대상을 앱이라고 부른다.
  const noun = serverId ? '앱' : '서비스';

  const done = () => {
    const service = result?.service;
    if (service) onCreated(service);
    onClose();
  };

  const modeOptions: { value: SetupMode; label: string }[] = [
    { value: 'new', label: `새 ${noun}` },
    { value: 'existing', label: `기존 ${noun}` },
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
          <p className="mt-0.5 type-body text-text-muted">{description}</p>
        </div>
        <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={submitting} />
      </div>

      {result ? (
        <DirectTelemetrySetupResult
          connection={result}
          // 조사가 이름의 받침에 따라 갈리지 않는 문장으로 쓴다("메트릭를"이 됐었다).
          title={result.kind === 'issued' ? `${capabilityLabel} 연결이 준비되었습니다` : `기존 ${noun}에 ${capabilityLabel} 연결을 추가했습니다`}
          doneLabel={`${capabilityLabel} 보기`}
          onDone={done}
        />
      ) : (
        <form onSubmit={submit} className="space-y-5 p-6">
          {optionsLoading && <p role="status" className="type-body text-text-muted">연결 정보를 확인하고 있습니다…</p>}
          {optionsError && <LoadErrorBanner inline title="연결 정보를 불러오지 못했습니다" message={optionsError} onRetry={() => setOptionsRetryKey(key => key + 1)} />}
          {signal === 'logs' && (
            <p className="type-body text-text-muted">
              컨테이너가 stdout으로 내보내는 로그는 <Link to="/environments" className="text-action underline underline-offset-2">Docker 환경</Link>에서 연결합니다. 여기서는 앱이 OpenTelemetry로 직접 보내는 로그를 연결합니다.
            </p>
          )}
          {/* Offered only when some service can take this signal on. */}
          {existingServices.length > 0 && (
            <SegmentedControl options={modeOptions} value={mode} onChange={setMode} size="md" ariaLabel={`${noun} 선택 방식`} />
          )}

          {mode === 'new' ? (
            <>
              <div className="space-y-1.5">
                <label className="block type-label text-text-secondary" htmlFor={`direct-${signal}-service-name`}>{noun} 이름</label>
                <Input id={`direct-${signal}-service-name`} name="name" autoComplete="off" aria-describedby={`direct-${signal}-name-hint`} required maxLength={200} value={name} onChange={event => setName(event.target.value)} placeholder="예: orders-api" />
                <p id={`direct-${signal}-name-hint`} className="type-body text-text-muted">앱이 보내는 service.name과 관계없이 이 이름으로 표시하며, 연결 설정의 OTEL_SERVICE_NAME에도 들어갑니다.</p>
              </div>
              {!serverId && <label className="block space-y-1.5" htmlFor={`direct-${signal}-project`}>
                <span className="type-label text-text-secondary">그룹</span>
                <Select id={`direct-${signal}-project`} value={projectId} onChange={event => setProjectId(event.target.value)}>
                  <option value="">미분류</option>
                  {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                </Select>
              </label>}
            </>
          ) : (
            <label className="block space-y-1.5" htmlFor={`direct-${signal}-existing-service`}>
              <span className="type-label text-text-secondary">{noun}</span>
              <Select id={`direct-${signal}-existing-service`} required value={existingId} onChange={event => setExistingId(event.target.value)}>
                <option value="">{noun} 선택</option>
                {existingServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
              </Select>
              <span className="block type-body text-text-muted">{`기존 연결 키에 ${capabilityLabel} 권한을 추가합니다.`}</span>
            </label>
          )}

          <div className="flex justify-end gap-2 border-t border-ui-border pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>취소</Button>
            <Button type="submit" disabled={optionsLoading || Boolean(optionsError) || (mode === 'new' ? !name.trim() : !selected)} loading={submitting}>
              <MaterialIcon name="add" />
              추가
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}

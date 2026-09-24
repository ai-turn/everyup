import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, Input, MaterialIcon, SegmentedControl, Select, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import {
  api,
  type ObservedService,
  type ObservedServiceSetup,
  type Project,
  type TelemetrySignal,
} from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { DirectTelemetrySetupResult } from './DirectTelemetrySetupResult';
import { TelemetryReceiptStatus } from '../../services/components/TelemetryReceiptStatus';
import { TelemetrySetupGuidance } from './TelemetrySetupGuidance';

interface DirectTelemetrySetupDialogProps {
  initialService?: ObservedService;
  signal: TelemetrySignal;
  capabilityLabel: string;
  title: string;
  description: string;
  onClose: () => void;
  onCreated: (service: ObservedService) => void;
}

type SetupMode = 'new' | 'existing';

export function DirectTelemetrySetupDialog({
  initialService,
  signal,
  capabilityLabel,
  title,
  description,
  onClose,
  onCreated,
}: DirectTelemetrySetupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<SetupMode>(initialService ? 'existing' : 'new');
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [existingId, setExistingId] = useState(initialService?.id ?? '');
  const [projects, setProjects] = useState<Project[]>([]);
  const [existingServices, setExistingServices] = useState<ObservedService[]>([]);
  const [setup, setSetup] = useState<ObservedServiceSetup | null>(null);
  const [attached, setAttached] = useState<ObservedService | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { dialogRef.current?.showModal(); }, []);
  useEffect(() => {
    Promise.all([api.getProjects(), api.getObservedServices()])
      .then(([projectRows, serviceRows]) => {
        setProjects(projectRows ?? []);
        setExistingServices((serviceRows ?? []).filter(service => service.isActive && !service.signals.includes(signal)));
      })
      .catch(() => {});
  }, [signal]);

  const selected = useMemo(
    () => existingServices.find(service => service.id === existingId),
    [existingId, existingServices],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'new') {
        setSetup(await api.createObservedService({
          name: name.trim(),
          projectId: projectId || undefined,
          signals: [signal],
        }));
      } else if (selected) {
        setAttached(await api.updateObservedService(selected.id, {
          name: selected.name,
          projectId: selected.projectId,
          signals: [...selected.signals, signal],
        }));
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const done = () => {
    const service = setup ?? attached;
    if (service) onCreated(service);
    onClose();
  };

  const modeOptions: { value: SetupMode; label: string }[] = [
    { value: 'new', label: '새 서비스' },
    { value: 'existing', label: '기존 서비스' },
  ];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`direct-${signal}-dialog-title`}
      onCancel={(event) => { event.preventDefault(); if (!submitting) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}
      className={`m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ui-border bg-bg-surface px-6 py-4">
        <div>
          <h2 id={`direct-${signal}-dialog-title`} className="type-card-title text-text-base">{title}</h2>
          <p className="mt-0.5 text-sm text-text-muted">{description}</p>
        </div>
        <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={submitting} />
      </div>

      {setup ? (
        <DirectTelemetrySetupResult
          setup={setup}
          title={`${capabilityLabel} 연결이 준비되었습니다`}
          doneLabel={`${capabilityLabel} 보기`}
          onDone={done}
        />
      ) : attached ? (
        <div className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-healthy/10 text-status-healthy"><MaterialIcon name="check" /></span>
            <div>
              <h3 className="type-card-title text-text-base">{`기존 서비스에 ${capabilityLabel}를 추가했습니다`}</h3>
              <p className="mt-1 text-sm text-text-muted">{`기존 API Key에 ${capabilityLabel} 권한을 추가했습니다. 실행 중인 OpenTelemetry 설정은 같은 키를 계속 사용합니다.`}</p>
            </div>
          </div>
          <TelemetrySetupGuidance signals={[signal]} />
          <TelemetryReceiptStatus path={`/observed-services/${attached.id}/setup-status`} expected={[signal]} />
          <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end border-t border-ui-border bg-bg-surface px-6 py-4"><Button onClick={done}>{`${capabilityLabel} 보기`}</Button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5 p-6">
          <SegmentedControl options={modeOptions} value={mode} onChange={setMode} size="md" ariaLabel="서비스 선택 방식" />

          {mode === 'new' ? (
            <>
              <label className="block space-y-1.5" htmlFor={`direct-${signal}-service-name`}>
                <span className="text-sm font-medium text-text-secondary">서비스 이름</span>
                <Input id={`direct-${signal}-service-name`} required maxLength={200} value={name} onChange={event => setName(event.target.value)} placeholder="checkout-api" />
                <span className="block type-body text-text-muted">수신 payload의 service.name 대신 이 이름으로 고정합니다.</span>
              </label>
              <label className="block space-y-1.5" htmlFor={`direct-${signal}-project`}>
                <span className="text-sm font-medium text-text-secondary">Project</span>
                <Select id={`direct-${signal}-project`} value={projectId} onChange={event => setProjectId(event.target.value)}>
                  <option value="">미분류</option>
                  {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                </Select>
              </label>
            </>
          ) : existingServices.length > 0 ? (
            <label className="block space-y-1.5" htmlFor={`direct-${signal}-existing-service`}>
              <span className="text-sm font-medium text-text-secondary">Observed Service</span>
              <Select id={`direct-${signal}-existing-service`} required value={existingId} onChange={event => setExistingId(event.target.value)}>
                <option value="">서비스 선택</option>
                {existingServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
              </Select>
              <span className="block type-body text-text-muted">{`기존 연결 키의 범위에 ${capabilityLabel}를 추가합니다.`}</span>
            </label>
          ) : (
            <div className="rounded-xl border border-ui-border bg-ui-hover-soft p-4 text-sm text-text-muted">{`${capabilityLabel}를 추가할 수 있는 기존 직접 서비스가 없습니다. 새 서비스를 만들어 주세요.`}</div>
          )}

          <div className="flex justify-end gap-2 border-t border-ui-border pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>취소</Button>
            <Button type="submit" disabled={mode === 'new' ? !name.trim() : !selected} loading={submitting}>
              <MaterialIcon name="add" />
              추가
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}

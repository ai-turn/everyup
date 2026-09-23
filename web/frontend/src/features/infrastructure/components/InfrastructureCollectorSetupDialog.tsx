import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, Input, MaterialIcon, Select, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { api, type InfrastructureResource, type InfrastructureResourceSetup, type Project } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { InfrastructureCollectorSetupResult } from './InfrastructureCollectorSetupResult';

export function InfrastructureCollectorSetupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (resource: InfrastructureResource) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [setup, setSetup] = useState<InfrastructureResourceSetup | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => { api.getProjects().then(rows => setProjects(rows ?? [])).catch(() => {}); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      setSetup(await api.createInfrastructureResource({ name: name.trim(), projectId: projectId || undefined }));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };
  const done = () => {
    if (setup) onCreated(setup);
    onClose();
  };

  return (
    // Backdrop click is supplemental; Escape and the labelled close/cancel buttons are keyboard equivalents.
    // react-doctor-disable-next-line no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby="infrastructure-collector-dialog-title"
      onCancel={event => { event.preventDefault(); if (!submitting) onClose(); }}
      onClick={event => { if (event.target === event.currentTarget && !submitting) onClose(); }}
      className={`m-auto w-full max-w-2xl overflow-hidden rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-ui-border px-6 py-4">
        <div>
          <h2 id="infrastructure-collector-dialog-title" className="type-card-title text-text-base">OpenTelemetry Collector 연결</h2>
          <p className="mt-0.5 text-sm text-text-muted">표준 hostmetrics receiver로 CPU, 메모리, 디스크를 수집합니다.</p>
        </div>
        <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={submitting} />
      </div>
      {setup ? (
        <InfrastructureCollectorSetupResult setup={setup} title="Collector 연결이 준비되었습니다" onDone={done} />
      ) : (
        <form onSubmit={submit} className="space-y-5 p-6">
          <label className="block space-y-1.5" htmlFor="collector-resource-name">
            <span className="text-sm font-medium text-text-secondary">인프라 이름</span>
            <Input id="collector-resource-name" required maxLength={200} value={name} onChange={event => setName(event.target.value)} placeholder="edge-host-01" />
          </label>
          <label className="block space-y-1.5" htmlFor="collector-project">
            <span className="text-sm font-medium text-text-secondary">Project</span>
            <Select id="collector-project" value={projectId} onChange={event => setProjectId(event.target.value)}>
              <option value="">미분류</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
          </label>
          <div className="rounded-xl border border-ui-border bg-ui-hover-soft p-4 text-sm text-text-muted">
            설정 파일과 일회성 API 키를 발급합니다. Collector는 metrics 신호만 전송할 수 있으며 Docker 환경은 추가되지 않습니다.
          </div>
          <div className="flex justify-end gap-2 border-t border-ui-border pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>취소</Button>
            <Button type="submit" disabled={submitting || !name.trim()}><MaterialIcon name="add" />{submitting ? '추가 중...' : '추가하기'}</Button>
          </div>
        </form>
      )}
    </dialog>
  );
}

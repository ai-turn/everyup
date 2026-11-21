import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, MaterialIcon, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { api, type InfrastructureResource, type InfrastructureResourceSetup } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { InfrastructureCollectorSetupResult } from './InfrastructureCollectorSetupResult';

export function InfrastructureCollectorSetupDialog({
  onClose,
  onCreated,
  onIssued,
  serverId,
  serverName,
}: {
  onClose: () => void;
  onCreated: (resource: InfrastructureResource) => void;
  /** 리소스를 만들고 키를 발급한 직후. 안내를 보고 닫기(X)로 닫아도 만든 것이 있다고 알 수 있다. */
  onIssued?: () => void;
  /** 리소스를 만들 서버. 그룹은 서버의 것이다. */
  serverId: string;
  /** 리소스는 서버마다 하나라 이름을 묻지 않고 서버 이름을 쓴다. */
  serverName: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [setup, setSetup] = useState<InfrastructureResourceSetup | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { ref.current?.showModal(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      setSetup(await api.createInfrastructureResource({ name: serverName, serverId }));
      onIssued?.();
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
      // The API Key is shown once — a stray backdrop click must not throw it away.
      onClick={event => { if (event.target === event.currentTarget && !submitting && !setup) onClose(); }}
      className={`m-auto w-full max-w-2xl overflow-hidden rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-ui-border px-6 py-4">
        <div>
          <h2 id="infrastructure-collector-dialog-title" className="type-card-title text-text-base">OpenTelemetry Collector 연결</h2>
          <p className="mt-intra type-body text-text-muted">표준 hostmetrics receiver로 CPU, 메모리, 디스크, 네트워크를 수집합니다.</p>
        </div>
        <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={submitting} />
      </div>
      {setup ? (
        <InfrastructureCollectorSetupResult setup={setup} title="Collector 연결이 준비되었습니다" onDone={done} />
      ) : (
        <form onSubmit={submit} className="space-y-item p-6">
          <div className="rounded-md bg-ui-hover-soft p-4 type-control text-text-muted">
            추가하면 Collector 설정 파일과 한 번만 표시되는 API Key를 발급합니다.
          </div>
          <div className="flex justify-end gap-2 border-t border-ui-border pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>취소</Button>
            <Button type="submit" loading={submitting}><MaterialIcon name="add" />추가</Button>
          </div>
        </form>
      )}
    </dialog>
  );
}

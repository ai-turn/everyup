import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, ConfirmDialog, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { useModalDialog } from '../../../hooks/useModalDialog';
import { api } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { hasTargets, type ServerRow } from '../serverStatus';
import { useServerForm } from '../useServerForm';
import { ServerFields } from './ServerFields';
import { TargetCountList } from './TargetCountList';

export function ServerSettingsDialog({ row, onClose, onSaved, onMerge, onDelete }: {
  row: ServerRow;
  onClose: () => void;
  onSaved: () => void;
  onMerge: () => void;
  onDelete: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useModalDialog(true, dialogRef);
  const { server } = row;
  const form = useServerForm({ name: server.name, description: server.description ?? '', projectId: server.projectId ?? '' });
  const { saving } = form;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void form.submit(async (input) => {
      await api.updateServer(server.id, input);
      toast.success('서버 설정을 저장했습니다');
      onSaved();
    });
  };

  return (
    // 배경 클릭은 보조 수단이다. Escape와 닫기·취소 버튼이 키보드에서 같은 일을 한다.
    // react-doctor-disable-next-line no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-labelledby="server-settings-title"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <form onSubmit={submit}>
        <div className="flex items-center justify-between gap-3 border-b border-ui-border px-6 py-4">
          <h2 id="server-settings-title" className="type-card-title text-text-base">서버 설정</h2>
          <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={saving} />
        </div>
        <fieldset disabled={saving} className="space-y-4 p-6">
          <ServerFields form={form} idPrefix="server-settings" />
        </fieldset>
        {/* 서버 자체를 바꾸는 조작은 입력란 아래에 떼어 두고, 저장 줄은 맨 아래에 둔다.
            오른쪽 아래 끝(주 액션 자리)에 삭제가 오지 않게 한다. 중립 표면에 붉은 글자의 조작이다(DESIGN.md §9.2). */}
        <section aria-label="서버 관리" className="space-y-4 border-t border-ui-border px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 basis-56 type-body text-text-muted">선택한 서버의 대상을 모두 이 서버로 옮기고, 선택한 서버는 삭제합니다.</p>
            <Button type="button" variant="secondary" onClick={onMerge} disabled={saving}>다른 서버 합치기</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 basis-56 type-body text-text-muted">연결된 대상과 수집된 데이터를 함께 삭제합니다.</p>
            <Button type="button" variant="destructive" onClick={onDelete} disabled={saving}>서버 삭제</Button>
          </div>
        </section>
        <div className="flex justify-end gap-2 border-t border-ui-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>취소</Button>
          <Button type="submit" loading={saving}>저장</Button>
        </div>
      </form>
    </dialog>
  );
}

export function DeleteServerDialog({ row, onClose, onDeleted, onFailed }: {
  row: ServerRow;
  onClose: () => void;
  onDeleted: () => void;
  /** 실패해도 일부가 지워졌을 수 있다. 창을 연 채로 서버 데이터를 다시 불러온다. */
  onFailed: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteServer(row.server.id);
      toast.success('서버를 삭제했습니다');
      onDeleted();
    } catch (cause) {
      setError(getErrorMessage(cause));
      setDeleting(false);
      onFailed();
    }
  };

  return (
    <ConfirmDialog isOpen onClose={onClose} onConfirm={() => void remove()} title={`${row.server.name} 서버를 삭제할까요?`} confirmLabel="삭제" variant="danger" isProcessing={deleting}
      message={hasTargets(row.targets) ? (
        <div className="space-y-3">
          <p>다음 대상이 함께 삭제됩니다.</p>
          <TargetCountList rows={[row]} />
          <p>수집된 데이터도 함께 삭제됩니다.</p>
        </div>
      ) : row.unknownCapabilities.length > 0 || row.staleCapabilities.length > 0
        // 알려진 대상이 없어도 불러오지 못한 목록에 있을 수 있다(이전 목록이면 그 뒤에 생겼을 수 있다). 없다고 단정하지 않는다.
        ? <p>대상 목록을 불러오지 못해 함께 삭제될 대상을 확인하지 못했습니다. 연결된 대상이 있으면 함께 삭제됩니다.</p>
        : <p>이 서버에는 연결된 대상이 없습니다.</p>}
      description={error && <span role="alert" className="text-status-error">{error}</span>}
    />
  );
}

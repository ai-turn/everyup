import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, IconButton, Select } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { useModalDialog } from '../../../hooks/useModalDialog';
import { api, type Project } from '../../../services/api';
import { ApiError, getErrorMessage } from '../../../utils/errors';
import { Field } from '../../alerts/components/FormLayout';
import { hasTargets, type ServerRow } from '../serverStatus';
import { TargetCountList } from './ServerSettingsDialog';

const errorMessage = (error: unknown) => error instanceof ApiError && error.code === 'SERVER_HAS_INFRASTRUCTURE'
  ? '두 서버 모두 인프라 리소스가 있어서 합칠 수 없습니다.'
  : getErrorMessage(error);

export function MergeServerDialog({ row, rows, projects, onClose, onMerged }: {
  row: ServerRow;
  rows: ServerRow[];
  /** 그룹 목록을 불러오지 못했으면 null. 선택지에서 그룹 이름을 뺀다. */
  projects: Project[] | null;
  onClose: () => void;
  onMerged: (targetServerId: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useModalDialog(true, dialogRef);
  const [targetId, setTargetId] = useState('');
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이름이 같은 서버가 다른 그룹에 있을 수 있어서 그룹 이름을 함께 보인다.
  const groupOf = (candidate: ServerRow) => candidate.server.projectId
    ? projects?.find((project) => project.id === candidate.server.projectId)?.name ?? '-'
    : '미분류';
  const candidates = rows
    .filter((candidate) => candidate.server.id !== row.server.id)
    .sort((a, b) => a.server.name.localeCompare(b.server.name))
    .map((candidate) => {
      // 서버에 인프라 리소스는 하나뿐이다. 양쪽에 다 있으면 백엔드가 거부하므로 미리 막는다.
      const blocked = Boolean(row.targets.infrastructure && candidate.targets.infrastructure);
      const name = projects === null ? candidate.server.name : `${candidate.server.name} (${groupOf(candidate)})`;
      return { id: candidate.server.id, name: candidate.server.name, label: blocked ? `${name}, 인프라 리소스가 이미 있습니다` : name, blocked };
    });
  const target = candidates.find((candidate) => candidate.id === targetId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target) return;
    setMerging(true);
    setError(null);
    try {
      await api.mergeServer(row.server.id, target.id);
      toast.success('서버를 합쳤습니다');
      onMerged(target.id);
    } catch (cause) {
      setError(errorMessage(cause));
      setMerging(false);
    }
  };

  return (
    // 배경 클릭은 보조 수단이다. Escape와 닫기·취소 버튼이 키보드에서 같은 일을 한다.
    // react-doctor-disable-next-line no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-labelledby="merge-server-title"
      onCancel={(event) => { event.preventDefault(); if (!merging) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !merging) onClose(); }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="flex items-center justify-between gap-3 border-b border-ui-border px-6 py-4">
          <div>
            <h2 id="merge-server-title" className="type-card-title text-text-base">다른 서버와 합치기</h2>
            <p className="mt-0.5 type-body text-text-muted">{row.server.name}</p>
          </div>
          <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={merging} />
        </div>
        <fieldset disabled={merging} className="space-y-4 p-6">
          {candidates.length === 0 ? (
            <p className="type-body text-text-muted">합칠 다른 서버가 없습니다.</p>
          ) : (
            <Field label="대상 서버" htmlFor="merge-server-target">
              <Select id="merge-server-target" aria-label="대상 서버" required value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                <option value="">서버 선택</option>
                {candidates.map((candidate) => <option key={candidate.id} value={candidate.id} disabled={candidate.blocked}>{candidate.label}</option>)}
              </Select>
            </Field>
          )}
          {target && (hasTargets(row.targets) ? (
            <div className="space-y-3">
              <p className="type-body text-text-base">이 서버의 대상을 모두 {target.name}으로 옮기고 이 서버를 삭제합니다.</p>
              <TargetCountList row={row} />
            </div>
          ) : (
            <p className="type-body text-text-base">옮길 대상이 없습니다. 이 서버만 삭제됩니다.</p>
          ))}
          {error && <p role="alert" className="type-body text-status-error">{error}</p>}
        </fieldset>
        <div className="flex justify-end gap-2 border-t border-ui-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={merging}>취소</Button>
          <Button type="submit" loading={merging} disabled={!target}>합치기</Button>
        </div>
      </form>
    </dialog>
  );
}

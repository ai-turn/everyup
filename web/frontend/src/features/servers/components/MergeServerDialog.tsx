import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { useModalDialog } from '../../../hooks/useModalDialog';
import { api, type Project } from '../../../services/api';
import { ApiError, getErrorMessage } from '../../../utils/errors';
import { countTargets, hasTargets, targetCountLabels, type ServerRow } from '../serverStatus';
import { TargetCountList } from './TargetCountList';

const INFRA_TAKEN = '인프라 리소스가 이미 있습니다';

const errorMessage = (error: unknown) => error instanceof ApiError && error.code === 'SERVER_HAS_INFRASTRUCTURE'
  ? '두 서버 모두 인프라 리소스가 있어서 합칠 수 없습니다.'
  : getErrorMessage(error);

/** 다른 서버들을 이 서버로 가져온다. 선택한 서버의 대상은 이 서버로 옮겨지고 선택한 서버는 삭제된다. */
export function MergeServerDialog({ row, rows, projects, onClose, onReload, onMerged }: {
  row: ServerRow;
  rows: ServerRow[];
  /** 그룹 목록을 불러오지 못했으면 null. 항목에서 그룹 이름을 뺀다. */
  projects: Project[] | null;
  onClose: () => void;
  /** 실패한 뒤에 서버 데이터를 다시 불러온다. 창은 열어 둔다. */
  onReload: () => void;
  /** 모두 합쳤다. 창을 닫고 서버 데이터를 다시 불러오는 것은 화면이 한다. */
  onMerged: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useModalDialog(true, dialogRef);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = rows
    .filter((candidate) => candidate.server.id !== row.server.id)
    .sort((a, b) => a.server.name.localeCompare(b.server.name));
  // 다시 불러온 뒤 사라진 서버(이미 합쳐진 서버)는 선택에서도 빠진다.
  const selected = candidates.filter((candidate) => checked.has(candidate.server.id));

  // 서버 하나에 인프라 리소스는 하나다. 인프라 목록을 모르면 미리 막지 않고 백엔드의 거부(409)에 맡긴다.
  const infraUnknown = rows.some((candidate) => candidate.unknownCapabilities.includes('infrastructure'));
  const infraTaken = !infraUnknown && (Boolean(row.targets.infrastructure) || selected.some((candidate) => candidate.targets.infrastructure));
  const blocked = (candidate: ServerRow) => infraTaken && Boolean(candidate.targets.infrastructure) && !checked.has(candidate.server.id);

  // 그룹이 없으면 미분류, 그룹 목록을 모르거나 그룹을 찾지 못하면 괄호를 뺀다.
  const groupOf = (candidate: ServerRow) => !candidate.server.projectId ? '미분류'
    : projects?.find((project) => project.id === candidate.server.projectId)?.name;
  const summaryOf = (candidate: ServerRow) => {
    const labels = targetCountLabels(countTargets(candidate.targets));
    if (labels.length > 0) return labels.join(', ');
    return candidate.unknownCapabilities.length > 0 || candidate.staleCapabilities.length > 0 ? '대상 확인 불가' : '대상 없음';
  };

  const toggle = (id: string) => setChecked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) return;
    setMerging(true);
    setError(null);
    // 차례로 합친다. 같은 서버로 동시에 옮기면 인프라 충돌 검사가 서로를 보지 못한다.
    let merged = 0;
    for (const candidate of selected) {
      try {
        // 차례로 호출하는 것이 요구 사항이다(위 주석). 병렬로 바꾸지 않는다.
        // react-doctor-disable-next-line async-await-in-loop
        await api.mergeServer(candidate.server.id, row.server.id);
        merged += 1;
        // 다시 불러오기가 끝나기 전이나 실패한 뒤에 재시도해도 이미 합쳐진 서버로 요청하지 않게 선택에서 바로 뺀다.
        setChecked((current) => {
          const next = new Set(current);
          next.delete(candidate.server.id);
          return next;
        });
      } catch (cause) {
        setError(`${merged > 0 ? `서버 ${merged}개를 합친 뒤 ` : ''}${candidate.server.name}에서 멈췄습니다. ${errorMessage(cause)}`);
        setMerging(false);
        onReload();
        return;
      }
    }
    toast.success(`서버 ${merged}개를 합쳤습니다`);
    onMerged();
  };

  const knownTargets = selected.some((candidate) => hasTargets(candidate.targets));
  const unknownTargets = selected.some((candidate) => candidate.unknownCapabilities.length > 0 || candidate.staleCapabilities.length > 0);

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
            <h2 id="merge-server-title" className="type-card-title text-text-base">다른 서버 합치기</h2>
            <p className="mt-0.5 type-body text-text-muted">선택한 서버의 대상을 모두 이 서버로 옮기고, 선택한 서버는 삭제합니다.</p>
          </div>
          <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={merging} />
        </div>
        <fieldset disabled={merging} className="space-y-4 p-6">
          {candidates.length === 0 ? (
            <p className="type-body text-text-muted">합칠 다른 서버가 없습니다.</p>
          ) : (
            <div>
              <h3 id="merge-server-choices" className="mb-1.5 type-label text-text-muted">합칠 서버 ({candidates.length}개)</h3>
              {/* 행 높이(약 52px)의 4.5배쯤에서 자른다. 마지막 행이 반쯤 걸쳐야 목록이 더 있다는 것이 보인다. */}
              <ul aria-labelledby="merge-server-choices" className="-mx-2 max-h-60 overflow-y-auto">
                {candidates.map((candidate) => {
                  const disabled = blocked(candidate);
                  const group = groupOf(candidate);
                  return (
                    <li key={candidate.server.id}>
                      <label className={`flex min-h-11 items-start gap-3 rounded-lg px-2 py-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-ui-hover-soft'}`}>
                        <input type="checkbox" checked={checked.has(candidate.server.id)} disabled={disabled} onChange={() => toggle(candidate.server.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed" />
                        <span className="min-w-0">
                          <span className="block break-words type-label text-text-base">{candidate.server.name}{group && ` (${group})`}</span>
                          <span className="block type-caption text-text-muted">{disabled ? INFRA_TAKEN : summaryOf(candidate)}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {infraUnknown && <p className="type-body text-text-muted">인프라 리소스 목록을 불러오지 못해 충돌 여부를 미리 확인하지 못했습니다.</p>}
          {selected.length > 0 && (
            <div className="space-y-3" aria-live="polite">
              <p className="type-body text-text-base">
                {knownTargets ? '다음 대상이 이 서버로 옮겨집니다.'
                  : unknownTargets ? '대상 목록을 불러오지 못해 옮겨질 대상을 확인하지 못했습니다.'
                    : '옮길 대상이 없습니다.'}
              </p>
              <TargetCountList rows={selected} />
              <p className="type-body text-text-base">선택한 서버 {selected.length}개는 삭제됩니다.</p>
            </div>
          )}
          {error && <p role="alert" className="type-body text-status-error">{error}</p>}
        </fieldset>
        <div className="flex justify-end gap-2 border-t border-ui-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={merging}>취소</Button>
          {/* 선택한 서버가 삭제되는 동작이다(DESIGN.md §7 삭제 확인). */}
          <Button type="submit" variant="danger" loading={merging} disabled={selected.length === 0}>합치기</Button>
        </div>
      </form>
    </dialog>
  );
}

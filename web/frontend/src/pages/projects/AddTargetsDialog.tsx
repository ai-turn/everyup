import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, IconButton, MaterialIcon, SearchInput } from '../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../hooks/useOverlay';
import type { Project } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { TARGET_KINDS, setTargetGroup, targetKey, type AssignableTarget } from './projectMembers';

// 그룹 상세의 "대상 추가". 이미 이 그룹에 있는 대상은 빼고, 다른 그룹에 있는 대상은 현재 그룹을 보여 준 채
// 고를 수 있게 한다(배정은 덮어쓰기라 그대로 옮겨진다). 미분류를 먼저 보여 준다.
export function AddTargetsDialog({ project, projects, targets, onClose, onAdded }: {
  project: Project;
  projects: Project[];
  targets: AssignableTarget[];
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  useEffect(() => { dialogRef.current?.showModal(); }, []);

  const groupName = (id?: string) => projects.find(row => row.id === id)?.name;
  const candidates = targets
    .filter(target => target.item.projectId !== project.id)
    .sort((a, b) => Number(Boolean(a.item.projectId)) - Number(Boolean(b.item.projectId)));
  const needle = query.trim().toLowerCase();
  const visible = needle ? candidates.filter(target => target.item.name.toLowerCase().includes(needle)) : candidates;
  const chosen = candidates.filter(target => selected.has(targetKey(target)));
  const moving = chosen.filter(target => target.item.projectId).length;

  const toggle = (key: string, checked: boolean) => setSelected(previous => {
    const next = new Set(previous);
    if (checked) next.add(key); else next.delete(key);
    return next;
  });

  const close = () => { if (!saving) onClose(); };
  const submit = async () => {
    setSaving(true);
    const results = await Promise.allSettled(chosen.map(target => setTargetGroup(target, project.id)));
    const failed = chosen.filter((_, index) => results[index].status === 'rejected');
    await onAdded();
    setSaving(false);
    if (failed.length === 0) { onClose(); return; }
    // 실패한 대상만 선택에 남겨 다시 시도할 수 있게 한다.
    setSelected(new Set(failed.map(targetKey)));
    const reason = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')?.reason;
    toast.error(`${failed.length}개를 추가하지 못했습니다: ${getErrorMessage(reason)}`);
  };

  return (
    // Backdrop click is supplemental; Escape and the labelled cancel button are keyboard equivalents.
    // react-doctor-disable-next-line no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-labelledby="add-targets-title"
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === event.currentTarget) close(); }}
      className={`m-auto max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden rounded-xl border border-ui-border bg-bg-surface shadow-lg open:flex ${SCRIM_MODAL_DIALOG}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-ui-border px-6 py-4">
        <h2 id="add-targets-title" className="type-card-title text-text-base">대상 추가</h2>
        <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={close} disabled={saving} />
      </div>

      {candidates.length === 0 ? (
        <>
          <div className="px-6 py-8">
            <p className="type-label text-text-base">추가할 수 있는 대상이 없습니다</p>
            <p className="mt-1 type-body text-text-muted">업타임, 로그, 인프라 같은 메뉴에서 대상을 먼저 등록하면 여기에 나타납니다.</p>
          </div>
          <div className="flex justify-end border-t border-ui-border px-6 py-4"><Button variant="quiet" onClick={close}>닫기</Button></div>
        </>
      ) : (
        <>
          <div className="px-6 pt-4">
            <SearchInput value={query} onChange={event => setQuery(event.target.value)} placeholder="이름으로 찾기" aria-label="추가할 대상 검색" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {visible.length === 0 && <p className="py-6 text-center type-body text-text-muted">검색 결과가 없습니다</p>}
            {TARGET_KINDS.map(({ kind, label }) => {
              const rows = visible.filter(target => target.kind === kind);
              if (rows.length === 0) return null;
              return (
                <fieldset key={kind} className="mb-4 last:mb-0">
                  <legend className="mb-1 type-caption text-text-muted">{label}</legend>
                  {rows.map(target => {
                    const key = targetKey(target);
                    const current = groupName(target.item.projectId);
                    return (
                      <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-ui-hover-soft">
                        <input type="checkbox" checked={selected.has(key)} disabled={saving} onChange={event => toggle(key, event.target.checked)} className="h-4 w-4 shrink-0 cursor-pointer accent-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate type-label text-text-base">{target.item.name}</span>
                          <span className="block truncate type-caption text-text-muted">{current ? `현재 그룹: ${current}` : '미분류'}</span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-ui-border px-6 py-4">
            <p className="w-full type-caption text-text-muted sm:mr-auto sm:w-auto" aria-live="polite">
              {chosen.length === 0 ? '추가할 대상을 고르세요' : moving > 0 ? `${chosen.length}개 선택, ${moving}개는 다른 그룹에서 옮겨집니다` : `${chosen.length}개 선택`}
            </p>
            <Button variant="secondary" onClick={close} disabled={saving}>취소</Button>
            <Button onClick={() => void submit()} disabled={chosen.length === 0} loading={saving}><MaterialIcon name="add" />추가</Button>
          </div>
        </>
      )}
    </dialog>
  );
}

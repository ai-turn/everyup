import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, MaterialIcon, OptionText, SearchInput } from '../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../hooks/useOverlay';
import type { Project } from '../../services/api';
import { TARGET_KINDS, groupChangeFailure, setTargetGroup, targetKey, type AssignableTarget } from './projectMembers';

// 그룹 상세의 "대상 추가". 이미 이 그룹에 있는 대상은 빼고, 다른 그룹에 있는 대상은 현재 그룹을 보여 준 채
// 고를 수 있게 한다(배정은 덮어쓰기라 그대로 옮겨진다). 미분류를 먼저 보여 준다.
export function AddTargetsDialog({ project, projects, targets, loadFailed = false, onRetry, onClose, onAdded }: {
  project: Project;
  projects: Project[];
  targets: AssignableTarget[];
  /** 서버나 Docker 환경 목록을 불러오지 못했다. 고를 대상이 없을 때 없다고 단정하지 않는다. */
  loadFailed?: boolean;
  onRetry?: () => Promise<void>;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // 넣지 못한 대상과 까닭. 성공한 대상은 반영하고 대화 상자를 닫지 않는다.
  const [failures, setFailures] = useState<{ name: string; reason: string }[]>([]);
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
    setFailures([]);
    const results = await Promise.allSettled(chosen.map(target => setTargetGroup(target, project.id)));
    const failed = chosen.flatMap((target, index) => {
      const result = results[index];
      return result.status === 'rejected' ? [{ target, reason: groupChangeFailure(result.reason, project.id) }] : [];
    });
    await onAdded();
    setSaving(false);
    if (failed.length === 0) { onClose(); return; }
    // 실패한 대상만 선택에 남겨 다시 시도할 수 있게 한다.
    setSelected(new Set(failed.map(({ target }) => targetKey(target))));
    setFailures(failed.map(({ target, reason }) => ({ name: target.item.name, reason })));
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
          {loadFailed ? (
            <div role="alert" className="px-6 py-8">
              <p className="type-label text-text-base">대상 목록을 불러오지 못했습니다</p>
              <p className="mt-1 type-body text-text-muted">서버나 Docker 환경 목록을 다시 불러온 뒤에 고를 수 있습니다.</p>
            </div>
          ) : (
            <div className="px-6 py-8">
              <p className="type-label text-text-base">추가할 수 있는 대상이 없습니다</p>
              <p className="mt-1 type-body text-text-muted">서버나 Docker 환경을 먼저 등록하면 여기에 나타납니다.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-ui-border px-6 py-4">
            <Button variant="quiet" onClick={close}>닫기</Button>
            {loadFailed && onRetry && (
              <Button variant="secondary" loading={retrying} onClick={() => { setRetrying(true); void onRetry().finally(() => setRetrying(false)); }}>다시 시도</Button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="px-6 pt-4">
            <SearchInput value={query} onChange={event => setQuery(event.target.value)} onClear={() => setQuery('')} placeholder="이름으로 찾기" aria-label="추가할 대상 검색" />
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
                        <OptionText truncate title={target.item.name} description={current ? `현재 그룹: ${current}` : '미분류'} />
                      </label>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>
          {failures.length > 0 && (
            <div role="alert" className="px-6 pb-4">
              <p className="flex items-start gap-1.5 type-label text-text-base"><MaterialIcon size={20} name="error_outline" className="shrink-0 text-status-error" />{failures.length}개를 추가하지 못했습니다</p>
              <ul className="mt-1 space-y-intra break-words type-body text-text-muted">
                {failures.map(({ name, reason }, index) => <li key={`${index}-${name}`}><span className="text-text-base">{name}</span>: {reason}</li>)}
              </ul>
            </div>
          )}
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

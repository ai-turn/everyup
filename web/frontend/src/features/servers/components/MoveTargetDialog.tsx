import { useEffect, useRef, useState } from 'react';
import { Button, ButtonLink, IconButton, MaterialIcon, OptionText } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { useModalDialog } from '../../../hooks/useModalDialog';
import { api, type Server } from '../../../services/api';
import { ApiError, getErrorMessage } from '../../../utils/errors';
import { signalList } from '../../telemetry/signals';
import { NEW_SERVER_PATH } from '../serverPaths';

const KIND_NOUN = { monitor: '업타임 모니터', app: '앱', infrastructure: '인프라 리소스' } as const;

const errorMessage = (error: unknown) => error instanceof ApiError && error.code === 'SERVER_HAS_INFRASTRUCTURE'
  ? '그 서버에는 이미 인프라 리소스가 있습니다.'
  : getErrorMessage(error);

interface Choices {
  servers: Server[];
  /** 인프라 리소스가 이미 있는 서버. 인프라 리소스를 옮길 때만 채운다. */
  taken: ReadonlySet<string>;
}

/** 대상 하나를 다른 서버로 옮긴다. 인프라 리소스는 서버마다 하나라서 이미 있는 서버를 비활성으로 둔다. */
export function MoveTargetDialog({ kind, targetName, signals = [], currentServerId, onClose, onMove }: {
  kind: 'monitor' | 'app' | 'infrastructure';
  targetName: string;
  /** 앱의 신호. 둘 이상이면 모든 데이터가 함께 옮겨진다고 알린다. */
  signals?: string[];
  currentServerId: string;
  onClose: () => void;
  /** 선택한 서버로 옮긴다. 실패하면 던진다 */
  onMove: (serverId: string) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useModalDialog(true, dialogRef);
  const [choices, setChoices] = useState<Choices | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getServers({ includeDocker: true }),
      kind === 'infrastructure' ? api.getInfrastructureResources() : Promise.resolve([]),
    ]).then(([servers, resources]) => {
      if (!alive) return;
      setChoices({
        servers: (servers ?? []).filter((server) => server.id !== currentServerId).sort((a, b) => a.name.localeCompare(b.name)),
        taken: new Set((resources ?? []).flatMap((resource) => resource.serverId ? [resource.serverId] : [])),
      });
      setLoadError(null);
    }, (cause: unknown) => {
      if (alive) setLoadError(getErrorMessage(cause));
    });
    return () => { alive = false; };
  }, [kind, currentServerId, loadKey]);

  const retry = () => { setLoadError(null); setChoices(null); setLoadKey((key) => key + 1); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setMoving(true);
    setError(null);
    try {
      await onMove(selected);
    } catch (cause) {
      // 대화 상자를 열어 둔 채 알린다. 성공하면 호출한 쪽이 닫는다.
      setError(errorMessage(cause));
      setMoving(false);
    }
  };

  const body = loadError ? (
    <div className="space-y-label">
      <p role="alert" className="flex items-start gap-2 type-body text-text">
        <MaterialIcon name="sync_problem" className="icon-lead shrink-0 text-attn-text" />서버 목록을 불러오지 못했습니다. {loadError}
      </p>
      <Button type="button" variant="secondary" size="sm" onClick={retry}>다시 시도</Button>
    </div>
  ) : !choices ? (
    <p aria-busy="true" className="type-body text-text-muted">서버 목록을 불러오는 중</p>
  ) : choices.servers.length === 0 ? (
    <div className="space-y-label">
      <p className="type-body text-text-muted">옮길 수 있는 다른 서버가 없습니다.</p>
      <ButtonLink variant="secondary" to={NEW_SERVER_PATH}><MaterialIcon name="add" />서버 추가</ButtonLink>
    </div>
  ) : (
    <fieldset disabled={moving}>
      <legend className="mb-label type-label text-text-muted">옮길 서버</legend>
      <ul className="-mx-2 max-h-72 overflow-y-auto">
        {choices.servers.map((server) => {
          const disabled = choices.taken.has(server.id);
          return (
            <li key={server.id}>
              <label className={`flex min-h-11 items-start gap-3 rounded-lg px-2 py-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-surface-hover'}`}>
                <input type="radio" name="move-target-server" value={server.id} checked={selected === server.id} disabled={disabled}
                  onChange={() => setSelected(server.id)} aria-describedby={disabled ? `move-target-taken-${server.id}` : undefined}
                  className="icon-lead h-4 w-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed" />
                <OptionText title={server.name} description={disabled && '인프라 리소스가 이미 있습니다'} descriptionId={`move-target-taken-${server.id}`} />
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );

  return (
    // 배경 클릭은 보조 수단이다. Escape와 닫기·취소 버튼이 키보드에서 같은 일을 한다.
    // react-doctor-disable-next-line no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-labelledby="move-target-title"
      onCancel={(event) => { event.preventDefault(); if (!moving) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !moving) onClose(); }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 id="move-target-title" className="type-card-title text-text">다른 서버로 옮기기</h2>
            {/* 이름 뒤에 조사를 붙이지 않는다(받침에 따라 을/를이 갈린다). */}
            <p className="mt-intra break-words type-body text-text-muted">옮길 {KIND_NOUN[kind]}: <strong className="font-medium text-text">{targetName}</strong></p>
          </div>
          <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={moving} />
        </div>
        <div className="space-y-heading p-6">
          {kind === 'app' && signals.length > 1 && (
            <p className="type-body text-text-muted">이 앱의 {signalList(signals)} 데이터가 함께 옮겨집니다.</p>
          )}
          {body}
          {error && <p role="alert" className="type-body text-crit-text">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={moving}>취소</Button>
          <Button type="submit" loading={moving} disabled={!selected}>옮기기</Button>
        </div>
      </form>
    </dialog>
  );
}

import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import type { ObservedService, TelemetrySignal } from '../../../services/api';
import { SIGNAL_TARGET, connectAction, connectAttached, connectReady, connectView } from '../../connections/connectCopy';
import { DirectTelemetrySetupForm } from './DirectTelemetrySetupForm';
import { DirectTelemetrySetupResult, type TelemetryConnectionResult } from './DirectTelemetrySetupResult';

interface DirectTelemetrySetupDialogProps {
  signal: TelemetrySignal;
  description: string;
  onClose: () => void;
  onCreated: (service: ObservedService) => void;
  /** 앱을 만들었거나 신호를 더했다(결과 화면이 열렸다). 닫기만 해도 다시 불러올 것이 생겼다. */
  onIssued?: () => void;
  /** 새 앱을 이 서버에 만들고, 기존 앱 후보를 이 서버의 앱으로 좁힌다. */
  serverId: string;
  /** 같은 이름의 Docker 환경을 찾아 안내한다(`DockerHostNote`). */
  serverName: string;
  /** 앱 페이지의 `연결 전` 탭에서 열었다. 새 앱을 만들지 않고 이 앱에 데이터 유형을 더한다(고를 것이 없다). */
  attachToId?: string;
}

/** 직접 연결 대화 상자. 입력(`DirectTelemetrySetupForm`)을 마치면 같은 자리에서 결과(`DirectTelemetrySetupResult`)로 바뀐다. */
export function DirectTelemetrySetupDialog({
  signal,
  description,
  onClose,
  onCreated,
  onIssued,
  serverId,
  serverName,
  attachToId,
}: DirectTelemetrySetupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // 제목·결과·완료 버튼은 시작 버튼과 같은 말이다(DESIGN.md §9.17).
  const target = SIGNAL_TARGET[signal];
  const [result, setResult] = useState<TelemetryConnectionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);

  const done = () => {
    const service = result?.service;
    if (service) onCreated(service);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`direct-${signal}-dialog-title`}
      onCancel={(event) => { event.preventDefault(); if (!submitting) onClose(); }}
      // The new key is shown once — a stray click outside must not close it away.
      onClick={(event) => { if (event.target === event.currentTarget && !submitting && result?.kind !== 'issued') onClose(); }}
      className={`m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-6 py-4">
        <div>
          <h2 id={`direct-${signal}-dialog-title`} className="type-card-title text-text">{connectAction(target)}</h2>
          <p className="mt-intra type-body text-text-muted">{description}</p>
        </div>
        <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={submitting} />
      </div>

      {result ? (
        <DirectTelemetrySetupResult
          connection={result}
          title={result.kind === 'issued' ? connectReady(target) : connectAttached(target, result.service.name)}
          doneLabel={connectView(target)}
          onDone={done}
        />
      ) : (
        <DirectTelemetrySetupForm signal={signal} serverId={serverId} serverName={serverName} attachToId={attachToId}
          submitting={submitting} onSubmittingChange={setSubmitting} onCancel={onClose}
          onResult={(next) => { setResult(next); onIssued?.(); }} />
      )}
    </dialog>
  );
}

import { useEffect, useRef } from 'react';
import { Button, MaterialIcon } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import type { ObservedServiceSetup } from '../../../services/api';
import { DirectTelemetrySetupResult } from './DirectTelemetrySetupResult';

export function RotatedTelemetryKeyDialog({
  setup,
  onClose,
}: {
  setup: ObservedServiceSetup;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="rotated-telemetry-key-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      className={`m-auto w-full max-w-2xl overflow-hidden rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <div className="flex items-center justify-between border-b border-ui-border px-6 py-4">
        <h2 id="rotated-telemetry-key-title" className="type-card-title text-text-base">직접 수집 키 재발급</h2>
        <Button variant="quiet" size="sm" aria-label="닫기" onClick={onClose}><MaterialIcon name="close" /></Button>
      </div>
      <DirectTelemetrySetupResult setup={setup} title="새 키가 발급되었습니다" onDone={onClose} />
    </dialog>
  );
}

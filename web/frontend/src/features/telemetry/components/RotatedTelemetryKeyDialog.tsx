import { useEffect, useRef } from 'react';
import { IconButton } from '../../../components/common';
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
      className={`m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <div className="flex items-center justify-between border-b border-ui-border px-6 py-4">
        <h2 id="rotated-telemetry-key-title" className="type-card-title text-text-base">API Key 재발급</h2>
        <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} />
      </div>
      <DirectTelemetrySetupResult connection={{ kind: 'issued', service: setup }} title="새 키가 발급되었습니다" onDone={onClose} />
    </dialog>
  );
}

import { toast } from 'react-hot-toast';
import { Button, COPY_ACTION_SUBTLE, CopyButton, ICON_ACTION, MaterialIcon } from '../../../components/common';
import { useConnectionAddress } from '../../services/useConnectionAddress';
import { ConnectionAddressField } from '../../services/components/ConnectionAddressField';
import { TelemetryReceiptStatus } from '../../services/components/TelemetryReceiptStatus';
import { TelemetrySetupGuidance } from './TelemetrySetupGuidance';
import { copyTextToClipboard } from '../../../hooks/useClipboardCopy';
import type { ObservedServiceSetup } from '../../../services/api';

interface DirectTelemetrySetupResultProps {
  setup: ObservedServiceSetup;
  title: string;
  onDone: () => void;
  doneLabel?: string;
}

function copy(value: string) {
  return copyTextToClipboard(value).then(() => true).catch(() => {
    toast.error('복사하지 못했습니다. 내용을 직접 선택해 복사해 주세요.');
    return false;
  });
}

export function DirectTelemetrySetupResult({
  setup,
  title,
  onDone,
  doneLabel,
}: DirectTelemetrySetupResultProps) {
  const address = useConnectionAddress();
  const endpoint = address.endpoint;
  const configuration = [
    `OTEL_SERVICE_NAME=${setup.name}`,
    `OTEL_EXPORTER_OTLP_ENDPOINT=${endpoint}`,
    'OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf',
    `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer ${setup.apiKey}`,
  ].join('\n');

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-healthy/10 text-status-healthy">
          <MaterialIcon size={20} name="check" />
        </span>
        <div>
          <h3 className="type-card-title text-text-base">{title}</h3>
          <p className="mt-1 text-sm text-text-muted">API 키는 지금 한 번만 표시됩니다. 안전한 곳에 저장해 주세요.</p>
        </div>
      </div>

      <ConnectionAddressField address={address} />
      <div className="space-y-2">
        <p className="type-label text-text-secondary">직접 수집 API 키</p>
        <div className="flex items-center gap-2 rounded-xl border border-ui-border bg-ui-hover-soft p-3">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-text-base">{setup.apiKey}</code>
          <CopyButton
            onCopy={() => copy(setup.apiKey)}
            title="API 키 복사"
            className={ICON_ACTION}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="type-label text-text-secondary">OpenTelemetry 환경 변수</p>
          <CopyButton
            onCopy={() => copy(configuration)}
            disabled={!address.valid}
            title="환경 변수 복사"
            className={COPY_ACTION_SUBTLE}
          >
            복사
          </CopyButton>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-ui-border bg-ui-hover-soft p-4 font-mono text-xs text-text-secondary">{address.valid ? configuration : '접근 가능한 서버 주소를 입력하세요.'}</pre>
      </div>

      <TelemetrySetupGuidance signals={setup.signals} />
      <TelemetryReceiptStatus path={`/observed-services/${setup.id}/setup-status`} expected={setup.signals} />
      <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end border-t border-ui-border bg-bg-surface px-6 py-4">
        <Button onClick={onDone}>{doneLabel ?? '완료'}</Button>
      </div>
    </div>
  );
}

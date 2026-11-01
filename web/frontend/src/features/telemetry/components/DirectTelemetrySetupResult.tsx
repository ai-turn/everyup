import { toast } from 'react-hot-toast';
import { Button, COPY_ACTION_SUBTLE, CopyButton, ICON_ACTION } from '../../../components/common';
import { useConnectionAddress } from '../../services/useConnectionAddress';
import { ConnectionAddressField } from '../../services/components/ConnectionAddressField';
import { TelemetryReceiptStatus } from '../../services/components/TelemetryReceiptStatus';
import { TelemetrySetupGuidance } from './TelemetrySetupGuidance';
import { copyTextToClipboard } from '../../../hooks/useClipboardCopy';
import type { ObservedService, ObservedServiceSetup, TelemetrySignal } from '../../../services/api';

const SIGNALS: TelemetrySignal[] = ['traces', 'metrics', 'logs'];
export type TelemetryConnectionResult =
  | { kind: 'issued'; service: ObservedServiceSetup }
  | { kind: 'attached'; service: ObservedService; signal: TelemetrySignal };

function copy(value: string) {
  return copyTextToClipboard(value).then(() => true).catch(() => {
    toast.error('복사하지 못했습니다. 내용을 직접 선택해 복사해 주세요.');
    return false;
  });
}

export function DirectTelemetrySetupResult({ connection, title, onDone, doneLabel }: {
  connection: TelemetryConnectionResult; title: string; onDone: () => void; doneLabel?: string;
}) {
  const address = useConnectionAddress();
  const service = connection.service;
  const setup = connection.kind === 'issued' ? connection.service : null;
  const signals = connection.kind === 'attached' ? [connection.signal] : service.signals;
  const configuration = setup ? [
    `OTEL_SERVICE_NAME=${setup.name}`,
    `OTEL_EXPORTER_OTLP_ENDPOINT=${address.endpoint}`,
    'OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf',
    `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer ${setup.apiKey}`,
    ...SIGNALS.filter(signal => !setup.signals.includes(signal)).map(signal => `OTEL_${signal.toUpperCase()}_EXPORTER=none`),
  ].join('\n') : '';

  const appConfiguration = setup ? <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <p className="type-label text-text-secondary">OpenTelemetry 환경 변수</p>
      <CopyButton onCopy={() => copy(configuration)} disabled={!address.valid} title="환경 변수 복사" className={COPY_ACTION_SUBTLE}>복사</CopyButton>
    </div>
    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-ui-border bg-ui-hover-soft p-4 font-mono text-xs text-text-secondary">{address.valid ? configuration : '접근 가능한 서버 주소를 입력하세요.'}</pre>
  </div> : undefined;

  return <div className="space-y-5 p-6">
    <div className="space-y-2">
      <h3 className="type-card-title text-text-base">{title}</h3>
      <p className="type-body text-text-muted">등록된 연결에 앱 설정을 적용한 뒤, 아래에서 실제 데이터 수신을 확인해 주세요.</p>
      {setup ? <p className="type-body text-text-muted">API Key는 지금 한 번만 표시됩니다. 안전한 곳에 저장해 주세요.</p>
        : <p className="type-body text-text-muted">기존 API Key에 권한을 추가했습니다. 실행 중인 OpenTelemetry 설정은 같은 주소와 키를 계속 사용합니다.</p>}
    </div>
    {setup && <>
      <ConnectionAddressField address={address} />
      <div className="space-y-2">
        <p className="type-label text-text-secondary">API Key</p>
        <div className="flex items-center gap-2 rounded-xl border border-ui-border bg-ui-hover-soft p-3">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-text-base">{setup.apiKey}</code>
          <CopyButton onCopy={() => copy(setup.apiKey)} title="API Key 복사" className={ICON_ACTION} />
        </div>
      </div>
    </>}
    {connection.kind === 'attached' && <p className="type-body text-text-muted">{`앱 설정에 OTEL_${connection.signal.toUpperCase()}_EXPORTER=none이 있다면 지워 주세요. 그대로 두면 이 데이터는 전송되지 않습니다.`}</p>}
    <TelemetrySetupGuidance signals={signals} appConfiguration={appConfiguration} />
    <TelemetryReceiptStatus path={`/observed-services/${service.id}/setup-status`} expected={signals} />
    <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end border-t border-ui-border bg-bg-surface px-6 py-4">
      <Button onClick={onDone}>{doneLabel ?? '완료'}</Button>
    </div>
  </div>;
}

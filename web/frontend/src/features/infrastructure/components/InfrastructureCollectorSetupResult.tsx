import { toast } from 'react-hot-toast';
import { Button, COPY_ACTION_SUBTLE, CopyButton, ICON_ACTION, MaterialIcon } from '../../../components/common';
import { useConnectionAddress } from '../../services/useConnectionAddress';
import { ConnectionAddressField } from '../../services/components/ConnectionAddressField';
import { TelemetryReceiptStatus } from '../../services/components/TelemetryReceiptStatus';
import { copyTextToClipboard } from '../../../hooks/useClipboardCopy';
import type { InfrastructureResourceSetup } from '../../../services/api';

function copy(value: string) {
  return copyTextToClipboard(value).then(() => true).catch(() => {
    toast.error('복사하지 못했습니다. 내용을 직접 선택해 복사해 주세요.');
    return false;
  });
}

function collectorConfig(setup: InfrastructureResourceSetup, endpoint: string) {
  return [
    'receivers:',
    '  host_metrics:',
    '    collection_interval: 30s',
    '    scrapers:',
    '      cpu:',
    '        metrics:',
    '          system.cpu.utilization:',
    '            enabled: true',
    '      memory:',
    '      filesystem:',
    '      disk:',
    '      network:',
    'processors:',
    '  batch:',
    'exporters:',
    '  otlphttp/everyup:',
    `    endpoint: ${endpoint}`,
    '    headers:',
    `      Authorization: "Bearer ${setup.apiKey}"`,
    'service:',
    '  pipelines:',
    '    metrics:',
    '      receivers: [host_metrics]',
    '      processors: [batch]',
    '      exporters: [otlphttp/everyup]',
  ].join('\n');
}

export function InfrastructureCollectorSetupResult({
  setup,
  title,
  onDone,
}: {
  setup: InfrastructureResourceSetup;
  title: string;
  onDone: () => void;
}) {
  const address = useConnectionAddress();
  const config = address.valid ? collectorConfig(setup, address.endpoint) : '접근 가능한 서버 주소를 입력하세요.';
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-healthy/10 text-status-healthy"><MaterialIcon name="check" /></span>
        <div>
          <h3 className="type-card-title text-text-base">{title}</h3>
          <p className="mt-1 text-sm text-text-muted">Collector API 키는 지금 한 번만 표시됩니다. 안전한 곳에 저장해 주세요.</p>
        </div>
      </div>
      <ConnectionAddressField address={address} />
      <div className="space-y-2">
        <p className="type-label text-text-secondary">Collector API 키</p>
        <div className="flex items-center gap-2 rounded-xl border border-ui-border bg-ui-hover-soft p-3">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-text-base">{setup.apiKey}</code>
          <CopyButton onCopy={() => copy(setup.apiKey)} title="API 키 복사" className={ICON_ACTION} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="type-label text-text-secondary">otelcol-contrib.yaml</p>
          <CopyButton disabled={!address.valid} onCopy={() => copy(config)} title="Collector 설정 복사" className={COPY_ACTION_SUBTLE}>복사</CopyButton>
        </div>
        <pre className="max-h-80 overflow-auto whitespace-pre rounded-xl border border-ui-border bg-ui-hover-soft p-4 font-mono text-xs text-text-secondary">{config}</pre>
      </div>
      <div className="rounded-xl border border-ui-border bg-ui-hover-soft p-4 type-body text-text-muted">
        <p className="font-medium text-text-secondary">실행</p>
        <code className="mt-2 block break-all font-mono">otelcol-contrib --config otelcol-contrib.yaml</code>
      </div>
      <TelemetryReceiptStatus path={`/infrastructure-resources/${setup.id}/setup-status`} expected={['infrastructure']} />
      <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end border-t border-ui-border bg-bg-surface px-6 py-4"><Button onClick={onDone}>인프라 보기</Button></div>
    </div>
  );
}

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, COPY_ACTION_SUBTLE, CopyButton, ICON_ACTION, MaterialIcon, SegmentedControl } from '../../../components/common';
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

type RunMode = 'docker' | 'binary';
const RUN_MODES = [{ label: 'Docker', value: 'docker' }, { label: '바이너리', value: 'binary' }] as const;
const COLLECTOR_IMAGE = 'otel/opentelemetry-collector-contrib:0.164.0';

// `hostmetrics`는 2026-04에 `host_metrics`로 바뀐 receiver의 옛 이름이다. 새 버전도 옛 이름을
// 받지만 그 전 버전은 새 이름을 모른다 — 설치된 Collector 버전을 가리지 않도록 옛 이름을 쓴다.
// Docker에서는 호스트의 /를 /hostfs로 읽어야 컨테이너가 아니라 호스트를 잰다.
function collectorConfig(setup: InfrastructureResourceSetup, endpoint: string, mode: RunMode) {
  return [
    'receivers:',
    '  hostmetrics:',
    ...(mode === 'docker' ? ['    root_path: /hostfs'] : []),
    '    collection_interval: 30s',
    '    scrapers:',
    '      cpu:',
    '        metrics:',
    '          system.cpu.utilization:',
    '            enabled: true',
    '      memory:',
    '      filesystem:',
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
    '      receivers: [hostmetrics]',
    '      processors: [batch]',
    '      exporters: [otlphttp/everyup]',
  ].join('\n');
}

// --network host: /proc/net은 읽는 프로세스의 네트워크를 보여 주므로, 호스트 네트워크에 있어야 호스트 트래픽이 잡힌다.
const RUN_COMMAND: Record<RunMode, string> = {
  docker: [
    'docker run -d --name everyup-collector --restart unless-stopped \\',
    '  --network host \\',
    '  -v /:/hostfs:ro \\',
    '  -v "$PWD/otelcol-contrib.yaml:/etc/otelcol-contrib/config.yaml:ro" \\',
    `  ${COLLECTOR_IMAGE}`,
  ].join('\n'),
  binary: 'otelcol-contrib --config otelcol-contrib.yaml',
};

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
  const [mode, setMode] = useState<RunMode>('docker');
  const config = address.valid ? collectorConfig(setup, address.endpoint, mode) : '접근 가능한 서버 주소를 입력하세요.';
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-healthy/10 text-status-healthy"><MaterialIcon name="check" /></span>
        <div>
          <h3 className="type-card-title text-text-base">{title}</h3>
          <p className="mt-0.5 text-sm text-text-muted">Collector API Key는 지금 한 번만 표시됩니다. 안전한 곳에 저장해 주세요.</p>
        </div>
      </div>
      <ConnectionAddressField address={address} />
      <div className="space-y-2">
        <p className="type-label text-text-secondary">Collector API Key</p>
        <div className="flex items-center gap-2 rounded-xl border border-ui-border bg-ui-hover-soft p-3">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-text-base">{setup.apiKey}</code>
          <CopyButton onCopy={() => copy(setup.apiKey)} title="API Key 복사" className={ICON_ACTION} />
        </div>
      </div>
      <div className="space-y-2">
        <p className="type-label text-text-secondary">실행 방법</p>
        <SegmentedControl options={RUN_MODES} value={mode} onChange={setMode} ariaLabel="Collector 실행 방법" />
        <p className="type-caption text-text-muted">
          {mode === 'docker'
            ? 'Linux 호스트 기준입니다. 호스트의 /를 읽기 전용으로 마운트해 컨테이너가 아닌 호스트를 측정합니다.'
            : <>서버에 otelcol-contrib를 설치한 뒤 실행합니다. <a href="https://github.com/open-telemetry/opentelemetry-collector-releases/releases" target="_blank" rel="noreferrer" className="text-action underline">설치 파일</a></>}
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="type-label text-text-secondary">otelcol-contrib.yaml</p>
          <CopyButton disabled={!address.valid} onCopy={() => copy(config)} title="Collector 설정 복사" className={COPY_ACTION_SUBTLE}>복사</CopyButton>
        </div>
        <pre className="max-h-80 overflow-auto whitespace-pre rounded-xl border border-ui-border bg-ui-hover-soft p-4 font-mono text-xs text-text-secondary">{config}</pre>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="type-label text-text-secondary">실행 명령</p>
          <CopyButton onCopy={() => copy(RUN_COMMAND[mode])} title="실행 명령 복사" className={COPY_ACTION_SUBTLE}>복사</CopyButton>
        </div>
        <pre className="overflow-auto whitespace-pre rounded-xl border border-ui-border bg-ui-hover-soft p-4 font-mono text-xs text-text-secondary">{RUN_COMMAND[mode]}</pre>
      </div>
      <TelemetryReceiptStatus path={`/infrastructure-resources/${setup.id}/setup-status`} expected={['infrastructure']} />
      <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end border-t border-ui-border bg-bg-surface px-6 py-4"><Button onClick={onDone}>인프라 보기</Button></div>
    </div>
  );
}

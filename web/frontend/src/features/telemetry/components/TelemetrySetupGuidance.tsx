import { useState } from 'react';
import { SegmentedControl, Select } from '../../../components/common';

const guides = {
  java: { label: 'Java', text: 'Java agent 파일을 앱에서 읽을 수 있는 위치에 놓고 -javaagent 실행 옵션을 추가한 뒤 앱을 재시작하세요. 기존 JAVA_TOOL_OPTIONS는 유지하세요.', url: 'https://opentelemetry.io/docs/zero-code/java/agent/getting-started/' },
  node: { label: 'Node.js', text: 'OpenTelemetry SDK와 사용하는 프레임워크의 계측 패키지를 설치하고 앱 코드보다 먼저 초기화한 뒤 재시작하세요. 기존 NODE_OPTIONS는 유지하세요.', url: 'https://opentelemetry.io/docs/zero-code/js/' },
  go: { label: 'Go', text: 'SDK에서 선택한 신호의 OTLP/HTTP exporter와 provider를 초기화하고, 핸들러 또는 로그 라이브러리에 계측을 연결하세요. 재빌드·재배포와 종료 시 flush가 필요합니다.', url: 'https://opentelemetry.io/docs/languages/go/getting-started/' },
};

export function TelemetrySetupGuidance({ signals }: { signals: string[] }) {
  const [experience, setExperience] = useState<'existing' | 'new'>('existing');
  const [language, setLanguage] = useState<keyof typeof guides>('java');
  const guide = guides[language];
  return <section aria-label="OpenTelemetry 적용 안내" className="space-y-3 rounded-xl border border-ui-border p-4">
    <h4 className="type-label text-text-base">OpenTelemetry를 이미 사용하고 있나요?</h4>
    <SegmentedControl options={[{ value: 'existing', label: '이미 사용 중' }, { value: 'new', label: '처음 설정' }]} value={experience} onChange={setExperience} size="md" ariaLabel="OpenTelemetry 사용 경험" />
    {experience === 'existing' ? <>
      <p className="type-body text-text-muted">기존 전송 대상도 유지하려면 현재 Collector에 EveryUp용 OTLP/HTTP exporter를 추가하고, 선택한 신호의 pipeline에 함께 연결하세요. 앱의 공통 OTLP 주소를 바꾸면 기존 전송 대상이 대체될 수 있습니다.</p>
      <a className="block w-fit type-body text-primary hover:underline" href="https://opentelemetry.io/docs/collector/configuration/" target="_blank" rel="noreferrer">Collector exporter·pipeline 설정 예제</a>
    </> : <>
      <Select aria-label="앱 언어" value={language} onChange={event => setLanguage(event.target.value as keyof typeof guides)}>{Object.entries(guides).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</Select>
      <p className="type-body text-text-muted">{guide.text} 환경 변수만 추가하면 계측이 시작되는 것은 아닙니다.</p>
      <a className="block w-fit type-body text-primary hover:underline" href={guide.url} target="_blank" rel="noreferrer">{guide.label} 계측·SDK 설정 예제</a>
    </>}
    {signals.includes('logs') && <p className="type-body text-text-muted">로그는 사용하는 로깅 라이브러리의 OTel bridge 또는 appender도 연결해야 합니다. stdout 출력만으로 직접 OTLP 로그가 전송되지는 않습니다.</p>}
    <ol className="list-decimal space-y-1 pl-5 type-body text-text-secondary">
      <li>선택한 신호의 exporter에 연결 주소와 키를 설정하세요. 기존 연결에 기능을 추가했다면 기존 앱 설정의 주소와 키를 계속 사용합니다.</li>
      <li>앱 또는 Collector의 설정 적용 방식에 따라 재시작·재배포하세요.</li>
      <li>요청이나 로그를 발생시키고, 메트릭은 수집 주기가 지난 뒤 확인하세요.</li>
      <li>데이터 수신 확인에서 선택한 신호의 수신 기록을 확인하세요.</li>
    </ol>
  </section>;
}

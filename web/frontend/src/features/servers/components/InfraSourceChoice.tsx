import { OptionText } from '../../../components/common';
import type { MergeInfrastructure } from '../../../services/api';

/**
 * 호스트 지표 출처 고르기(서버당 하나, ADR 0012). Docker Collector와 OpenTelemetry Collector가 같은 호스트의 CPU·메모리·디스크를
 * 함께 모으게 되는 모든 흐름(합치기, 기존 서버에 Docker Collector 설치, 인프라 연결, Docker 기능 추가)이 같은 선택지를 쓴다.
 * 무엇이 바뀌는지는 흐름마다 달라서 설명은 부르는 쪽이 준다.
 */
export function InfraSourceChoice({ value, onChange, descriptions }: {
  value: MergeInfrastructure | null;
  onChange: (value: MergeInfrastructure) => void;
  descriptions: Record<MergeInfrastructure, string>;
}) {
  return (
    <fieldset className="space-y-label">
      <legend className="type-label text-text">호스트 지표 출처</legend>
      <p className="type-body text-text-muted">Docker Collector와 OpenTelemetry Collector가 같은 호스트의 CPU·메모리·디스크를 모읍니다. 하나만 남기세요.</p>
      {(['docker', 'otel'] as const).map((source) => (
        <label key={source} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-hover">
          <input type="radio" name="infrastructure-source" value={source} checked={value === source} onChange={() => onChange(source)}
            className="icon-lead h-4 w-4 shrink-0 cursor-pointer accent-accent" />
          <OptionText title={source === 'docker' ? 'Docker Collector' : 'OpenTelemetry Collector'} description={descriptions[source]} />
        </label>
      ))}
    </fieldset>
  );
}

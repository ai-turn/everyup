import type { ReactNode } from 'react';
import { Button, MaterialIcon, Select, StatusLight } from '../../../components/common';
import type { Project } from '../../../services/api';

// 직접 연결(Logs·Metrics·API·Collector) 상세의 연결 메타데이터. 제목 바로 아래
// 한 줄로 읽는다 — 수집 키·마지막 수집·Project는 대상의 속성이지 본문이 아니라서
// 본문 위에 카드 두 장을 차지하고 있을 이유가 없었다.
interface DirectConnectionMetaProps {
  isActive: boolean;
  apiKeyMasked?: string;
  lastSeenAt?: string | null;
  /** 신호 목록(직접 서비스) 또는 어댑터(Collector) */
  detail: { label: string; value: string };
  onRotateKey: () => void;
  projects: Project[];
  projectId: string;
  savedProjectId: string;
  onProjectChange: (projectId: string) => void;
  onSaveProject: () => void;
  savingProject: boolean;
}

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-text-dim">{label}</span>
      {children}
    </span>
  );
}

export function DirectConnectionMeta({
  isActive,
  apiKeyMasked,
  lastSeenAt,
  detail,
  onRotateKey,
  projects,
  projectId,
  savedProjectId,
  onProjectChange,
  onSaveProject,
  savingProject,
}: DirectConnectionMetaProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 type-caption">
      <StatusLight tone={isActive ? 'healthy' : 'error'} label={isActive ? '수집 가능' : '중지됨'} />
      <MetaItem label="수집 키">
        <span className="truncate font-mono text-text-secondary">{apiKeyMasked || '마스킹된 키 없음'}</span>
        <Button variant="ghost" onClick={onRotateKey}><MaterialIcon name="key" />키 재발급</Button>
      </MetaItem>
      <MetaItem label="마지막 수집">
        <span className="text-text-secondary">{lastSeenAt ? new Date(lastSeenAt).toLocaleString() : '아직 없음'}</span>
      </MetaItem>
      <MetaItem label={detail.label}>
        {/* mono 아님 — 신호 목록('logs, metrics')도 어댑터명('OpenTelemetry Collector')도
            복사해 쓰는 코드가 아니라 읽는 값이다. 코드인 수집 키만 mono로 둔다. */}
        <span className="text-text-secondary">{detail.value}</span>
      </MetaItem>
      <MetaItem label="Project">
        <Select wrapperClassName="w-40" value={projectId} onChange={event => onProjectChange(event.target.value)} aria-label="Project 배정">
          <option value="">미분류</option>
          {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </Select>
        {projectId !== savedProjectId && (
          <Button onClick={onSaveProject} disabled={savingProject}>{savingProject ? '저장 중...' : '배정 저장'}</Button>
        )}
      </MetaItem>
    </div>
  );
}

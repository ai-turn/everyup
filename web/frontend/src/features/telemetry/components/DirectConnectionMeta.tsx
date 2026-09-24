import { Button, DetailMeta, MaterialIcon, Select, StatusLight } from '../../../components/common';
import type { Project } from '../../../services/api';

// 직접 연결(Logs·Metrics·API·Collector) 상세의 연결 메타데이터. 수집 키·마지막 수집·Project는
// 대상의 속성이지 본문이 아니라서 카드가 아니라 제목 아래 DetailMeta로 둔다.
interface DirectConnectionMetaProps {
  isActive: boolean;
  apiKeyMasked?: string;
  lastSeenAt?: string | null;
  /** 신호 목록(직접 서비스) 또는 어댑터(Collector) */
  detail: { label: string; value: string };
  onRotateKey: () => void;
  /** 수집 중일 때만 — 상태 옆에 붙는 연결 중지 */
  onRevoke: () => void;
  projects: Project[];
  projectId: string;
  savedProjectId: string;
  onProjectChange: (projectId: string) => void;
  onSaveProject: () => void;
  savingProject: boolean;
}

export function DirectConnectionMeta({
  isActive,
  apiKeyMasked,
  lastSeenAt,
  detail,
  onRotateKey,
  onRevoke,
  projects,
  projectId,
  savedProjectId,
  onProjectChange,
  onSaveProject,
  savingProject,
}: DirectConnectionMetaProps) {
  return (
    <DetailMeta
      status={
        <>
          <StatusLight tone={isActive ? 'healthy' : 'error'} label={isActive ? '수집 가능' : '중지됨'} />
          <span aria-hidden="true">·</span>
          <span>마지막 수집 {lastSeenAt ? new Date(lastSeenAt).toLocaleString() : '아직 없음'}</span>
          {/* 상태와 그 상태를 바꾸는 액션을 붙여 둔다 — 수집 키 옆 키 재발급과 같은 원리 */}
          {isActive && <Button variant="ghost" onClick={onRevoke}><MaterialIcon name="block" />연결 중지</Button>}
        </>
      }
      fields={[
        {
          label: 'API Key',
          value: (
            <>
              <span className="truncate font-mono">{apiKeyMasked || '마스킹된 키 없음'}</span>
              <Button variant="ghost" className="ml-auto" onClick={onRotateKey}><MaterialIcon name="key" />키 재발급</Button>
            </>
          ),
        },
        {
          label: 'Project',
          value: (
            <>
              <Select wrapperClassName="w-48" value={projectId} onChange={event => onProjectChange(event.target.value)} aria-label="Project 배정">
                <option value="">미분류</option>
                {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </Select>
              {projectId !== savedProjectId && (
                <Button onClick={onSaveProject} loading={savingProject}>배정 저장</Button>
              )}
            </>
          ),
        },
        // mono 아님 — 신호 목록('logs, metrics')도 어댑터명('OpenTelemetry Collector')도
        // 복사해 쓰는 코드가 아니라 읽는 값이다. 코드인 수집 키만 mono로 둔다.
        { label: detail.label, value: detail.value },
      ]}
    />
  );
}

import { Button, CollectionStatusBadge, LoadErrorBanner, DetailMeta, MaterialIcon, Select, StatusLight, type CollectionStatus, type DetailMetaField, type StatusTone } from '../../../components/common';
import type { Project } from '../../../services/api';

// 직접 연결(Logs·Metrics·API·Collector) 상세의 연결 메타데이터. 수집 키·마지막 수집·그룹은
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
  projectsLoading?: boolean;
  projectsError?: string | null;
  onRetryProjects?: () => void;
  /** 기능별 설정 — 로그의 수집 레벨처럼 그 상세에만 있는 칸 */
  extraFields?: DetailMetaField[];
  /** 좁은 화면에서 속성 목록을 접는다 — 본문(로그 목록)이 첫 화면 밖으로 밀리는 상세용 */
  collapseOnMobile?: boolean;
  collapseLabel?: string;
  /** 목록과 같은 수집 상태. 주면 "연결 활성" 대신 이것을 보인다 — 키가 살아 있어도 수신 전·지연일 수 있다.
   *  메트릭은 목록·본문과 같은 판정(`metricCollection`)의 점 + 라벨을 그대로 넘긴다. */
  collection?: CollectionStatus | { tone: StatusTone; label: string };
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
  projectsLoading = false,
  projectsError,
  onRetryProjects,
  extraFields = [],
  collapseOnMobile = false,
  collapseLabel,
  collection,
}: DirectConnectionMetaProps) {
  return (
    <DetailMeta
      collapseOnMobile={collapseOnMobile}
      collapseLabel={collapseLabel}
      status={
        <>
          {isActive && collection ? typeof collection === 'string' ? <CollectionStatusBadge status={collection} /> : <StatusLight {...collection} /> : <StatusLight tone={isActive ? 'healthy' : 'error'} label={isActive ? '연결 활성' : '중지됨'} />}
          <span>마지막 수집 {lastSeenAt ? new Date(lastSeenAt).toLocaleString('ko-KR', { hour12: false }) : '아직 없음'}</span>
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
          label: '그룹',
          value: (
            projectsLoading ? <span>그룹 목록 확인 중…</span> : projectsError ? <LoadErrorBanner inline role="status" title="그룹 목록을 불러오지 못했습니다" onRetry={onRetryProjects} /> : <>
              <Select wrapperClassName="w-48" value={projectId} onChange={event => onProjectChange(event.target.value)} aria-label="그룹 배정">
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
        ...extraFields,
      ]}
    />
  );
}

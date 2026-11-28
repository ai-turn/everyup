import { ButtonLink, EmptyState } from '../../components/common';
import { SERVERS_PATH, serverPath } from '../servers/serverPaths';
import type { ServerRow } from '../servers/serverStatus';

/** 대상마다 조사가 달라(앱이/모니터가) 문구를 통째로 받는다. */
export interface TargetMissingCopy {
  /** 목록을 불러오지 못했다: 제목과 설명 */
  failed: string;
  failedDescription: string;
  /** 이 서버의 대상이 아니다: 제목과 까닭 */
  notHere: string;
  gone: string;
}

/**
 * 서버의 대상(앱, 업타임 모니터) 페이지에서 대상을 아직 모르거나 찾지 못했다. 목록을 불러오지 못했으면 없다고 단정하지 않는다.
 */
export function TargetMissing({ row, loading, error, unverified, onRetry, copy }: {
  row?: ServerRow; loading: boolean; error: string | null; unverified: boolean; onRetry: () => void; copy: TargetMissingCopy;
}) {
  if (loading) {
    return (
      <div role="status" className="space-y-group">
        <span className="sr-only">로딩 중…</span>
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-hover" />
        <div className="h-10 animate-pulse rounded-lg bg-surface-hover" />
        <div className="h-96 animate-pulse rounded-xl bg-surface-hover" />
      </div>
    );
  }
  if (unverified || (!row && error)) {
    return <EmptyState icon="sync_problem" title={copy.failed} description={error ?? copy.failedDescription} action={{ label: '다시 시도', onClick: onRetry }} headingLevel="h1" />;
  }
  if (!row) {
    return (
      <EmptyState icon="search_off" title="서버를 찾을 수 없습니다" description="삭제되었거나 주소가 잘못되었습니다." headingLevel="h1">
        <ButtonLink to={SERVERS_PATH}>서버 목록</ButtonLink>
      </EmptyState>
    );
  }
  return (
    <EmptyState icon="search_off" title={copy.notHere} description={copy.gone} headingLevel="h1">
      <ButtonLink to={serverPath(row.server.id)}>{`${row.server.name} 서버로`}</ButtonLink>
    </EmptyState>
  );
}

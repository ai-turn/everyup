import type { ReactNode } from 'react';
import { Button, EmptyState, MaterialIcon, Pagination } from '../../components/common';
import type { ApiRequest } from '../../services/api';
import { statusClass } from './useRequestQuery';

function requestTime(time: string) {
  return new Date(time).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function ApiRequestRow({ request: req, onSelect }: { request: ApiRequest; onSelect: (traceId: string) => void }) {
  const traceId = req.traceId;
  const time = requestTime(req.createdAt);
  const duration = req.durationMs > 0 ? `${req.durationMs.toLocaleString()}ms` : null;
  return <tr className="transition-colors hover:bg-ui-hover-soft">
    <td className="min-w-0 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 font-mono text-text-muted">{req.method.toUpperCase()}</span>
        {traceId ? <div className="min-w-0 flex-1"><Button type="button" variant="text" size="sm" onClick={() => onSelect(traceId)}
          aria-label={`${req.method.toUpperCase()} ${req.statusCode} ${req.path} 트레이스 상세 열기`}
          aria-haspopup="dialog"
          title={`${req.path}: 트레이스 상세를 오른쪽 패널에서 열기`}
          className="group -ml-3 min-w-0 max-w-full max-sm:h-11">
          <span className="truncate font-mono underline-offset-2 group-hover:underline group-focus-visible:underline">{req.path}</span>
          <MaterialIcon name="chevron_right" size={16} />
        </Button></div>
          : <span className="min-w-0 break-all font-mono text-text-secondary">{req.path}</span>}
        {req.isError && <span className="shrink-0 text-status-error">오류</span>}
      </div>
      {/* 실패 원인(span status message). 저장만 되고 어디에도 보이지 않았다. */}
      {req.error && <p className="mt-1 line-clamp-2 break-all font-mono text-text-secondary">{req.error}</p>}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 tabular-nums text-text-muted lg:hidden">
        <span className={`sm:hidden ${statusClass(req.statusCode)}`}>{req.statusCode}</span>
        <span className="sm:hidden">{duration ?? '소요 미측정'}</span>
        <span>{time}</span>
      </div>
    </td>
    <td className={`hidden px-4 py-3 text-right tabular-nums sm:table-cell ${statusClass(req.statusCode)}`}>{req.statusCode}</td>
    <td className="hidden px-4 py-3 text-right tabular-nums text-text-secondary sm:table-cell">{duration ?? '-'}</td>
    <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums text-text-muted lg:table-cell">{time}</td>
  </tr>;
}

export function ApiRequestResults({ requests, total, page, loading, error, filtered, waiting = false, onRetry, onClear, onPageChange, onSelect }: {
  requests: ApiRequest[]; total: number; page: number; loading: boolean; error: string | null; filtered: boolean;
  /** traces를 한 번도 받지 않은 서비스. 한산한 서비스의 "이 기간에 없음"과 구분한다. */
  waiting?: boolean;
  onRetry: () => void; onClear: () => void; onPageChange: (page: number) => void; onSelect: (traceId: string) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / 25));
  let content: ReactNode;
  if (loading) {
    content = <div aria-label="API 요청 조회 중" className="h-48 animate-pulse rounded-xl bg-ui-hover" />;
  } else if (error) {
    content = <div role="alert"><EmptyState icon="error_outline" title="API 요청을 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: onRetry }} /></div>;
  } else if (requests.length === 0) {
    content = <EmptyState icon="http"
          title={filtered ? '조건에 맞는 요청이 없습니다' : waiting ? '아직 수신한 API 트레이스가 없습니다' : '이 기간에 수집된 HTTP 요청이 없습니다'}
          description={filtered ? '적용한 필터를 해제하거나 기간을 바꿔 주세요.' : waiting ? '아래 수집 설정 안내에 따라 앱의 OpenTelemetry 전송을 설정해 주세요.' : '기간을 바꾸거나 트레이스 탭에서 다른 span이 수신됐는지 확인해 주세요.'}
          action={filtered ? { label: '필터 해제', onClick: onClear } : undefined}
        />;
  } else {
    content = <div className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
          <table aria-label="API 요청 목록" className="w-full table-fixed text-xs">
            <thead className="border-b border-ui-border bg-ui-table-header text-text-muted"><tr>
              <th scope="col" className="px-4 py-3 text-left font-medium">요청</th>
              <th scope="col" className="hidden w-20 px-4 py-3 text-right font-medium sm:table-cell">상태</th>
              <th scope="col" className="hidden w-24 px-4 py-3 text-right font-medium sm:table-cell">소요</th>
              <th scope="col" className="hidden w-44 px-4 py-3 text-right font-medium lg:table-cell">시작</th>
            </tr></thead>
            <tbody className="divide-y divide-ui-border-soft">{requests.map(req => <ApiRequestRow key={req.id} request={req} onSelect={onSelect} />)}</tbody>
          </table>
          {totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ui-border-soft px-4 py-3">
            <p className="type-caption tabular-nums text-text-muted">{total.toLocaleString()}건 중 {((page - 1) * 25 + 1).toLocaleString()}~{Math.min(page * 25, total).toLocaleString()}</p>
            <Pagination page={page} totalPages={totalPages} onChange={onPageChange} previousLabel="이전" nextLabel="다음" />
          </div>}
        </div>;
  }
  return <section aria-label="요청 결과" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="type-card-title text-text-base">요청 결과</h2>
      {!loading && !error && <p className="type-caption tabular-nums text-text-muted">{filtered ? '검색 결과' : '전체'} {total.toLocaleString()}건</p>}
    </div>
    {content}
  </section>;
}

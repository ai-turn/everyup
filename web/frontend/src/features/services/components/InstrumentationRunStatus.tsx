import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { InstrumentationRun } from '../instrumentationApi';
import { useSetupStatus } from '../useSetupStatus';

const statuses: Record<InstrumentationRun['status'], string> = { planned: '서버에서 명령 실행 대기', applying: '설정 적용 및 검증 중', verified: '설정 적용 검증 완료', failed: '적용 전 검사 실패', rolled_back: '이전 설정으로 복구됨', rollback_failed: '복구 실패 — 서버 확인 필요' };
const reasons: Record<string, string> = { preflight_failed: 'Compose 경로·프로젝트·실행 상태를 확인하세요.', restart_failed: '서비스 재시작에 실패했습니다.', verification_failed: '컨테이너 상태·상세 수집 옵션·볼륨·네트워크 검사에 실패했습니다.', manual_rollback: '수동 복구 명령이 실행됐습니다.' };

// A run this dialog did not start is history, not the current result — and an
// old one must never read as the outcome of what the user is about to run.
const RECENT_MS = 60 * 60 * 1000;

function isHistory(run: InstrumentationRun, current: boolean): boolean {
  return !current && Date.now() - new Date(run.updatedAt).getTime() > RECENT_MS;
}

export function InstrumentationRunStatus({ agentId, runId }: { agentId: string; runId?: string }) {
  const { data: run, error } = useSetupStatus<InstrumentationRun | null>(`/agents/${agentId}/instrumentation-runs/${runId ?? 'latest'}`);
  if (!run && !error) return null;
  if (run && isHistory(run, Boolean(runId))) return null;
  const failed = run?.status === 'failed' || run?.status === 'rollback_failed';
  return <section aria-label="상세 수집 적용 결과" className="space-y-2 rounded-xl border border-ui-border bg-ui-hover-soft p-4">
    <h4 className="type-label text-text-base">{runId ? '상세 수집 적용 결과' : '최근 상세 수집 적용 기록'}</h4>
    {error ? <p role="alert" className="type-body text-status-warn">{error}</p> : run && <>
      <p className="type-body text-text-secondary">{run.project} · {run.targets.map(target => target.name).join(', ')}</p>
      <p className={`type-body ${failed ? 'text-status-error' : 'text-text-secondary'}`} title={new Date(run.updatedAt).toLocaleString()}>
        {statuses[run.status]} · {formatDistanceToNow(new Date(run.updatedAt), { addSuffix: true, locale: ko })}
      </p>
      {run.reason && <p className={`type-body ${failed ? 'text-status-error' : 'text-status-warn'}`}>{reasons[run.reason] ?? run.reason}</p>}
      {run.status === 'applying' && <p className="type-body text-text-muted">결과가 갱신되지 않으면 서버의 CLI 출력을 확인하세요. 통신 중단만으로 성공 처리하지 않습니다.</p>}
      {run.status === 'verified' && <ul className="space-y-1 type-body text-text-secondary">{run.targets.map(target => <li key={target.key}>{target.name} · {run.signals.some(receipt => receipt.serviceName === target.name) ? '실행 시작 이후 새 트레이스 수신' : '새 트레이스 대기 — 서비스에 요청을 보내 주세요'}</li>)}</ul>}
      <p className="type-body text-text-muted">CLI 검증은 실행 상태·상세 수집 설정을 확인합니다. 새 트레이스에는 기존 eBPF 수집도 포함될 수 있습니다. 트래픽이 없어도 자동 복구하지 않습니다.</p>
    </>}
  </section>;
}

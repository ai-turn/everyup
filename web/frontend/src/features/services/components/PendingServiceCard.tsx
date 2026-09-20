import { Button } from '../../../components/common/Button';
import { MaterialIcon } from '../../../components/common/MaterialIcon';
import { ResourceCardHeader } from '../../../components/common/ResourceCardHeader';
import { StatusLight } from '../../../components/common/StatusLight';
import type { ConnectedAgent } from '../../../services/api';

interface Props {
  agent: ConnectedAgent;
  onDelete: (id: string) => void;
  onViewKey: () => void;
  onInstall: () => void;
}

// Pending agents share the project grid with connected agents. Keep this as a
// concise status summary; the installation modal owns the detailed guidance.
export function PendingServiceCard({ agent, onDelete, onViewKey, onInstall }: Props) {
  return (
    <div className="bg-bg-surface border border-ui-border rounded-xl p-4 flex flex-col gap-3">
      <ResourceCardHeader
        title={<h2 className="truncate type-card-title text-text-base">{agent.name}</h2>}
        status={
          <div className="flex shrink-0 items-center gap-1">
            <StatusLight tone="idle" label="설치 대기" />
            <details className="relative">
              <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-text-dim hover:bg-ui-hover hover:text-text-base [&::-webkit-details-marker]:hidden">
                <MaterialIcon size={20} name="more_vert" />
                <span className="sr-only">추가 작업</span>
              </summary>
              <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-ui-border bg-ui-raised p-1 shadow-lg">
                <button
                  type="button"
                  onClick={onViewKey}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text-secondary hover:bg-ui-hover"
                >
                  <MaterialIcon size={16} name="key" />
                  API 키
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(agent.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-status-error hover:bg-ui-hover"
                >
                  <MaterialIcon size={16} name="delete_outline" />
                  비활성화
                </button>
              </div>
            </details>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-text-muted">Docker 수집기 연결 대기</p>
        <Button size="sm" onClick={onInstall}>
          설치 명령어
          <MaterialIcon size={16} name="arrow_forward" />
        </Button>
      </div>
    </div>
  );
}

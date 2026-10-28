import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, MaterialIcon } from '../../../components/common';
import { api, type LogLevel } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';

type Source = { observedServiceId: string } | { agentId: string; serviceKey: string };

const LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];

/**
 * 어떤 레벨을 저장할지 정하는 서비스 설정. 로그 목록의 보기 필터 옆에 있으면 같은 레벨 선택이
 * 두 번 보여 헷갈렸다 — 그룹 배정처럼 상세 헤더 메타의 한 칸으로 둔다. [] = 전체 저장.
 */
export function LogIngestLevels(source: Source) {
  const directId = 'observedServiceId' in source ? source.observedServiceId : undefined;
  const agentId = 'agentId' in source ? source.agentId : undefined;
  const serviceKey = 'serviceKey' in source ? source.serviceKey : undefined;
  // null = 아직 모름. 실패를 []로 두면 "전체"로 잘못 읽힌다.
  const [saved, setSaved] = useState<LogLevel[] | null>(null);
  // null = 보기 상태
  const [draft, setDraft] = useState<LogLevel[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const request = directId ? api.getObservedServiceLogFilter(directId) : api.getAgentServiceLogFilter(agentId!, serviceKey!);
    request.then(r => setSaved((r?.levels ?? []) as LogLevel[])).catch(() => {});
  }, [directId, agentId, serviceKey]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const r = directId
        ? await api.setObservedServiceLogFilter(directId, draft)
        : await api.setAgentServiceLogFilter(agentId!, serviceKey!, draft);
      setSaved((r?.levels ?? []) as LogLevel[]);
      setDraft(null);
      toast.success('수집 레벨을 저장했습니다.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (draft === null) {
    const shown = LEVELS.filter(l => saved?.includes(l)).join(', ');
    return (
      // The levels truncate before the button moves; the button wraps below only when
      // not even 4rem of them fits (200% text on a phone) instead of pushing past the row.
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
        <span className={`min-w-0 flex-[1_1_4rem] truncate ${saved === null ? 'text-text-dim' : saved.length > 0 ? 'font-mono' : ''}`} title={shown || undefined}>
          {saved === null ? '-' : saved.length === 0 ? '전체' : shown}
        </span>
        <Button collapseLabel variant="ghost" className="ml-auto" disabled={saved === null} onClick={() => setDraft(saved ?? [])}>
          <MaterialIcon name="tune" />변경
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      <div role="group" aria-label="수집할 로그 레벨" className="flex flex-wrap gap-1.5">
        {LEVELS.map(l => {
          const on = draft.includes(l);
          return (
            <Button key={l} size="sm" variant={on ? 'secondary' : 'quiet'} aria-pressed={on} className="font-mono"
              onClick={() => setDraft(on ? draft.filter(x => x !== l) : [...draft, l])}>
              {l}
            </Button>
          );
        })}
      </div>
      <p className="type-caption text-text-muted">선택한 레벨만 저장합니다. 모두 해제하면 전체를 저장하고, 앞으로 들어오는 로그에만 적용됩니다.</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void save()} loading={saving}>저장</Button>
        <Button size="sm" variant="quiet" onClick={() => setDraft(null)}>취소</Button>
      </div>
    </div>
  );
}

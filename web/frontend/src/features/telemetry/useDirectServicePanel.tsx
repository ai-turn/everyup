import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { Button, ConfirmDialog, MaterialIcon, type StatusTone } from '../../components/common';
import { api, type ObservedService, type ObservedServiceSetup, type TelemetrySignal } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { appState, capabilityStateLabel } from '../servers/serverStatus';
import { RotatedTelemetryKeyDialog } from './components/RotatedTelemetryKeyDialog';
import { serviceRemoval, signalLabel } from './signals';

type ConfirmAction = 'rotate' | 'revoke' | 'delete' | null;

const CAPABILITY = { logs: 'logs', traces: 'api', metrics: 'metrics' } as const;

/**
 * 로그·API·메트릭 앱 패널의 공통 로직: 앱 조회, 키 재발급, 연결 중지, 삭제 또는 신호 연결 해제, 확인 대화 상자.
 * 그룹 배정은 다루지 않는다. 서버 화면에서는 그룹을 서버가 정한다.
 */
export function useDirectServicePanel(serviceId: string, signal: TelemetrySignal, onRemoved: () => void, options: {
  /** 서버 상세가 이미 불러온 앱. 주면 따로 불러오지 않는다(갱신의 주체는 서버 상세 하나다). */
  service?: ObservedService;
  /** 연결 중지나 키 재발급으로 앱이 바뀐 뒤. 서버 상세가 서버 데이터를 다시 불러온다. */
  onChanged?: () => void | Promise<void>;
  /** 옛 상세(/logs/:id 등)의 요청: serverId를 보내지 않는다. Task 13에서 없앤다. */
  standalone?: boolean;
} = {}): {
  service: ObservedService | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** DirectConnectionMeta에 그대로 넘길 연결 관련 props (그룹 관련 props는 포함하지 않는다) */
  connection: { isActive: boolean; apiKeyMasked?: string; lastSeenAt?: string | null; onRotateKey: () => void; onRevoke: () => void; collection: { tone: StatusTone; label: string } };
  /** 삭제 또는 "신호 연결 해제" 버튼 */
  removalButton: ReactNode;
  /** 확인 대화 상자와 재발급된 키 대화 상자. 패널이 렌더링 트리에 넣는다 */
  dialogs: ReactNode;
  /** 다른 서버로 옮긴다 */
  move: (serverId: string) => Promise<void>;
} {
  const { service: given, onChanged, standalone = false } = options;
  const [fetched, setFetched] = useState<ObservedService | null>(null);
  const [loading, setLoading] = useState(!given);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [processing, setProcessing] = useState(false);
  const [rotatedSetup, setRotatedSetup] = useState<ObservedServiceSetup | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // 주어진 앱이 최신이다. 직접 불러온 앱은 조작의 응답으로 바뀐다.
  const service = given ?? fetched;

  const hasGiven = Boolean(given);
  useEffect(() => {
    if (hasGiven) return;
    let current = true;
    api.getObservedService(serviceId)
      .then((row) => {
        if (!current) return;
        if (row.signals.includes(signal)) setFetched(row);
        else setError(`이 서비스에는 ${signalLabel(signal)} 기능이 연결되어 있지 않습니다.`);
      })
      .catch((requestError: unknown) => { if (current) setError(getErrorMessage(requestError)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [serviceId, signal, hasGiven, loadKey]);

  const runConfirmedAction = async () => {
    if (!service || !confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction === 'delete') {
        const removal = serviceRemoval(service, signal);
        if (removal.kind === 'detach') {
          // serverId를 빼면 백엔드가 옛 화면의 요청으로 보고 서버의 그룹을 바꾼다.
          await api.updateObservedService(service.id, standalone
            ? { name: service.name, projectId: service.projectId ?? undefined, signals: removal.signals }
            : { name: service.name, serverId: service.serverId, signals: removal.signals });
        } else {
          await api.deleteObservedService(service.id);
        }
        toast.success(removal.done);
        // 화면이 바뀔 때까지 조작을 막아 둔다(processing을 풀지 않는다).
        onRemoved();
        return;
      }
      if (confirmAction === 'rotate') {
        const setup = await api.rotateObservedServiceKey(service.id);
        if (!alive.current) return;
        setFetched(setup);
        setRotatedSetup(setup);
      } else {
        const updated = await api.revokeObservedServiceKey(service.id);
        if (!alive.current) return;
        setFetched(updated);
        toast.success('직접 수집 연결을 중지했습니다.');
      }
      await onChanged?.();
      if (!alive.current) return;
      setConfirmAction(null);
      setProcessing(false);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
      // 삭제에 성공하면 화면이 바뀔 때까지 풀지 않으므로 finally가 아니라 실패에서만 푼다.
      // react-doctor-disable-next-line no-loading-flag-reset-outside-finally
      if (alive.current) setProcessing(false);
    }
  };

  const move = async (serverId: string) => {
    if (!service) throw new Error('앱 정보를 불러오지 못했습니다.');
    await api.updateObservedService(service.id, { name: service.name, serverId, signals: service.signals });
  };

  const removal = service ? serviceRemoval(service, signal) : null;
  const confirmCopy = {
    rotate: { title: 'API Key를 재발급할까요?', message: '현재 키는 즉시 폐기됩니다. 모든 OpenTelemetry Exporter에 새 키를 반영해야 합니다.', label: '재발급', variant: 'primary' as const },
    revoke: { title: '직접 수집 연결을 중지할까요?', message: `이 키를 사용한 새 ${signalLabel(signal)} 수집이 즉시 차단됩니다. 저장된 데이터는 유지됩니다.`, label: '연결 중지', variant: 'danger' as const },
    delete: { title: removal?.title ?? '', message: removal?.message ?? '', label: removal?.button, variant: 'danger' as const },
  };
  const selectedConfirm = confirmAction ? confirmCopy[confirmAction] : null;
  const state = service ? appState(service).state : 'idle';

  return {
    service,
    loading: !service && loading,
    error,
    // 다시 시도의 로딩 표시는 여기서 켠다. 처음 불러올 때는 초기값이 켜 둔다.
    reload: () => { setLoading(true); setError(null); setLoadKey((key) => key + 1); },
    connection: {
      isActive: service?.isActive ?? false,
      apiKeyMasked: service?.apiKeyMasked,
      lastSeenAt: service?.lastSeenAt,
      onRotateKey: () => setConfirmAction('rotate'),
      onRevoke: () => setConfirmAction('revoke'),
      collection: { tone: state, label: capabilityStateLabel(CAPABILITY[signal], state) },
    },
    removalButton: removal && (
      <Button collapseLabel variant="destructive" disabled={processing} onClick={() => setConfirmAction('delete')}><MaterialIcon name="delete_outline" />{removal.button}</Button>
    ),
    dialogs: (
      <>
        <ConfirmDialog
          isOpen={Boolean(selectedConfirm)}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => void runConfirmedAction()}
          title={selectedConfirm?.title ?? ''}
          message={selectedConfirm?.message ?? ''}
          confirmLabel={selectedConfirm?.label}
          variant={selectedConfirm?.variant}
          isProcessing={processing}
        />
        {rotatedSetup && <RotatedTelemetryKeyDialog setup={rotatedSetup} onClose={() => setRotatedSetup(null)} />}
      </>
    ),
    move,
  };
}

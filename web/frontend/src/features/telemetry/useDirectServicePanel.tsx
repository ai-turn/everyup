import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { ConfirmDialog, type OverflowMenuItem } from '../../components/common';
import { api, type ObservedService, type ObservedServiceSetup, type TelemetrySignal } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { readLatest, TargetGoneError } from '../../utils/readLatest';
import { RotatedTelemetryKeyDialog } from './components/RotatedTelemetryKeyDialog';
import { serviceRemoval, signalLabel } from './signals';

type ConfirmAction = 'rotate' | 'revoke' | 'delete' | null;

/**
 * 서버 탭의 로그·API·메트릭 앱 패널의 공통 로직: 키 재발급, 연결 중지, 삭제 또는 신호 연결 해제, 확인 대화 상자.
 * 앱은 서버 상세가 불러온 것을 받는다(갱신의 주체는 서버 상세 하나다). 그룹은 서버가 정한다.
 */
export function useDirectServicePanel(service: ObservedService, signal: TelemetrySignal, onRemoved: (remaining: ObservedService | null) => void,
  /** 연결 중지나 키 재발급으로 앱이 바뀐 뒤. 서버 상세가 서버 데이터를 다시 불러온다. */
  onChanged?: () => void | Promise<void>): {
  /** 키 재발급, 연결 중지, 삭제 요청이 진행 중이다. 패널은 이 동안 새로고침 신호로 다시 불러오지 않는다. */
  processing: boolean;
  /** DirectConnectionMeta에 그대로 넘길 연결 관련 props */
  connection: { isActive: boolean; apiKeyMasked?: string; lastSeenAt?: string | null; onRotateKey: () => void; onRevoke: () => void };
  /** 삭제 또는 "신호 연결 해제". 머리말의 더보기 메뉴 끝에 둔다(DESIGN.md §4.1 상세 헤더). */
  removalItem: OverflowMenuItem;
  /** 확인 대화 상자와 재발급된 키 대화 상자. 패널이 렌더링 트리에 넣는다 */
  dialogs: ReactNode;
} {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [processing, setProcessing] = useState(false);
  const [rotatedSetup, setRotatedSetup] = useState<ObservedServiceSetup | null>(null);
  // 삭제·연결 해제의 판정에 쓴 앱. 확인 창을 열 때 다시 읽는다(화면의 앱은 이미 바뀐 신호 목록을 모를 수 있다).
  const [removalTarget, setRemovalTarget] = useState<ObservedService | null>(null);
  const [checkingRemoval, setCheckingRemoval] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const removalVerb = (target: ObservedService) => serviceRemoval(target, signal).kind === 'detach' ? '연결 해제' : '삭제';

  const openRemoval = async () => {
    setCheckingRemoval(true);
    try {
      const latest = await readLatest(() => api.getObservedService(service.id), removalVerb(service));
      if (!alive.current) return;
      if (!latest.signals.includes(signal)) {
        toast.error(`이미 ${signalLabel(signal)} 연결이 해제되었습니다`);
        void onChanged?.();
        return;
      }
      setRemovalTarget(latest);
      setConfirmAction('delete');
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
      // 이미 지워진 앱이면 서버 데이터를 다시 불러와 화면에서 뺀다.
      if (requestError instanceof TargetGoneError) void onChanged?.();
    } finally {
      if (alive.current) setCheckingRemoval(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction === 'delete') {
        const judged = removalTarget ?? service;
        // 실행 직전에 다시 읽는다. 확인 창을 연 뒤에 신호 목록이 바뀌었으면 실행하지 않고 바뀐 판정으로 다시 확인받는다.
        const latest = await readLatest(() => api.getObservedService(service.id), removalVerb(judged));
        if (latest.signals.length !== judged.signals.length || latest.signals.some((item) => !judged.signals.includes(item))) {
          if (!alive.current) return;
          setRemovalTarget(latest);
          setProcessing(false);
          toast.error('그 사이에 연결된 데이터가 바뀌었습니다. 내용을 다시 확인하세요.');
          // 이 신호가 이미 해제되었으면 확인할 것이 없다. openRemoval의 같은 경우처럼 다시 불러와 화면에서 뺀다.
          if (!latest.signals.includes(signal)) { setConfirmAction(null); void onChanged?.(); }
          return;
        }
        const removal = serviceRemoval(latest, signal);
        let remaining: ObservedService | null = null;
        if (removal.kind === 'detach') {
          // serverId를 빼면 백엔드가 옛 화면의 요청으로 보고 서버의 그룹을 바꾼다.
          remaining = await api.updateObservedService(latest.id, { name: latest.name, serverId: latest.serverId, signals: removal.signals });
        } else {
          await api.deleteObservedService(service.id);
        }
        toast.success(removal.done);
        // 화면이 바뀔 때까지 조작을 막아 둔다(processing을 풀지 않는다).
        onRemoved(remaining);
        return;
      }
      if (confirmAction === 'rotate') {
        const setup = await api.rotateObservedServiceKey(service.id);
        if (!alive.current) return;
        setRotatedSetup(setup);
      } else {
        await api.revokeObservedServiceKey(service.id);
        if (!alive.current) return;
        toast.success('직접 수집 연결을 중지했습니다');
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
      if (requestError instanceof TargetGoneError) {
        if (alive.current) setConfirmAction(null);
        void onChanged?.();
      }
    }
  };

  const removal = serviceRemoval(service, signal);
  // 확인 창의 문구는 다시 읽은 앱으로 정한다.
  const confirmRemoval = removalTarget ? serviceRemoval(removalTarget, signal) : removal;
  const confirmCopy = {
    rotate: { title: 'API Key를 재발급할까요?', message: '현재 키는 즉시 폐기됩니다. 이 앱의 모든 OpenTelemetry Exporter에 새 키를 반영해야 합니다.', label: '재발급', variant: 'primary' as const },
    // 키는 앱 단위다. 연결을 중지하면 이 탭의 신호만이 아니라 앱의 모든 신호가 막힌다.
    revoke: { title: '직접 수집 연결을 중지할까요?', message: '이 키를 사용하는 모든 데이터의 수집을 즉시 차단합니다. 저장된 데이터는 유지됩니다.', label: '연결 중지', variant: 'danger' as const },
    delete: { title: confirmRemoval.title, message: confirmRemoval.message, label: confirmRemoval.button, variant: 'danger' as const },
  };
  const selectedConfirm = confirmAction ? confirmCopy[confirmAction] : null;

  return {
    processing,
    connection: {
      isActive: service.isActive,
      apiKeyMasked: service.apiKeyMasked,
      lastSeenAt: service.lastSeenAt,
      onRotateKey: () => setConfirmAction('rotate'),
      onRevoke: () => setConfirmAction('revoke'),
    },
    removalItem: { label: removal.button, icon: 'delete_outline', danger: true, disabled: processing || checkingRemoval, onSelect: () => void openRemoval() },
    dialogs: (
      <>
        <ConfirmDialog
          isOpen={Boolean(selectedConfirm)}
          onClose={() => { setConfirmAction(null); setRemovalTarget(null); }}
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
  };
}

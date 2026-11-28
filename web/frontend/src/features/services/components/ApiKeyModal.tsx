import { useEffect, useState } from 'react';
import { Button, ConfirmDialog, COPY_ACTION_SUBTLE, CopyButton, IconButton, MaterialIcon } from '../../../components/common';
import { api } from '../../../services/api';
import { copyTextToClipboard } from '../../../hooks/useClipboardCopy';
import { getErrorMessage } from '../../../utils/errors';
import { toast } from 'react-hot-toast';
import { useOverlay, SCRIM_MODAL } from '../../../hooks/useOverlay';

interface Props {
  agentId: string;
  agentName: string;
  onClose: () => void;
  onRotated?: () => void;
}

// Shows a project's full API key (decrypted server-side) with copy + rotate.
export function ApiKeyModal({ agentId, agentName, onClose, onRotated }: Props) {
  useOverlay(true, onClose);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [available, setAvailable] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    let active = true;
    api.getAgentKey(agentId)
      .then((res) => {
        if (!active) return;
        setApiKey(res.apiKey);
        setAvailable(res.available);
      })
      .catch((err) => { if (active) toast.error(getErrorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [agentId]);

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(apiKey);
      return true;
    } catch {
      toast.error('복사에 실패했습니다. 키를 직접 선택해 복사하세요.');
      return false;
    }
  };

  const handleRotate = async () => {
    setConfirmRotate(false);
    setRotating(true);
    try {
      const res = await api.rotateAgentKey(agentId);
      setApiKey(res.apiKey);
      setAvailable(true);
      toast.success('새 API Key가 발급됐습니다');
      onRotated?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRotating(false);
    }
  };

  return (
    <div role="presentation" className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${SCRIM_MODAL}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-surface rounded-xl shadow-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="type-card-title text-text truncate">
            {agentName} · API Key
          </h2>
          <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} />
        </div>

        <div className="p-6 space-y-item">
          {loading ? (
            <div className="h-24 rounded-xl bg-surface-hover animate-pulse" />
          ) : available ? (
            <>
              <div className="space-y-label">
                <p className="type-caption text-text-muted">API Key</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 cell rounded-md bg-surface-hover text-xs font-mono text-text break-all">
                    {apiKey}
                  </code>
                  <CopyButton onCopy={handleCopy} title="API Key 복사" className={COPY_ACTION_SUBTLE} />
                </div>
              </div>
              <div className="space-y-label">
                <p className="type-caption text-text-muted">Docker Collector 설정</p>
                <pre className="px-3 cell rounded-md bg-surface-hover text-xs font-mono text-text overflow-x-auto">{`EVERYUP_AGENT_API_KEY=${apiKey}`}</pre>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 p-4 rounded-md bg-surface-hover">
              <MaterialIcon size={20} name="info" className="text-attn shrink-0 icon-lead" />
              <p className="type-body text-text-muted">
                이 Docker Collector는 키 저장 기능 이전에 생성되어 기존 키를 조회할 수 없습니다. 재발급하면 새 키가 발급됩니다.
              </p>
            </div>
          )}

          {!loading && (
            <Button variant="secondary" onClick={() => setConfirmRotate(true)} loading={rotating} className="w-full">
              <MaterialIcon name="autorenew" />
              API Key 재발급
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        onConfirm={() => void handleRotate()}
        title="API Key를 재발급할까요?"
        message={`'${agentName}' Docker Collector의 기존 키는 즉시 무효화되며, Docker Collector 설정을 새 키로 교체해야 합니다.`}
        confirmLabel="재발급"
        isProcessing={rotating}
      />
    </div>
  );
}

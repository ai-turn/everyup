import { useEffect, useState } from 'react';
import { MaterialIcon } from '../../../components/common';
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
  const [copied, setCopied] = useState(false);
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('복사에 실패했습니다. 키를 직접 선택해 복사하세요.');
    }
  };

  const handleRotate = async () => {
    if (!confirm(`'${agentName}' Docker 수집기의 API 키를 재발급하시겠습니까?\n기존 키는 즉시 무효화되며, Docker 수집기 설정을 새 키로 교체해야 합니다.`)) return;
    setRotating(true);
    try {
      const res = await api.rotateAgentKey(agentId);
      setApiKey(res.apiKey);
      setAvailable(true);
      toast.success('새 API 키가 발급됐습니다');
      onRotated?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRotating(false);
    }
  };

  return (
    <div role="presentation" className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${SCRIM_MODAL}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-bg-surface rounded-xl shadow-lg border border-ui-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-soft">
          <h2 className="type-card-title text-text-base truncate">
            {agentName} · API 키
          </h2>
          <button onClick={onClose} aria-label="닫기" title="닫기"
            className="p-1 rounded-lg text-slate-400 hover:text-text-base transition-colors">
            <MaterialIcon size={20} name="close" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="h-24 rounded-xl bg-ui-hover animate-pulse" />
          ) : available ? (
            <>
              <div className="space-y-1.5">
                <p className="text-xs text-text-muted uppercase tracking-wider">API 키</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2.5 rounded-xl bg-ui-hover-soft border border-ui-border text-xs font-mono text-text-base break-all">
                    {apiKey}
                  </code>
                  <button onClick={handleCopy} aria-label="API 키 복사"
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      copied
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-ui-hover text-text-secondary hover:bg-ui-active'
                    }`}>
                    <MaterialIcon size={20} name={copied ? 'check' : 'content_copy'} />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-text-muted uppercase tracking-wider">Docker 수집기 설정</p>
                <pre className="px-3 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-950 text-xs font-mono text-slate-100 overflow-x-auto">{`EVERYUP_AGENT_API_KEY=${apiKey}`}</pre>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-ui-hover-soft border border-ui-border">
              <MaterialIcon size={20} name="info" className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-text-muted">
                이 Docker 환경은 키 저장 기능 이전에 생성되어 기존 키를 조회할 수 없습니다. 재발급하면 새 키가 발급됩니다.
              </p>
            </div>
          )}

          {!loading && (
            <button onClick={handleRotate} disabled={rotating}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-ui-hover text-text-secondary hover:bg-ui-active disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <MaterialIcon size={20} name="autorenew" />
              {rotating ? '재발급 중...' : 'API 키 재발급'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

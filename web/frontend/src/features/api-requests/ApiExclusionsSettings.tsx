import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, Textarea } from '../../components/common';
import { api } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

export function ApiExclusionsSettings({ serviceId, paths, onSaved }: { serviceId: string; paths: string[]; onSaved: (paths: string[]) => void }) {
  const [draft, setDraft] = useState(paths.join('\n'));
  const [saved, setSaved] = useState(paths.join('\n'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await api.setObservedServiceApiExclusions(serviceId, draft.split('\n').map(path => path.trim()).filter(Boolean));
      const normalized = (result.paths ?? []).join('\n');
      setDraft(normalized);
      setSaved(normalized);
      onSaved(result.paths ?? []);
      toast.success('API 제외 경로를 저장했습니다.');
    } catch (error) {
      setError(getErrorMessage(error));
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return <details className="mt-6 rounded-xl border border-ui-border bg-bg-surface p-4">
    <summary className="cursor-pointer type-label text-action">API 제외 경로 {paths.length}개</summary>
    <div className="mt-4 space-y-4">
      <p className="type-body text-text-muted">새로 수집하는 HTTP 요청에서 제외할 경로입니다. 한 줄에 하나씩 입력하며 정확한 경로 또는 끝에 *를 붙인 prefix를 지원합니다. 트레이스 원본에는 적용하지 않습니다.</p>
      <Textarea mono className="min-h-28 resize-y" aria-label="API 제외 경로" value={draft} onChange={event => setDraft(event.target.value)} placeholder={'/health\n/internal/*'} />
      {error && <p role="alert" className="type-body text-status-error">{error}</p>}
      <div className="flex justify-end"><Button onClick={() => void save()} disabled={draft === saved} loading={saving}>저장</Button></div>
    </div>
  </details>;
}

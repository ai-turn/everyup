import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, Input, MaterialIcon, Select, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { useModalDialog } from '../../../hooks/useModalDialog';
import type { UptimeMonitor, UptimeMonitorInput, UptimeMonitorType } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';

type MonitorDraft = {
  name: string;
  type: UptimeMonitorType;
  target: string;
  port: string;
  interval: string;
  timeout: string;
};

const EMPTY_DRAFT: MonitorDraft = {
  name: '', type: 'http', target: '', port: '443', interval: '30', timeout: '5000',
};

export function UptimeMonitorDialog({
  monitor,
  onClose,
  onSave,
}: {
  monitor: UptimeMonitor | null;
  onClose: () => void;
  onSave: (input: UptimeMonitorInput) => Promise<void>;
}) {

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<MonitorDraft>(() => monitor ? {
    name: monitor.name,
    type: monitor.type,
    target: monitor.url,
    port: String(monitor.port ?? 443),
    interval: String(monitor.interval),
    timeout: String(monitor.timeout),
  } : EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  useModalDialog(true, dialogRef);

  const update = <K extends keyof MonitorDraft>(key: K, value: MonitorDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: draft.name.trim(),
        type: draft.type,
        ...(draft.type === 'http' ? { url: draft.target.trim() } : { host: draft.target.trim(), port: Number(draft.port) }),
        interval: Number(draft.interval),
        timeout: Number(draft.timeout),
      });
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    // Backdrop click is supplemental; Escape and the labelled close/cancel buttons are keyboard equivalents.
    // react-doctor-disable-next-line no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-labelledby="uptime-monitor-dialog-title"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <form onSubmit={submit}>
        <div className="flex items-center justify-between gap-3 border-b border-ui-border px-6 py-4">
          <div>
            <h2 id="uptime-monitor-dialog-title" className="type-card-title text-text-base">
              {monitor ? '업타임 수정' : '업타임 추가'}
            </h2>
            <p className="mt-0.5 text-sm text-text-muted">HTTP 또는 TCP 상태를 직접 확인합니다.</p>
          </div>
          <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={saving} />
        </div>
        <fieldset disabled={saving} className="space-y-4 p-6">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-secondary">이름</span>
            <Input required pattern={'.*\\S.*'} title="공백 이외의 이름을 입력하세요." value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="예: 공개 API" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-secondary">체크 방식</span>
            <Select aria-label="체크 방식" value={draft.type} onChange={(event) => update('type', event.target.value as UptimeMonitorType)} disabled={Boolean(monitor)}>
              <option value="http">HTTP</option>
              <option value="tcp">TCP</option>
            </Select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-secondary">{draft.type === 'http' ? 'URL' : '호스트'}</span>
            <Input required mono type={draft.type === 'http' ? 'url' : 'text'} pattern={draft.type === 'http' ? '[Hh][Tt][Tt][Pp][Ss]?://.+' : '.*\\S.*'} title={draft.type === 'http' ? 'http:// 또는 https://로 시작하는 주소를 입력하세요.' : undefined} value={draft.target} onChange={(event) => update('target', event.target.value)} placeholder={draft.type === 'http' ? 'https://api.example.com/health' : 'db.example.com'} />
          </label>
          {draft.type === 'tcp' && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text-secondary">포트</span>
              <Input required type="number" min={1} max={65535} value={draft.port} onChange={(event) => update('port', event.target.value)} />
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text-secondary">주기 (초)</span>
              <Input required type="number" min={5} value={draft.interval} onChange={(event) => update('interval', event.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text-secondary">타임아웃 (ms)</span>
              <Input required type="number" min={1} value={draft.timeout} onChange={(event) => update('timeout', event.target.value)} />
            </label>
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 border-t border-ui-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>취소</Button>
          <Button type="submit" loading={saving}>
            {!monitor && <MaterialIcon name="add" />}
            {monitor ? '저장' : '추가'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

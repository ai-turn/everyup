import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, Input, MaterialIcon, Select } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import type { UptimeMonitor, UptimeMonitorInput, UptimeMonitorType } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';

type MonitorDraft = {
  name: string;
  type: UptimeMonitorType;
  target: string;
  port: number;
  interval: number;
  timeout: number;
};

const EMPTY_DRAFT: MonitorDraft = {
  name: '', type: 'http', target: '', port: 443, interval: 30, timeout: 5000,
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
    port: monitor.port ?? 443,
    interval: monitor.interval,
    timeout: monitor.timeout,
  } : EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const update = <K extends keyof MonitorDraft>(key: K, value: MonitorDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: draft.name,
        type: draft.type,
        ...(draft.type === 'http' ? { url: draft.target } : { host: draft.target, port: draft.port }),
        interval: draft.interval,
        timeout: draft.timeout,
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
      className={`m-auto w-full max-w-lg overflow-hidden rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <form onSubmit={submit}>
        <div className="flex items-center justify-between gap-3 border-b border-ui-border px-6 py-4">
          <div>
            <h2 id="uptime-monitor-dialog-title" className="type-card-title text-text-base">
              {monitor ? '업타임 수정' : '업타임 추가'}
            </h2>
            <p className="mt-1 text-sm text-text-muted">HTTP 또는 TCP 상태를 직접 확인합니다.</p>
          </div>
          <Button type="button" variant="quiet" size="sm" aria-label="닫기" onClick={onClose} disabled={saving}>
            <MaterialIcon name="close" />
          </Button>
        </div>
        <div className="space-y-4 p-6">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-secondary">이름</span>
            <Input required value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="예: 공개 API" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-secondary">체크 방식</span>
            <Select value={draft.type} onChange={(event) => update('type', event.target.value as UptimeMonitorType)} disabled={Boolean(monitor)}>
              <option value="http">HTTP</option>
              <option value="tcp">TCP</option>
            </Select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-secondary">{draft.type === 'http' ? 'URL' : '호스트'}</span>
            <Input required mono value={draft.target} onChange={(event) => update('target', event.target.value)} placeholder={draft.type === 'http' ? 'https://api.example.com/health' : 'db.example.com'} />
          </label>
          {draft.type === 'tcp' && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text-secondary">포트</span>
              <Input required type="number" min={1} max={65535} value={draft.port} onChange={(event) => update('port', Number(event.target.value))} />
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text-secondary">주기 (초)</span>
              <Input required type="number" min={5} value={draft.interval} onChange={(event) => update('interval', Number(event.target.value))} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text-secondary">타임아웃 (ms)</span>
              <Input required type="number" min={1} value={draft.timeout} onChange={(event) => update('timeout', Number(event.target.value))} />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-ui-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>취소</Button>
          <Button type="submit" disabled={saving}>
            {saving && <MaterialIcon name="sync" className="animate-spin" />}
            {monitor ? '저장' : '추가하기'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, Input, MaterialIcon, OptionText, Select, IconButton } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { useModalDialog } from '../../../hooks/useModalDialog';
import { api, type UptimeMonitor, type UptimeMonitorInput, type UptimeMonitorType } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { Field } from '../../alerts/components/FormLayout';

type MonitorDraft = {
  name: string;
  type: UptimeMonitorType;
  target: string;
  port: string;
  /** HTTP만. 이 코드가 아니면 실패다(기본 200). */
  expectedStatus: string;
  interval: string;
  /** 초. API는 ms라 저장할 때 바꾼다 — 주기와 같은 단위로 보여 주려고. */
  timeout: string;
};

const EMPTY_DRAFT: MonitorDraft = {
  name: '', type: 'http', target: '', port: '443', expectedStatus: '200', interval: '30', timeout: '5',
};

type DraftErrors = Partial<Record<keyof MonitorDraft, string>>;

const isInteger = (value: string, min: number, max = Infinity) => /^\d+$/.test(value.trim()) && Number(value) >= min && Number(value) <= max;

// 브라우저 기본 검증(말풍선) 대신 입력 아래에 오류를 둔다(폼은 noValidate, UI/UX 점검 A5). 조건은 이전 required·min·max·pattern과 같다.
function validate(draft: MonitorDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.name.trim()) errors.name = '이름을 입력하세요';
  if (draft.type === 'http') {
    if (!/^https?:\/\/\S+$/i.test(draft.target.trim())) errors.target = 'http:// 또는 https://로 시작하는 주소를 입력하세요';
    if (!isInteger(draft.expectedStatus, 100, 599)) errors.expectedStatus = '100~599 사이의 상태 코드를 입력하세요';
  } else {
    if (!draft.target.trim()) errors.target = '호스트를 입력하세요';
    if (!isInteger(draft.port, 1, 65535)) errors.port = '1~65535 사이의 포트를 입력하세요';
  }
  if (!isInteger(draft.interval, 5)) errors.interval = '5초 이상의 정수를 입력하세요';
  if (!(Number(draft.timeout) >= 0.1)) errors.timeout = '0.1초 이상으로 입력하세요';
  return errors;
}

const FIELD_ORDER: (keyof MonitorDraft)[] = ['name', 'target', 'port', 'expectedStatus', 'interval', 'timeout'];

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
    expectedStatus: String(monitor.expectedStatus || 200),
    interval: String(monitor.interval),
    timeout: String(monitor.timeout / 1000),
  } : EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const id = useId();
  const fieldId = (key: keyof MonitorDraft) => `${id}-${key}`;
  // 추가할 때만 묻는다. 켜진 채널이 있으면 기본으로 켠다 — 모니터는 "다운되면 알려 달라"가 존재 이유다.
  const [alertOnDown, setAlertOnDown] = useState(false);
  useEffect(() => {
    if (monitor) return;
    let active = true;
    api.getNotificationChannels()
      .then(channels => { if (active) setAlertOnDown(channels.some(channel => channel.isEnabled)); })
      .catch(() => { /* 채널을 못 읽으면 꺼 둔다. 사용자가 직접 켤 수 있다. */ });
    return () => { active = false; };
  }, [monitor]);

  useModalDialog(true, dialogRef);

  const update = <K extends keyof MonitorDraft>(key: K, value: MonitorDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // 방식을 바꾸면 주소·포트·상태 코드의 조건이 바뀌므로 오류를 모두 지운다.
    setErrors((current) => key === 'type' ? {} : { ...current, [key]: undefined });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate(draft);
    setErrors(found);
    const first = FIELD_ORDER.find((key) => found[key]);
    if (first) {
      document.getElementById(fieldId(first))?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: draft.name.trim(),
        type: draft.type,
        ...(draft.type === 'http'
          ? { url: draft.target.trim(), expectedStatus: Number(draft.expectedStatus) }
          : { host: draft.target.trim(), port: Number(draft.port) }),
        interval: Number(draft.interval),
        timeout: Math.round(Number(draft.timeout) * 1000),
        ...(!monitor && alertOnDown ? { alertOnDown: true } : {}),
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
      <form onSubmit={submit} noValidate>
        <div className="flex items-center justify-between gap-3 border-b border-ui-border px-6 py-4">
          <div>
            <h2 id="uptime-monitor-dialog-title" className="type-card-title text-text-base">
              {monitor ? '업타임 수정' : '업타임 추가'}
            </h2>
            <p className="mt-0.5 type-body text-text-muted">HTTP 또는 TCP 상태를 직접 확인합니다.</p>
          </div>
          <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={saving} />
        </div>
        <fieldset disabled={saving} className="space-y-4 p-6">
          <Field label="이름" htmlFor={fieldId('name')} required error={errors.name}>
            <Input id={fieldId('name')} invalid={Boolean(errors.name)} value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="예: 공개 API" />
          </Field>
          <Field label="체크 방식" htmlFor={fieldId('type')}>
            <Select id={fieldId('type')} aria-label="체크 방식" value={draft.type} onChange={(event) => update('type', event.target.value as UptimeMonitorType)} disabled={Boolean(monitor)}>
              <option value="http">HTTP</option>
              <option value="tcp">TCP</option>
            </Select>
          </Field>
          <Field label={draft.type === 'http' ? 'URL' : '호스트'} htmlFor={fieldId('target')} required error={errors.target}>
            <Input id={fieldId('target')} mono type={draft.type === 'http' ? 'url' : 'text'} invalid={Boolean(errors.target)} value={draft.target} onChange={(event) => update('target', event.target.value)} placeholder={draft.type === 'http' ? 'https://api.example.com/health' : 'db.example.com'} />
          </Field>
          {draft.type === 'tcp' ? (
            <Field label="포트" htmlFor={fieldId('port')} required error={errors.port}>
              <Input id={fieldId('port')} type="number" inputMode="numeric" invalid={Boolean(errors.port)} value={draft.port} onChange={(event) => update('port', event.target.value)} />
            </Field>
          ) : (
            <Field label="기대 상태 코드" htmlFor={fieldId('expectedStatus')} required error={errors.expectedStatus} hint="응답 코드가 이 값과 다르면 실패로 기록합니다.">
              <Input id={fieldId('expectedStatus')} type="number" inputMode="numeric" invalid={Boolean(errors.expectedStatus)} value={draft.expectedStatus} onChange={(event) => update('expectedStatus', event.target.value)} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="주기 (초)" htmlFor={fieldId('interval')} required error={errors.interval}>
              <Input id={fieldId('interval')} type="number" inputMode="numeric" invalid={Boolean(errors.interval)} value={draft.interval} onChange={(event) => update('interval', event.target.value)} />
            </Field>
            <Field label="타임아웃 (초)" htmlFor={fieldId('timeout')} required error={errors.timeout}>
              {/* ms로 저장된 기존 값(예: 2550 → 2.55)을 그대로 열고 저장할 수 있어야 한다. */}
              <Input id={fieldId('timeout')} type="number" inputMode="decimal" step="any" invalid={Boolean(errors.timeout)} value={draft.timeout} onChange={(event) => update('timeout', event.target.value)} />
            </Field>
          </div>
          {!monitor && (
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={alertOnDown} onChange={(event) => setAlertOnDown(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary" />
              <OptionText tone="secondary" title="다운되면 알림" description="연속으로 실패하면 한 번, 복구되면 한 번 켜진 모든 채널로 보냅니다. 알림 규칙에서 바꿀 수 있습니다." />
            </label>
          )}
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

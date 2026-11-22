import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, IconButton, OptionText } from '../../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../../hooks/useOverlay';
import { useModalDialog } from '../../../hooks/useModalDialog';
import { api, type MergeInfrastructure, type Project } from '../../../services/api';
import { ApiError, getErrorMessage } from '../../../utils/errors';
import { capabilityUnverified, countTargets, dockerCollects, hasTargets, targetCountLabels, type ServerRow } from '../serverStatus';
import { TargetCountList } from './TargetCountList';

const INFRA_TAKEN = '인프라 리소스가 이미 있습니다';
const DOCKER_TAKEN = 'Docker Collector가 이미 있습니다';

const ERRORS: Record<string, string> = {
  SERVER_HAS_INFRASTRUCTURE: '두 서버 모두 인프라 리소스가 있어서 합칠 수 없습니다.',
  SERVER_HAS_TWO_DOCKER: '두 서버 모두 Docker Collector가 있어서 합칠 수 없습니다. 서버 하나에 Docker Collector는 하나입니다.',
  INFRASTRUCTURE_SOURCE_REQUIRED: '호스트 지표를 받을 출처를 고르세요.',
};
const errorMessage = (error: unknown) => (error instanceof ApiError && ERRORS[error.code ?? '']) || getErrorMessage(error);

// OpenTelemetry Collector로 직접 연결한 인프라 리소스. Docker Collector의 호스트 지표(`everyup-agent`)는 Docker Collector를 따른다.
const otelInfrastructure = (row: ServerRow) => row.targets.infrastructure?.adapter === 'otel-collector' ? row.targets.infrastructure : undefined;

const INFRA_SOURCES: { value: MergeInfrastructure; title: string; description: string }[] = [
  { value: 'docker', title: 'Docker Collector', description: 'OpenTelemetry Collector 리소스는 연결을 중지합니다. 수집한 기록은 남습니다.' },
  { value: 'otel', title: 'OpenTelemetry Collector', description: 'Docker Collector의 수집에서 인프라를 뺍니다. 합친 뒤 서버에서 적용 명령을 한 번 실행합니다.' },
];

/**
 * 이 서버(row)와 고른 서버들을 합칠 때의 규칙(같은 호스트 합치기, ADR 0012). 고르지 않은 후보를 막는 까닭과, 호스트 지표 출처를
 * 골라야 하는지를 정한다. 서버 하나에 Docker Collector와 OpenTelemetry 인프라 리소스는 각각 하나다.
 */
function mergeRules(row: ServerRow, selected: ServerRow[], checked: ReadonlySet<string>, infraUnknown: boolean) {
  const merged = [row, ...selected];
  const infraTaken = !infraUnknown && merged.some((candidate) => otelInfrastructure(candidate));
  const dockerTaken = merged.some((candidate) => candidate.targets.docker);
  const blockedBy = (candidate: ServerRow) => {
    if (checked.has(candidate.server.id)) return null;
    if (dockerTaken && candidate.targets.docker) return DOCKER_TAKEN;
    return infraTaken && otelInfrastructure(candidate) ? INFRA_TAKEN : null;
  };
  // 합친 서버의 Docker Collector가 호스트 지표를 모으고 OpenTelemetry Collector 리소스도 있으면 출처를 고른다.
  const docker = merged.find((candidate) => candidate.targets.docker);
  const needsInfraSource = Boolean(docker && dockerCollects(docker.targets, 'infrastructure')) && merged.some((candidate) => otelInfrastructure(candidate));
  return { blockedBy, needsInfraSource };
}

// 두 번 수집하지 않도록 하나를 고른다. 고르기 전에는 합치지 않는다.
function InfraSourceChoice({ value, onChange }: { value: MergeInfrastructure | null; onChange: (value: MergeInfrastructure) => void }) {
  return (
    <fieldset className="space-y-label">
      <legend className="type-label text-text-base">호스트 지표 출처</legend>
      <p className="type-body text-text-muted">Docker Collector와 OpenTelemetry Collector가 같은 호스트의 CPU·메모리·디스크를 모읍니다. 하나만 남기세요.</p>
      {INFRA_SOURCES.map((source) => (
        <label key={source.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-ui-hover-soft">
          <input type="radio" name="merge-infrastructure" value={source.value} checked={value === source.value} onChange={() => onChange(source.value)}
            className="icon-lead h-4 w-4 shrink-0 cursor-pointer accent-primary" />
          <OptionText title={source.title} description={source.description} />
        </label>
      ))}
    </fieldset>
  );
}

/**
 * 다른 서버들을 이 서버로 가져온다. 선택한 서버의 대상은 이 서버로 옮겨지고 선택한 서버는 삭제된다.
 * Docker 서버도 합친다(같은 호스트, ADR 0012): Docker Collector는 결과 서버에 하나만 남고, Docker Collector와 OpenTelemetry
 * Collector가 둘 다 호스트 지표를 모으게 되면 하나를 고른다.
 */
export function MergeServerDialog({ row, rows, projects, initialSelected = [], onClose, onReload, onMerged }: {
  row: ServerRow;
  rows: ServerRow[];
  /** 그룹 목록을 불러오지 못했으면 null. 항목에서 그룹 이름을 뺀다. */
  projects: Project[] | null;
  /** 처음부터 고른 서버(개요의 같은 호스트 제안). */
  initialSelected?: string[];
  onClose: () => void;
  /** 실패한 뒤에 서버 데이터를 다시 불러온다. 창은 열어 둔다. */
  onReload: () => void;
  /** 모두 합쳤다. 창을 닫고 서버 데이터를 다시 불러오는 것은 화면이 한다. OpenTelemetry를 골랐으면 적용 명령을 안내한다. */
  onMerged: (infrastructure?: MergeInfrastructure) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useModalDialog(true, dialogRef);
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(initialSelected));
  const [infraSource, setInfraSource] = useState<MergeInfrastructure | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Docker Collector가 있는 서버는 아직 합칠 수 없다(백엔드 409 SERVER_HAS_DOCKER, 같은 호스트 합치기는 통합 3단계).
  const candidates = rows
    .filter((candidate) => candidate.server.id !== row.server.id)
    .sort((a, b) => a.server.name.localeCompare(b.server.name));
  // 다시 불러온 뒤 사라진 서버(이미 합쳐진 서버)는 선택에서도 빠진다.
  const selected = candidates.filter((candidate) => checked.has(candidate.server.id));

  // 서버 하나에 인프라 리소스는 하나다. 인프라 목록을 모르면 미리 막지 않고 백엔드의 거부(409)에 맡긴다.
  // 이전 목록인 인프라도 모르는 것으로 본다(그 사이에 옮겨졌을 수 있다).
  const infraUnknown = rows.some((candidate) => capabilityUnverified(candidate, 'infrastructure'));
  // 서버 하나에 Docker Collector는 하나다(백엔드 409 SERVER_HAS_TWO_DOCKER). 고른 것이 있으면 다른 Docker 서버는 고를 수 없다.
  const { blockedBy, needsInfraSource } = mergeRules(row, selected, checked, infraUnknown);
  const infrastructure = needsInfraSource ? infraSource ?? undefined : undefined;

  // 그룹이 없으면 미분류, 그룹 목록을 모르거나 그룹을 찾지 못하면 괄호를 뺀다.
  const groupOf = (candidate: ServerRow) => !candidate.server.projectId ? '미분류'
    : projects?.find((project) => project.id === candidate.server.projectId)?.name;
  const summaryOf = (candidate: ServerRow) => {
    const labels = targetCountLabels(countTargets(candidate.targets));
    if (labels.length > 0) return labels.join(', ');
    return candidate.unknownCapabilities.length > 0 || candidate.staleCapabilities.length > 0 ? '대상 확인 불가' : '대상 없음';
  };

  const toggle = (id: string) => setChecked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) return;
    setMerging(true);
    setError(null);
    // 차례로 합친다. 같은 서버로 동시에 옮기면 인프라 충돌 검사가 서로를 보지 못한다.
    let merged = 0;
    for (const candidate of selected) {
      try {
        // 차례로 호출하는 것이 요구 사항이다(위 주석). 병렬로 바꾸지 않는다.
        // react-doctor-disable-next-line async-await-in-loop
        await api.mergeServer(candidate.server.id, row.server.id, infrastructure);
        merged += 1;
        // 다시 불러오기가 끝나기 전이나 실패한 뒤에 재시도해도 이미 합쳐진 서버로 요청하지 않게 선택에서 바로 뺀다.
        setChecked((current) => {
          const next = new Set(current);
          next.delete(candidate.server.id);
          return next;
        });
      } catch (cause) {
        setError(`${merged > 0 ? `서버 ${merged}개를 합친 뒤 ` : ''}${candidate.server.name}에서 멈췄습니다. ${errorMessage(cause)}`);
        setMerging(false);
        onReload();
        return;
      }
    }
    toast.success(`서버 ${merged}개를 합쳤습니다`);
    onMerged(infrastructure);
  };

  const knownTargets = selected.some((candidate) => hasTargets(candidate.targets));
  const unknownTargets = selected.some((candidate) => candidate.unknownCapabilities.length > 0 || candidate.staleCapabilities.length > 0);

  return (
    // 배경 클릭은 보조 수단이다. Escape와 닫기·취소 버튼이 키보드에서 같은 일을 한다.
    // react-doctor-disable-next-line no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-labelledby="merge-server-title"
      onCancel={(event) => { event.preventDefault(); if (!merging) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !merging) onClose(); }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="flex items-center justify-between gap-3 border-b border-ui-border px-6 py-4">
          <div>
            <h2 id="merge-server-title" className="type-card-title text-text-base">다른 서버 합치기</h2>
            <p className="mt-intra type-body text-text-muted">선택한 서버의 대상을 모두 이 서버로 옮기고, 선택한 서버는 삭제합니다.</p>
          </div>
          <IconButton icon="close" label="닫기" tone="quiet" size="sm" onClick={onClose} disabled={merging} />
        </div>
        <fieldset disabled={merging} className="space-y-heading p-6">
          {candidates.length === 0 ? (
            <p className="type-body text-text-muted">합칠 다른 서버가 없습니다.</p>
          ) : (
            <div>
              <h3 id="merge-server-choices" className="mb-label type-label text-text-muted">합칠 서버 ({candidates.length}개)</h3>
              {/* 행 높이(약 52px)의 4.5배쯤에서 자른다. 마지막 행이 반쯤 걸쳐야 목록이 더 있다는 것이 보인다. */}
              <ul aria-labelledby="merge-server-choices" className="-mx-2 max-h-60 overflow-y-auto">
                {candidates.map((candidate) => {
                  const reason = blockedBy(candidate);
                  const disabled = Boolean(reason);
                  const group = groupOf(candidate);
                  return (
                    <li key={candidate.server.id}>
                      <label className={`flex min-h-11 items-start gap-3 rounded-lg px-2 py-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-ui-hover-soft'}`}>
                        <input type="checkbox" checked={checked.has(candidate.server.id)} disabled={disabled} onChange={() => toggle(candidate.server.id)}
                          className="icon-lead h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed" />
                        <OptionText title={<>{candidate.server.name}{group && ` (${group})`}</>}
                          description={reason ?? `${candidate.targets.docker ? 'Docker Collector, ' : ''}${summaryOf(candidate)}`} />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {infraUnknown && <p className="type-body text-text-muted">인프라 리소스 목록을 불러오지 못해 충돌 여부를 미리 확인하지 못했습니다.</p>}
          {needsInfraSource && <InfraSourceChoice value={infraSource} onChange={setInfraSource} />}
          {selected.length > 0 && (
            <div className="space-y-label" aria-live="polite">
              <p className="type-body text-text-base">
                {knownTargets ? '다음 대상이 이 서버로 옮겨집니다.'
                  : unknownTargets ? '대상 목록을 불러오지 못해 옮겨질 대상을 확인하지 못했습니다.'
                    : '옮길 대상이 없습니다.'}
              </p>
              <TargetCountList rows={selected} />
              <p className="type-body text-text-base">선택한 서버 {selected.length}개는 삭제됩니다.</p>
            </div>
          )}
          {error && <p role="alert" className="type-body text-status-error">{error}</p>}
        </fieldset>
        <div className="flex justify-end gap-2 border-t border-ui-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={merging}>취소</Button>
          {/* 선택한 서버가 삭제되는 동작이다(DESIGN.md §7 삭제 확인). */}
          <Button type="submit" variant="danger" loading={merging} disabled={selected.length === 0 || (needsInfraSource && !infraSource)}>합치기</Button>
        </div>
      </form>
    </dialog>
  );
}

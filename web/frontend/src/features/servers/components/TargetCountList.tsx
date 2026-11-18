import { countTargets, targetCountLabels, type ServerRow } from '../serverStatus';

/** 합치기와 삭제의 확인 창이 옮겨지거나 지워질 대상을 종류별 합계로 보여 준다. 0개인 종류는 뺀다. */
export function TargetCountList({ rows }: { rows: ServerRow[] }) {
  const total = rows.map((row) => countTargets(row.targets)).reduce((sum, counts) => ({
    monitors: sum.monitors + counts.monitors, apps: sum.apps + counts.apps, infrastructure: sum.infrastructure + counts.infrastructure,
  }), { monitors: 0, apps: 0, infrastructure: 0 });
  const labels = targetCountLabels(total);
  const unknown = rows.some((row) => row.unknownCapabilities.length > 0);
  return (
    <>
      {labels.length > 0 && (
        <ul aria-label="대상 개수" className="list-disc space-y-1 pl-5 type-body text-text-base">
          {labels.map((label) => <li key={label}>{label}</li>)}
        </ul>
      )}
      {unknown && labels.length > 0 && <p className="mt-2 type-body text-text-muted">일부 대상 목록을 불러오지 못해 개수가 빠졌을 수 있습니다.</p>}
    </>
  );
}

import type { AlertRule } from '../../../services/api';
import { targetParts, type TargetNames } from '../ruleDisplay';

// 규칙 대상의 이름. 이름을 찾지 못한 대상은 설명(`이름을 불러오지 못한 대상`, `삭제된 대상`) 뒤에
// 내부 ID를 흐린 글자로 붙인다 — ID가 무엇을 가리키는지 확인할 단서는 남기되 이름처럼 읽히지 않게 한다.
// `stacked`: 한 줄로 말줄임하는 표 칸에서는 설명에 가려지지 않게 ID를 다음 줄에 둔다.
export function RuleTargetName({ rule, names, stacked = false }: { rule: AlertRule; names: TargetNames; stacked?: boolean }) {
  const { label, missingId } = targetParts(rule, names);
  if (!missingId) return <>{label}</>;
  return stacked
    ? <>{label}<span className="block truncate type-caption text-text-faint">{missingId}</span></>
    : <>{label} <span className="text-text-faint">{missingId}</span></>;
}

import { SegmentedControl, Select, type StatusTone } from '../../../components/common';

/** 서버 탭의 앱 선택. 4개까지는 한눈에 보이는 버튼, 넘으면 목록. 선택지마다 이름이 있는 상태 점을 둔다. */
export function AppSelector({ apps, value, onChange, ariaLabel }: {
  apps: { id: string; name: string; state: StatusTone; stateLabel: string }[];
  value: string;
  onChange: (appId: string) => void;
  ariaLabel: string;
}) {
  if (apps.length <= 4) {
    return (
      <SegmentedControl size="md" ariaLabel={ariaLabel} value={value} onChange={onChange}
        options={apps.map((app) => ({ value: app.id, label: app.name, tone: app.state, toneLabel: app.stateLabel }))} />
    );
  }
  return (
    <Select wrapperClassName="w-64 max-w-full" aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}>
      {apps.map((app) => <option key={app.id} value={app.id} data-tone={app.state} data-tone-label={app.stateLabel}>{app.name}</option>)}
    </Select>
  );
}

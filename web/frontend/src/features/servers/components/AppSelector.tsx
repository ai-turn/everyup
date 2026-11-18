import { useEffect, useRef } from 'react';
import { SegmentedControl, Select, type StatusTone } from '../../../components/common';

/** 서버 탭의 앱 선택. 4개까지는 한눈에 보이는 버튼, 넘으면 목록. 정상이 아닌 앱은 상태를 글자로도 적는다. */
export function AppSelector({ apps, value, onChange, ariaLabel }: {
  apps: { id: string; name: string; state: StatusTone; stateLabel: string }[];
  value: string;
  onChange: (appId: string) => void;
  ariaLabel: string;
}) {
  // 선택한 앱이 스크롤 영역 밖이면 그 영역만 움직여 보이게 한다(Tabs와 같은 방식, 페이지는 움직이지 않는다).
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const area = scrollRef.current;
    const button = area?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!area || !button) return;
    const left = button.getBoundingClientRect().left - area.getBoundingClientRect().left + area.scrollLeft;
    if (left < area.scrollLeft) area.scrollLeft = left;
    else if (left + button.offsetWidth > area.scrollLeft + area.clientWidth) area.scrollLeft = left + button.offsetWidth - area.clientWidth;
  }, [value]);

  if (apps.length <= 4) {
    return (
      // 넘치면 페이지가 아니라 이 영역만 가로로 스크롤한다(서버 탭 줄과 같다).
      <div ref={scrollRef} className="max-w-full overflow-x-auto overflow-y-hidden">
        <SegmentedControl size="md" scroll ariaLabel={ariaLabel} value={value} onChange={onChange}
          options={apps.map((app) => ({ value: app.id, label: app.name, tone: app.state, toneLabel: app.stateLabel }))} />
      </div>
    );
  }
  return (
    <Select wrapperClassName="w-64 max-w-full" aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}>
      {apps.map((app) => <option key={app.id} value={app.id}>{app.state === 'healthy' ? app.name : `${app.name} (${app.stateLabel})`}</option>)}
    </Select>
  );
}

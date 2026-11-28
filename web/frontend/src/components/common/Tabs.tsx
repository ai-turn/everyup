import { useEffect, useRef, type KeyboardEvent } from 'react';
import { STATUS_DOT, type StatusTone } from './statusTone';
import { tabId, tabPanelId } from './tabIds';
import { Tooltip } from './Tooltip';

// 패널을 바꾸는 밑줄 탭. DESIGN.md §4.6.

export interface TabItem<T extends string> {
  key: T;
  label: string;
  /** 문제가 있는 탭에 붙는 상태 점. 점의 접근 가능한 이름은 toneLabel이다.
   *  점만으로 상태를 전달하지 않도록 toneLabel을 함께 준다(없으면 점은 aria-hidden). */
  tone?: StatusTone;
  toneLabel?: string;
  /** 라벨 옆의 보조 문구(예: "연결 전"). */
  caption?: string;
  /** 화면에는 그리지 않고 접근 가능한 이름에만 붙는 설명(예: ", 모니터 2개"). 라벨 바로 뒤에 읽힌다. */
  srDetail?: string;
  /** 연결되지 않은 탭처럼 흐리게 표시한다. 선택은 가능하다. */
  muted?: boolean;
}


export function Tabs<T extends string>({ items, active, onChange, ariaLabel, idPrefix }: {
  items: readonly TabItem<T>[];
  active: T;
  /** 키보드(화살표, Home, End)로 바꾼 경우에만 source가 'keyboard'다. */
  onChange: (key: T, source?: 'keyboard') => void;
  ariaLabel: string;
  /** 탭과 패널의 id를 만드는 접두사 */
  idPrefix: string;
}) {
  // 주소로 바로 들어오면 선택된 탭이 탭 줄 밖에 있을 수 있다. 탭 줄만 가로로 움직인다.
  // scrollIntoView는 탭 줄이 화면 밖이면 페이지까지 세로로 움직이므로 scrollLeft를 직접 맞춘다.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !tab) return;
    const left = tab.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
    if (left < list.scrollLeft) list.scrollLeft = left;
    else if (left + tab.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = left + tab.offsetWidth - list.clientWidth;
  }, [active]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(items[next].key, 'keyboard');
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    // 탭 아래 전폭 기준선은 두지 않고 선택 밑줄만 남긴다(DESIGN.md §3.1).
    // 가로 스크롤 영역은 세로도 잘라서 포커스 링(2px + 간격 2px)이 잘렸다. 링이 들어갈 여백(p-1)을 두고 같은 만큼 끌어당겨(-m-1) 자리는 그대로다.
    <div ref={listRef} role="tablist" aria-label={ariaLabel} className="-m-1 flex gap-1 overflow-x-auto overflow-y-hidden p-1">
      {items.map((item, index) => {
        const selected = active === item.key;
        return (
          // 상태 점은 색이라 화면을 보는 사용자에게도 문구를 툴팁으로 보인다(마우스와 키보드 포커스).
          <Tooltip key={item.key} content={item.tone ? item.toneLabel : undefined}><button
            id={tabId(idPrefix, item.key)}
            type="button"
            role="tab"
            tabIndex={selected ? 0 : -1}
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix, item.key)}
            onClick={() => onChange(item.key)}
            onKeyDown={event => onKeyDown(event, index)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 type-label transition-colors ${
              selected
                ? 'border-accent text-text'
                : `border-transparent hover:text-text ${item.muted ? 'text-text-faint' : 'text-text-muted'}`
            }`}
          >
            {item.label}
            {item.srDetail && <span className="sr-only">{item.srDetail}</span>}
            {item.caption && <span className="type-caption text-text-faint">{item.caption}</span>}
            {item.tone && (
              <span
                {...(item.toneLabel ? { role: 'img', 'aria-label': item.toneLabel } : { 'aria-hidden': true })}
                className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[item.tone]}`}
              />
            )}
          </button></Tooltip>
        );
      })}
    </div>
  );
}

import type { KeyboardEvent } from 'react';
import type { StatusTone } from './StatusLight';
import { tabId, tabPanelId } from './tabIds';

// 패널을 바꾸는 밑줄 탭. DESIGN.md §4.6.

export interface TabItem<T extends string> {
  key: T;
  label: string;
  /** 문제가 있는 탭에 붙는 상태 점. 점의 접근 가능한 이름은 toneLabel이다. */
  tone?: StatusTone;
  toneLabel?: string;
  /** 라벨 옆의 보조 문구(예: "연결 전"). */
  caption?: string;
  /** 연결되지 않은 탭처럼 흐리게 표시한다. 선택은 가능하다. */
  muted?: boolean;
}

// StatusLight의 점과 같은 토큰. 컴포넌트 파일끼리 상수를 export하면 fast refresh 규칙에 걸려 복제했다.
const DOT: Record<StatusTone, string> = {
  healthy: 'bg-status-healthy-fill',
  warn: 'bg-status-warn-fill',
  error: 'bg-status-error-fill',
  idle: 'bg-status-idle-fill',
};

export function Tabs<T extends string>({ items, active, onChange, ariaLabel, idPrefix }: {
  items: readonly TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  ariaLabel: string;
  /** 탭과 패널의 id를 만드는 접두사 */
  idPrefix: string;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(items[next].key);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    // 탭 아래 전폭 기준선은 두지 않고 선택 밑줄만 남긴다(DESIGN.md §3.1).
    <div role="tablist" aria-label={ariaLabel} className="flex gap-1 overflow-x-auto overflow-y-hidden">
      {items.map((item, index) => {
        const selected = active === item.key;
        return (
          <button
            key={item.key}
            id={tabId(idPrefix, item.key)}
            type="button"
            role="tab"
            tabIndex={selected ? 0 : -1}
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix, item.key)}
            onClick={() => onChange(item.key)}
            onKeyDown={event => onKeyDown(event, index)}
            className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 type-label transition-colors ${
              selected
                ? 'border-primary text-text-base'
                : `border-transparent hover:text-text-base ${item.muted ? 'text-text-dim' : 'text-text-muted'}`
            }`}
          >
            {item.label}
            {item.caption && <span className="type-caption text-text-dim">{item.caption}</span>}
            {item.tone && <span role="img" aria-label={item.toneLabel} className={`h-2 w-2 shrink-0 rounded-full ${DOT[item.tone]}`} />}
          </button>
        );
      })}
    </div>
  );
}

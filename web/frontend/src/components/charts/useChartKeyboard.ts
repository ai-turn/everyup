import { useState, type KeyboardEvent } from 'react';

/**
 * 시간축 차트의 키보드 탐색. Recharts accessibilityLayer는 숫자(시간) X축에서 방향키가 먹지 않아서,
 * 키보드로 고른 시점의 인덱스를 직접 들고 있다. 값은 호출하는 쪽이 차트 아래 aria-live 줄로 읽어 준다.
 * index = null 이면 키보드로 고르는 중이 아니다. 차트에는 accessibilityLayer={false}를 함께 준다.
 */
export function useChartKeyboard(length: number) {
  const [index, setIndex] = useState<number | null>(null);
  const last = length - 1;
  const onKeyDown = (e: KeyboardEvent) => {
    if (last < 0) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      setIndex((i) => i === null ? last : Math.min(last, Math.max(0, i + step)));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setIndex(e.key === 'Home' ? 0 : last);
    } else if (e.key === 'Escape') {
      setIndex(null);
    }
  };
  return { index: index === null ? null : Math.min(index, last), onKeyDown, onBlur: () => setIndex(null) };
}

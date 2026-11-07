import type { KeyboardEvent } from 'react';

/**
 * 클릭으로만 동작하던 요소에 키보드 경로를 붙인다.
 *
 * `<div onClick>`은 탭으로 도달할 수 없어 마우스가 없으면 기능 자체가 막힌다.
 * 프로젝트·서비스 카드가 그랬고, 카드 안에 버튼(API 키·삭제)이 중첩돼 있어
 * 네이티브 `<a>`/`<button>`으로 바꾸면 인터랙티브 요소가 중첩된다 — 그래서
 * ARIA로 역할만 부여한다.
 *
 * `<tr>`·`<th>`에는 쓰지 말 것. `role="button"`이 테이블 시맨틱을 덮어써서
 * 스크린리더가 행·열 관계를 잃는다. 그쪽은 셀 안에 실제 `<button>`을 둔다.
 *
 * @param enabled false면 빈 객체를 돌려준다 — 조건부로만 클릭되는 행에 쓴다.
 *
 *   ⚠ **반드시 진짜 boolean을 넘길 것.** `undefined`를 넘기면 JS 기본 파라미터가
 *   발동해 `true`가 된다 — `obj && obj.x > 0` 같은 식은 `undefined`를 낼 수 있어서,
 *   비활성이어야 할 행이 포커스 가능한 버튼이 되어 버린다. TypeScript는 선택적
 *   파라미터에 `undefined` 전달을 허용하므로 이 실수를 잡아주지 못한다.
 */
export function activatable(onActivate: () => void, enabled: boolean = true) {
  if (!enabled) return {};
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      // Space는 기본 동작이 스크롤이라 막아야 한다.
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
  } as const;
}

// 폼 입력의 단일 소스.
// 이전엔 클래스 문자열이 10종이라 radius 3종(md/lg/xl) · 세로패딩 5종(1.5~3.5) ·
// 배경 4종 · 포커스 링 5종이 화면마다 뒤섞여 있었다.
//
// 포커스 링은 index.css의 전역 `:focus-visible`이 처리한다 — 여기서 재정의하지 않는다.
// 검증 에러는 상태색(status-*)이 아니라 폼 축이라 primitive red를 쓴다.

import type { ComponentPropsWithRef } from 'react';

/** 폼 필드 공통 셸 — Input·Select가 나란히 놓였을 때 밑변이 맞아야 한다.
 *
 * Button과 같은 이유로 **높이를 고정**한다(py 조합 금지): `<select>`는 line-height를
 * `normal`로 강제해 `leading-*`이 먹지 않아, py 기반으로 맞추면 input보다 2px 낮게 렌더된다.
 * 높이가 자유로워야 하는 textarea는 이 셸에 자기 py를 덧붙여 쓴다. */
export const FIELD_SHELL =
  'w-full rounded-lg border bg-ui-hover-soft px-3 text-sm text-text-base transition-colors';

// 터치 화면(sm 미만)에서 44px — Button md와 같은 규칙이라 나란히 놓여도 밑변이 맞는다.
export const FIELD_HEIGHT = 'h-11 sm:h-10';

const BASE = `${FIELD_SHELL} ${FIELD_HEIGHT} placeholder:text-text-dim disabled:opacity-50 disabled:cursor-not-allowed`;

interface InputProps extends ComponentPropsWithRef<'input'> {
  /** 검증 실패 — 보더를 붉게 하고 aria-invalid를 세운다. */
  invalid?: boolean;
  /** 제출은 막지 않는 주의 상태(예: 원격에서 안 통할 주소) — 앰버 보더. */
  warn?: boolean;
  /** 토큰·URL·경로처럼 등폭이 필요한 값. */
  mono?: boolean;
}

// 보더 색은 컴포넌트가 정한다. className으로 넘기면 BASE의 border-ui-border와 특이도가 같아
// 생성된 CSS 순서로 승패가 갈린다 — 호출부가 이길 거라 가정하면 안 된다.
export function Input({ invalid = false, warn = false, mono = false, className = '', ...props }: InputProps) {
  const border = invalid ? 'border-red-500' : warn ? 'border-amber-400' : 'border-ui-border';
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`${BASE} ${border} ${mono ? 'font-mono' : ''} ${className}`}
      {...props}
    />
  );
}

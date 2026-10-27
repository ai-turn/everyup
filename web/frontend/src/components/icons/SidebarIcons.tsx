import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const defaults = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

/**
 * Health Check — 심박 펄스 라인 + 체크 표시.
 * 서비스의 생사 여부를 주기적으로 확인하는 헬스체크의 핵심을 표현.
 * 평탄한 라인에서 한 번 뛰는 펄스가 "살아있음"을 상징.
 */
export function IconHealthCheck({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <polyline points="2,13 6,13 9,6 12,18 15,10 18,13 22,13" />
      <circle cx="18" cy="7" r="4" strokeWidth="1.8" />
      <polyline points="16.5,7 17.5,8 19.5,6" strokeWidth="1.8" />
    </svg>
  );
}

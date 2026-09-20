// 서비스·체크의 정상/장애 표시.
//
// 이전 구현은 10개 상태를 문자열 key로 매핑하고 react-i18next `common.*`를 썼지만
// 렌더되는 상태는 정상/장애 둘뿐이었고, 그 키 9개는 이 파일 밖에서 쓰인 적이 없다.
// 앱이 Tolgee(source-as-key)로 이전 중이라 i18n 스택도 혼자 어긋나 있었다.
// 실제로 화면을 그리던 구현을 그대로 승격했다.
//
// 이름은 Badge지만 형태는 `StatusLight`(점 + 라벨)다 — 대상의 상태는 배지가 아니라
// status light라는 §5.1 결론 때문. 이름은 호출부 9곳의 도메인 어휘라 그대로 뒀다.

import { StatusLight } from './StatusLight';

export function StatusBadge({ healthy }: { healthy: boolean }) {
  return <StatusLight tone={healthy ? 'healthy' : 'error'} label={healthy ? '정상' : '장애'} />;
}

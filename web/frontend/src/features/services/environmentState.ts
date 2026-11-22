import type { ConnectedAgent } from '../../services/api';

export type EnvironmentState = 'install' | 'collecting' | 'delayed';

/**
 * Docker 환경의 상태는 이 함수 하나로 정한다. 목록·환경 머리말·설정 가이드가 같은 환경을 서로 다르게 말했다
 * (서비스가 없으면 `설치 대기`, 최근 통신이면 `수집 중`, 설치 상태로는 `설치 필요`, 연결 진입점 정리 E1).
 * Docker Collector가 한 번도 보고하지 않았으면(버전이 없으면) 설치 전이다. 환경을 만들 때 마지막 통신 시각이 생성 시각으로
 * 채워지므로, 그것만 보면 설치하지 않은 환경이 2분 동안 `수집 중`이었다.
 */
export function environmentState(agent: Pick<ConnectedAgent, 'version' | 'lastSeenAt'>): EnvironmentState {
  if (!agent.version) return 'install';
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000 ? 'collecting' : 'delayed';
}

export const ENVIRONMENT_INSTALL_LABEL = '설치 대기';

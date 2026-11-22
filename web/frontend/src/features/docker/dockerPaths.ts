/**
 * 컨테이너(Docker Collector가 발견한 Docker 서비스) 하나의 페이지(ADR 0012). 서버를 모르고 Docker Collector만 아는 곳(컨테이너
 * 목록 응답, 트레이스)은 Collector ID를 서버 ID로 넘긴다: Docker 서버는 그 Collector와 ID가 같다(migrateV59).
 */
export const containerPath = (serverId: string, key: string) => `/servers/${serverId}/containers/${encodeURIComponent(key)}`;

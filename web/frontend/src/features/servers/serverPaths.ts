// 서버 화면의 주소는 여기서만 만든다. 컴포넌트마다 문자열을 이어 붙이면 인코딩과 순서가 어긋난다.

export const SERVERS_PATH = '/servers';
export const NEW_SERVER_PATH = '/servers/new';

export type ServerCapability = 'uptime' | 'infrastructure' | 'logs' | 'api' | 'metrics';

export const SERVER_CAPABILITIES: readonly { key: ServerCapability; label: string }[] = [
  { key: 'uptime', label: '업타임' },
  { key: 'infrastructure', label: '인프라' },
  { key: 'logs', label: '로그' },
  { key: 'api', label: 'API 요청' },
  { key: 'metrics', label: '메트릭' },
];

export function serverPath(serverId: string, capability?: ServerCapability, targetId?: string): string {
  return [SERVERS_PATH, serverId, capability, capability && targetId]
    .filter((part): part is string => Boolean(part))
    .map((part, index) => index === 0 ? part : encodeURIComponent(part))
    .join('/');
}

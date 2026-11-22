// 연결 문구는 여기서만 만든다(DESIGN.md §9 연결 문구, CONTEXT.md). 화면마다 이어 붙이면 같은 동작의 이름이 갈린다.
//
// - 연결: 밖에서 데이터가 들어오게 만드는 일(로그, API 요청, 메트릭, 인프라, Docker).
// - 추가: EveryUp 안에서 설정만으로 만드는 대상(업타임 모니터, 서버).
// - 버튼 글자 = 대화 상자 제목. 결과는 "{대상}을/를 연결할 준비가 되었습니다", 완료는 "{대상} 보기".

/** 서버가 갖는 기능(서버 탭의 키). */
export type ConnectTarget = 'uptime' | 'infrastructure' | 'logs' | 'api' | 'metrics';

const NAME: Record<ConnectTarget, string> = {
  uptime: '업타임 모니터', infrastructure: '인프라', logs: '로그', api: 'API 요청', metrics: '메트릭',
};

// 조사는 이름의 받침에 따라 갈린다. 이름이 몇 개뿐이라 판별 함수 대신 목적격을 같이 적는다.
const OBJECT: Record<ConnectTarget, string> = {
  uptime: '업타임 모니터를', infrastructure: '인프라를', logs: '로그를', api: 'API 요청을', metrics: '메트릭을',
};

/** 화면에 쓰는 기능 이름. traces의 연결 단위는 `API 요청`이다(트레이스는 탭 이름으로만 쓴다). */
export const connectName = (target: ConnectTarget) => NAME[target];
/** 목적격(`로그를`, `API 요청을`). */
export const connectObject = (target: ConnectTarget) => OBJECT[target];
/** 시작 버튼과 대화 상자 제목. 업타임 모니터는 추가, 나머지는 연결이다. */
export const connectAction = (target: ConnectTarget) => `${NAME[target]} ${target === 'uptime' ? '추가' : '연결'}`;
/** 키와 설정을 받은 결과의 제목. */
export const connectReady = (target: ConnectTarget) => `${OBJECT[target]} 연결할 준비가 되었습니다`;
/** 기존 앱에 데이터 유형을 더한 결과의 제목. */
export const connectAttached = (target: ConnectTarget, appName: string) => `${appName}에 ${OBJECT[target]} 연결했습니다`;
/** 결과의 완료 버튼. 누르면 그 데이터가 보이는 자리로 간다. */
export const connectView = (target: ConnectTarget) => `${NAME[target]} 보기`;
/** 연결을 마친 뒤의 알림. */
export const connectDone = (target: ConnectTarget) => `${OBJECT[target]} 연결했습니다`;

/** OTel 신호의 연결 단위. traces는 API 요청이다. */
export const SIGNAL_TARGET = { logs: 'logs', traces: 'api', metrics: 'metrics' } as const satisfies Record<string, ConnectTarget>;

/**
 * Docker 환경의 수집 기능 이름. Docker의 uptime 기능은 컨테이너가 떠 있는지 보는 것이라 `컨테이너 상태`다
 * (ADR 0006: 업타임은 응답 확인만 뜻한다).
 */
export const DOCKER_CAPABILITY_NAME = {
  uptime: '컨테이너 상태', logs: '로그', infrastructure: '인프라', api: 'API 요청', metrics: '메트릭',
} as const;

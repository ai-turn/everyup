// 연결 문구는 여기서만 만든다(DESIGN.md §9 연결 문구, CONTEXT.md). 화면마다 이어 붙이면 같은 동작의 이름이 갈린다.
//
// - 연결: 밖에서 데이터가 들어오게 만드는 일(로그, API 요청, 메트릭, 인프라).
// - 추가: EveryUp 안에서 설정만으로 만드는 대상(업타임 모니터, 서버).
// - 설치: 서버에 Docker Collector를 두는 일(`Docker Collector 설치`). 서버의 기능 탭이 아니라 서버 단위라 ConnectTarget에 넣지 않는다.
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

/**
 * Docker Collector를 서버에 두는 시작 버튼과 대화 상자 제목(ADR 0012). 서버 추가의 연결 방식, 서버 개요의 `연결할 수 있는 기능`,
 * 설치 창이 같은 말을 쓴다(옛 `Docker 연결`).
 */
export const DOCKER_INSTALL = 'Docker Collector 설치';

/** OTel 신호의 연결 단위. traces는 API 요청이다. */
export const SIGNAL_TARGET = { logs: 'logs', traces: 'api', metrics: 'metrics' } as const satisfies Record<string, ConnectTarget>;

/**
 * Docker Collector의 수집 기능 이름. Docker의 uptime 기능은 컨테이너가 떠 있는지 보는 것이라 `컨테이너 상태`다
 * (ADR 0006: 업타임은 응답 확인만 뜻한다).
 */
export const DOCKER_CAPABILITY_NAME = {
  uptime: '컨테이너 상태', logs: '로그', infrastructure: '인프라', api: 'API 요청', metrics: '메트릭',
} as const;

/**
 * 연결 대화 상자의 적용 범위 한 줄(설명 바로 아래 같은 자리). 무엇에 적용되고, 서버나 앱에서 무엇을 해야 하는지를
 * 연결하기 전에 비교할 수 있게 한다(연결 진입점 정리 5번).
 */
export const APPLY_SCOPE = {
  directNew: '이 앱 하나에 적용됩니다. 앱의 OpenTelemetry 설정에 주소와 API Key를 넣고 앱을 다시 시작해야 합니다.',
  directAttach: '이 앱 하나에 적용됩니다. API Key는 그대로이고, 앱 설정에서 이 데이터의 전송을 켠 뒤 앱을 다시 시작해야 합니다.',
  infrastructure: '이 서버 하나에 적용됩니다. 서버에서 OpenTelemetry Collector를 실행해야 하고, 앱은 다시 시작하지 않아도 됩니다.',
  docker: '이 Docker 호스트 전체에 적용됩니다. 서버에서 설치 명령을 한 번 실행하면 되고, 앱은 수정하지 않습니다.',
  dockerCapability: '이 서버의 Docker Collector 전체에 적용됩니다. 서버에서 적용 명령을 한 번 실행하면 되고, 앱은 다시 시작하지 않아도 됩니다.',
  uptime: '이 모니터 하나에 적용됩니다. 서버에 설치할 것이 없습니다. EveryUp이 주소를 직접 확인합니다.',
} as const;

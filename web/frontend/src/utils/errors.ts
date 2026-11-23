/**
 * 백엔드 `error.code` → 사용자 노출 메시지.
 *
 * 번역 사전이 아니라 백엔드 계약의 표시 매핑이다. 새 에러를 추가할 때는
 * `web/backend/internal/api/handlers/errors.go` 상수와 여기를 함께 고쳐야 한다.
 */
const ERROR_MESSAGES: Record<string, string> = {
  DATABASE_ERROR: '서버 오류가 발생했습니다.',
  FETCH_ERROR: '데이터를 불러오지 못했습니다.',
  CREATE_ERROR: '생성에 실패했습니다.',
  UPDATE_ERROR: '수정에 실패했습니다.',
  DELETE_ERROR: '삭제에 실패했습니다.',
  TOGGLE_ERROR: '상태 변경에 실패했습니다.',
  SECRET_ERROR: '보안 처리에 실패했습니다.',
  HASH_ERROR: '인증 정보 처리에 실패했습니다.',
  TOKEN_ERROR: '인증 토큰 생성에 실패했습니다.',
  SEND_ERROR: '알림 전송에 실패했습니다.',
  QUERY_ERROR: '데이터 조회에 실패했습니다.',
  INVALID_REQUEST: '잘못된 요청입니다.',
  INVALID_INPUT: '입력값이 올바르지 않습니다.',
  VALIDATION_ERROR: '입력값 검증에 실패했습니다.',
  NOT_FOUND: '요청한 항목을 찾을 수 없습니다.',
  FORBIDDEN: '이 작업을 수행할 권한이 없습니다.',
  CONFIG_UNAVAILABLE: '서버 설정을 불러올 수 없습니다.',
  UPDATE_FAILED: '설정 저장에 실패했습니다.',
  UNAUTHORIZED: '인증이 필요합니다.',
  INVALID_CREDENTIALS: '사용자명 또는 비밀번호가 올바르지 않습니다.',
  ALREADY_SETUP: '이미 초기 설정이 완료되었습니다.',
  HOST_NOT_FOUND: '호스트를 찾을 수 없습니다.',
  SERVICE_NOT_FOUND: '대상을 찾을 수 없습니다.',
  PROJECT_NOT_FOUND: '그룹을 찾을 수 없습니다.',
  OBSERVED_SERVICE_NOT_FOUND: '앱 또는 컨테이너를 찾을 수 없습니다.',
  INFRASTRUCTURE_RESOURCE_NOT_FOUND: '인프라 리소스를 찾을 수 없습니다.',
  INFRASTRUCTURE_PROJECT_NOT_FOUND: '인프라 리소스에 배정할 그룹을 찾을 수 없습니다.',
  HOST_EXISTS: '이미 존재하는 호스트 ID입니다.',
  SERVICE_EXISTS: '이미 존재하는 ID입니다.',
  SERVER_NAME_TAKEN: '같은 이름의 서버가 이미 있습니다. 그룹(미분류 포함)마다 이름이 달라야 합니다.',
  SERVER_HAS_INFRASTRUCTURE: '이 서버에는 이미 인프라 리소스가 있습니다.',
  SSRF_BLOCKED: '보안상 허용되지 않는 주소입니다.',
  NO_COLLECTOR: 'Collector가 등록되지 않았습니다.',
  COLLECT_FAILED: '시스템 정보 수집에 실패했습니다.',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
  // 클라이언트 쪽 분류(백엔드 코드가 아니다): 서버에 닿지 못한 요청, 코드 없이 5xx로 끝난 요청.
  NETWORK_ERROR: '서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도하세요.',
  SERVER_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
};

// 앱이 직접 만든 오류 문구는 한국어다. 그 밖의 원문(서버의 영어 메시지, 브라우저의 `Failed to fetch`)은
// 사용자에게 그대로 보이지 않고 위 문구로 바꾼다(DESIGN.md §7 — 오류 배너의 설명은 사용자의 말이다).
const HANGUL = /[가-힣]/;
// fetch가 서버에 닿지 못하면 브라우저마다 다른 문구의 TypeError를 던진다(Chrome·Firefox·Safari).
const NETWORK_FAILURE = /Failed to fetch|NetworkError|Load failed|Network request failed/i;

/**
 * Structured API error that carries the error code from the backend.
 * Use `getErrorMessage(error)` to resolve a user-facing message.
 */
export class ApiError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Resolves a user-facing message from any error.
 *
 * Priority:
 * 1. ApiError with a known code → mapped message
 * 2. Network failure (fetch TypeError) → NETWORK_ERROR
 * 3. Any other error whose message the app wrote in Korean → that message
 * 4. ApiError with an unmapped code: 5xx → SERVER_ERROR, otherwise UNKNOWN_ERROR.
 *    The raw backend message is never shown.
 * 5. Anything else → UNKNOWN_ERROR
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code && error.code !== 'UNKNOWN_ERROR' && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }
  if (error instanceof TypeError && NETWORK_FAILURE.test(error.message)) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  if (error instanceof Error && HANGUL.test(error.message)) {
    return error.message;
  }
  if (error instanceof ApiError && error.status && error.status >= 500) {
    return ERROR_MESSAGES.SERVER_ERROR;
  }
  return ERROR_MESSAGES.UNKNOWN_ERROR;
}

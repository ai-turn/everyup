import { ApiError } from './errors';

/** 다시 읽은 대상이 이미 삭제되었다(404). 화면이 서버 데이터를 다시 불러와 지워진 대상을 뺀다. */
export class TargetGoneError extends Error {}

/**
 * 대상 전체를 보내는 수정 요청 직전에 그 대상을 다시 읽는다. 화면에 있는 객체(최대 한 주기 전, 다시 불러오기에 실패했으면 더 이전)로
 * 요청을 만들면 그 사이의 변경(일시정지, 신호 연결 해제)을 조용히 되돌린다.
 * 삭제되었으면(404) `대상이 삭제되어 <동작>할 수 없습니다`로 거부하고, 그 밖의 실패는 그대로 거부한다. 어느 쪽이든 요청을 보내지 않는다.
 */
export async function readLatest<T>(read: () => Promise<T>, action: string): Promise<T> {
  try {
    return await read();
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) throw new TargetGoneError(`대상이 삭제되어 ${action}할 수 없습니다`);
    throw cause;
  }
}

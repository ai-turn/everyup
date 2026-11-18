export type CollectionStatus = 'collecting' | 'partial' | 'delayed' | 'waiting' | 'not-configured';

// 상태 점 없이 문구만 필요한 자리(예: 서버 탭 인프라 상태 줄의 원인)도 같은 말을 쓴다.
export const COLLECTION_STATUS_LABEL: Record<CollectionStatus, string> = {
  collecting: '수집 중',
  partial: '부분 수집',
  delayed: '수집 지연',
  waiting: '수신 대기',
  'not-configured': '미설정',
};

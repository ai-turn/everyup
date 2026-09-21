// 장애 에피소드의 시간 표기. ProjectDetailPage에 로컬로 있던 것을 개요 타임라인이
// 같은 표기를 써야 해서 공용으로 뽑았다 — 두 화면이 "2시간 4분"과 "124분"처럼
// 다르게 읽히면 같은 장애인지 알아보기 어렵다.

/** 초 → 사람이 읽는 길이. 단위는 최대 두 단계까지만 붙인다. */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 ${m % 60}분`;
  return `${Math.floor(h / 24)}일 ${h % 24}시간`;
}

/** 오늘이면 시:분, 그 전이면 월/일. 목록에서 폭이 일정하게 유지된다. */
export function formatIncidentTime(iso: string): string {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

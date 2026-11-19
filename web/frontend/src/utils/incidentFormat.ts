// 장애 에피소드의 시간 표기. ProjectDetailPage에 로컬로 있던 것을 개요 타임라인이
// 같은 표기를 써야 해서 공용으로 뽑았다 — 두 화면이 "2시간 4분"과 "124분"처럼
// 다르게 읽히면 같은 장애인지 알아보기 어렵다.
//
// 화면의 시각은 ko-KR 24시간제로 고정한다(차트 축과 같다). 브라우저 로캘을 따르면
// 같은 화면에 "오전 05:21"과 "05:21 AM", "Nov 17"이 섞였다. 시간대는 브라우저를 따른다.

/** 초 → 사람이 읽는 길이. 단위는 최대 두 단계까지만 붙인다. */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 ${m % 60}분`;
  return `${Math.floor(h / 24)}일 ${h % 24}시간`;
}

const CLOCK: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
const isToday = (d: Date) => new Date().toDateString() === d.toDateString();
const monthDay = (d: Date) => d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

/** 시:분 또는 시:분:초(`05:21:53`). */
export function formatClock(value: string | number | Date, seconds = false): string {
  return new Date(value).toLocaleTimeString('ko-KR', seconds ? { ...CLOCK, second: '2-digit' } : CLOCK);
}

/** 오늘이면 시:분, 그 전이면 월/일(`11월 17일`). 목록에서 폭이 일정하게 유지된다. */
export function formatIncidentTime(iso: string): string {
  const d = new Date(iso);
  return isToday(d) ? formatClock(d) : monthDay(d);
}

/** 오늘이면 시각만, 그 전이면 날짜와 시각(`11월 17일 05:21:53`). 마지막 수집처럼 한 번 보이는 시각. */
export function formatDateTime(value: string | number | Date): string {
  const d = new Date(value);
  return isToday(d) ? formatClock(d, true) : `${monthDay(d)} ${formatClock(d, true)}`;
}

/** 연도까지 쓴 전체 시각(`2026. 11. 19. 05:21:53`). 툴팁과 감사 기록처럼 정확한 시각이 필요한 자리. */
export function formatFullDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', ...CLOCK, second: '2-digit' });
}

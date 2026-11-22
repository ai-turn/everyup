import type { UptimeOverviewStat } from './components/UptimeOverview';

const CERT_WARN_DAYS = 14;

/**
 * 대상 상세의 업타임 수치 묶음(DESIGN.md §4.7 대상 상세). 업타임 모니터와 Docker 서비스가 같은 네 칸을 쓴다:
 * 24시간·30일 업타임, 24시간 평균 응답, HTTPS면 인증서 만료(14일 이하는 주의, 지나면 오류 색). 90일 업타임은 띠 머리글에 둔다.
 */
export function uptimeKpis({ uptime24h, uptime30d, avgResponse24h, certExpiresAt }: {
  uptime24h?: number | null; uptime30d?: number | null; avgResponse24h?: number | null; certExpiresAt?: string;
}): UptimeOverviewStat[] {
  const percent = (value?: number | null) => value == null ? '-' : `${value.toFixed(2)}%`;
  const certDays = certExpiresAt ? Math.ceil((new Date(certExpiresAt).getTime() - Date.now()) / 86_400_000) : null;
  return [
    { label: '24시간 업타임', value: percent(uptime24h) },
    { label: '30일 업타임', value: percent(uptime30d) },
    { label: '평균 응답 (24시간)', value: avgResponse24h == null ? '-' : `${Math.round(avgResponse24h).toLocaleString()}ms` },
    ...(certDays === null ? [] : [{ label: '인증서 만료', value: certDays < 0 ? '만료됨' : `D-${certDays}`,
      tone: certDays < 0 ? 'error' as const : certDays <= CERT_WARN_DAYS ? 'warn' as const : undefined }]),
  ];
}

export function SummaryCard({ label, value, detail, tone = 'idle' }: {
  label: string;
  value: number;
  detail: string;
  tone?: 'healthy' | 'warn' | 'error' | 'idle';
}) {
  // 색은 **주의가 필요할 때만** 싣는다. healthy·idle은 muted로 떨어뜨린다 —
  // 카드 4장이 전부 색 문장을 달고 있으면 정작 문제인 카드가 묻히고, 전부 중립이면
  // warn/error 하나만 튄다 (§5.1 StatusLight와 같은 논리).
  //
  // 이 규칙이 기존 오용 두 건도 같이 걷어낸다: 업타임 '정상' 카드의 `전체 5개 대상 중`
  // (분모)과 개요 'Projects' 카드의 `대상을 운영 단위로 묶고 있습니다`(설명)가
  // tone=healthy를 타고 초록으로 칠해지고 있었다. 둘 다 상태가 아니다.
  const detailClass = tone === 'warn' ? 'text-status-warn'
    : tone === 'error' ? 'text-status-error'
    : 'text-text-muted';

  // 아이콘은 뺐다 — 톤이 아이콘과 설명 문장 양쪽에 중복으로 칠해지고 있었고,
  // 종류는 라벨이 이미 말한다. 우측 상단에 혼자 떠 있던 자리를 숫자가 대신 쓴다.
  return (
    <article className="rounded-xl border border-ui-border bg-bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate type-label text-text-secondary">{label}</p>
        <p className="shrink-0 font-mono text-2xl tabular-nums text-text-base">{value}</p>
      </div>
      <p className={`mt-2 type-caption ${detailClass}`}>{detail}</p>
    </article>
  );
}

// 알림 severity 배지 — 규칙 표·발송 이력·모바일 카드·규칙 폼 미리보기가 같은 배지를 쓴다.
// 색은 severityLabel.ts의 SEVERITY_TONE 하나에서 온다(A-16, DESIGN §1.5·§5.1b).

import { severityLabel, severityTone } from '../utils/severityLabel';

export function SeverityBadge({ severity }: { severity: string }) {
    return (
        <span className={`badge ${severityTone(severity).badge}`}>
            {severityLabel(severity)}
        </span>
    );
}

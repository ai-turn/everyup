import { Button, DetailMeta, MaterialIcon, StatusLight, type DetailMetaField } from '../../../components/common';
import type { ReactNode } from 'react';
import { formatDateTime } from '../../../utils/incidentFormat';
import type { PanelStatus } from '../../servers/serverStatus';

// 서버 탭의 직접 연결(Logs·Metrics·API·Collector) 상세의 연결 메타데이터. 수집 키·마지막 수집은
// 대상의 속성이지 본문이 아니라서 카드가 아니라 제목 아래 DetailMeta로 둔다.
interface DirectConnectionMetaProps {
  isActive: boolean;
  apiKeyMasked?: string;
  lastSeenAt?: string | null;
  /** 신호 목록(직접 서비스) 또는 어댑터(Collector) */
  detail: { label: string; value: string };
  onRotateKey: () => void;
  /** 수집 중일 때만 — 상태 옆에 붙는 연결 중지 */
  onRevoke: () => void;
  /** 기능별 설정 — 로그의 수집 레벨처럼 그 상세에만 있는 칸 */
  extraFields?: DetailMetaField[];
  /** 좁은 화면에서 속성 목록을 접는다 — 본문(로그 목록)이 첫 화면 밖으로 밀리는 상세용 */
  collapseOnMobile?: boolean;
  collapseLabel?: string;
  /** 모든 폭에서 속성 목록을 접는다(서버 탭) */
  collapsed?: boolean;
  /** 상태 바로 뒤에 붙는 설명(예: 확인 필요의 원인) */
  statusDetail?: ReactNode;
  /** 상태 줄 오른쪽 끝(기간 선택, 조작). 좁으면 상태 줄 아래로 흐른다. */
  statusAside?: ReactNode;
  /** 탭이 정한 상태(탭의 상태 점과 같은 판정). 이전 정보이면 마지막 수집 시각을 숨긴다. */
  status: PanelStatus;
}

export function DirectConnectionMeta({
  isActive,
  apiKeyMasked,
  lastSeenAt,
  detail,
  onRotateKey,
  onRevoke,
  extraFields = [],
  collapseOnMobile = false,
  collapseLabel,
  collapsed = false,
  statusDetail,
  statusAside,
  status,
}: DirectConnectionMetaProps) {
  return (
    <DetailMeta
      collapseOnMobile={collapseOnMobile}
      collapseLabel={collapseLabel}
      collapsed={collapsed}
      status={
        <>
          <StatusLight tone={status.tone} label={status.label} />
          {status.detail && <span>{status.detail}</span>}
          {statusDetail}
          {!status.stale && <span>마지막 수집 {lastSeenAt ? formatDateTime(lastSeenAt) : '아직 없음'}</span>}
          {/* 상태와 그 상태를 바꾸는 액션을 붙여 둔다 — 수집 키 옆 키 재발급과 같은 원리 */}
          {isActive && <Button variant="ghost" onClick={onRevoke}><MaterialIcon name="block" />연결 중지</Button>}
          {statusAside && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{statusAside}</div>}
        </>
      }
      fields={[
        {
          label: 'API Key',
          value: (
            <>
              <span className="truncate font-mono">{apiKeyMasked || '마스킹된 키 없음'}</span>
              <Button variant="ghost" className="ml-auto" onClick={onRotateKey}><MaterialIcon name="key" />키 재발급</Button>
            </>
          ),
        },
        // mono 아님 — 신호 목록('logs, metrics')도 어댑터명('OpenTelemetry Collector')도
        // 복사해 쓰는 코드가 아니라 읽는 값이다. 코드인 수집 키만 mono로 둔다.
        { label: detail.label, value: detail.value },
        ...extraFields,
      ]}
    />
  );
}

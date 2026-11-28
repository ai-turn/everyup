import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from './MaterialIcon';

// 두 줄 목록 — 개요의 현재 확인 필요·최근 장애 이력, Docker 환경의 장애 이력, 로그의 반복 패턴이 같이 쓴다.
// 세로 위계(DESIGN.md §3.7): 항목 안 4 < 라벨 → 항목 8 < 제목 → 내용 16 < 항목 사이 20 ≤ 그룹 사이 24.
// 행은 hover 채움 때문에 px-3 py-2.5를 갖고, 목록(`List`)이 그만큼 사방으로 펼쳐져(list-bleed) 글자는 본문 정렬선에,
// 앞뒤 간격은 토큰 값 그대로 보인다. 이전에는 화면마다 따로 만들어 항목 안 1~2px, 항목 사이 7~24px로 갈렸다.

/** 목록 자체. 넓은 화면에서 행의 오른쪽 값(시각, 개수)이 이름에서 멀어지지 않게 글자 폭 720px까지만 쓴다. */
export function List({ children, label }: { children: ReactNode; label?: string }) {
  return <ul aria-label={label} className="list-bleed max-w-186">{children}</ul>;
}

export function ListRow({ to, marker, title, detail, detailSize = 'body', trailing, trailingDetail }: {
  to: string;
  /** 첫 줄 앞의 표지(아이콘, 상태 점, 레벨). 20px 열이고 첫 줄의 가운데에 맞는다. */
  marker: ReactNode;
  /** 첫 줄. 문자열이면 type-label(14/20/500)로 말줄임한다. 다른 모양이 필요하면 노드를 넘긴다. */
  title: ReactNode;
  /** 둘째 줄. body는 설명형 문장(14/21), caption은 메타 묶음(12/18). 둘 다 text-muted다. */
  detail?: ReactNode;
  detailSize?: 'body' | 'caption';
  /** 첫 줄 오른쪽(시각, 개수, 상태). */
  trailing?: ReactNode;
  /** 둘째 줄 오른쪽(경과 시간). */
  trailingDetail?: ReactNode;
}) {
  return (
    <li>
      <Link to={to} className="flex gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-surface-hover">
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center">{marker}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-3">
            <span className="min-w-0 flex-1 truncate type-label text-text">{title}</span>
            {trailing != null && <span className="shrink-0 whitespace-nowrap type-caption tabular-nums text-text-muted">{trailing}</span>}
          </span>
          {detail != null && (
            // 항목 안 4px: 두 줄 사이의 보이는 간격. 줄 상자(20/21) 위의 mt-0.5다.
            <span className={`mt-0.5 flex items-baseline gap-3 text-text-muted ${detailSize === 'body' ? 'type-body' : 'type-caption-stack'}`}>
              <span className="min-w-0 flex-1 truncate">{detail}</span>
              {trailingDetail != null && <span className="shrink-0 whitespace-nowrap type-caption tabular-nums">{trailingDetail}</span>}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

/**
 * 목록 끝의 펼치기 조작. 목록 항목이 아니라 목록 뒤에 둔다(항목 수에 세지 않는다). 행과 같은 모양이라
 * 아이콘은 표지 열, 글자는 항목 제목 열에 선다. 자리(마지막 항목과 20px)는 `ListGroup`의 footer 자리가 정한다.
 */
export function ListMore({ expanded, label, onToggle }: { expanded: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left type-label-sm text-text transition-colors hover:bg-surface-hover sm:min-h-0">
      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center"><MaterialIcon name={expanded ? 'expand_less' : 'expand_more'} /></span>
      {label}
    </button>
  );
}

/** 하위 그룹 라벨의 글자(14/20/500, secondary). 담긴 카드·항목의 제목(16·14 base)과 크기·색으로 구분하고, 라벨 → 내용은 8px다(DESIGN.md §3.7). */
export const SUBGROUP_LABEL = 'type-label text-text';

/** 섹션 안의 하위 그룹(개요의 장애, 확인 필요). 라벨 → 항목 8px, 그룹 사이는 부모의 space-y-6(24px)이다. */
export function ListGroup({ id, label, footer, children }: { id: string; label: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id}>
      <h3 id={id} data-gap-after="label" className={`mb-label ${SUBGROUP_LABEL}`}>{label}</h3>
      <List>{children}</List>
      {/* 목록 끝 조작(ListMore)의 자리(list-more): 목록(list-bleed)의 아래 -10px을 되돌려 마지막 항목과 20px, 행처럼 좌우로 펼치고
          그룹 끝에서 버튼의 아래 패딩을 거둔다. */}
      {footer && <div className="list-more max-w-186">{footer}</div>}
    </div>
  );
}

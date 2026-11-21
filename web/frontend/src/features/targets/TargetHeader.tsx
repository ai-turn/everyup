import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  DetailMeta, MaterialIcon, PageHeader, RefreshStatus, TimeRangePicker, type DetailMetaField, type GlobalTimeRange,
} from '../../components/common';
import { useBreadcrumb, useHeaderActionSlot } from '../../contexts/BreadcrumbContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export type TargetConnectionKind = 'docker' | 'otel' | 'uptime';

const KIND: Record<TargetConnectionKind, { label: string; icon: string }> = {
  docker: { label: 'Docker Collector', icon: 'deployed_code' },
  otel: { label: '직접 OpenTelemetry', icon: 'hub' },
  uptime: { label: '업타임 모니터', icon: 'monitor_heart' },
};

export interface TargetConnection {
  kind: TargetConnectionKind;
  /** 방식 뒤에 붙는 짧은 설명: Docker 환경 이름, 받는 신호, 체크 방식과 간격. */
  detail?: ReactNode;
  /** 방식마다 하나: 데이터를 더하거나 연결을 고치는 곳으로 간다. */
  action?: { label: string; to?: string; onClick?: () => void; disabled?: boolean };
}

interface RefreshProps {
  updatedAt: Date | null;
  onRefresh: () => void;
  refreshing?: boolean;
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
}

/**
 * 대상(업타임 모니터, 직접 연결 앱, Docker 서비스) 상세의 머리말 하나(DESIGN.md §4.7 대상 상세). 연결 방식과 상관없이 같은 모양이다:
 * 제목 → 상태 줄(오른쪽 끝 갱신 상태) → 연결 줄 → 접히는 속성, 제목 줄 오른쪽에 주 조작과 더보기, 머리말 오른쪽 칸에 기간 선택.
 * 좁은 화면의 갱신 상태는 기간 선택과 같은 줄(없으면 복귀 링크와 같은 줄)이다.
 */
export function TargetHeader({ title, crumbs, back: backLink, status, connection, fields, fieldsLabel, actions, range, onRangeChange, refresh }: {
  title: string;
  /** 위 단계들(마지막이 복귀 링크). 제목은 이 뒤에 붙는다. */
  crumbs: { label: string; to: string }[];
  /** 좁은 화면의 복귀 링크. 목록(검색·보기 방식 포함)에서 열었으면 그 목록이다. 없으면 크럼의 마지막 단계다. */
  back?: { label: string; to: string };
  status: ReactNode;
  connection: TargetConnection;
  fields?: DetailMetaField[];
  fieldsLabel?: string;
  actions?: ReactNode;
  range?: GlobalTimeRange;
  onRangeChange?: (range: GlobalTimeRange) => void;
  refresh: RefreshProps;
}) {
  useBreadcrumb([...crumbs, { label: title }]);
  const back = backLink ?? crumbs[crumbs.length - 1];
  // 목록에서 열었으면 넓은 화면에서도 그 목록(검색·보기 방식 포함)으로 돌아가는 링크를 상단 바 오른쪽에 둔다. 크럼은 위치만 말하고
  // 목록의 상태를 모른다. 상단 바에 두면 본문의 높이를 쓰지 않는다.
  const slot = useHeaderActionSlot();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const linkClass = 'inline-flex min-h-11 items-center gap-1.5 type-control text-text-muted transition-colors hover:text-action';
  const refreshStatus = <RefreshStatus {...refresh} />;
  return (
    <header>
      {backLink && desktop && slot && createPortal(
        <Link to={backLink.to} className={`${linkClass} sm:min-h-6`}><MaterialIcon size={20} name="arrow_back" />{backLink.label}</Link>, slot)}
      {/* 좁은 화면(lg 미만)의 첫 줄: 복귀 링크와, 그 오른쪽 끝에 연결 방식(아이콘 + 방식 + 조작)을 한 줄로 둔다. 연결 줄을 따로 두면
          탭 줄이 52px 더 내려갔다(2026-11-21). 세부(환경 이름, 받는 신호)는 넓은 화면의 연결 줄에만 있다. 갱신 상태는 기간 선택과
          같은 줄이고, 기간 선택이 없는 대상은 연결 방식 대신 이 줄에 둔다. */}
      <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
        <Link to={back.to} className={`${linkClass} min-w-0`}>
          <MaterialIcon size={20} name="arrow_back" /><span className="truncate">{back.label}</span>
        </Link>
        {range ? <ConnectionLine connection={connection} compact /> : refreshStatus}
      </div>
      <PageHeader
        title={title}
        meta={
          <DetailMeta
            collapseOnMobile
            collapseLabel={fieldsLabel}
            status={<>{status}<div className="ml-auto max-lg:hidden">{refreshStatus}</div></>}
            connection={<div className="max-lg:hidden"><ConnectionLine connection={connection} /></div>}
            fields={fields}
          />
        }
        actions={actions}
        aside={range && onRangeChange && (
          <div className="flex flex-wrap items-center justify-between gap-3 xl:justify-end">
            <TimeRangePicker value={range} onChange={onRangeChange} />
            <div className="lg:hidden">{refreshStatus}</div>
          </div>
        )}
      />
    </header>
  );
}

/** 연결 방식 한 줄. `compact`는 좁은 화면의 복귀 링크 줄 오른쪽에 들어가는 꼴이다: 세부 없이 아이콘·방식·조작만. */
function ConnectionLine({ connection, compact = false }: { connection: TargetConnection; compact?: boolean }) {
  const kind = KIND[connection.kind];
  const action = connection.action;
  const actionClass = 'inline-flex min-h-11 shrink-0 items-center text-action link-underline sm:min-h-6';
  return (
    <p data-connection={connection.kind} className={`flex min-w-0 items-center gap-x-3 gap-y-1 type-caption text-text-muted ${compact ? 'justify-end' : 'flex-wrap'}`}>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <MaterialIcon size={16} name={kind.icon} className="shrink-0" />
        {/* 좁은 화면에서는 "연결"을 화면 낭독기에만 읽힌다: 아이콘과 방식 이름이 같은 말을 한다. */}
        <span className={compact ? 'sr-only' : ''}>연결 </span><span className="truncate text-text-secondary">{kind.label}</span>
      </span>
      {!compact && connection.detail && <span>{connection.detail}</span>}
      {action && (action.to
        ? <Link to={action.to} className={actionClass}>{action.label}</Link>
        : <button type="button" onClick={action.onClick} disabled={action.disabled} className={`${actionClass} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}>{action.label}</button>)}
    </p>
  );
}

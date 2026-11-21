import React from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useHeaderActionSlot, useRegisterMenuTitle } from '../../contexts/BreadcrumbContext';
import { ControlDefaultsContext } from './controlSize';
import { Tooltip } from './Tooltip';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    /** 제목이 가리키는 대상의 메타데이터. 헤더 띠 안, 설명 아래. 상세 화면은 `DetailMeta`를 쓴다. */
    meta?: React.ReactNode;
    /** 넓은 화면에서 제목·메타데이터 우측에 놓을 대상 제어와 요약. */
    aside?: React.ReactNode;
    /**
     * 상세 화면의 대상 조작(새로고침, 설정, 편집, 파괴). 제목 줄 오른쪽에 두고 제목과 세로 가운데를 맞춘다.
     * 조작만 담은 줄을 머리말 아래에 따로 두지 않는다(DESIGN.md §4.1 액션 앵커) — 본문 위에 빈 줄이 하나 더 생겼다.
     */
    actions?: React.ReactNode;
    children?: React.ReactNode;
    /** 조작을 제목과 같은 줄에 둔다(상세·전체 로그). 메뉴 첫 화면(`menu`)은 늘 그렇다. */
    compactActions?: boolean;
    /** 긴 제목을 한 줄로 말줄임한다(compactActions와 함께: 버튼이 줄어들지 않고 제목이 줄어든다). 기본은 줄바꿈. */
    truncateTitle?: boolean;
    /**
     * 메뉴 첫 화면(DESIGN.md §3.4). 데스크톱(`lg`+)의 제목은 `AppHeader` 하나다: 크럼을 페이지 제목 크기(개수 포함)로
     * 그리고, 본문 h1은 시각적으로만 숨긴다(`lg:sr-only`). 주 액션(children)과 meta도 `AppHeader` 오른쪽으로 옮긴다 —
     * 위치·제목·액션이 한 줄이 되고 본문 위 빈 띠가 사라진다. 모바일은 `AppHeader`가 없어 그대로 그린다.
     * 상세 화면은 제목이 대상 이름·상태를 이끌므로 쓰지 않는다.
     */
    menu?: boolean;
    /**
     * 제목 뒤의 개수(`서버 9`). 한 목록이 화면의 전부인 메뉴만 준다(탭이 목록을 나누는 알림은 탭이 개수를 말한다).
     * `null`은 아직 모르는 개수다: 숫자 자리만 비운다.
     */
    count?: number | null;
}

const DESKTOP_HEADER = { size: 'sm', variant: 'secondary' } as const;
const MOBILE_MENU = { variant: 'secondary' } as const;

export function PageHeader({ title, subtitle, meta, aside, actions, children, compactActions = false, truncateTitle = false, menu = false, count }: PageHeaderProps) {
    const desktop = useMediaQuery('(min-width: 1024px)');
    const slot = useHeaderActionSlot();
    useRegisterMenuTitle(menu, count);
    const headerSlot = menu && desktop ? slot : null;
    const inlineChildren = headerSlot || !children ? undefined
        : menu ? <ControlDefaultsContext.Provider value={MOBILE_MENU}>{children}</ControlDefaultsContext.Provider> : children;
    // meta 안의 조작(개요의 새로고침)도 children과 같이 모바일에서 테두리 버튼이 기본이다.
    const inlineMeta = headerSlot || !meta ? undefined
        : menu ? <ControlDefaultsContext.Provider value={MOBILE_MENU}>{meta}</ControlDefaultsContext.Provider> : meta;

    // h1만 남으면(sr-only) 데스크톱에서 띠의 여백·구분선을 0으로 접는다.
    // lg:hidden으로 감추면 sr-only h1까지 접근성 트리에서 빠진다.
    const inlineRow = compactActions || menu;
    const collapseOnDesktop = menu && !subtitle && !aside && !actions && !inlineChildren && !inlineMeta;
    const titleClass = `${truncateTitle ? 'min-w-0 truncate' : 'wrap-anywhere'} type-page-title text-text-base ${menu ? 'lg:sr-only' : ''}`;
    const heading = count === undefined || count === null ? title
        : <>{title} <span className="font-medium tabular-nums text-text-muted">{count}</span></>;

    return (
        <>
            {headerSlot && (meta || children) && createPortal(<ControlDefaultsContext.Provider value={DESKTOP_HEADER}>{meta}{children}</ControlDefaultsContext.Provider>, headerSlot)}
            <div className={`mb-6 border-b border-ui-border-soft pb-5 ${collapseOnDesktop ? 'lg:mb-0 lg:border-b-0 lg:pb-0' : ''} ${aside ? 'flex flex-col gap-item xl:flex-row xl:items-start xl:gap-group' : ''}`}>
                {/* 제목·부제 → 아래 메타 줄 8px(label). */}
                <div className="min-w-0 flex-1 space-y-label">
                <div>
                    {/* 제목 줄에 조작이 있으면 줄 높이를 버튼 높이(40px)로 두고 가운데를 맞춘다. aside는 넓은 화면에서
                        제목 옆 위쪽에 붙으므로 같은 높이의 줄을 두어 첫 조작 줄과 가운데가 맞게 한다(32px 제목 + 40px 조작은 4px 어긋났다). */}
                    {/* 메뉴 첫 화면(모바일)은 조작이 제목 줄 오른쪽이고, 자리가 없으면 다음 줄 오른쪽으로 접힌다(DESIGN.md §3.4). */}
                    <div className={menu ? 'flex flex-wrap items-center justify-between gap-x-3 gap-y-2'
                        : compactActions ? 'flex items-center justify-between gap-3'
                        : actions ? 'flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-2'
                        : aside ? 'xl:flex xl:min-h-10 xl:items-center' : ''}>
                        {/* 말줄임한 제목은 서버 설명처럼 공통 툴팁으로 전체를 보인다. */}
                        {truncateTitle ? <Tooltip content={title}><h1 className={titleClass}>{heading}</h1></Tooltip> : <h1 className={titleClass}>{heading}</h1>}
                        {inlineRow && inlineChildren && <div className="ml-auto flex shrink-0 items-center gap-2">{inlineChildren}</div>}
                        {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>}
                    </div>
                    {(subtitle || (!inlineRow && inlineChildren)) && (
                        <div className="mt-intra flex flex-col gap-heading md:flex-row md:items-center">
                            {subtitle && <p className="min-w-0 type-body text-text-muted max-w-2xl">{subtitle}</p>}
                            {!inlineRow && inlineChildren && (
                                <div className="flex w-full flex-col gap-label sm:flex-row sm:flex-wrap sm:items-center md:ml-auto md:w-auto md:shrink-0 md:justify-end">
                                    {inlineChildren}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                    {inlineMeta}
                </div>
                {aside && <div className="min-w-0 space-y-heading xl:max-w-[max(24rem,calc(100%_-_36rem))] xl:shrink-0">{aside}</div>}
            </div>
        </>
    );
}

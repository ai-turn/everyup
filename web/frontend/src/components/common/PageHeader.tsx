import React from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useHeaderActionSlot } from '../../contexts/BreadcrumbContext';
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
     * 메뉴 첫 화면(DESIGN.md §3.4, G안). 제목 줄은 h1 + 개수 + 오른쪽 주 액션(children) 한 줄이다. 갱신 상태(meta)는
     * 데스크톱에서 `AppHeader` 오른쪽으로 옮긴다. 모바일은 `AppHeader`가 없어 제목 아래에 그린다.
     */
    menu?: boolean;
    /**
     * 제목 뒤의 개수(`서버 9`). 한 목록이 화면의 전부인 메뉴만 준다(탭이 목록을 나누는 알림은 탭이 개수를 말한다).
     * `null`은 아직 모르는 개수다: 숫자 자리만 비운다.
     */
    count?: number | null;
    /** 제목 옆의 흐린 짧은 요약(G안 `13개 서버 · 24시간`). 제목 이름에는 들어가지 않는다. */
    titleNote?: string;
}

// 제목 줄의 주 액션은 primary(G안 `서버 추가`, 무채색 채움)다. 넓은 화면에서는 32px.
const DESKTOP_HEADER = { size: 'sm' } as const;
const MOBILE_MENU = {} as const;

export function PageHeader({ title, subtitle, meta, aside, actions, children, compactActions = false, truncateTitle = false, menu = false, count, titleNote }: PageHeaderProps) {
    const desktop = useMediaQuery('(min-width: 1024px)');
    const slot = useHeaderActionSlot();
    const headerSlot = menu && desktop ? slot : null;
    const inlineChildren = !children ? undefined
        : menu ? <ControlDefaultsContext.Provider value={desktop ? DESKTOP_HEADER : MOBILE_MENU}>{children}</ControlDefaultsContext.Provider> : children;
    // meta 안의 조작(개요의 새로고침)도 children과 같이 모바일에서 테두리 버튼이 기본이다.
    const inlineMeta = headerSlot || !meta ? undefined
        : menu ? <ControlDefaultsContext.Provider value={MOBILE_MENU}>{meta}</ControlDefaultsContext.Provider> : meta;

    const inlineRow = compactActions || menu;
    const titleClass = `${truncateTitle ? 'min-w-0 truncate' : 'wrap-anywhere'} type-page-title text-text`;
    // 개수는 제목 옆의 흐린 숫자다(G안 `서버 13개`). 접근성 이름은 `서버 13`.
    const heading = count === undefined || count === null ? title
        : <>{title} <span className="type-body tabular-nums text-text-faint">{count}</span></>;

    return (
        <>
            {headerSlot && meta && createPortal(<ControlDefaultsContext.Provider value={DESKTOP_HEADER}>{meta}</ControlDefaultsContext.Provider>, headerSlot)}
            <div className={`mb-6 ${aside ? 'flex flex-col gap-item xl:flex-row xl:items-start xl:gap-group' : ''}`}>
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
                        {titleNote && <span className={`type-body tabular-nums text-text-faint ${inlineRow ? 'mr-auto' : ''}`}>{titleNote}</span>}
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

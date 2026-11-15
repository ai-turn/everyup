import React from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useHeaderActionSlot } from '../../contexts/BreadcrumbContext';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    /** 제목이 가리키는 대상의 메타데이터. 헤더 띠 안, 설명 아래. 상세 화면은 `DetailMeta`를 쓴다. */
    meta?: React.ReactNode;
    /** 넓은 화면에서 제목·메타데이터 우측에 놓을 대상 제어와 요약. */
    aside?: React.ReactNode;
    children?: React.ReactNode;
    /** 목록의 주 액션을 좁은 화면에서도 제목 옆에 둔다. */
    compactActions?: boolean;
    /**
     * 메뉴 첫 화면(DESIGN.md §3.4). 데스크톱(`lg`+)은 `AppHeader` 크럼이 이름을 이미 말하므로 h1을
     * 시각적으로만 숨기고(`lg:sr-only`), 주 액션(children)과 meta는 `AppHeader` 오른쪽으로 옮긴다 —
     * 위치와 액션이 한 줄이 되고 본문 위 빈 띠가 사라진다. 모바일은 `AppHeader`가 없어 그대로 그린다.
     * 상세 화면은 제목이 대상 이름·상태를 이끌므로 쓰지 않는다.
     */
    menu?: boolean;
}

export function PageHeader({ title, subtitle, meta, aside, children, compactActions = false, menu = false }: PageHeaderProps) {
    const desktop = useMediaQuery('(min-width: 1024px)');
    const slot = useHeaderActionSlot();
    const headerSlot = menu && desktop ? slot : null;
    const inlineChildren = headerSlot ? undefined : children;
    const inlineMeta = headerSlot ? undefined : meta;

    // h1만 남으면(sr-only) 데스크톱에서 띠의 여백·구분선을 0으로 접는다.
    // lg:hidden으로 감추면 sr-only h1까지 접근성 트리에서 빠진다.
    const collapseOnDesktop = menu && !subtitle && !aside && !inlineChildren && !inlineMeta;
    const titleClass = `wrap-anywhere type-page-title text-text-base ${menu ? 'lg:sr-only' : ''}`;

    return (
        <>
            {headerSlot && (meta || children) && createPortal(<>{meta}{children}</>, headerSlot)}
            <div className={`mb-6 border-b border-ui-border-soft pb-5 ${collapseOnDesktop ? 'lg:mb-0 lg:border-b-0 lg:pb-0' : ''} ${aside ? 'flex flex-col gap-5 xl:flex-row xl:items-start xl:gap-6' : ''}`}>
                <div className="min-w-0 flex-1">
                    <div className={compactActions ? 'flex items-center justify-between gap-3' : ''}>
                        <h1 className={titleClass}>{title}</h1>
                        {compactActions && inlineChildren && <div className="flex shrink-0 items-center gap-2">{inlineChildren}</div>}
                    </div>
                    {(subtitle || (!compactActions && inlineChildren)) && (
                        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center">
                            {subtitle && <p className="min-w-0 type-body text-text-muted max-w-2xl">{subtitle}</p>}
                            {!compactActions && inlineChildren && (
                                // 메뉴 첫 화면은 갱신 같은 보조 조작이 주 액션 앞에 온다 — 좁은 화면에서 쌓지 않고
                                // 한 줄에 두고 마지막(주 액션)이 남은 폭을 채운다. 하나뿐이면 예전처럼 꽉 찬다.
                                <div className={`flex w-full gap-2 sm:flex-row sm:flex-wrap sm:items-center md:ml-auto md:w-auto md:shrink-0 md:justify-end ${menu ? 'flex-wrap items-center *:last:grow sm:*:last:grow-0' : 'flex-col'}`}>
                                    {inlineChildren}
                                </div>
                            )}
                        </div>
                    )}
                    {inlineMeta && <div className="mt-3">{inlineMeta}</div>}
                </div>
                {aside && <div className="min-w-0 space-y-4 xl:max-w-[max(24rem,calc(100%_-_36rem))] xl:shrink-0">{aside}</div>}
            </div>
        </>
    );
}

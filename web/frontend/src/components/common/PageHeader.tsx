import React from 'react';

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
     * 메뉴 첫 화면. 데스크톱(`lg`+)은 `AppHeader` 크럼이 같은 이름을 이미 보여 주므로 h1을
     * 시각적으로만 숨기고(`lg:sr-only`) 설명·주 액션이 첫 줄로 올라온다. 모바일은 `AppHeader`가
     * 없어 h1이 유일한 위치 표시라 그대로 보인다. 상세 화면은 제목이 대상 이름·상태를 이끌므로 쓰지 않는다.
     */
    menu?: boolean;
}

export function PageHeader({ title, subtitle, meta, aside, children, compactActions = false, menu = false }: PageHeaderProps) {
    const titleClass = `wrap-anywhere type-page-title text-text-base ${menu ? 'lg:sr-only' : ''}`;
    const subtitleClass = 'min-w-0 type-body text-text-muted max-w-2xl';
    return (
        <div className={`mb-6 border-b border-ui-border-soft pb-5 ${aside ? 'flex flex-col gap-5 xl:flex-row xl:items-start xl:gap-6' : ''}`}>
            <div className="min-w-0 flex-1">
                {compactActions ? (
                    // 제목·액션이 한 줄, 설명은 그 아래. menu면 lg에서 h1이 흐름에서 빠지고(sr-only는 absolute)
                    // 설명이 제목 자리(1행 1열)로 올라가 액션과 한 줄이 된다.
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
                        <h1 className={`col-start-1 row-start-1 ${titleClass}`}>{title}</h1>
                        {children && <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-2">{children}</div>}
                        {subtitle && <p className={`col-span-2 mt-2 ${menu ? 'lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:mt-0' : ''} ${subtitleClass}`}>{subtitle}</p>}
                    </div>
                ) : (
                    <>
                        <h1 className={titleClass}>{title}</h1>
                        {(subtitle || children) && (
                            <div className={`mt-2 flex flex-col gap-4 md:flex-row md:items-center ${menu ? 'lg:mt-0' : ''}`}>
                                {subtitle && <p className={subtitleClass}>{subtitle}</p>}
                                {children && (
                                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center md:ml-auto md:w-auto md:shrink-0 md:justify-end">
                                        {children}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
                {meta && <div className="mt-3">{meta}</div>}
            </div>
            {aside && <div className="min-w-0 space-y-4 xl:max-w-[max(24rem,calc(100%_-_36rem))] xl:shrink-0">{aside}</div>}
        </div>
    );
}

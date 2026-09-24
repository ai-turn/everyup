import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    /** 제목이 가리키는 대상의 메타데이터. 헤더 띠 안, 설명 아래. 상세 화면은 `DetailMeta`를 쓴다. */
    meta?: React.ReactNode;
    children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, meta, children }: PageHeaderProps) {
    return (
        <div className="mb-6 border-b border-ui-border pb-5">
            <h1 className="type-page-title text-text-base">{title}</h1>
            {(subtitle || children) && (
                <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center">
                    {subtitle && (
                        <p className="min-w-0 type-body text-text-muted max-w-2xl">
                            {subtitle}
                        </p>
                    )}
                    {children && (
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center md:ml-auto md:w-auto md:shrink-0 md:justify-end">
                            {children}
                        </div>
                    )}
                </div>
            )}
            {meta && <div className="mt-3">{meta}</div>}
        </div>
    );
}

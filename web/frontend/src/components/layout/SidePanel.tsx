import { useRef } from 'react';
import { IconButton, MaterialIcon } from '../common';
import { useSidePanel } from '../../contexts/SidePanelContext';
import { useOverlay, SCRIM_PANEL } from '../../hooks/useOverlay';

export function SidePanel() {
    const { isOpen, title, content, size, closePanel } = useSidePanel();
    const widthClass =
        size === 'wide'
            ? 'w-full sm:w-[560px] lg:w-[820px] xl:w-[980px]'
            : 'w-full sm:w-[500px] lg:w-[600px]';
    const panelRef = useRef<HTMLDivElement>(null);

    useOverlay(isOpen, closePanel, panelRef);

    return (
        <>
            {/* Mobile Backdrop - only visible/active on mobile when panel is open */}
            <div
                className={`fixed inset-0 z-40 transition-opacity duration-500 lg:hidden ${SCRIM_PANEL} ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={closePanel}
                aria-hidden="true"
            />

            {/* Side Panel */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="side-panel-title"
                aria-hidden={!isOpen}
                inert={!isOpen || undefined}
                tabIndex={-1}
                className={`
          fixed inset-y-0 right-0 z-50 ${widthClass}
          bg-bg-surface border-l border-ui-border
          shadow-lg transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}
                style={{
                    transitionProperty: 'transform'
                }}
            >
                {/* Header */}
                <div className="flex-none flex items-center justify-between px-6 h-16 border-b border-ui-border bg-bg-surface z-10 transition-colors duration-200">
                    <div className="flex items-center gap-3 min-w-0">
                        <MaterialIcon name="apps" className="text-text-dim shrink-0" />
                        <h2 id="side-panel-title" className="type-card-title text-text-base truncate">
                            {title}
                        </h2>
                    </div>
                    <IconButton icon="close" label="닫기" tone="quiet" onClick={closePanel} className="-mr-2" />
                </div>

                {/* Content — forms provide their own scroll area + footer */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {content}
                </div>
            </div>
        </>
    );
}

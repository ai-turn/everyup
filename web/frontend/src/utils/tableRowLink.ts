import type { MouseEvent as ReactMouseEvent } from 'react';

const INTERACTIVE = 'a,button,input,select,textarea,summary,label,[role="button"],[role="switch"],[role="combobox"],[contenteditable]:not([contenteditable="false"])';

function followRowLink(event: ReactMouseEvent<HTMLTableRowElement>) {
  if (event.defaultPrevented || !(event.target instanceof Element) || event.target.closest(INTERACTIVE)) return;
  if ((event.type === 'click' && event.button !== 0) || (event.type === 'auxclick' && event.button !== 1)) return;
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode)) return;
  const link = event.currentTarget.querySelector<HTMLAnchorElement>('a[data-row-link]');
  if (!link) return;

  event.preventDefault();
  if (event.button === 1 || event.ctrlKey || event.metaKey || event.shiftKey) {
    window.open(link.href, '_blank', 'noopener,noreferrer');
  } else {
    // 기존 Link가 보존하는 Router state와 뒤로가기 경로를 사용한다.
    link.click();
  }
}

// tr의 시맨틱은 유지한다. 키보드는 셀 안의 기본 링크와 관리 버튼을 그대로 사용한다.
export const tableRowLinkHandlers = { onClick: followRowLink, onAuxClick: followRowLink };

import { useEffect, type RefObject } from 'react';

/* 오버레이 배경(scrim) — 역할별 2단.
 *
 * 농도가 Material Design 3(32%)이나 shadcn(80%)과 다른 이유는 **blur를 같이 걸기 때문**이다.
 * scrim만 쓰는 시스템은 배경을 읽지 못하게 하려고 60~80%가 필요하지만, backdrop-blur가
 * 판독을 이미 막으므로 scrim은 명도만 낮추면 된다 — 그 구간이 30~40%다.
 *
 * bg-black이 아니라 slate-900인 것도 의도다. 다크 배경(#0d1117) 위에서 순수 검정은
 * 대비가 생기지 않아 구멍처럼 보이고, 앱 팔레트가 slate 계열이라 정합도 맞다. */

/** 모달·다이얼로그 — 배경과 무관한 작업이라 맥락을 끊는다. */
export const SCRIM_MODAL = 'bg-slate-900/60 backdrop-blur-sm';

/** 사이드패널·팔레트 — 배경 목록을 보면서 상세를 확인하는 맥락이라 옅게. */
export const SCRIM_PANEL = 'bg-slate-900/40 backdrop-blur-sm';

/** 네이티브 `<dialog>`의 ::backdrop용 — SCRIM_MODAL과 같은 값이다.
 *  유틸리티마다 `backdrop:` 접두가 필요하고 Tailwind JIT는 런타임 조합을 못 읽어서
 *  문자열을 따로 둔다. 값을 바꿀 때 위와 함께 고칠 것. */
export const SCRIM_MODAL_DIALOG = 'backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm';

// 오버레이(모달·사이드패널·팔레트)의 ESC 닫기.
// 이전엔 FormSidePanel/TracePanel/CommandPalette가 각자 같은 effect를 복사해 두고
// ApiKeyModal·InstrumentationOverrideModal은 아예 빠져 있었다.
//
// ponytail: 스크롤 잠금은 넣지 않았다. 이 앱은 body가 아니라 MainLayout 내부 컨테이너가
// 스크롤하는 구조라 body overflow를 잠가도 효과가 없고, 실제 스크롤 누출은 재현되지 않았다.
// 누출이 확인되면 그때 잠글 대상(내부 스크롤러)을 정해서 추가할 것.
/**
 * Gives non-native overlays the minimum modal keyboard behaviour: Escape,
 * focus entry, focus trapping, and returning focus to the trigger. Native
 * dialogs already provide this, but using the hook there is harmless.
 */
export function useOverlay(
  open: boolean,
  onClose: () => void,
  overlayRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusFirst = () => {
      const overlay = overlayRef?.current;
      if (!overlay) return;
      const first = overlay.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (first ?? overlay).focus();
    };
    const focusTimer = window.setTimeout(focusFirst, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !overlayRef?.current) return;

      const focusable = Array.from(overlayRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hasAttribute('hidden'));
      if (focusable.length === 0) {
        e.preventDefault();
        overlayRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, onClose, overlayRef]);
}

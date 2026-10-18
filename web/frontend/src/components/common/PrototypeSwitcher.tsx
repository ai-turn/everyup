// THROWAWAY — compare information architecture on the existing overview/uptime routes.
import { useCallback, useEffect, useEffectEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, MaterialIcon } from './index';

const variants = ['current', 'A', 'B', 'C'] as const;
const names = {
  overview: ['현재 화면', '조사할 대상 먼저', '모니터링 범위 비교', '장애의 시간 흐름'],
  uptime: ['현재 화면', '대상 비교 표', '목록과 상세 함께', '환경별 묶음'],
};

export function PrototypeSwitcher() {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const variant = params.get('variant');
  const enabled = import.meta.env.DEV && variant !== null && (pathname === '/' || pathname === '/uptime');
  const index = Math.max(0, variants.findIndex((item) => item === variant));
  const move = useCallback((step: number) => {
    const next = new URLSearchParams(params);
    next.set('variant', variants[(index + step + variants.length) % variants.length]);
    setParams(next, { replace: true });
  }, [index, params, setParams]);
  const moveFromKeyboard = useEffectEvent(move);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || target.closest('input, textarea, select, [contenteditable="true"], [role="combobox"], [role="tablist"]')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); moveFromKeyboard(event.key === 'ArrowLeft' ? -1 : 1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
  if (!enabled) return null;
  return (
    <aside aria-label="설계안 비교" className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-action bg-bg-surface p-2 shadow-lg lg:bottom-5">
      <Button size="sm" variant="secondary" aria-label="이전 설계안" onClick={() => move(-1)}><MaterialIcon name="arrow_back" /></Button>
      <div className="min-w-0 px-1 text-center"><p className="type-caption font-medium text-action">설계 실험 · {variants[index]}</p><p className="text-sm text-text-base">{names[pathname === '/' ? 'overview' : 'uptime'][index]}</p></div>
      <Button size="sm" variant="secondary" aria-label="다음 설계안" onClick={() => move(1)}><MaterialIcon name="arrow_forward" /></Button>
      <div className="flex gap-1 border-l border-ui-border pl-2">
        <ButtonLink size="sm" variant="ghost" to={`/?variant=${variants[index]}`}>개요</ButtonLink>
        <ButtonLink size="sm" variant="ghost" to={`/uptime?variant=${variants[index]}`}>업타임</ButtonLink>
      </div>
    </aside>
  );
}

import { env } from '../../config/env';
import { DemoScenarioSwitcher } from './DemoScenarioSwitcher';
import { DemoHelpLinks } from './DemoHelpLinks';

export function DemoBanner() {
  if (!env.isDemoMode) return null;

  return (
    <div data-demo-chrome className="lg:hidden max-h-[30dvh] overflow-y-auto w-full shrink-0 border-b border-ui-border bg-bg-surface">
      {/* 한 줄: 설명 두 줄 + 라벨 붙은 선택 상자 + 링크 줄이 첫 화면을 약 96px 밀어냈다. 사이드바 카드와 같은 구성이다. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
        <span className="shrink-0 type-label text-text-base">Live Demo</span>
        <div className="w-36"><DemoScenarioSwitcher bare /></div>
        <div className="ml-auto"><DemoHelpLinks /></div>
      </div>
    </div>
  );
}

import { env } from '../../config/env';
import { DemoScenarioSwitcher } from './DemoScenarioSwitcher';
import { DemoHelpLinks } from './DemoHelpLinks';

export function DemoBanner() {
  if (!env.isDemoMode) return null;

  return (
    <div data-demo-chrome className="lg:hidden max-h-[30dvh] overflow-y-auto w-full shrink-0 border-b border-ui-border bg-bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-sm text-action">Live Demo</span>
          <p className="min-w-0 type-caption text-text-muted">예시 데이터입니다. 서버 연결과 알림 발송은 실행되지 않습니다.</p>
        </div>
        <DemoScenarioSwitcher tone="light" />
        <DemoHelpLinks />
      </div>
    </div>
  );
}

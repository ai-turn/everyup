import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { IconButton, MaterialIcon } from '../common';
import { env } from '../../config/env';
import logo from '../../assets/logo.webp';
import { DemoScenarioSwitcher } from './DemoScenarioSwitcher';
import { DemoHelpLinks } from './DemoHelpLinks';
import { NAV_SECTIONS } from './navSections';
import { useCurrentSection } from '../../hooks/useGroupTrail';

interface NavItemProps {
  to: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
}

function NavItem({ to, icon, label, active, badge }: NavItemProps) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? 'bg-primary/10 text-action' : 'text-text-muted hover:bg-ui-hover hover:text-text-base'
      }`}
    >
      <MaterialIcon size={20} name={icon} className="shrink-0" />
      <span className="truncate">{label}</span>
      {/* 배지 박스는 표 컬럼 전용(DESIGN §5.1b) — 여기서는 색 있는 숫자로 충분하다. 링크 이름은 "개요 장애 1건". */}
      {badge != null && badge > 0 && (
        <span className="ml-auto shrink-0 type-label-sm tabular-nums text-status-error">
          <span className="sr-only">장애 </span>{badge}<span className="sr-only">건</span>
        </span>
      )}
    </Link>
  );
}

/** failureCount: 개요 항목의 장애 배지. MainLayout이 탭 제목과 같은 값을 넘긴다(useFailureCount). */
export function Sidebar({ failureCount }: { failureCount: number }) {
  const { theme, toggleTheme } = useTheme();

  // 활성 항목 = 첫 크럼과 같은 섹션(담김 관계, DESIGN.md §3.4) — 서비스 상세는 Docker 환경이다.
  // 그룹에서 연 대상이면 그룹이다(useGroupTrail).
  const current = useCurrentSection();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ui-border bg-bg-surface lg:flex">
      {/* 링크를 가장자리에서 띄워 포커스 링(2px + 2px)이 화면과 사이드바 경계에 잘리지 않게 한다. 로고의 자리는 그대로다. */}
      <div className="flex h-16 shrink-0 items-center px-3">
        <Link to="/" className="group flex items-center gap-2 rounded-lg px-1">
          <img src={logo} alt="" className="h-9 w-9 object-contain" />
          <span className="text-lg font-bold tracking-tight text-text-base transition-colors group-hover:text-action">EveryUp</span>
        </Link>
      </div>

      {env.isDemoMode && (
        // 중립 표면 — 아래 검색 버튼과 같은 bg-main + ui-border. 파란 틴트 상자는 §9.3 금지 패턴이라 사이드바에서 혼자 튀었다.
        <div data-demo-chrome className="mx-3 mb-2 rounded-lg border border-ui-border bg-bg-main p-3">
          {/* 제목 줄 + 선택 상자 두 줄. 설명 문장은 내비를 밀어 내려서 뺐다 — 모바일 DemoBanner에는 남아 있다. */}
          <div className="flex items-center justify-between gap-2">
            <p className="type-label-sm text-text-base">Live Demo</p>
            <DemoHelpLinks compact />
          </div>
          <div className="mt-1"><DemoScenarioSwitcher bare size="sm" /></div>
        </div>
      )}

      <button
        onClick={() => window.dispatchEvent(new Event('everyup:command-palette'))}
        className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-ui-border bg-bg-main px-3 py-1.5 text-text-dim transition-colors hover:border-primary/40 hover:text-text-base"
      >
        <MaterialIcon size={20} name="search" className="shrink-0" />
        <span className="flex-1 text-left text-xs">검색</span>
        <kbd className="font-sans rounded border border-ui-border px-1 py-0.5 type-label-sm">{navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      {/* 스크롤 영역은 포커스 링도 자른다. 위아래 여백에 첫·마지막 항목의 링이 들어간다. */}
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-1" aria-label="주 메뉴">
        {NAV_SECTIONS.map((section, i) => (
          <Fragment key={section.to}>
            {section.group && section.group !== NAV_SECTIONS[i - 1]?.group && (
              <p className="px-3 pt-4 pb-1 type-label-sm text-text-dim">{section.group}</p>
            )}
            <NavItem
              // 개요는 장애 목록으로 바로 내린다 — 배지가 가리키는 곳이다.
              to={section.to === '/' ? '/#attention' : section.to}
              icon={section.icon}
              label={section.label}
              active={current?.to === section.to}
              badge={section.to === '/' ? failureCount : undefined}
            />
          </Fragment>
        ))}
      </nav>

      <div className="flex shrink-0 flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <IconButton icon={theme === 'light' ? 'dark_mode' : 'light_mode'} label="테마 전환" tone="quiet" size="sm" onClick={toggleTheme} />
        </div>
      </div>
    </aside>
  );
}

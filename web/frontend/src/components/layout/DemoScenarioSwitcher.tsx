import { useState } from 'react';
import { Select } from '../common';
import { DEMO_SCENARIOS, getDemoScenario, setDemoScenario, type MockScenario } from '../../mocks/demoScenario';

/**
 * Demo-only data-state control. It reloads so every page refetches the chosen fixture.
 * bare: 라벨 없이 선택 상자만 — 사이드바 카드·모바일 배너. 옆의 `Live Demo`가 라벨 역할을 한다.
 */
export function DemoScenarioSwitcher({ bare = false, size = 'md' }: { bare?: boolean; size?: 'sm' | 'md' }) {
  const [scenario, setScenario] = useState(getDemoScenario);

  const changeScenario = (next: MockScenario) => {
    if (next === scenario) return;
    setDemoScenario(next);
    setScenario(next);
    window.location.reload();
  };

  const select = (
    <Select aria-label="데모 시나리오" size={size} value={scenario} onChange={(event) => changeScenario(event.target.value as MockScenario)}>
      {DEMO_SCENARIOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </Select>
  );
  return bare ? select : (
    <label className="flex items-center gap-2 type-label-sm text-text">
      <span className="shrink-0">데모 상태</span>
      {select}
    </label>
  );
}

import { useState } from 'react';
import { Select } from '../common';
import { DEMO_SCENARIOS, getDemoScenario, setDemoScenario, type MockScenario } from '../../mocks/demoScenario';

/**
 * Demo-only data-state control. It reloads so every page refetches the chosen fixture.
 * stacked: 사이드바 카드 — 라벨 위, 선택 상자는 카드 폭 전체. 좁은 폭에 라벨과 상자를 한 줄로 붙이면 비좁았다.
 */
export function DemoScenarioSwitcher({ stacked = false }: { stacked?: boolean }) {
  const [scenario, setScenario] = useState(getDemoScenario);

  const changeScenario = (next: MockScenario) => {
    if (next === scenario) return;
    setDemoScenario(next);
    setScenario(next);
    window.location.reload();
  };

  const select = (
    <Select aria-label="데모 시나리오" size={stacked ? 'sm' : 'md'} value={scenario} onChange={(event) => changeScenario(event.target.value as MockScenario)}>
      {DEMO_SCENARIOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </Select>
  );
  return stacked ? (
    <label className="block">
      <span className="mb-1.5 block type-caption text-text-muted">데모 상태</span>
      {select}
    </label>
  ) : (
    <label className="flex items-center gap-2 type-label-sm text-text-secondary">
      <span className="shrink-0">데모 상태</span>
      {select}
    </label>
  );
}

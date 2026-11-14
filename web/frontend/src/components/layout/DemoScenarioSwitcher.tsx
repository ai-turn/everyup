import { useState } from 'react';
import { Select } from '../common';
import { DEMO_SCENARIOS, getDemoScenario, setDemoScenario, type MockScenario } from '../../mocks/demoScenario';

interface DemoScenarioSwitcherProps {
  tone: 'light' | 'dark';
}

/** Demo-only data-state control. It reloads so every page refetches the chosen fixture. */
export function DemoScenarioSwitcher({ tone }: DemoScenarioSwitcherProps) {
  const [scenario, setScenario] = useState(getDemoScenario);
  const dark = tone === 'dark';

  const changeScenario = (next: MockScenario) => {
    if (next === scenario) return;
    setDemoScenario(next);
    setScenario(next);
    window.location.reload();
  };

  return (
    <label className={`flex items-center gap-2 type-label-sm ${dark ? 'text-slate-200' : 'text-text-secondary'}`}>
      <span className="shrink-0">데모 상태</span>
      <Select
        aria-label="데모 시나리오"
        value={scenario}
        onChange={(event) => changeScenario(event.target.value as MockScenario)}
        className={`h-8 min-w-0 py-0 text-xs ${dark ? 'border-slate-600 bg-slate-800 text-slate-100' : 'bg-bg-surface text-text-secondary'}`}
      >
        {DEMO_SCENARIOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
    </label>
  );
}

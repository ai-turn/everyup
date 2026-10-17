import { expect, test } from '@playwright/test';
import type { AlertRule } from '../src/services/api';
import { dockerService, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });
const rule = (id: string, threshold: number, fields: Partial<AlertRule> = {}): AlertRule => ({ id, name: id, threshold, type: 'service', metric: 'response_time', operator: 'gt', duration: 0, severity: 'warning', isEnabled: true, isSystem: false, cooldown: 300, channelIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...fields });

for (const kind of ['direct', 'agent'] as const) {
  test(`[15] ${kind} thresholds include only enabled rules for the exact target and metric`, async ({ page }) => {
    const state = await uptimeFixture(page);
    const serviceKey = 'shop%2Fapi'; state.services = [dockerService({ key: serviceKey })];
    const fields = kind === 'direct' ? { serviceId: 'http-monitor' } : { agentId: 'docker-host', serviceKey };
    state.responses.set('GET /alert-rules', [
      rule('Exact', 111, fields), rule('Disabled', 333, { ...fields, isEnabled: false }),
      rule('Global', 444), rule('Other target', 555, kind === 'direct' ? { serviceId: 'other' } : { agentId: 'other', serviceKey }),
      rule('Other metric', 666, { ...fields, metric: 'cpu' }),
    ]);
    state.responses.set(`GET /agents/docker-host/services/${encodeURIComponent(serviceKey)}/history`, [{ time: new Date().toISOString(), latencyMs: 100, total: 1, uptimePct: 100 }]);
    await page.goto(kind === 'direct' ? './uptime/http-monitor' : `./services/docker-host/${encodeURIComponent(serviceKey)}`);
    await expect(page.getByText('알림 > 111ms', { exact: true })).toBeVisible();
    for (const threshold of [333, 444, 555, 666]) await expect(page.getByText(`알림 > ${threshold}ms`, { exact: true })).toHaveCount(0);
    if (kind === 'direct') {
      // Direct detail currently exposes edit/delete and chart thresholds; no rules shortcut exists.
      await expect(page.getByRole('link', { name: '알림 규칙', exact: true })).toHaveCount(0);
    } else {
      const entry = page.getByRole('link', { name: '알림 규칙', exact: true });
      await entry.click();
      const query = new URL(page.url()).searchParams;
      expect(query.get('target')).toBe('agent');
      expect(query.get('agentId')).toBe('docker-host');
      expect(query.get('serviceKey')).toBe(serviceKey);
      expect(query.get('tab')).toBe('rules');
      await expect(page.getByText('Exact', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Other target', { exact: true })).toHaveCount(0);
    }
  });
}

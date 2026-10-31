import type { GaugeData } from '../../types/infra';
import type { SystemInfo, SystemMetricsHistory } from '../../services/api';
import { systemInfoToGauges } from '../../utils/systemTransform';

export type { GaugeData };

// 데모 인프라의 원본 값. 게이지·추세는 실제 화면과 같은 변환을 거쳐 만든다 — 손으로 적으면
// 실제 Collector 호스트가 낼 수 없는 값(Cached 등)이 데모에만 남는다.
export const mockSystemInfo: SystemInfo = {
  hostname: 'prod-server-01',
  os: 'Ubuntu 22.04 LTS',
  platform: 'linux',
  kernel: '5.15.0-92-generic',
  uptime: 1_234_567,
  ip: '192.168.1.50',
  cpu: { cores: 8, usage: 67.4 },
  memory: { total: 16, used: 11.65, usage: 72.8 },
  disk: { total: 500, used: 206, usage: 41.2, readSpeed: 120, writeSpeed: 80 },
  network: { in: 3.2, out: 1.4 },
};

export const mockSystemMetrics: SystemMetricsHistory = {
  range: '6h',
  points: Array.from({ length: 72 }, (_, i) => ({
    timestamp: new Date(Date.now() - (71 - i) * 5 * 60_000).toISOString(),
    cpu: 45 + Math.sin(i / 8) * 20 + Math.random() * 5,
    memUsage: 70 + Math.cos(i / 10) * 3 + Math.random(),
    diskUsage: 40 + i * 0.016,
    netIn: 2 + Math.random() * 3,
    netOut: 1 + Math.random() * 1.5,
  })),
};

export const mockGauges: GaugeData[] = systemInfoToGauges(mockSystemInfo, mockSystemMetrics);

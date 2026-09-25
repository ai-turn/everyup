import type { SystemInfo, SystemMetricsHistory } from '../services/api';
import type { GaugeData, ChartData, Resource } from '../types/infra';
import { SERIES_HEX } from '../components/charts/chartTheme';

// --- SystemInfo → Resource[] (legacy, kept for backward compatibility) ---
export function systemInfoToResources(info: SystemInfo): Resource[] {
  const maxUsage = Math.max(info.cpu.usage, info.memory.usage, info.disk.usage);
  const status: Resource['status'] =
    maxUsage >= 90 ? 'critical' : maxUsage >= 80 ? 'warning' : 'healthy';

  return [
    {
      id: 'local',
      name: info.hostname,
      type: 'server',
      status,
      cluster: 'Local',
      ip: info.ip,
    },
  ];
}

// --- SystemInfo → GaugeData[] ---
// Network gauge uses a 125 MB/s baseline (1 Gbps link) to map throughput → %.
const NETWORK_FULL_SCALE_MBPS = 125;

export function systemInfoToGauges(info: SystemInfo, history?: SystemMetricsHistory): GaugeData[] {
  const pts = history?.points ?? [];
  const gauges: GaugeData[] = [
    {
      label: 'CPU',
      percentage: info.cpu.usage,
      color: SERIES_HEX.primary,
      subtitle: `${info.cpu.cores} Cores Online`,
      spark: pts.map((p) => p.cpu),
    },
    {
      label: 'Memory',
      percentage: info.memory.usage,
      color: SERIES_HEX.emerald,
      subtitle: `${info.memory.used} GB / ${info.memory.total} GB`,
    },
    {
      label: 'Disk',
      percentage: info.disk.usage,
      color: SERIES_HEX.amber,
      subtitle: `${info.disk.used} GB / ${info.disk.total} GB`,
    },
  ];

  const netIn = info.network?.in ?? 0;
  const netOut = info.network?.out ?? 0;
  const total = netIn + netOut;
  const { value, unit } = formatThroughput(total);

  gauges.push({
    label: 'Network',
    percentage: Math.max(0, Math.min(100, Math.round((total / NETWORK_FULL_SCALE_MBPS) * 100))),
    color: SERIES_HEX.teal,
    subtitle: `In ${formatThroughput(netIn).value} ${formatThroughput(netIn).unit} · Out ${formatThroughput(netOut).value} ${formatThroughput(netOut).unit}`,
    displayValue: value,
    displayUnit: unit,
    spark: pts.map((p) => (p.netIn ?? 0) + (p.netOut ?? 0)),
  });

  return gauges;
}

// formatThroughput formats a MB/s value into the largest sensible unit.
export function formatThroughput(mbPerSec: number): { value: string; unit: string } {
  if (!Number.isFinite(mbPerSec) || mbPerSec < 0) return { value: '0', unit: 'KB/s' };
  if (mbPerSec >= 1024) return { value: (mbPerSec / 1024).toFixed(2), unit: 'GB/s' };
  if (mbPerSec >= 1) return { value: mbPerSec.toFixed(2), unit: 'MB/s' };
  return { value: (mbPerSec * 1024).toFixed(0), unit: 'KB/s' };
}

// --- SystemMetricsHistory → ChartData[] ---
export function historyToCharts(history: SystemMetricsHistory, currentInfo?: SystemInfo | null): ChartData[] {
  const points = history.points ?? [];
  if (points.length === 0 && !currentInfo) return [];

  const data: ChartData['data'] = points.map((p) => ({
    t: new Date(p.timestamp).getTime(),
    cpu: Math.round(p.cpu),
    memUsed: parseFloat(p.memUsed.toFixed(1)),
    memCached: parseFloat((p.memCached || 0).toFixed(1)),
    diskRead: parseFloat(p.diskRead.toFixed(2)),
    diskWrite: parseFloat(p.diskWrite.toFixed(2)),
    netIn: parseFloat((p.netIn || 0).toFixed(2)),
    netOut: parseFloat((p.netOut || 0).toFixed(2)),
  }));

  if (currentInfo) {
    // memCached는 현재값 API에 없다 — 0을 넣으면 Cached 선이 끝에서 바닥으로 떨어지고 Last가 0이 된다.
    data.push({
      t: Date.now(),
      cpu: Math.round(currentInfo.cpu.usage),
      memUsed: parseFloat(currentInfo.memory.used.toFixed(1)),
      diskRead: parseFloat((currentInfo.disk.readSpeed ?? 0).toFixed(2)),
      diskWrite: parseFloat((currentInfo.disk.writeSpeed ?? 0).toFixed(2)),
      netIn: parseFloat((currentInfo.network?.in ?? 0).toFixed(2)),
      netOut: parseFloat((currentInfo.network?.out ?? 0).toFixed(2)),
    });
  }

  return [
    {
      title: 'CPU',
      unit: '%',
      yMax: 100,
      data,
      series: [{ key: 'cpu', label: 'Usage', color: SERIES_HEX.primary }],
    },
    {
      title: '메모리',
      unit: 'GB',
      data,
      series: [
        { key: 'memUsed',   label: 'Used',   color: SERIES_HEX.primary },
        { key: 'memCached', label: 'Cached', color: SERIES_HEX.teal },
      ],
    },
    {
      title: '디스크 I/O',
      unit: 'MB/s',
      data,
      series: [
        { key: 'diskRead', label: '읽기', color: SERIES_HEX.primary },
        { key: 'diskWrite', label: '쓰기', color: SERIES_HEX.amber },
      ],
    },
    {
      title: '네트워크',
      unit: 'MB/s',
      data,
      series: [
        { key: 'netIn', label: 'In', color: SERIES_HEX.primary },
        { key: 'netOut', label: 'Out', color: SERIES_HEX.emerald },
      ],
    },
  ];
}

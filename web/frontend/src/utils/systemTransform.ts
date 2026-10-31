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

// Collector가 퍼센트만 보내면 용량(total)이 0이다 — "0 GB / 0 GB"보다 비워 두는 편이 맞다.
function capacity({ used, total }: { used: number; total: number }) {
  return total > 0 ? `${used.toFixed(1)} GB / ${total.toFixed(1)} GB` : '';
}

export function systemInfoToGauges(info: SystemInfo, history?: SystemMetricsHistory): GaugeData[] {
  const pts = history?.points ?? [];
  const gauges: GaugeData[] = [
    {
      label: 'CPU',
      percentage: info.cpu.usage,
      color: SERIES_HEX.primary,
      // Collector 경로는 코어 수를 모른다(0).
      subtitle: info.cpu.cores > 0 ? `코어 ${info.cpu.cores}개` : '',
      spark: pts.map((p) => p.cpu),
    },
    {
      label: '메모리',
      percentage: info.memory.usage,
      color: SERIES_HEX.emerald,
      subtitle: capacity(info.memory),
    },
    {
      label: '디스크',
      percentage: info.disk.usage,
      color: SERIES_HEX.amber,
      subtitle: capacity(info.disk),
    },
  ];

  const netIn = info.network?.in ?? 0;
  const netOut = info.network?.out ?? 0;
  const total = netIn + netOut;
  const { value, unit } = formatThroughput(total);

  gauges.push({
    label: '네트워크',
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
    memUsage: Math.round(p.memUsage),
    diskUsage: Math.round(p.diskUsage),
    netIn: parseFloat((p.netIn || 0).toFixed(2)),
    netOut: parseFloat((p.netOut || 0).toFixed(2)),
  }));

  if (currentInfo) {
    data.push({
      t: Date.now(),
      cpu: Math.round(currentInfo.cpu.usage),
      memUsage: Math.round(currentInfo.memory.usage),
      diskUsage: Math.round(currentInfo.disk.usage),
      netIn: parseFloat((currentInfo.network?.in ?? 0).toFixed(2)),
      netOut: parseFloat((currentInfo.network?.out ?? 0).toFixed(2)),
    });
  }

  // 세 사용률 차트는 같은 %라서 알림 규칙 임계선을 그대로 긋는다(InfraTrends).
  return [
    {
      title: 'CPU',
      unit: '%',
      yMax: 100,
      data,
      series: [{ key: 'cpu', label: '사용률', color: SERIES_HEX.primary }],
    },
    {
      title: '메모리',
      unit: '%',
      yMax: 100,
      data,
      series: [{ key: 'memUsage', label: '사용률', color: SERIES_HEX.primary }],
    },
    {
      title: '디스크',
      unit: '%',
      yMax: 100,
      data,
      series: [{ key: 'diskUsage', label: '사용률', color: SERIES_HEX.primary }],
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

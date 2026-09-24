// Infra domain types — used across features/, hooks/, and utils/

export interface Resource {
  id: string;
  name: string;
  type: 'server' | 'database' | 'container';
  status: 'healthy' | 'warning' | 'critical' | 'error' | 'paused' | 'unknown';
  severity?: 'none' | 'warning' | 'critical';
  statusReason?: string;
  cluster: string;
  ip: string;
  connectionType?: 'local' | 'remote';
  isActive?: boolean;
  isRemote?: boolean;
  lastSeenAt?: string;
  lastCollectedAt?: string;
  incidentSince?: string;
  lastError?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  netTrend?: number[];
  createdAt?: string;
  updatedAt?: string;
}

export interface GaugeData {
  label: string;
  percentage: number;
  color: string;
  subtitle: string;
  /** 최근 추이(비율 지표만) — 카드에 스파크라인으로 그린다. 없으면 용량 막대. */
  spark?: number[];
  displayValue?: string;
  displayUnit?: string;
}

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartData {
  title: string;
  unit: string;
  yMax?: number;
  /** 행마다 `t`(epoch ms) + 시리즈 key별 값. */
  data: ({ t: number } & Record<string, number>)[];
  series: ChartSeries[];
}

export interface Process {
  id: string;
  name: string;
  icon: string;
  pid: string;
  cpu: string;
  cpuHighlight: boolean;
  memory: string;
  status: 'RUNNING' | 'IDLE' | 'STOPPED';
}

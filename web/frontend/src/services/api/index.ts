import { servicesApi } from './services';
import { hostsApi } from './hosts';
import { alertsApi } from './alerts';
import { agentsApi } from './agents';
import { projectsApi } from './projects';
import { observedServicesApi } from './observedServices';

/**
 * 중앙 API 클라이언트 싱글톤.
 * 도메인별 구현은 각 파일을 참조:
 *   - services.ts   : traces, audit events
 *   - hosts.ts      : system info, metrics history
 *   - alerts.ts     : alert rules, notification channels, history, settings
 */
export const api = {
  ...servicesApi,
  ...hostsApi,
  ...alertsApi,
  ...agentsApi,
  ...projectsApi,
  ...observedServicesApi,
};

// Re-export all types — 기존 import 경로 유지
export type { ApiResponse } from './base';
export type {
  LogEntry,
  LogLevel,
  LogHistogramBucket,
  LinkedRequest,
  ApiRequest,
  TraceSpan,
  TraceSpanEvent,
  TraceDetail,
  AuditEvent,
  UptimeMonitor,
  UptimeMonitorInput,
  UptimeMonitorType,
  UptimeMonitorStatus,
  UptimeMonitorMetric,
  UptimeMonitorSummary,
  UptimeMonitorDay,
  UptimeMonitorHistory,
} from './services';
export type {
  SystemInfo,
  SystemMetricPoint,
  SystemMetricsHistory,
  InfrastructureAdapter,
  InfrastructureResource,
  InfrastructureResourceInput,
  InfrastructureResourceSetup,
} from './hosts';
export type {
  ConnectedAgent,
  AgentProfileKind,
  AgentCollectionCapability,
  AgentProfile,
  AgentCapabilityState,
  AgentCapabilityStatus,
  AgentCapabilityReport,
  AgentJoinCode,
  AgentServiceSnapshot,
  AgentServiceFlat,
  AgentEvent,
  ServiceHistoryPoint,
  ServiceUptimeDay,
  AgentIncident,
  AgentOverview,
} from './agents';
export type {
  ApiRequestStatBucket,
  ApiRequestStatusSummary,
  MetricExemplar,
  OtelHistogramQuantiles,
  OtelMetricName,
  OtelMetricPoint,
  OtelServiceMetric,
  TraceListQuery,
  TraceSummary,
} from './telemetry';
export type {
  AlertRuleType,
  AlertMetric,
  AlertOperator,
  AlertSeverity,
  AlertRule,
  CreateAlertRuleData,
  UpdateAlertRuleData,
  NotificationChannel,
  TelegramConfig,
  DiscordConfig,
  SlackConfig,
  CreateNotificationChannelData,
  NotificationChannelHealth,
  NotificationStatus,
  NotificationAlertType,
  NotificationHistory,
  NotificationHistoryFilter,
  NotificationHistoryResponse,
  NotificationStats,
  AppSettings,
} from './alerts';
export type { Project, ProjectInput } from './projects';
export type {
  TelemetrySignal,
  ObservedService,
  ObservedServiceInput,
  ObservedServiceSetup,
  DirectLogQuery,
  DirectMetricPointQuery,
  DirectApiRequestQuery,
} from './observedServices';

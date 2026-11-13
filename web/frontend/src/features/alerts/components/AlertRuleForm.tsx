import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errors';
import { FormStep, Field } from './FormLayout';
import { Button, MaterialIcon, Input, Select } from '../../../components/common';
import { FIELD_SHELL } from '../../../components/common/Input';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { getChannelName, getChannelStyle } from '../utils/channelMeta';
import { SEVERITY_LABELS } from '../utils/severityLabel';
import {
    api,
    type AlertRule,
    type NotificationChannel,
    type AgentServiceFlat,
    type ConnectedAgent,
    type ObservedService,
    type InfrastructureResource,
    type UptimeMonitor,
    type TelemetrySignal,
} from '../../../services/api';

const ruleSchema = z.object({
    name: z.string().trim().min(1, '규칙 이름을 입력하세요'),
    ruleCategory: z.enum(['resource', 'endpoint', 'request', 'log', 'metric']),
    metric: z.enum(['cpu', 'memory', 'disk', 'http_status', 'response_time', 'log_level', 'api_status_code', 'otel_metric', 'error_rate', 'latency_p95', 'latency_p99']),
    metricName: z.string().optional(),
    agentId: z.string().optional(),
    serviceKey: z.string().optional(),
    serviceId: z.string().optional(),
    operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']),
    // 빈 칸은 valueAsNumber가 NaN으로 넘긴다. 숫자가 아니면 이 메시지가 나온다.
    threshold: z.number({ error: '임계값을 입력하세요' }).min(0, '0 이상으로 입력하세요'),
    duration: z.number({ error: '1~60 사이로 입력하세요' }).min(1, '1~60 사이로 입력하세요').max(60, '1~60 사이로 입력하세요'),
    severity: z.enum(['critical', 'warning', 'info']),
    cooldown: z.number({ error: '0~86400 사이로 입력하세요' }).min(0, '0~86400 사이로 입력하세요').max(86400, '0~86400 사이로 입력하세요'),
    channelIds: z.array(z.string()),
})
    // 교차 필드 검사는 다른 칸이 틀려도 함께 돌린다(when). 그래야 첫 제출에서 모든 인라인 오류가 한 번에 보인다.
    .refine(data => data.ruleCategory !== 'metric' || !!data.metricName?.trim(), { path: ['metricName'], message: '메트릭 이름을 입력하세요', when: () => true })
    // A window over every service at once would let one noisy service hide another.
    .refine(data => data.ruleCategory !== 'request' || !!data.serviceKey || !!data.serviceId, { path: ['serviceKey'], message: '서비스를 선택하세요', when: () => true });

type RuleFormValues = z.infer<typeof ruleSchema>;
type RuleCategory = RuleFormValues['ruleCategory'];

/** 새 규칙 폼의 초기값. 대상 필터 목록의 `추가`와 메트릭 단독 보기의 `알림 추가`가 같은 통로로 넘긴다. */
export type AlertRuleFormInitial = Partial<Pick<RuleFormValues, 'ruleCategory' | 'metricName' | 'agentId' | 'serviceKey' | 'serviceId'>>;

const CATEGORY_METRIC: Record<RuleCategory, RuleFormValues['metric']> = {
    endpoint: 'http_status', request: 'error_rate', log: 'log_level', metric: 'otel_metric', resource: 'cpu',
};

// 직접 연결 서비스는 그 신호를 받는 경우에만 대상 목록에 나온다.
function directSignalFor(category: RuleCategory, metric: RuleFormValues['metric']): TelemetrySignal | null {
    if (category === 'metric') return 'metrics';
    if (category === 'log') return metric === 'api_status_code' ? 'traces' : 'logs';
    if (category === 'request') return 'traces';
    return null;
}

function initialFormValues(initial?: AlertRuleFormInitial): RuleFormValues {
    const ruleCategory = initial?.ruleCategory ?? 'endpoint';
    const metric = CATEGORY_METRIC[ruleCategory];
    const preset = recommendedValues(metric);
    return {
        name: '', ruleCategory, metric, metricName: '', agentId: '', serviceKey: '', serviceId: '',
        operator: preset.operator, threshold: preset.threshold, duration: preset.duration ?? 1,
        severity: 'warning', cooldown: 300, channelIds: [],
        ...initial,
    };
}

const OPERATOR_SYMBOLS: Record<string, string> = {
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    eq: '=',
};

// 지표별 권장 조건. 문제가 생겼을 때 참이 되는 조건만 둔다. 평소에 참인 "정상" 조건은 늘 발동하므로 두지 않는다(A-08).
function recommendedValues(metric: RuleFormValues['metric']): { operator: RuleFormValues['operator']; threshold: number; duration?: number } {
    if (metric === 'http_status') return { operator: 'gte', threshold: 400 };
    if (metric === 'response_time') return { operator: 'gt', threshold: 3000 };
    if (metric === 'log_level') return { operator: 'gte', threshold: 3 };
    if (metric === 'api_status_code') return { operator: 'gte', threshold: 500 };
    // 메트릭은 공통 기본값이 없다. 임계값을 비워 두고 사용자가 정하게 한다(빈 칸이면 NaN이라 검증에 걸린다).
    if (metric === 'otel_metric') return { operator: 'gt', threshold: NaN };
    if (metric === 'error_rate') return { operator: 'gt', threshold: 5, duration: 5 };
    if (metric === 'latency_p95') return { operator: 'gt', threshold: 1000, duration: 5 };
    if (metric === 'latency_p99') return { operator: 'gt', threshold: 2000, duration: 5 };
    return { operator: 'gt', threshold: 80, duration: 3 };
}

function buildDefaultMessage(metric: RuleFormValues['metric'], operator: RuleFormValues['operator'], threshold: number, duration: number): string {
    const opSym = OPERATOR_SYMBOLS[operator] ?? operator;
    if (metric === 'http_status') return `HTTP Status ${opSym} ${threshold} detected`;
    if (metric === 'response_time') return `Response Time ${opSym} ${threshold}ms detected`;
    if (metric === 'log_level') return `Log {level}: {message}`;
    if (metric === 'api_status_code') return `{method} {path} → {status} ({duration}ms)`;
    if (metric === 'otel_metric') return `{service_name} {metric} = {value} (threshold ${opSym} {threshold})`;
    if (metric === 'error_rate' || metric === 'latency_p95' || metric === 'latency_p99') {
        const label = { error_rate: 'error rate', latency_p95: 'p95 latency', latency_p99: 'p99 latency' }[metric];
        return `{service_name}: ${label} {value} over the last ${duration}min (threshold ${opSym} {threshold})`;
    }
    const metricLabel = { cpu: 'CPU', memory: 'Memory', disk: 'Disk' }[metric] ?? metric.toUpperCase();
    return `${metricLabel} usage ${opSym} ${threshold}%, sustained for ${duration}min on {host_name}`;
}

// ─── Layout primitives ────────────────────────────────────────────────────────

// 텍스트영역 전용 셸 — Input과 같은 규격을 공유한다 (포커스 링은 전역 :focus-visible).
const textareaCls = `${FIELD_SHELL} py-2.5 max-sm:text-base border-ui-control-border placeholder:text-text-dim`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface AlertRuleFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    rule?: AlertRule;
    /** 새 규칙일 때만 쓴다. 수정은 `rule`이 값을 정한다. */
    initial?: AlertRuleFormInitial;
    channels: NotificationChannel[];
    onSubmittingChange?: (v: boolean) => void;
}

// ─── Public export ────────────────────────────────────────────────────────────

export function AlertRuleForm({ onSuccess, onCancel, rule, initial, channels, onSubmittingChange }: AlertRuleFormProps) {
    if (!!rule && rule.isSystem) {
        return <SystemRuleEditor rule={rule} channels={channels} onSuccess={onSuccess} onCancel={onCancel} onSubmittingChange={onSubmittingChange} />;
    }
    return <FullRuleForm onSuccess={onSuccess} onCancel={onCancel} rule={rule} initial={initial} channels={channels} onSubmittingChange={onSubmittingChange} />;
}

// ─── System rule editor ───────────────────────────────────────────────────────

function SystemRuleEditor({ rule, channels, onSuccess, onCancel, onSubmittingChange }: { rule: AlertRule; channels: NotificationChannel[]; onSuccess: () => void; onCancel: () => void; onSubmittingChange?: (v: boolean) => void }) {

    const [message, setMessage] = useState(rule.message ?? '');
    const [selectedChannels, setSelectedChannels] = useState<string[]>(rule.channelIds || []);
    const effectiveChannelCount = selectedChannels.length === 0 ? channels.length : selectedChannels.length;
    // 시드되는 시스템 규칙은 서버 시작 알림 하나다(migrations.go system-boot).
    const systemTrigger = rule.id === 'system-boot' ? '서버가 시작될 때' : '시스템이 정한 조건';

    const handleToggleChannel = (id: string) => {
        setSelectedChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onSubmittingChange?.(true);
        try {
            await api.updateAlertRule(rule.id, { message, channelIds: selectedChannels });
            toast.success('규칙이 수정되었습니다');
            onSuccess();
            onCancel();
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            onSubmittingChange?.(false);
        }
    };

    return (
        <form id="alert-rule-form" onSubmit={handleSubmit}>
            <div className="max-w-350 mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
                <div className="space-y-4 min-w-0">
                    <FormStep n={1} title="시스템 규칙" subtitle="시스템이 관리하는 규칙입니다. 메시지와 알림 채널만 수정할 수 있습니다.">
                        <div className="p-4 bg-ui-hover-soft/50 rounded-xl">
                            <h3 className="type-card-title text-text-base">{rule.name}</h3>
                            <p className="mt-1 text-sm text-text-muted">발동: {systemTrigger}</p>
                        </div>
                    </FormStep>

                    <FormStep n={2} title="알림 메시지" subtitle="알림 발송 시 사용될 메시지">
                        <textarea
                            aria-label="알림 메시지"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={3}
                            placeholder="Server has been started"
                            className={textareaCls + " resize-none"}
                        />
                    </FormStep>

                    <FormStep n={3} title="알림 채널" subtitle="발송할 채널 선택">
                        <div role="group" aria-label="알림 채널" className="space-y-2">
                            {channels.length === 0 ? (
                                <p className="text-sm text-text-muted">등록된 알림 채널이 없습니다</p>
                            ) : channels.map(ch => (
                                <button key={ch.id} type="button" onClick={() => handleToggleChannel(ch.id)} aria-pressed={selectedChannels.includes(ch.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 border-2 rounded-xl transition-colors ${selectedChannels.includes(ch.id) ? 'border-primary bg-primary/5 text-action' : 'border-ui-border-soft text-text-muted'}`}>
                                    <ChannelIcon type={ch.type} size={20} className={getChannelStyle(ch.type).text} />
                                    <span className="text-sm flex-1 text-left">{ch.name}</span>
                                </button>
                            ))}
                            {selectedChannels.length === 0 && channels.length > 0 && (
                                <p className="text-sm text-text-muted">비우면 전체 채널</p>
                            )}
                        </div>
                    </FormStep>
                </div>

                <div className="hidden lg:block">
                    {/* top-0: 패널 스크롤 영역 기준이라 0이어야 좌측 카드 시작선과 정렬 (실측 검증) */}
                    <div className="sticky top-0 space-y-4">
                        <div className="bg-bg-surface border border-ui-border rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-ui-border bg-ui-hover-soft/50">
                                <MaterialIcon size={20} name="lock" className="text-text-dim" />
                                <div>
                                    <p className="text-sm font-medium text-text-base">
                                        시스템 규칙
                                    </p>
                                    <p className="text-sm text-text-muted mt-0.5">
                                        발동: {systemTrigger}
                                    </p>
                                </div>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="rounded-xl bg-ui-hover-soft/50 p-3">
                                    <p className="text-xs font-medium text-text-muted">규칙 이름</p>
                                    <p className="mt-1 truncate text-sm text-text-base">{rule.name}</p>
                                </div>
                                <div className="rounded-xl bg-ui-hover-soft/50 p-3">
                                    <p className="text-xs font-medium text-text-muted">알림 채널</p>
                                    <p className="mt-1 text-sm text-text-base">
                                        {selectedChannels.length === 0
                                            ? `전체 ${effectiveChannelCount}개`
                                            : `${effectiveChannelCount}개 선택`}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-ui-hover-soft/50 p-3">
                                    <p className="text-xs font-medium text-text-muted">알림 메시지</p>
                                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                                        {message || 'Server has been started'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}

// ─── Full rule form ───────────────────────────────────────────────────────────

function FullRuleForm({ onSuccess, onCancel, rule, initial, channels, onSubmittingChange }: AlertRuleFormProps) {

    const isEdit = !!rule;
    const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
    const [agents, setAgents] = useState<ConnectedAgent[]>([]);
    const [directServices, setDirectServices] = useState<ObservedService[]>([]);
    const [infrastructureResources, setInfrastructureResources] = useState<InfrastructureResource[]>([]);
    const [uptimeMonitors, setUptimeMonitors] = useState<UptimeMonitor[]>([]);
    const [customMessage, setCustomMessage] = useState('');

    const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitted } } = useForm<RuleFormValues>({
        resolver: zodResolver(ruleSchema),
        mode: 'onBlur',
        defaultValues: initialFormValues(initial),
    });

    const watchedCategory  = watch('ruleCategory');
    const watchedMetric    = watch('metric');
    const watchedOperator  = watch('operator');
    const watchedThreshold = watch('threshold');
    const watchedDuration  = watch('duration');
    const watchedCooldown  = watch('cooldown');
    const watchedAgentId   = watch('agentId') ?? '';
    const watchedServiceKey = watch('serviceKey') ?? '';
    const watchedServiceId = watch('serviceId') ?? '';
    const watchedChannelIds = watch('channelIds');
    const watchedSeverity  = watch('severity');
    const watchedName      = watch('name');

    useEffect(() => {
        api.getAllAgentServicesFlat().then(svcs => setAgentServices(svcs ?? [])).catch(() => { });
        api.getAgents().then(agts => setAgents(agts ?? [])).catch(() => { });
        api.getObservedServices().then(rows => {
            setDirectServices(rows ?? []);
            // 대상만 넘어온 새 규칙은 그 서비스가 받는 신호로 카테고리를 고른다. 직접 연결 서비스가 아니면(업타임 모니터) 헬스체크 그대로다.
            const signals = (rows ?? []).find(service => service.id === initial?.serviceId)?.signals;
            if (isEdit || initial?.ruleCategory || !signals) return;
            const category: RuleCategory = signals.includes('metrics') ? 'metric' : signals.includes('traces') ? 'request' : 'log';
            const metric = CATEGORY_METRIC[category];
            setValue('ruleCategory', category);
            setValue('metric', metric);
            const preset = recommendedValues(metric);
            setValue('operator', preset.operator);
            setValue('threshold', preset.threshold);
            if (preset.duration != null) setValue('duration', preset.duration);
        }).catch(() => { });
        api.getInfrastructureResources().then(rows => setInfrastructureResources(rows ?? [])).catch(() => { });
        // 헬스체크 규칙은 업타임 모니터 하나를 대상으로 할 수 있다(서버는 service_id로 평가한다).
        api.getUptimeMonitors().then(rows => setUptimeMonitors(rows ?? [])).catch(() => { });
    }, [isEdit, initial?.ruleCategory, initial?.serviceId, setValue]);

    useEffect(() => {
        if (rule) {
            const metric = rule.metric as RuleFormValues['metric'];
            const ruleCategory: RuleCategory = metric === 'otel_metric' ? 'metric'
                : rule.type === 'request' ? 'request'
                : rule.type === 'service' ? 'endpoint' : rule.type === 'log' ? 'log' : 'resource';
            reset({
                name: rule.name,
                ruleCategory,
                metric,
                metricName: rule.metricName ?? '',
                agentId: rule.agentId ?? '',
                serviceKey: rule.serviceKey ?? '',
                serviceId: rule.serviceId ?? '',
                operator: rule.operator,
                threshold: rule.threshold,
                duration: rule.duration,
                severity: rule.severity,
                cooldown: rule.cooldown || 300,
                channelIds: rule.channelIds || [],
            });
            setCustomMessage(rule.message ?? '');
        }
    }, [rule, reset]);

    // 제출한 뒤에는 고칠 때마다 다시 검증해 인라인 오류를 바로 지운다.
    const revalidate = { shouldValidate: isSubmitted };

    const applyRecommended = (metric: RuleFormValues['metric']) => {
        const vals = recommendedValues(metric);
        setValue('operator', vals.operator);
        setValue('threshold', vals.threshold, revalidate);
        if (vals.duration != null) setValue('duration', vals.duration);
    };

    const handleCategoryChange = (cat: RuleCategory) => {
        const newMetric = CATEGORY_METRIC[cat];
        // 대상 필터에서 넘어온 대상은 새 카테고리도 그 대상을 고를 수 있으면 유지한다.
        const signal = directSignalFor(cat, newMetric);
        const keepTarget = cat !== 'resource' && watchedCategory !== 'resource' && (watchedServiceId
            ? (cat === 'endpoint'
                ? uptimeMonitors.some(monitor => monitor.id === watchedServiceId)
                : !!signal && !!directServices.find(service => service.id === watchedServiceId)?.signals.includes(signal))
            : true);
        setValue('ruleCategory', cat);
        if (!keepTarget) {
            setValue('agentId', '');
            setValue('serviceKey', '');
            setValue('serviceId', '');
        }
        setValue('metricName', '');
        setValue('metric', newMetric);
        // 메트릭은 권장값이 없다. 임계값 칸이 빈 채로 직접 입력하게 된다.
        applyRecommended(newMetric);
    };

    const handleMetricChange = (m: RuleFormValues['metric']) => {
        setValue('metric', m);
        applyRecommended(m);
    };

    const handleToggleChannel = (channelId: string) => {
        const current = watchedChannelIds || [];
        setValue('channelIds', current.includes(channelId)
            ? current.filter(id => id !== channelId)
            : [...current, channelId]);
    };

    const onSubmit = async (data: RuleFormValues) => {
        onSubmittingChange?.(true);
        try {
            const isEndpoint = data.ruleCategory === 'endpoint';
            const isLog = data.ruleCategory === 'log';
            const isMetric = data.ruleCategory === 'metric';
            const isRequest = data.ruleCategory === 'request';
            const scoped = isEndpoint || isLog || isMetric || isRequest;
            const payload = {
                name: data.name,
                // metric rules share the connected-agent (service) rule type.
                type: isRequest ? 'request' as const : isLog ? 'log' as const : (isEndpoint || isMetric) ? 'service' as const : 'resource' as const,
                metric: data.metric,
                metricName: isMetric ? (data.metricName || '') : '',
                agentId: data.agentId || null,
                serviceKey: scoped ? (data.serviceKey || null) : null,
                serviceId: scoped ? (data.serviceId || null) : null,
                operator: data.operator,
                threshold: data.threshold,
                duration: data.duration,
                severity: data.severity,
                // ingest-time evals (log/endpoint/metric) are dedup-driven, cooldown 0;
                // windowed request rules re-check every minute and need the cooldown.
                cooldown: scoped && !isRequest ? 0 : data.cooldown,
                message: customMessage.trim() || '',
                channelIds: data.channelIds,
            };
            if (isEdit && rule) {
                await api.updateAlertRule(rule.id, payload);
                toast.success('규칙이 수정되었습니다');
            } else {
                await api.createAlertRule(payload);
                toast.success('규칙이 생성되었습니다');
            }
            onSuccess();
            onCancel();
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            onSubmittingChange?.(false);
        }
    };

    const isEndpoint = watchedCategory === 'endpoint';
    const isLog = watchedCategory === 'log';
    const isMetric = watchedCategory === 'metric';
    const isRequest = watchedCategory === 'request';
    const isApiStatus = watchedMetric === 'api_status_code';
    const watchedMetricName = watch('metricName') ?? '';
    const metricName = { cpu: 'CPU', memory: 'Memory', disk: 'Disk', http_status: 'HTTP Status', response_time: 'Response Time', log_level: 'Log Level', api_status_code: 'API Status', otel_metric: 'Metric', error_rate: 'Error Rate', latency_p95: 'p95', latency_p99: 'p99' }[watchedMetric] ?? watchedMetric;
    const thresholdUnit = watchedMetric === 'response_time' || watchedMetric === 'latency_p95' || watchedMetric === 'latency_p99' ? 'ms' : (watchedMetric === 'http_status' || watchedMetric === 'log_level' || isApiStatus || isMetric) ? '' : '%';

    // Metric-name suggestions for the datalist: the selected service's exported
    // OTLP metrics. Free text still allowed when no service is selected.
    const [metricNameOptions, setMetricNameOptions] = useState<string[]>([]);
    useEffect(() => {
        const request = !isMetric ? null
            : watchedServiceId ? api.getObservedServiceOtelMetricNames(watchedServiceId)
            : watchedAgentId && watchedServiceKey ? api.getAgentServiceOtelMetricNames(watchedAgentId, watchedServiceKey)
            : null;
        if (!request) { setMetricNameOptions([]); return; }
        let active = true;
        request
            .then(names => { if (active) setMetricNameOptions([...new Set((names ?? []).map(n => n.metricName))]); })
            .catch(() => { if (active) setMetricNameOptions([]); });
        return () => { active = false; };
    }, [isMetric, watchedAgentId, watchedServiceKey, watchedServiceId]);
    const selectedAgentService = agentServices.find(s => s.agentId === watchedAgentId && s.key === watchedServiceKey);
    const selectedAgent = agents.find(a => a.id === watchedAgentId);
    const selectedInfrastructureResource = infrastructureResources.find(resource => resource.id === watchedAgentId);
    const directSignal = directSignalFor(watchedCategory, watchedMetric);
    const availableDirectServices = directSignal
        ? directServices.filter(service => service.signals.includes(directSignal))
        : [];
    const selectedDirectService = isEndpoint
        ? uptimeMonitors.find(monitor => monitor.id === watchedServiceId)
        : directServices.find(service => service.id === watchedServiceId);
    const targetLabel = isEndpoint || isLog || isRequest || isMetric
        ? (selectedDirectService
            ? selectedDirectService.name
            : watchedAgentId && watchedServiceKey
            ? (selectedAgentService ? `${selectedAgentService.agentName} / ${selectedAgentService.name}` : watchedServiceKey)
            : (isRequest ? '서비스 선택 필요' : isLog ? '전체 로그 서비스' : isMetric ? '모든 서비스' : '전체 헬스체크'))
        : watchedCategory === 'resource' && watchedAgentId
            ? (selectedInfrastructureResource?.name ?? selectedAgent?.name ?? watchedAgentId)
            : (watchedAgentId ? (selectedAgent?.name ?? watchedAgentId) : '전체 인프라');

    const previewChannels = watchedChannelIds.length === 0
        ? channels
        : channels.filter(c => watchedChannelIds.includes(c.id));

    const severityClasses = {
        critical: { border: 'border-red-500',  bg: 'bg-red-500/5',   badge: 'bg-red-500/10 text-red-500',   dot: 'bg-red-500' },
        warning:  { border: 'border-amber-500', bg: 'bg-amber-500/5', badge: 'bg-amber-500/10 text-amber-500', dot: 'bg-amber-500' },
        info:     { border: 'border-sky-500',   bg: 'bg-sky-500/5',   badge: 'bg-sky-500/10 text-sky-500',   dot: 'bg-sky-500' },
    }[watchedSeverity];

    return (
        <form
            id="alert-rule-form"
            // 검증 실패는 필드 아래 인라인 메시지가 정본이다(DESIGN §7). 첫 오류 필드로 포커스를 옮겨 화면에 보이게 한다.
            onSubmit={handleSubmit(onSubmit, invalid => {
                const order: [keyof RuleFormValues, string][] = [['serviceKey', 'rule-target'], ['metricName', 'rule-metric'], ['name', 'rule-name'], ['threshold', 'rule-threshold'], ['duration', 'rule-duration'], ['cooldown', 'rule-cooldown']];
                const first = order.find(([field]) => invalid[field]);
                if (first) document.getElementById(first[1])?.focus();
            })}
        >
            <div className="max-w-350 mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

                {/* ── Left: form steps ─────────────────────────────────── */}
                <div className="space-y-4 min-w-0">

                    {/* Step 1: Target */}
                    <FormStep n={1} title="대상">
                        <Field label="카테고리">
                            <div role="group" aria-label="카테고리" className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
                                {([
                                    { value: 'endpoint' as const, label: '헬스체크', icon: 'monitor_heart' },
                                    { value: 'request'  as const, label: 'API 요청', icon: 'speed' },
                                    { value: 'log'      as const, label: '로그',        icon: 'article' },
                                    { value: 'metric'   as const, label: '메트릭', icon: 'monitoring' },
                                    { value: 'resource' as const, label: '인프라', icon: 'memory' },
                                ]).map(cat => (
                                    <button
                                        key={cat.value}
                                        type="button"
                                        onClick={() => handleCategoryChange(cat.value)}
                                        aria-pressed={watchedCategory === cat.value}
                                        className={`flex items-center gap-2 px-3 py-3 border-2 rounded-xl transition-colors text-left ${
                                            watchedCategory === cat.value
                                                ? 'border-primary bg-primary/10 text-action'
                                                : 'border-ui-border-soft text-text-muted hover:border-ui-border'
                                        }`}
                                    >
                                        <MaterialIcon size={20} name={cat.icon} />
                                        <span className="text-sm whitespace-nowrap">{cat.label}</span>
                                    </button>
                                ))}
                            </div>
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                            <Field
                                htmlFor="rule-target"
                                label="대상"
                                required={isRequest}
                                error={errors.serviceKey?.message}
                                hint={isRequest ? null : !watchedAgentId && !watchedServiceId ? '미선택 시 모든 대상에 적용됩니다' : null}
                            >
                                {isEndpoint || isLog || isMetric || isRequest ? (
                                    <Select
                                        id="rule-target"
                                        value={watchedServiceId ? `direct:::${watchedServiceId}` : watchedAgentId && watchedServiceKey ? `${watchedAgentId}:::${watchedServiceKey}` : ''}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (!val) { setValue('agentId', ''); setValue('serviceId', ''); setValue('serviceKey', '', revalidate); }
                                            else {
                                                const [scope, key] = val.split(':::');
                                                if (scope === 'direct') { setValue('serviceId', key); setValue('agentId', ''); setValue('serviceKey', '', revalidate); }
                                                else { setValue('agentId', scope); setValue('serviceId', ''); setValue('serviceKey', key, revalidate); }
                                            }
                                        }}

                                    >
                                        <option value="">{isRequest ? '서비스 선택' : isLog ? '전체 로그 서비스' : isMetric ? '모든 서비스' : '전체 헬스체크'}</option>
                                        {agentServices.map(svc => (
                                            <option key={`${svc.agentId}:::${svc.key}`} value={`${svc.agentId}:::${svc.key}`}>
                                                {svc.agentName} / {svc.name}
                                            </option>
                                        ))}
                                        {availableDirectServices.map(service => (
                                            <option key={`direct:::${service.id}`} value={`direct:::${service.id}`}>
                                                Direct / {service.name}
                                            </option>
                                        ))}
                                        {isEndpoint && uptimeMonitors.map(monitor => (
                                            <option key={`direct:::${monitor.id}`} value={`direct:::${monitor.id}`}>
                                                업타임 / {monitor.name}
                                            </option>
                                        ))}
                                    </Select>
                                ) : (
                                    <Select
                                        id="rule-target"
                                        value={watchedAgentId}
                                        onChange={e => { setValue('agentId', e.target.value); setValue('serviceKey', ''); }}

                                    >
                                        <option value="">전체 인프라</option>
                                        {infrastructureResources.map(resource => (
                                            <option key={resource.id} value={resource.id}>
                                                {resource.adapter === 'otel-collector' ? 'Collector' : 'Docker'} / {resource.name}
                                            </option>
                                        ))}
                                    </Select>
                                )}
                            </Field>

                            <Field htmlFor={isMetric ? 'rule-metric' : undefined} label="지표" required={isMetric} error={isMetric ? errors.metricName?.message : undefined} hint={isMetric && !watchedServiceKey && !watchedServiceId ? '서비스를 선택하면 수집된 메트릭이 제안됩니다' : null}>
                                {isMetric ? (
                                    <>
                                        <Input
                                            id="rule-metric"
                                            list="otel-metric-names"
                                            value={watchedMetricName}
                                            onChange={e => setValue('metricName', e.target.value, revalidate)}
                                            invalid={!!errors.metricName}
                                            placeholder="예: jvm.memory.used"

                                        />
                                        <datalist id="otel-metric-names">
                                            {metricNameOptions.map(n => <option key={n} value={n} />)}
                                        </datalist>
                                    </>
                                ) : (
                                    <div role="group" aria-label="지표" className="flex flex-wrap gap-2">
                                        {(isLog
                                            ? ['log_level', 'api_status_code'] as const
                                            : isRequest
                                            ? ['error_rate', 'latency_p95', 'latency_p99'] as const
                                            : isEndpoint
                                            ? ['http_status', 'response_time'] as const
                                            : ['cpu', 'memory', 'disk'] as const
                                        ).map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => handleMetricChange(m)}
                                                aria-pressed={watchedMetric === m}
                                                className={`px-3 py-2 rounded-lg text-sm border-2 transition-colors ${
                                                    watchedMetric === m
                                                        ? 'border-primary bg-primary/10 text-action'
                                                        : 'border-ui-border-soft text-text-muted hover:border-ui-border'
                                                }`}
                                            >
                                                {m === 'log_level' ? '로그 레벨' : m === 'api_status_code' ? 'API 요청'
                                                    : m === 'error_rate' ? '에러율' : m === 'latency_p95' ? 'p95 지연' : m === 'latency_p99' ? 'p99 지연'
                                                    : m === 'cpu' ? 'CPU' : m === 'memory' ? '메모리' : m === 'disk' ? '디스크' : m === 'http_status' ? 'HTTP 상태' : '응답 시간'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </Field>
                        </div>

                        <Field htmlFor="rule-name" label="규칙 이름" required error={errors.name?.message}>
                            <Input
                                id="rule-name"
                                invalid={!!errors.name}
                                {...register('name')}
                                placeholder="예: 결제 API 응답 지연"

                            />
                        </Field>
                    </FormStep>

                    {/* Step 2: Condition. 연산자·임계값은 늘 보인다. 평가 방식 칸은 카테고리의 서버 평가기를 따른다. */}
                    <FormStep n={2} title="조건">
                        <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_1fr] gap-3 items-start">
                            <Field htmlFor="rule-operator" label="연산자">
                                {/* 공용 Select는 register의 ref를 받지 못해 표시가 첫 옵션에 머문다. 값을 직접 묶는다. */}
                                <Select
                                    id="rule-operator"
                                    value={watchedOperator}
                                    onChange={e => setValue('operator', e.target.value as RuleFormValues['operator'])}
                                    className="w-20"
                                >
                                    <option value="gt">&gt;</option>
                                    <option value="gte">&ge;</option>
                                    <option value="lt">&lt;</option>
                                    <option value="lte">&le;</option>
                                    <option value="eq">=</option>
                                </Select>
                            </Field>
                            <Field htmlFor="rule-threshold" label="임계값" required error={errors.threshold?.message}>
                                {watchedMetric === 'log_level' ? (
                                    // 로그 레벨은 숫자로 저장된다. 이름으로 고르게 한다.
                                    <Select
                                        id="rule-threshold"
                                        value={watchedThreshold}
                                        onChange={e => setValue('threshold', Number(e.target.value), revalidate)}
                                    >
                                        <option value={4}>ERROR</option>
                                        <option value={3}>WARN</option>
                                        <option value={2}>INFO</option>
                                        <option value={1}>DEBUG</option>
                                        <option value={0}>TRACE</option>
                                    </Select>
                                ) : (
                                    <div className="flex">
                                        <Input
                                            id="rule-threshold"
                                            type="number"
                                            step="any"
                                            invalid={!!errors.threshold}
                                            aria-describedby={errors.threshold ? 'rule-threshold-error' : undefined}
                                            {...register('threshold', { valueAsNumber: true })}
                                            className={thresholdUnit ? 'rounded-r-none' : ''}
                                        />
                                        {thresholdUnit && (
                                            <span className="px-3 py-2.5 bg-ui-hover border border-l-0 border-ui-border rounded-r-lg text-sm font-medium text-text-muted">
                                                {thresholdUnit}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </Field>
                            {isEndpoint || isRequest || watchedCategory === 'resource' ? (
                                <Field
                                    htmlFor="rule-duration"
                                    label={isEndpoint ? '연속 체크 횟수' : isRequest ? '평가 구간 (분)' : '지속 시간 (분)'}
                                    error={errors.duration?.message}
                                >
                                    <Input
                                        id="rule-duration"
                                        type="number" min={1} max={isEndpoint ? 20 : 60}
                                        invalid={!!errors.duration}
                                        {...register('duration', { valueAsNumber: true })}
                                    />
                                </Field>
                            ) : (
                                <Field label="평가 방식">
                                    <p className="text-sm text-text-muted py-2.5">수신 즉시</p>
                                </Field>
                            )}
                        </div>

                        {/* 메트릭 규칙은 수신 시점에 바로 비교하고 시리즈별 중복 억제로만 거른다(otlp_ingest evaluateOtelMetricAlerts).
                            지속 시간·쿨다운은 서버가 쓰지 않으므로 받지 않는다. */}
                        {isMetric ? (
                            <p className="text-sm text-text-muted">수신할 때마다 평가합니다. 같은 시리즈는 일정 시간(기본 5분)에 한 번만 보냅니다.</p>
                        ) : (
                            <div>
                                <Button type="button" variant="ghost" size="sm" onClick={() => applyRecommended(watchedMetric)}>
                                    <MaterialIcon name="tune" />
                                    권장값 채우기
                                </Button>
                            </div>
                        )}

                        {!isEndpoint && !isLog && !isMetric && (
                            <Field
                                htmlFor="rule-cooldown"
                                label="쿨다운 (초)"
                                hint="동일 규칙은 이 시간 내 재발송하지 않음"
                                error={errors.cooldown?.message}
                            >
                                <Input
                                    id="rule-cooldown"
                                    type="number" min={0} max={86400}
                                    invalid={!!errors.cooldown}
                                    {...register('cooldown', { valueAsNumber: true })}
                                />
                            </Field>
                        )}

                    </FormStep>

                    {/* Step 3: Notify */}
                    <FormStep n={3} title="알림">
                        <Field label="심각도">
                            <div role="group" aria-label="심각도" className="grid grid-cols-3 gap-2">
                                {([
                                    { value: 'critical' as const, active: 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400', dot: 'bg-red-500' },
                                    { value: 'warning'  as const, active: 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
                                    { value: 'info'     as const, active: 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
                                ]).map(s => (
                                    <button
                                        key={s.value}
                                        type="button"
                                        onClick={() => setValue('severity', s.value)}
                                        aria-pressed={watchedSeverity === s.value}
                                        className={`py-2.5 text-sm rounded-xl border-2 transition-colors flex items-center justify-center gap-2 ${
                                            watchedSeverity === s.value
                                                ? s.active
                                                : 'border-ui-border-soft text-text-muted hover:border-ui-border'
                                        }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                        {SEVERITY_LABELS[s.value]}
                                    </button>
                                ))}
                            </div>
                        </Field>

                        <Field
                            label="알림 채널"
                            hint={watchedChannelIds.length === 0 && channels.length > 0 ? '미선택 시 모든 활성 채널로 발송됩니다' : null}
                        >
                            <div role="group" aria-label="알림 채널" className="space-y-2">
                                {channels.length === 0 ? (
                                    <p className="text-sm text-text-muted">등록된 알림 채널이 없습니다</p>
                                ) : channels.map(ch => (
                                    <button
                                        key={ch.id}
                                        type="button"
                                        onClick={() => handleToggleChannel(ch.id)}
                                        aria-pressed={watchedChannelIds.includes(ch.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 border-2 rounded-xl transition-colors ${
                                            watchedChannelIds.includes(ch.id)
                                                ? 'border-primary bg-primary/5 text-action'
                                                : 'border-ui-border-soft text-text-muted hover:border-ui-border'
                                        }`}
                                    >
                                        <ChannelIcon type={ch.type} size={20} className={getChannelStyle(ch.type).text} />
                                        <span className="text-sm flex-1 text-left">{ch.name}</span>
                                        <span className="text-sm text-text-dim">{getChannelName(ch.type)}</span>
                                    </button>
                                ))}
                            </div>
                        </Field>

                        <Field
                            htmlFor="rule-message"
                            label="알림 메시지"
                            hint={'선택 사항입니다. 입력하면 자동 생성 메시지 대신 보냅니다. ' + `사용 가능한 변수: ${(isRequest
                                    ? ['{service_name}', '{value}', '{threshold}', '{duration}']
                                    : isApiStatus
                                    ? ['{service_name}', '{method}', '{path}', '{status}', '{duration}']
                                    : isLog
                                    ? ['{service_name}', '{level}', '{message}']
                                    : isEndpoint
                                    ? ['{service_name}', '{value}', '{threshold}', '{metric}']
                                    : ['{host_name}', '{value}', '{threshold}', '{metric}', '{duration}']
                                ).join(' ')}`}
                        >
                            <textarea
                                id="rule-message"
                                value={customMessage}
                                onChange={e => setCustomMessage(e.target.value)}
                                rows={2}
                                placeholder={buildDefaultMessage(watchedMetric, watchedOperator, watchedThreshold, watchedDuration)}
                                className={textareaCls + " resize-none"}
                            />
                        </Field>
                    </FormStep>
                </div>

                {/* ── Right: sticky live preview (lg+) ─────────────────── */}
                <div className="hidden lg:block">
                    {/* top-0: 패널 스크롤 영역 기준이라 0이어야 좌측 카드 시작선과 정렬 (실측 검증) */}
                    <div className="sticky top-0 space-y-4">

                        {/* Live preview card */}
                        <div className="bg-bg-surface border border-ui-border rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-ui-border bg-ui-hover-soft/50">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <div>
                                    <p className="text-sm font-medium text-text-base">라이브 미리보기</p>
                                    <p className="text-sm text-text-muted mt-0.5">입력값 변경 시 자동 갱신</p>
                                </div>
                            </div>
                            <div className="p-5 space-y-5">

                                {/* IF block */}
                                <div>
                                    <p className="text-xs font-medium text-text-muted mb-2">조건</p>
                                    <div className="bg-slate-900 dark:bg-slate-950 rounded-lg px-4 py-3 font-mono text-xs leading-7">
                                        <div>
                                            <span className="text-sky-300">IF </span>
                                            <span className="text-amber-300">{metricName} </span>
                                            <span className="text-text-dim">{OPERATOR_SYMBOLS[watchedOperator] ?? watchedOperator} </span>
                                            <span className="text-red-300">{Number.isNaN(watchedThreshold) ? '?' : `${watchedThreshold}${thresholdUnit}`}</span>
                                        </div>
                                        {isEndpoint && (
                                            <div className="pl-4">
                                                <span className="text-sky-300">FAILS </span>
                                                <span className="text-violet-300">{watchedDuration}×</span>
                                            </div>
                                        )}
                                        {!isEndpoint && !isLog && !isMetric && (
                                            <div className="pl-4">
                                                <span className="text-sky-300">{isRequest ? 'OVER ' : 'FOR '}</span>
                                                <span className="text-violet-300">{isRequest ? `last ${watchedDuration} min` : `${watchedDuration} min`}</span>
                                            </div>
                                        )}
                                        {(isLog || isMetric) && (
                                            <div className="pl-4">
                                                <span className="text-sky-300">PER </span>
                                                <span className="text-violet-300">event (immediate)</span>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-sky-300">ON </span>
                                            <span className="text-emerald-300 truncate">{targetLabel}</span>
                                        </div>
                                        {!isEndpoint && !isLog && !isMetric && (
                                            <div>
                                                <span className="text-sky-300">COOLDOWN </span>
                                                <span className="text-text-dim">{watchedCooldown}s</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* THEN block */}
                                <div>
                                    <p className="text-xs font-medium text-text-muted mb-2">메시지</p>
                                    <div className={`rounded-xl px-3 py-3 ${severityClasses.bg}`}>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${severityClasses.badge}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${severityClasses.dot}`} />
                                                {watchedSeverity}
                                            </span>
                                            <span className="text-sm text-text-muted truncate">{watchedName || '<규칙 이름>'}</span>
                                        </div>
                                        <p className="text-sm text-text-secondary leading-relaxed">
                                            {customMessage || buildDefaultMessage(watchedMetric, watchedOperator, watchedThreshold, watchedDuration)}
                                        </p>
                                    </div>
                                </div>

                                {/* Channels */}
                                <div>
                                    <p className="text-xs font-medium text-text-muted mb-2">
                                        {watchedChannelIds.length === 0
                                            ? `발송 → 전체 ${channels.length}개 채널`
                                            : `발송 → ${watchedChannelIds.length}개 선택`}
                                    </p>
                                    <div className="space-y-1.5">
                                        {channels.length === 0 ? (
                                            <p className="text-sm text-text-muted">등록된 알림 채널이 없습니다</p>
                                        ) : previewChannels.slice(0, 5).map(ch => (
                                            <div key={ch.id} className="flex items-center gap-2 px-3 py-1.5 bg-ui-hover-soft/50 rounded-lg">
                                                <ChannelIcon type={ch.type} size={14} className={getChannelStyle(ch.type).text} />
                                                <span className="text-sm font-medium text-text-secondary flex-1 truncate">{ch.name}</span>
                                                <span className="text-xs text-text-dim">{getChannelName(ch.type)}</span>
                                            </div>
                                        ))}
                                        {previewChannels.length > 5 && (
                                            <p className="text-sm text-text-muted pl-1">{`+${previewChannels.length - 5}개 더`}</p>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </form>
    );
}

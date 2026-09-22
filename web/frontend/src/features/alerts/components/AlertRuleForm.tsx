import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errors';
import { FormStep, Field } from './FormLayout';
import { MaterialIcon, Input, Select } from '../../../components/common';
import { FIELD_SHELL } from '../../../components/common/Input';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { getChannelStyle } from '../utils/channelMeta';
import { SEVERITY_LABELS } from '../utils/severityLabel';
import {
    api,
    type AlertRule,
    type NotificationChannel,
    type AgentServiceFlat,
    type ConnectedAgent,
    type ObservedService,
    type InfrastructureResource,
} from '../../../services/api';

const ruleSchema = z.object({
    name: z.string().min(1),
    ruleCategory: z.enum(['resource', 'endpoint', 'log', 'metric']),
    metric: z.enum(['cpu', 'memory', 'disk', 'http_status', 'response_time', 'log_level', 'api_status_code', 'otel_metric']),
    metricName: z.string().optional(),
    agentId: z.string().optional(),
    serviceKey: z.string().optional(),
    serviceId: z.string().optional(),
    operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']),
    threshold: z.number().min(0),
    duration: z.number().min(1).max(60),
    severity: z.enum(['critical', 'warning', 'info']),
    cooldown: z.number().min(0).max(86400),
    channelIds: z.array(z.string()),
}).superRefine((data, ctx) => {
    if (!data.name.trim()) {
        ctx.addIssue({ path: ['name'], code: z.ZodIssueCode.custom, message: 'required' });
    }
    if (data.ruleCategory === 'metric' && !data.metricName?.trim()) {
        ctx.addIssue({ path: ['metricName'], code: z.ZodIssueCode.custom, message: 'required' });
    }
});

type RuleFormValues = z.infer<typeof ruleSchema>;
type RuleCategory = RuleFormValues['ruleCategory'];
type ConditionPreset = 'normal' | 'error' | 'custom';

const OPERATOR_SYMBOLS: Record<string, string> = {
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    eq: '=',
};

function getPresetValues(metric: RuleFormValues['metric'], preset: ConditionPreset): { operator: RuleFormValues['operator']; threshold: number; duration?: number } | null {
    if (preset === 'custom') return null;
    if (preset === 'normal') {
        if (metric === 'http_status') return { operator: 'lte', threshold: 299 };
        if (metric === 'response_time') return { operator: 'lt', threshold: 1000 };
        if (metric === 'log_level') return { operator: 'eq', threshold: 4 };
        if (metric === 'api_status_code') return { operator: 'lt', threshold: 400 };
        return { operator: 'lt', threshold: 70, duration: 1 };
    }
    if (metric === 'http_status') return { operator: 'gte', threshold: 400 };
    if (metric === 'response_time') return { operator: 'gt', threshold: 3000 };
    if (metric === 'log_level') return { operator: 'gte', threshold: 3 };
    if (metric === 'api_status_code') return { operator: 'gte', threshold: 500 };
    if (metric === 'otel_metric') return { operator: 'gt', threshold: 0 }; // no universal default — user sets it
    return { operator: 'gt', threshold: 80, duration: 3 };
}

function detectConditionPreset(metric: RuleFormValues['metric'], operator: RuleFormValues['operator'], threshold: number, duration: number): ConditionPreset {
    const normal = getPresetValues(metric, 'normal');
    const error = getPresetValues(metric, 'error');
    if (normal && operator === normal.operator && threshold === normal.threshold && (normal.duration == null || duration === normal.duration)) return 'normal';
    if (error && operator === error.operator && threshold === error.threshold && (error.duration == null || duration === error.duration)) return 'error';
    return 'custom';
}

function buildDefaultMessage(metric: RuleFormValues['metric'], operator: RuleFormValues['operator'], threshold: number, duration: number): string {
    const opSym = OPERATOR_SYMBOLS[operator] ?? operator;
    if (metric === 'http_status') return `HTTP Status ${opSym} ${threshold} detected`;
    if (metric === 'response_time') return `Response Time ${opSym} ${threshold}ms detected`;
    if (metric === 'log_level') return `Log {level}: {message}`;
    if (metric === 'api_status_code') return `{method} {path} → {status} ({duration}ms)`;
    if (metric === 'otel_metric') return `{service_name} {metric} = {value} (threshold ${opSym} {threshold})`;
    const metricLabel = { cpu: 'CPU', memory: 'Memory', disk: 'Disk' }[metric] ?? metric.toUpperCase();
    return `${metricLabel} usage ${opSym} ${threshold}%, sustained for ${duration}min on {host_name}`;
}

// ─── Layout primitives ────────────────────────────────────────────────────────

// 텍스트영역 전용 셸 — Input과 같은 규격을 공유한다 (포커스 링은 전역 :focus-visible).
const textareaCls = `${FIELD_SHELL} py-2.5 border-ui-border placeholder:text-text-dim`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface AlertRuleFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    rule?: AlertRule;
    channels: NotificationChannel[];
    onSubmittingChange?: (v: boolean) => void;
}

// ─── Public export ────────────────────────────────────────────────────────────

export function AlertRuleForm({ onSuccess, onCancel, rule, channels, onSubmittingChange }: AlertRuleFormProps) {
    if (!!rule && rule.isSystem) {
        return <SystemRuleEditor rule={rule} channels={channels} onSuccess={onSuccess} onCancel={onCancel} onSubmittingChange={onSubmittingChange} />;
    }
    return <FullRuleForm onSuccess={onSuccess} onCancel={onCancel} rule={rule} channels={channels} onSubmittingChange={onSubmittingChange} />;
}

// ─── System rule editor ───────────────────────────────────────────────────────

function SystemRuleEditor({ rule, channels, onSuccess, onCancel, onSubmittingChange }: { rule: AlertRule; channels: NotificationChannel[]; onSuccess: () => void; onCancel: () => void; onSubmittingChange?: (v: boolean) => void }) {

    const [message, setMessage] = useState(rule.message ?? '');
    const [selectedChannels, setSelectedChannels] = useState<string[]>(rule.channelIds || []);
    const effectiveChannelCount = selectedChannels.length === 0 ? channels.length : selectedChannels.length;

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
            <div className="max-w-350 mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
                <div className="space-y-4 min-w-0">
                    <FormStep n={1} title="시스템 규칙" subtitle="시스템이 관리하는 규칙입니다. 메시지와 알림 채널만 수정할 수 있습니다.">
                        <div className="p-4 bg-ui-hover-soft/50 rounded-xl">
                            <h3 className="type-card-title text-text-base mb-1">{rule.name}</h3>
                            <p className="text-sm text-slate-500">시스템이 관리하는 규칙입니다. 메시지와 알림 채널만 수정할 수 있습니다.</p>
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
                        <div className="space-y-2">
                            {channels.length === 0 ? (
                                <p className="text-sm text-slate-400">등록된 알림 채널이 없습니다</p>
                            ) : channels.map(ch => (
                                <button key={ch.id} type="button" onClick={() => handleToggleChannel(ch.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 border-2 rounded-xl transition-all ${selectedChannels.includes(ch.id) ? 'border-primary bg-primary/5 text-primary' : 'border-ui-border-soft text-slate-500'}`}>
                                    <ChannelIcon type={ch.type} size={16} className={getChannelStyle(ch.type).text} />
                                    <span className="text-sm flex-1 text-left">{ch.name}</span>
                                </button>
                            ))}
                            {selectedChannels.length === 0 && channels.length > 0 && (
                                <p className="text-sm text-slate-400 italic">비우면 전체 채널</p>
                            )}
                        </div>
                    </FormStep>
                </div>

                <div className="hidden lg:block">
                    {/* top-0: 패널 스크롤 영역 기준이라 0이어야 좌측 카드 시작선과 정렬 (실측 검증) */}
                    <div className="sticky top-0 space-y-4">
                        <div className="bg-bg-surface border border-ui-border rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-ui-border bg-ui-hover-soft/50">
                                <MaterialIcon size={16} name="lock" className="text-slate-400" />
                                <div>
                                    <p className="text-sm font-medium text-text-base uppercase tracking-widest">
                                        시스템 규칙
                                    </p>
                                    <p className="text-sm text-text-muted mt-0.5">
                                        발동 시:
                                    </p>
                                </div>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="rounded-xl bg-ui-hover-soft/50 p-3">
                                    <p className="text-xs font-medium uppercase tracking-widest text-slate-400">규칙 이름</p>
                                    <p className="mt-1 truncate text-sm text-text-base">{rule.name}</p>
                                </div>
                                <div className="rounded-xl bg-ui-hover-soft/50 p-3">
                                    <p className="text-xs font-medium uppercase tracking-widest text-slate-400">알림 채널</p>
                                    <p className="mt-1 text-sm text-text-base">
                                        {selectedChannels.length === 0
                                            ? `전체 ${effectiveChannelCount}개`
                                            : `${effectiveChannelCount}개 선택`}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-ui-hover-soft/50 p-3">
                                    <p className="text-xs font-medium uppercase tracking-widest text-slate-400">알림 메시지</p>
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

function FullRuleForm({ onSuccess, onCancel, rule, channels, onSubmittingChange }: AlertRuleFormProps) {

    const isEdit = !!rule;
    const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
    const [agents, setAgents] = useState<ConnectedAgent[]>([]);
    const [directServices, setDirectServices] = useState<ObservedService[]>([]);
    const [infrastructureResources, setInfrastructureResources] = useState<InfrastructureResource[]>([]);
    const [conditionPreset, setConditionPreset] = useState<ConditionPreset>('error');
    const [customMessage, setCustomMessage] = useState('');
    const [customThreshold, setCustomThreshold] = useState('');

    const { register, handleSubmit, reset, setValue, watch } = useForm<RuleFormValues>({
        resolver: zodResolver(ruleSchema),
        mode: 'onBlur',
        defaultValues: {
            name: '', ruleCategory: 'endpoint', metric: 'http_status',
            agentId: '', serviceKey: '', serviceId: '', operator: 'gte', threshold: 400,
            duration: 1, severity: 'warning', cooldown: 300, channelIds: [],
        },
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
        api.getObservedServices().then(rows => setDirectServices(rows ?? [])).catch(() => { });
        api.getInfrastructureResources().then(rows => setInfrastructureResources(rows ?? [])).catch(() => { });
    }, []);

    useEffect(() => {
        if (rule) {
            const metric = rule.metric as RuleFormValues['metric'];
            const ruleCategory: RuleCategory = metric === 'otel_metric' ? 'metric'
                : rule.type === 'service' ? 'endpoint' : rule.type === 'log' ? 'log' : 'resource';
            const preset = detectConditionPreset(metric, rule.operator, rule.threshold, rule.duration);
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
            setConditionPreset(preset);
            setCustomMessage(rule.message ?? '');
            if (preset === 'custom') setCustomThreshold(String(rule.threshold));
        }
    }, [rule, reset]);

    const applyPreset = (preset: ConditionPreset, metric: RuleFormValues['metric']) => {
        setConditionPreset(preset);
        const vals = getPresetValues(metric, preset);
        if (vals) {
            setValue('operator', vals.operator);
            setValue('threshold', vals.threshold);
            if (vals.duration != null) setValue('duration', vals.duration);
        }
    };

    const handleCategoryChange = (cat: RuleCategory) => {
        setValue('ruleCategory', cat);
        setValue('agentId', '');
        setValue('serviceKey', '');
        setValue('serviceId', '');
        setValue('metricName', '');
        const newMetric: RuleFormValues['metric'] = cat === 'resource' ? 'cpu' : cat === 'log' ? 'log_level' : cat === 'metric' ? 'otel_metric' : 'http_status';
        setValue('metric', newMetric);
        applyPreset(cat === 'metric' ? 'custom' : 'error', newMetric);
    };

    const handleMetricChange = (m: RuleFormValues['metric']) => {
        setValue('metric', m);
        applyPreset('error', m);
    };

    const handleConditionPreset = (preset: ConditionPreset) => {
        applyPreset(preset, watchedMetric);
        if (preset !== 'custom') {
            setCustomThreshold('');
        } else {
            setCustomThreshold(String(watchedThreshold));
        }
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
            const scoped = isEndpoint || isLog || isMetric;
            const payload = {
                name: data.name,
                // metric rules share the connected-agent (service) rule type.
                type: isLog ? 'log' as const : (isEndpoint || isMetric) ? 'service' as const : 'resource' as const,
                metric: data.metric,
                metricName: isMetric ? (data.metricName || '') : '',
                agentId: data.agentId || null,
                serviceKey: scoped ? (data.serviceKey || null) : null,
                serviceId: scoped ? (data.serviceId || null) : null,
                operator: data.operator,
                threshold: data.threshold,
                duration: data.duration,
                severity: data.severity,
                // ingest-time evals (log/endpoint/metric) are dedup-driven, cooldown 0.
                cooldown: scoped ? 0 : data.cooldown,
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
    const isApiStatus = watchedMetric === 'api_status_code';
    const watchedMetricName = watch('metricName') ?? '';
    const metricName = { cpu: 'CPU', memory: 'Memory', disk: 'Disk', http_status: 'HTTP Status', response_time: 'Response Time', log_level: 'Log Level', api_status_code: 'API Status', otel_metric: 'Metric' }[watchedMetric] ?? watchedMetric;
    const thresholdUnit = watchedMetric === 'response_time' ? 'ms' : (watchedMetric === 'http_status' || watchedMetric === 'log_level' || isApiStatus || isMetric) ? '' : '%';

    // Metric-name suggestions for the datalist: the selected service's exported
    // OTLP metrics. Free text still allowed when no service is selected.
    const [metricNameOptions, setMetricNameOptions] = useState<string[]>([]);
    useEffect(() => {
        if (!isMetric || !watchedAgentId || !watchedServiceKey) { setMetricNameOptions([]); return; }
        api.getAgentServiceOtelMetricNames(watchedAgentId, watchedServiceKey)
            .then(names => setMetricNameOptions((names ?? []).map(n => n.metricName)))
            .catch(() => setMetricNameOptions([]));
    }, [isMetric, watchedAgentId, watchedServiceKey]);
    const selectedAgentService = agentServices.find(s => s.agentId === watchedAgentId && s.key === watchedServiceKey);
    const selectedAgent = agents.find(a => a.id === watchedAgentId);
    const selectedInfrastructureResource = infrastructureResources.find(resource => resource.id === watchedAgentId);
    const directSignal = isMetric ? 'metrics' : isLog ? (isApiStatus ? 'traces' : 'logs') : null;
    const availableDirectServices = directSignal
        ? directServices.filter(service => service.signals.includes(directSignal))
        : [];
    const selectedDirectService = directServices.find(service => service.id === watchedServiceId);
    const targetLabel = isEndpoint || isLog
        ? (selectedDirectService
            ? selectedDirectService.name
            : watchedAgentId && watchedServiceKey
            ? (selectedAgentService ? `${selectedAgentService.agentName} / ${selectedAgentService.name}` : watchedServiceKey)
            : (isLog ? '전체 로그 서비스' : '전체 헬스체크'))
        : isMetric && selectedDirectService
            ? selectedDirectService.name
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
            onSubmit={handleSubmit(onSubmit, () => {
                toast.error('필수 항목을 확인해주세요');
            })}
        >
            <div className="max-w-350 mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

                {/* ── Left: form steps ─────────────────────────────────── */}
                <div className="space-y-4 min-w-0">

                    {/* Step 1: Target */}
                    <FormStep n={1} title="대상">
                        <Field label="카테고리">
                            <div className="flex gap-2">
                                {([
                                    { value: 'endpoint' as const, label: '헬스체크', icon: 'monitor_heart' },
                                    { value: 'log'      as const, label: '로그',        icon: 'article' },
                                    { value: 'metric'   as const, label: '메트릭', icon: 'monitoring' },
                                    { value: 'resource' as const, label: '인프라', icon: 'memory' },
                                ]).map(cat => (
                                    <button
                                        key={cat.value}
                                        type="button"
                                        onClick={() => handleCategoryChange(cat.value)}
                                        className={`flex-1 flex items-center gap-2 px-3 py-3 border-2 rounded-xl transition-all text-left ${
                                            watchedCategory === cat.value
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-ui-border-soft text-text-muted hover:border-slate-200 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <MaterialIcon size={16} name={cat.icon} />
                                        <span className="text-sm">{cat.label}</span>
                                    </button>
                                ))}
                            </div>
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                            <Field
                                htmlFor="rule-target"
                                label="대상"
                                hint={!watchedAgentId ? '미선택 시 모든 대상에 적용됩니다' : null}
                            >
                                {isEndpoint || isLog || isMetric ? (
                                    <Select
                                        id="rule-target"
                                        value={watchedServiceId ? `direct:::${watchedServiceId}` : watchedAgentId && watchedServiceKey ? `${watchedAgentId}:::${watchedServiceKey}` : ''}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (!val) { setValue('agentId', ''); setValue('serviceKey', ''); setValue('serviceId', ''); }
                                            else {
                                                const [scope, key] = val.split(':::');
                                                if (scope === 'direct') { setValue('serviceId', key); setValue('agentId', ''); setValue('serviceKey', ''); }
                                                else { setValue('agentId', scope); setValue('serviceKey', key); setValue('serviceId', ''); }
                                            }
                                        }}

                                    >
                                        <option value="">{isLog ? '전체 로그 서비스' : isMetric ? '모든 서비스' : '전체 헬스체크'}</option>
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

                            <Field htmlFor={isMetric ? 'rule-metric' : undefined} label="지표" hint={isMetric && !watchedServiceKey ? '서비스를 선택하면 수집된 메트릭이 제안됩니다' : null}>
                                {isMetric ? (
                                    <>
                                        <Input
                                            id="rule-metric"
                                            list="otel-metric-names"
                                            value={watchedMetricName}
                                            onChange={e => setValue('metricName', e.target.value)}
                                            placeholder="e.g. jvm.memory.used"

                                        />
                                        <datalist id="otel-metric-names">
                                            {metricNameOptions.map(n => <option key={n} value={n} />)}
                                        </datalist>
                                    </>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {(isLog
                                            ? ['log_level', 'api_status_code'] as const
                                            : isEndpoint
                                            ? ['http_status', 'response_time'] as const
                                            : ['cpu', 'memory', 'disk'] as const
                                        ).map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => handleMetricChange(m)}
                                                className={`px-3 py-2 rounded-lg text-sm border-2 transition-all ${
                                                    watchedMetric === m
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-ui-border-soft text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                                                }`}
                                            >
                                                {m === 'log_level' ? '로그 레벨' : m === 'api_status_code' ? 'API 요청' : m.replace('_', ' ').toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </Field>
                        </div>

                        <Field htmlFor="rule-name" label="규칙 이름" required>
                            <Input
                                id="rule-name"
                                {...register('name')}
                                placeholder="e.g. High CPU usage alert"

                            />
                        </Field>
                    </FormStep>

                    {/* Step 2: Condition */}
                    <FormStep n={2} title="조건">
                        <Field label="프리셋">
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { value: 'normal' as const, icon: 'check_circle', label: '정상' },
                                    { value: 'error'  as const, icon: 'warning',      label: '에러 및 오류' },
                                    { value: 'custom' as const, icon: 'tune',         label: '직접 설정' },
                                ]).map(p => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => handleConditionPreset(p.value)}
                                        className={`flex items-center justify-center gap-1.5 p-3 border-2 rounded-xl transition-all text-sm ${
                                            conditionPreset === p.value
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-ui-border-soft text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <MaterialIcon size={16} name={p.icon} />
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </Field>

                        {conditionPreset === 'custom' && (
                            <div className="grid grid-cols-[auto_1fr_1fr] gap-3 items-end">
                                <Field htmlFor="rule-operator" label="연산자">
                                    <Select
                                        id="rule-operator"
                                        {...register('operator')}
                                        className="w-20"
                                    >
                                        <option value="gt">&gt;</option>
                                        <option value="gte">&ge;</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">&le;</option>
                                        <option value="eq">=</option>
                                    </Select>
                                </Field>
                                <Field htmlFor="rule-threshold-unit" label="임계값">
                                    {watchedMetric === 'log_level' ? (
                                        // Log levels are stored numerically — expose them as named levels
                                        <Select
                                            id="rule-threshold-unit"
                                            value={watchedThreshold}
                                            onChange={e => setValue('threshold', Number(e.target.value))}

                                        >
                                            <option value={4}>ERROR (4)</option>
                                            <option value={3}>WARN (3)</option>
                                            <option value={2}>INFO (2)</option>
                                            <option value={1}>DEBUG (1)</option>
                                            <option value={0}>TRACE (0)</option>
                                        </Select>
                                    ) : (
                                    <div className="flex">
                                        <Input
                                            id="rule-threshold-unit"
                                            type="number"
                                            value={customThreshold}
                                            onChange={e => {
                                                setCustomThreshold(e.target.value);
                                                const n = parseFloat(e.target.value);
                                                if (!isNaN(n)) setValue('threshold', n);
                                            }}
                                            className={thresholdUnit ? "rounded-r-none" : ""}
                                        />
                                        {thresholdUnit && (
                                            <span className="px-3 py-2.5 bg-ui-hover border border-l-0 border-ui-border rounded-r-lg text-sm font-medium text-text-muted font-mono">
                                                {thresholdUnit}
                                            </span>
                                        )}
                                    </div>
                                    )}
                                </Field>
                                {isEndpoint ? (
                                    <Field htmlFor="rule-consecutive" label="연속 체크 횟수">
                                        <Input
                                            id="rule-consecutive"
                                            type="number" min={1} max={20}
                                            {...register('duration', { valueAsNumber: true })}

                                        />
                                    </Field>
                                ) : !isLog ? (
                                    <Field htmlFor="rule-duration" label="지속 시간 (분)">
                                        <Input
                                            id="rule-duration"
                                            type="number" min={1} max={60}
                                            {...register('duration', { valueAsNumber: true })}

                                        />
                                    </Field>
                                ) : (
                                    <Field label="평가 방식">
                                        <p className="text-sm text-slate-400 italic py-2.5">이벤트당 즉시 평가</p>
                                    </Field>
                                )}
                            </div>
                        )}

                        {conditionPreset !== 'custom' && isEndpoint && (
                            <div className="flex items-center justify-between p-3 bg-ui-hover-soft/50 rounded-xl">
                                <div>
                                    <p className="text-sm text-text-base">연속 체크 횟수</p>
                                    <p className="text-sm text-slate-400">알림 발생 전 연속 실패 횟수</p>
                                </div>
                                <Input
                                    type="number" min={1} max={20}
                                    {...register('duration', { valueAsNumber: true })}
                                    className="w-16 text-right font-mono tabular-nums"
                                />
                            </div>
                        )}

                        {!isEndpoint && !isLog && (
                            <Field
                                htmlFor="rule-cooldown"
                                label="쿨다운 (초)"
                                hint="동일 규칙은 이 시간 내 재발송하지 않음"
                            >
                                <Input
                                    id="rule-cooldown"
                                    type="number" min={0} max={86400}
                                    {...register('cooldown', { valueAsNumber: true })}

                                />
                            </Field>
                        )}

                    </FormStep>

                    {/* Step 3: Notify */}
                    <FormStep n={3} title="알림">
                        <Field label="심각도">
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { value: 'critical' as const, active: 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400', dot: 'bg-red-500' },
                                    { value: 'warning'  as const, active: 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
                                    { value: 'info'     as const, active: 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
                                ]).map(s => (
                                    <button
                                        key={s.value}
                                        type="button"
                                        onClick={() => setValue('severity', s.value)}
                                        className={`py-2.5 text-sm rounded-xl border-2 transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${
                                            watchedSeverity === s.value
                                                ? s.active
                                                : 'border-ui-border-soft text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
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
                            <div className="space-y-2">
                                {channels.length === 0 ? (
                                    <p className="text-sm text-slate-400">등록된 알림 채널이 없습니다</p>
                                ) : channels.map(ch => (
                                    <button
                                        key={ch.id}
                                        type="button"
                                        onClick={() => handleToggleChannel(ch.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 border-2 rounded-xl transition-all ${
                                            watchedChannelIds.includes(ch.id)
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-ui-border-soft text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <ChannelIcon type={ch.type} size={16} className={getChannelStyle(ch.type).text} />
                                        <span className="text-sm flex-1 text-left">{ch.name}</span>
                                        <span className="text-sm uppercase tracking-wider text-slate-400">{ch.type}</span>
                                    </button>
                                ))}
                            </div>
                        </Field>

                        <Field
                            htmlFor="rule-message"
                            label="알림 메시지"
                            hint={'선택 · 자동 생성 메시지 대체' + ' · ' + `사용 가능한 변수: ${(isApiStatus
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
                                    <p className="text-sm font-medium text-text-base uppercase tracking-widest">라이브 미리보기</p>
                                    <p className="text-sm text-text-muted mt-0.5">입력값 변경 시 자동 갱신</p>
                                </div>
                            </div>
                            <div className="p-5 space-y-5">

                                {/* IF block */}
                                <div>
                                    <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">조건</p>
                                    <div className="bg-slate-900 dark:bg-slate-950 rounded-lg px-4 py-3 font-mono text-xs leading-7">
                                        <div>
                                            <span className="text-sky-300">IF </span>
                                            <span className="text-amber-300">{metricName} </span>
                                            <span className="text-slate-400">{OPERATOR_SYMBOLS[watchedOperator] ?? watchedOperator} </span>
                                            <span className="text-red-300">{watchedThreshold}{thresholdUnit}</span>
                                        </div>
                                        {isEndpoint && (
                                            <div className="pl-4">
                                                <span className="text-sky-300">FAILS </span>
                                                <span className="text-violet-300">{watchedDuration}×</span>
                                            </div>
                                        )}
                                        {!isEndpoint && !isLog && (
                                            <div className="pl-4">
                                                <span className="text-sky-300">FOR </span>
                                                <span className="text-violet-300">{watchedDuration} min</span>
                                            </div>
                                        )}
                                        {isLog && (
                                            <div className="pl-4">
                                                <span className="text-sky-300">PER </span>
                                                <span className="text-violet-300">event (immediate)</span>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-sky-300">ON </span>
                                            <span className="text-emerald-300 truncate">{targetLabel}</span>
                                        </div>
                                        {!isEndpoint && !isLog && (
                                            <div>
                                                <span className="text-sky-300">COOLDOWN </span>
                                                <span className="text-slate-400">{watchedCooldown}s</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* THEN block */}
                                <div>
                                    <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">메시지</p>
                                    <div className={`rounded-xl px-3 py-3 ${severityClasses.bg}`}>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs uppercase tracking-wide ${severityClasses.badge}`}>
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
                                    <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">
                                        {watchedChannelIds.length === 0
                                            ? `발송 → 전체 ${channels.length}개 채널`
                                            : `발송 → ${watchedChannelIds.length}개 선택`}
                                    </p>
                                    <div className="space-y-1.5">
                                        {channels.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">등록된 알림 채널이 없습니다</p>
                                        ) : previewChannels.slice(0, 5).map(ch => (
                                            <div key={ch.id} className="flex items-center gap-2 px-3 py-1.5 bg-ui-hover-soft/50 rounded-lg">
                                                <ChannelIcon type={ch.type} size={14} className={getChannelStyle(ch.type).text} />
                                                <span className="text-sm font-medium text-text-secondary flex-1 truncate">{ch.name}</span>
                                                <span className="text-xs text-slate-400 uppercase">{ch.type}</span>
                                            </div>
                                        ))}
                                        {previewChannels.length > 5 && (
                                            <p className="text-sm text-slate-400 italic pl-1">{`+${previewChannels.length - 5}개 더`}</p>
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errors';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { api } from '../../services/api';
import { env } from '../../config/env';
import { SettingsDesktopView } from '../../features/settings/components/SettingsDesktopView';
import { SettingsMobileView } from '../../features/settings/components/SettingsMobileView';

export function SettingsPage() {

  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [metricsRetention, setMetricsRetention] = useState('7d');
  const [logsRetention, setLogsRetention] = useState('3d');
  const [collectInterval, setCollectInterval] = useState(30);
  const [consecutiveFailures, setConsecutiveFailures] = useState(3);
  const [backendLoading, setBackendLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setSettingsError(null);
      try {
        const settings = await api.getSettings();
        setMetricsRetention(settings.retention.metrics);
        setLogsRetention(settings.retention.logs);
        setCollectInterval(settings.system.collectInterval);
        setConsecutiveFailures(settings.alerts.consecutiveFailures);
      } catch (error) {
        setSettingsError(getErrorMessage(error));
      } finally {
        setBackendLoading(false);
      }
    };
    load();
  }, []);

  // 모든 설정은 선택 즉시 저장 (백엔드 PUT은 부분 업데이트 지원). 실패 시 롤백.
  const saveSetting = async (patch: Parameters<typeof api.updateSettings>[0], rollback: () => void) => {
    try {
      await api.updateSettings(patch);
      toast.success('저장되었습니다');
    } catch (error) {
      rollback();
      toast.error(getErrorMessage(error));
    }
  };

  const handleConsecutiveFailuresChange = (n: number) => {
    const prev = consecutiveFailures;
    setConsecutiveFailures(n);
    saveSetting({ alerts: { consecutiveFailures: n } }, () => setConsecutiveFailures(prev));
  };

  const handleMetricsRetentionChange = (value: string) => {
    const prev = metricsRetention;
    setMetricsRetention(value);
    saveSetting({ retention: { metrics: value, logs: logsRetention } }, () => setMetricsRetention(prev));
  };

  const handleLogsRetentionChange = (value: string) => {
    const prev = logsRetention;
    setLogsRetention(value);
    saveSetting({ retention: { metrics: metricsRetention, logs: value } }, () => setLogsRetention(prev));
  };

  const handleCollectIntervalChange = (seconds: number) => {
    const prev = collectInterval;
    setCollectInterval(seconds);
    saveSetting({ system: { collectInterval: seconds } }, () => setCollectInterval(prev));
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.resetAccount();
      toast.success('계정이 초기화되었습니다. 다시 로그인해 주세요.');
      logout();
      navigate('/login');
    } catch (error) {
      toast.error(getErrorMessage(error));
      setResetting(false);
    }
  };

  const sharedProps = {
    theme: theme as 'light' | 'dark',
    metricsRetention,
    logsRetention,
    collectInterval,
    consecutiveFailures,
    backendLoading,
    settingsError,
    showResetConfirm,
    resetting,
    onThemeChange: setTheme,
    onMetricsRetentionChange: handleMetricsRetentionChange,
    onLogsRetentionChange: handleLogsRetentionChange,
    onCollectIntervalChange: handleCollectIntervalChange,
    onConsecutiveFailuresChange: handleConsecutiveFailuresChange,
    onResetClick: () => !env.useMock && setShowResetConfirm(true),
    onResetConfirm: handleReset,
    onResetCancel: () => setShowResetConfirm(false),
    onRetryLoad: () => {
      setBackendLoading(true);
      void api.getSettings()
        .then((settings) => {
          setMetricsRetention(settings.retention.metrics);
          setLogsRetention(settings.retention.logs);
          setCollectInterval(settings.system.collectInterval);
          setConsecutiveFailures(settings.alerts.consecutiveFailures);
          setSettingsError(null);
        })
        .catch((error) => setSettingsError(getErrorMessage(error)))
        .finally(() => setBackendLoading(false));
    },
  } as const;

  if (isMobile) return <SettingsMobileView {...sharedProps} />;

  return <SettingsDesktopView {...sharedProps} />;
}

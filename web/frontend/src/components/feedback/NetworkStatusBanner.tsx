import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { MaterialIcon } from '../common';

export function NetworkStatusBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white py-2 px-4">
      <div className="flex items-center justify-center gap-2 text-sm">
        <MaterialIcon size={20} name="wifi_off" className="animate-pulse" />
        <span>서버와 연결이 끊어졌습니다. 재연결 시도 중…</span>
      </div>
    </div>
  );
}

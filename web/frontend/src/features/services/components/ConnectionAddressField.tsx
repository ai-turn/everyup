import { Input } from '../../../components/common';
import type { useConnectionAddress } from '../useConnectionAddress';

export function ConnectionAddressField({ address }: { address: ReturnType<typeof useConnectionAddress> }) {
  return <label className="block space-y-1.5 type-label text-text-secondary">
    EveryUp 외부 연결 주소
    <Input type="url" value={address.baseUrl} onChange={event => address.setBaseUrl(event.target.value)} placeholder="https://monitor.example.com" warn={!address.valid} />
    <span className="block type-body text-text-muted">{address.error || 'Collector 또는 앱에서 접근할 수 있는 서버 주소입니다. localhost는 사용할 수 없습니다.'}</span>
  </label>;
}

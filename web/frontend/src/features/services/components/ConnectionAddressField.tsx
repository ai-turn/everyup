import { useId } from 'react';
import { Input } from '../../../components/common';
import { Field } from '../../alerts/components/FormLayout';
import type { useConnectionAddress } from '../useConnectionAddress';

// 라벨 → 입력 8px, 입력 → 도움말 4px는 Field가 정한다(DESIGN.md §6 폼 리듬).
export function ConnectionAddressField({ address }: { address: ReturnType<typeof useConnectionAddress> }) {
  const id = useId();
  return (
    <Field label="EveryUp 외부 연결 주소" htmlFor={id} hint={address.error || 'Collector 또는 앱에서 접근할 수 있는 서버 주소입니다. localhost는 사용할 수 없습니다.'}>
      <Input id={id} type="url" value={address.baseUrl} onChange={event => address.setBaseUrl(event.target.value)} placeholder="https://monitor.example.com" warn={!address.valid} />
    </Field>
  );
}

import { Input } from '../../../components/common';
import { Field } from '../../alerts/components/FormLayout';
import type { useServerForm } from '../useServerForm';

export function ServerFields({ form, idPrefix }: { form: ReturnType<typeof useServerForm>; idPrefix: string }) {
  const { draft, update, nameError, nameRef } = form;
  return (
    <>
      <Field label="이름" htmlFor={`${idPrefix}-name`} required error={nameError ?? undefined}>
        <Input id={`${idPrefix}-name`} ref={nameRef} maxLength={200}
          invalid={Boolean(nameError)} value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="예: web-01" />
      </Field>
      <Field label="설명" htmlFor={`${idPrefix}-description`}>
        <Input id={`${idPrefix}-description`} value={draft.description} onChange={(event) => update('description', event.target.value)} />
      </Field>
    </>
  );
}

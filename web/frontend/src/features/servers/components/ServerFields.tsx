import { useEffect, useState } from 'react';
import { Button, Input, Select } from '../../../components/common';
import { api, type Project } from '../../../services/api';
import { Field } from '../../alerts/components/FormLayout';
import type { useServerForm } from '../useServerForm';

export function ServerFields({ form, idPrefix }: { form: ReturnType<typeof useServerForm>; idPrefix: string }) {
  const { draft, update, nameError, nameRef } = form;
  const [projects, setProjects] = useState<Project[] | null | 'error'>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    api.getProjects().then((rows) => { if (alive) setProjects(rows ?? []); }, () => { if (alive) setProjects('error'); });
    return () => { alive = false; };
  }, [attempt]);

  return (
    <>
      <Field label="이름" htmlFor={`${idPrefix}-name`} required error={nameError ?? undefined}>
        <Input id={`${idPrefix}-name`} ref={nameRef} required maxLength={200} pattern={'.*\\S.*'} title="공백 이외의 이름을 입력하세요."
          invalid={Boolean(nameError)} value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="예: web-01" />
      </Field>
      <Field label="설명" htmlFor={`${idPrefix}-description`}>
        <Input id={`${idPrefix}-description`} value={draft.description} onChange={(event) => update('description', event.target.value)} />
      </Field>
      {projects === 'error' ? (
        <Field label="그룹">
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="type-body text-text-muted">그룹 목록을 불러오지 못했습니다. 그룹은 지금 값 그대로 저장됩니다.</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => { setProjects(null); setAttempt((n) => n + 1); }}>다시 시도</Button>
          </div>
        </Field>
      ) : (
        <Field label="그룹" htmlFor={`${idPrefix}-group`}>
          <Select id={`${idPrefix}-group`} aria-label="그룹" value={draft.projectId} disabled={projects === null} onChange={(event) => update('projectId', event.target.value)}>
            <option value="">{projects === null ? '불러오는 중…' : '미분류'}</option>
            {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </Select>
        </Field>
      )}
    </>
  );
}

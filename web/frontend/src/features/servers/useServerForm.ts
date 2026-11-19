import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { ServerInput } from '../../services/api';
import { ApiError, getErrorMessage } from '../../utils/errors';
import { groupChangeFailure } from '../../pages/projects/projectMembers';

// 서버 추가 화면과 서버 설정 대화 상자가 같은 입력과 같은 오류 처리를 쓴다.

interface ServerDraft { name: string; description: string; projectId: string }

export function useServerForm(initial: ServerDraft) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // 저장 중에는 입력이 비활성이라 포커스를 받지 못한다. 다시 활성화된 뒤에 옮긴다.
  useEffect(() => { if (nameError) nameRef.current?.focus(); }, [nameError]);

  // 서버 수정은 전체 교체다. 세 값을 항상 모두 보내고, 그룹이 없으면 projectId를 빼서 해제한다.
  const submit = async (save: (input: ServerInput) => Promise<void>) => {
    setSaving(true);
    setNameError(null);
    try {
      await save({ name: draft.name.trim(), description: draft.description.trim(), projectId: draft.projectId || undefined });
    } catch (error) {
      // 미분류이면 "이 그룹"이 아니라 미분류에 같은 이름이 있다.
      if (error instanceof ApiError && error.code === 'SERVER_NAME_TAKEN') setNameError(groupChangeFailure(error, draft.projectId || undefined));
      else toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof ServerDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key !== 'description') setNameError(null);
  };

  return { draft, update, saving, nameError, nameRef, submit };
}


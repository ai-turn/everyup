import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { ServerUpdate } from '../../services/api';
import { ApiError, getErrorMessage } from '../../utils/errors';

// 서버 추가 화면과 서버 설정 대화 상자가 같은 입력과 같은 오류 처리를 쓴다.

interface ServerDraft { name: string; description: string }

export function useServerForm(initial: ServerDraft) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // 저장 중에는 입력이 비활성이라 포커스를 받지 못한다. 다시 활성화된 뒤에 옮긴다.
  useEffect(() => { if (nameError) nameRef.current?.focus(); }, [nameError]);

  // 서버 수정은 전체 교체다. 이름과 설명을 항상 함께 보낸다.
  const submit = async (save: (input: ServerUpdate) => Promise<void>) => {
    // 브라우저 기본 검증(말풍선) 대신 입력 아래에 같은 모양의 오류를 둔다(폼은 noValidate, UI/UX 점검 A5).
    if (!draft.name.trim()) {
      setNameError('서버 이름을 입력하세요');
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    setNameError(null);
    try {
      await save({ name: draft.name.trim(), description: draft.description.trim() });
    } catch (error) {
      // 서버 이름은 전체에서 하나다(대소문자, 앞뒤 공백 무시).
      if (error instanceof ApiError && error.code === 'SERVER_NAME_TAKEN') setNameError('같은 이름의 서버가 있습니다');
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


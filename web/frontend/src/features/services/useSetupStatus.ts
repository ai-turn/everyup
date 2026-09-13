import { useEffect, useState } from 'react';
import { request } from '../../services/api/base';
import { getErrorMessage } from '../../utils/errors';

export function useSetupStatus<T>(path: string | null) {
  const [result, setResult] = useState<{ path: string; data: T } | null>(null);
  const [failure, setFailure] = useState<{ path: string; message: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await request<T>(path);
        if (active) { setResult({ path, data }); setFailure(null); }
      } catch (error) { if (active) setFailure({ path, message: getErrorMessage(error) }); }
      finally { if (active) timer = setTimeout(() => void poll(), 5000); }
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [path]);
  return { data: result?.path === path ? result.data : null, error: failure?.path === path ? failure.message : '' };
}

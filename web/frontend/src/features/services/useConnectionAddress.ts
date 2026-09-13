import { useEffect, useRef, useState } from 'react';
import { env } from '../../config/env';
import { request } from '../../services/api/base';
import { getErrorMessage } from '../../utils/errors';
import { connectionBaseUrl, validConnectionUrl } from './connectionAddress';

export function useConnectionAddress() {
  const [baseUrl, setBaseUrl] = useState(() => connectionBaseUrl('', env.apiBaseUrl, window.location.origin));
  const [error, setError] = useState('');
  const edited = useRef(false);
  useEffect(() => {
    let active = true;
    request<{ publicUrl: string }>('/settings/connection').then(settings => {
      if (active && !edited.current) setBaseUrl(connectionBaseUrl(settings.publicUrl, env.apiBaseUrl, window.location.origin));
    }).catch(error => { if (active) setError(getErrorMessage(error)); });
    return () => { active = false; };
  }, []);
  return {
    baseUrl, error,
    setBaseUrl: (value: string) => { edited.current = true; setBaseUrl(value); },
    valid: validConnectionUrl(baseUrl),
    endpoint: validConnectionUrl(baseUrl) ? `${baseUrl.replace(/\/+$/, '')}/api/v1/otlp` : '',
  };
}

export function connectionBaseUrl(publicUrl: string, apiBaseUrl: string, origin: string): string {
  try {
    const base = publicUrl.trim() || new URL(apiBaseUrl, origin).href.replace(/\/api\/v1\/?$/, '');
    return validConnectionUrl(base) ? base.replace(/\/+$/, '') : '';
  } catch { return ''; }
}

export function validConnectionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
      && !url.username && !url.password && !url.search && !url.hash
      && !['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
  } catch { return false; }
}

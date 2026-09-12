export type ApiMockMode = 'mock' | 'fallback' | 'off';

const normalizeMockMode = (value: string | undefined): ApiMockMode => {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'off' || normalized === 'false' || normalized === '0' || normalized === 'real') {
    return 'off';
  }

  if (normalized === 'fallback' || normalized === 'auto') {
    return 'fallback';
  }

  return 'mock';
};

export const apiMockMode = normalizeMockMode(process.env.NEXT_PUBLIC_API_MOCK_MODE);
export const apiMockModeLabel: Record<ApiMockMode, string> = {
  mock: 'Mock',
  fallback: '接口优先',
  off: '真实接口',
};

export const shouldRequestApi = apiMockMode !== 'mock';
export const canUseMockData = apiMockMode !== 'off';
export const isMockOnly = apiMockMode === 'mock';

export const getApiBase = () => (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
export const getWsBase = () => (process.env.NEXT_PUBLIC_WS_BASE_URL ?? '').replace(/\/+$/, '');

export const buildApiUrl = (path: string, params?: Record<string, string | number | boolean | undefined>) => {
  const apiBase = getApiBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = new URL(`${apiBase}${normalizedPath}`, origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url;
};

export const buildWsUrl = (path: string) => {
  const wsBase = getWsBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (wsBase) {
    return `${wsBase}${normalizedPath}`;
  }

  if (typeof window === 'undefined') {
    return `ws://localhost${normalizedPath}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${normalizedPath}`;
};

export const unwrapApiData = (payload: unknown) => {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data: unknown }).data;
  }

  return payload;
};

/**
 * Bypass browser HTTP/1.1 ~6-connection limit by pulling HTTP-FLV through
 * same-origin WebSocket relay hosted by scripts/serve-static.mjs.
 */
export const buildFlvProxyWsUrl = (upstreamFlvUrl: string) => {
  const proxy = new URL(buildWsUrl('/api/media/flv-ws'));
  proxy.searchParams.set('target', upstreamFlvUrl);
  return proxy.toString();
};

/**
 * Resolve ladle snapshotPath for <img src>.
 * - http(s) / protocol-relative / web paths: use directly (via API base when relative)
 * - Windows absolute file paths (D:\...): same-origin Node proxy in serve-static.mjs
 */
export const resolveSnapshotUrl = (snapshotPath: string) => {
  const trimmed = snapshotPath.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) {
    const protocol = typeof window === 'undefined' ? 'http:' : window.location.protocol;
    return `${protocol}${trimmed}`;
  }

  // Backend returns OS absolute paths like D:\data\ladle\xxx.jpg — browsers cannot open
  // those; serve-static reads the file on the same host and exposes it over HTTP.
  const isWindowsAbs = /^[A-Za-z]:[\\/]/.test(trimmed);
  const isUncPath = trimmed.startsWith('\\\\');
  if (isWindowsAbs || isUncPath) {
    const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    const url = new URL('/api/media/snapshot', origin);
    url.searchParams.set('path', trimmed);
    return url.toString();
  }

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return buildApiUrl(path).toString();
};

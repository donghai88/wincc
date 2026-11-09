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
/** 测温截图静态资源根，例如 http://192.168.1.109:85（对接 /snapshots/... 相对路径） */
export const getSnapshotBase = () => (process.env.NEXT_PUBLIC_SNAPSHOT_BASE_URL ?? '').replace(/\/+$/, '');

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
 * - http(s) / protocol-relative: use directly
 * - Windows absolute / UNC: same-origin Node proxy `/api/media/snapshot`
 * - Web paths like `/snapshots/...`: join NEXT_PUBLIC_SNAPSHOT_BASE_URL when set
 *   (不要拼到 /api 上，静态图通常由独立静态服务或 Nginx 提供)
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
  const snapshotBase = getSnapshotBase();
  if (snapshotBase) {
    return `${snapshotBase}${path}`;
  }

  // `/api` 是 REST 前缀，不能用来拼静态截图路径，否则会变成 /api/snapshots/... 404
  const apiBase = getApiBase();
  if (!apiBase || apiBase === '/api' || apiBase.endsWith('/api')) {
    const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    return new URL(path, origin).toString();
  }

  return buildApiUrl(path).toString();
};

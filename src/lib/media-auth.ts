import { buildApiUrl } from '@/lib/api-config';

type TokenResponse = {
  code?: number;
  msg?: unknown;
  data?: unknown;
  access_token?: unknown;
  token?: unknown;
};

let cachedToken: string | null = null;
let inflight: Promise<string> | null = null;

const readTokenCandidate = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

/** Reject status text like「成功」when APIs put JWT/opaque token in msg. */
const looksLikeAccessToken = (value: string) => {
  if (value.length < 16) return false;
  if (/[\u4e00-\u9fff\s]/.test(value)) return false;
  const lower = value.toLowerCase();
  if (['ok', 'success', 'true', 'false', 'null', 'undefined'].includes(lower)) return false;
  return /^[A-Za-z0-9._\-+=/~]+$/.test(value);
};

const extractAccessToken = (payload: unknown): string => {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('媒体鉴权接口返回结构异常');
  }

  const record = payload as TokenResponse;
  if (typeof record.code === 'number' && record.code !== 200 && record.code !== 0) {
    const detail = readTokenCandidate(record.msg) || `code ${record.code}`;
    throw new Error(`媒体鉴权失败（${detail}）`);
  }

  const nested = typeof record.data === 'object' && record.data !== null
    ? record.data as Record<string, unknown>
    : null;

  // Prefer explicit token fields. Only treat msg as token when it looks like one
  // (some backends return JWT in msg; others put「成功」there).
  const candidates = [
    readTokenCandidate(nested?.access_token),
    readTokenCandidate(nested?.token),
    readTokenCandidate(record.access_token),
    readTokenCandidate(record.token),
    readTokenCandidate(nested?.msg),
    readTokenCandidate(record.msg),
  ];

  const token = candidates.find((item) => looksLikeAccessToken(item))
    || candidates.find((item) => item.length > 0 && !/[\u4e00-\u9fff]/.test(item) && item.length >= 16)
    || '';

  if (!token) {
    throw new Error('媒体鉴权接口未返回 access_token');
  }

  return token;
};

const fetchAccessToken = async () => {
  const response = await fetch(buildApiUrl('/device/getToken'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`媒体鉴权接口失败（HTTP ${response.status}）`);
  }

  const payload = await response.json() as unknown;
  return extractAccessToken(payload);
};

/** Shared media access_token from A service (/device/getToken). */
export const getMediaAccessToken = async (options?: {
  forceRefresh?: boolean;
}) => {
  if (!options?.forceRefresh && cachedToken) {
    return cachedToken;
  }

  if (!options?.forceRefresh && inflight) {
    return inflight;
  }

  const request = fetchAccessToken()
    .then((token) => {
      cachedToken = token;
      return token;
    })
    .finally(() => {
      if (inflight === request) inflight = null;
    });

  inflight = request;
  return request;
};

export const invalidateMediaAccessToken = () => {
  cachedToken = null;
};

/**
 * WIS3000 play URL auth: append token in query as `Bearer <token>`
 * (not Authorization header — that triggers CORS preflight rejection).
 *
 * webrtc: .../webrtc?...&vcodec=h264&Bearer <token>
 * flv:    .../xxx.live.flv?Bearer <token>
 *
 * Space is encoded as %20 so fetch/mpegts/Node http.request accept the URL.
 */
export const buildAuthenticatedStreamUrl = (streamUrl: string, token: string) => {
  const trimmedToken = token.trim();
  if (!trimmedToken) return streamUrl;

  const url = new URL(streamUrl);
  if (url.pathname.toLowerCase().includes('/webrtc') && !url.searchParams.get('vcodec')) {
    url.searchParams.set('vcodec', 'h264');
  }

  // Drop any previous Bearer query fragment before re-appending.
  const withoutBearer = url.toString()
    .replace(/([?&])Bearer(?:[+%20 ]|=)[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');

  const separator = withoutBearer.includes('?') ? '&' : '?';
  return `${withoutBearer}${separator}Bearer%20${encodeURIComponent(trimmedToken)}`;
};

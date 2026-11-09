import {
  buildLadleListNoPagePath,
  getMockLadleNos,
  queryLadleListNoPage,
} from '@/data/ladle-api-config';
import {
  buildApiUrl,
  canUseMockData,
  isMockOnly,
  unwrapApiData,
} from '@/lib/api-config';

/** 拉取钢包号下拉选项：真实环境走 GET /ladle/listNoPage */
export async function fetchLadleNoOptions(): Promise<string[]> {
  if (isMockOnly) {
    return getMockLadleNos();
  }

  try {
    const response = await fetch(buildApiUrl(buildLadleListNoPagePath()), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as unknown;
    const data = unwrapApiData(payload);
    if (Array.isArray(data)) {
      const nos = data
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim());
      if (nos.length > 0) return Array.from(new Set(nos));
    }
  } catch {
    // fall through
  }

  if (canUseMockData) return getMockLadleNos();
  const local = queryLadleListNoPage().data;
  return local.length > 0 ? local : getMockLadleNos();
}

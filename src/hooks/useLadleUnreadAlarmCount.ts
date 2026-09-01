'use client';

import { useEffect, useState } from 'react';
import { buildLadleAlarmPagePath, queryLadleAlarmPage } from '@/data/ladle-api-config';
import { buildApiUrl, isMockOnly, unwrapApiData } from '@/lib/api-config';
import { formatLadleDateTime } from '@/data/ladle-api-config';

const REFRESH_INTERVAL_MS = 30_000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const getRecentSevenDayRange = () => {
  const end = new Date();
  const start = new Date(end.getTime() - SEVEN_DAYS_MS);
  return {
    startTime: formatLadleDateTime(start),
    endTime: formatLadleDateTime(end),
  };
};

export function useLadleUnreadAlarmCount(enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    if (isMockOnly) {
      const data = queryLadleAlarmPage({
        pageNum: 1,
        pageSize: 1,
        isRead: 0,
        ...getRecentSevenDayRange(),
      }).data;
      setCount(data.total);
      return undefined;
    }

    let disposed = false;
    let controller: AbortController | undefined;

    const loadCount = async () => {
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch(
          buildApiUrl(buildLadleAlarmPagePath({
            pageNum: 1,
            pageSize: 1,
            isRead: 0,
            ...getRecentSevenDayRange(),
          })),
          {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          },
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = await response.json() as unknown;
        const data = unwrapApiData(payload) as { total?: number };
        if (!disposed) setCount(typeof data.total === 'number' ? Math.max(0, data.total) : 0);
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return;
        if (!disposed) setCount(null);
      }
    };

    void loadCount();
    const intervalId = window.setInterval(() => void loadCount(), REFRESH_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      controller?.abort();
    };
  }, [enabled]);

  return count;
}

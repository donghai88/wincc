'use client';

import { useEffect, useState } from 'react';
import { buildAlarmPageApiPath } from '@/data/wincc-config';
import { buildApiUrl, isMockOnly, unwrapApiData } from '@/lib/api-config';

const REFRESH_INTERVAL_MS = 30_000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const pad = (value: number) => String(value).padStart(2, '0');

const formatDateTimeValue = (date: Date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
);

/** Same rolling 7-day window as AlarmCenter list / location stats. */
const getRecentSevenDayRange = () => {
  const end = new Date();
  const start = new Date(end.getTime() - SEVEN_DAYS_MS);
  return {
    startTime: formatDateTimeValue(start),
    endTime: formatDateTimeValue(end),
  };
};

const pickUnreadAlarmCount = (payload: unknown) => {
  const data = unwrapApiData(payload);

  if (!isRecord(data) || typeof data.total !== 'number' || !Number.isFinite(data.total)) {
    throw new Error('告警分页接口返回缺少 total');
  }

  return Math.max(0, Math.trunc(data.total));
};

/** Unread alarm total within the recent 7 days (aligned with Alarm Center). */
export function useUnreadAlarmCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (isMockOnly) {
      return undefined;
    }

    let disposed = false;
    let controller: AbortController | undefined;

    const loadUnreadAlarmCount = async () => {
      controller?.abort();
      controller = new AbortController();
      const timeRange = getRecentSevenDayRange();

      try {
        const response = await fetch(
          buildApiUrl(buildAlarmPageApiPath({
            pageNum: 1,
            pageSize: 1,
            isRead: 0,
            startTime: timeRange.startTime,
            endTime: timeRange.endTime,
          })),
          {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          }
        );

        if (!response.ok) throw new Error(`/alarm/page HTTP ${response.status}`);

        const payload = await response.json() as unknown;
        if (!disposed) setCount(pickUnreadAlarmCount(payload));
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return;
        if (!disposed) setCount(null);
      }
    };

    void loadUnreadAlarmCount();
    const intervalId = window.setInterval(() => void loadUnreadAlarmCount(), REFRESH_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      controller?.abort();
    };
  }, []);

  return count;
}

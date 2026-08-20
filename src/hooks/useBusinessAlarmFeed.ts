'use client';

import { useEffect, useState } from 'react';
import {
  buildWsUrl,
  canUseMockData,
  isMockOnly,
  unwrapApiData,
} from '@/lib/api-config';
import type {
  BusinessAlarmFeed,
  BusinessAlarmFeedSource,
  DigitalTwinBusinessAlarm,
} from '@/types/digital-twin';

const BUSINESS_ALARM_WS_PATH = '/ws/business/alarm';
const MOCK_ALARM_DELAY_MS = 10000;
const MOCK_ALARM_MESSAGE = '收到高温报警推送';

type RawBusinessAlarm = Omit<DigitalTwinBusinessAlarm, 'receivedAt' | 'source'>;

const DOCUMENTED_HIGH_TEMP_ALARM: RawBusinessAlarm = {
  id: null,
  eventId: '2072957326901510148',
  alarmId: '2072957326901510148',
  eventTimeStamp: '2026-07-03 16:15:15',
  devId: '2065240549537427527',
  channelName: '9_1',
  num: 1,
  ruleType: '高温大于',
  level: '1',
  avgTemp: 40.2,
  minTemp: 26.3,
  maxTemp: 73.1,
  thresholdTemp: 50.0,
  locationName: '位置1',
  isRead: 0,
  processor: null,
  processContent: null,
  processTime: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const readString = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
};

const readNullableString = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : null;
};

const readNumber = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
};

const readLevel = (record: Record<string, unknown>) => {
  const value = readString(record, 'level');
  return value === '2' ? '2' : '1';
};

const readReadState = (record: Record<string, unknown>) => {
  const value = readNumber(record, 'isRead');
  return value === 1 ? 1 : 0;
};

const formatReceivedAt = () => {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
};

const normalizeAlarm = (
  alarm: RawBusinessAlarm,
  source: BusinessAlarmFeedSource
): DigitalTwinBusinessAlarm => {
  return {
    ...alarm,
    receivedAt: formatReceivedAt(),
    source,
  };
};

const pickBusinessAlarms = (payload: unknown): RawBusinessAlarm[] => {
  const body = unwrapApiData(payload);
  const rows = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.list)
      ? body.list
      : [];

  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];

    const eventId = readString(row, 'eventId');
    const alarmId = readString(row, 'alarmId');
    const eventTimeStamp = readString(row, 'eventTimeStamp');
    const devId = readString(row, 'devId');
    const channelName = readString(row, 'channelName');
    const ruleType = readString(row, 'ruleType');
    const locationName = readString(row, 'locationName');
    const num = readNumber(row, 'num');
    const avgTemp = readNumber(row, 'avgTemp');
    const minTemp = readNumber(row, 'minTemp');
    const maxTemp = readNumber(row, 'maxTemp');
    const thresholdTemp = readNumber(row, 'thresholdTemp');

    if (
      !eventId ||
      !alarmId ||
      !eventTimeStamp ||
      !devId ||
      !channelName ||
      !ruleType ||
      !locationName ||
      num === null ||
      avgTemp === null ||
      minTemp === null ||
      maxTemp === null ||
      thresholdTemp === null
    ) {
      return [];
    }

    return [{
      id: readNumber(row, 'id'),
      eventId,
      alarmId,
      eventTimeStamp,
      devId,
      channelName,
      num,
      ruleType,
      level: readLevel(row),
      avgTemp,
      minTemp,
      maxTemp,
      thresholdTemp,
      locationName,
      isRead: readReadState(row),
      processor: readNullableString(row, 'processor'),
      processContent: readNullableString(row, 'processContent'),
      processTime: readNullableString(row, 'processTime'),
    }];
  });
};

const parseSocketPayload = (data: unknown) => {
  if (typeof data !== 'string') return [];

  try {
    return pickBusinessAlarms(JSON.parse(data));
  } catch {
    return [];
  }
};

const createInitialFeed = (): BusinessAlarmFeed => ({
  status: isMockOnly ? 'idle' : 'connecting',
  alarm: null,
  message: '',
});

export function useBusinessAlarmFeed(): BusinessAlarmFeed {
  const [feed, setFeed] = useState<BusinessAlarmFeed>(() => createInitialFeed());

  useEffect(() => {
    let disposed = false;
    let mockAlarmTimer: number | undefined;
    let socket: WebSocket | undefined;

    const clearMockAlarmTimer = () => {
      if (mockAlarmTimer !== undefined) {
        window.clearTimeout(mockAlarmTimer);
        mockAlarmTimer = undefined;
      }
    };

    const pushMockAlarm = (source: BusinessAlarmFeedSource, message = MOCK_ALARM_MESSAGE) => {
      if (disposed) return;
      setFeed({
        status: source === 'fallback' ? 'fallback' : 'mock',
        alarm: normalizeAlarm(DOCUMENTED_HIGH_TEMP_ALARM, source),
        message,
      });
    };

    const scheduleMockAlarm = (source: BusinessAlarmFeedSource, message = MOCK_ALARM_MESSAGE, delay = MOCK_ALARM_DELAY_MS) => {
      clearMockAlarmTimer();
      mockAlarmTimer = window.setTimeout(() => pushMockAlarm(source, message), delay);
    };

    const stopSocket = () => {
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
      socket = undefined;
    };

    if (isMockOnly) {
      scheduleMockAlarm('mock');
      return () => {
        disposed = true;
        clearMockAlarmTimer();
        stopSocket();
      };
    }

    const fallBackOrError = (message: string) => {
      if (canUseMockData) {
        scheduleMockAlarm('fallback', message, 0);
        return;
      }

      setFeed((current) => ({
        ...current,
        status: 'error',
        message,
      }));
    };

    try {
      socket = new WebSocket(buildWsUrl(BUSINESS_ALARM_WS_PATH));

      socket.addEventListener('open', () => {
        if (disposed) return;
        setFeed((current) => ({
          ...current,
          status: 'connected',
          message: '',
        }));
      });

      socket.addEventListener('message', (event) => {
        const alarms = parseSocketPayload(event.data);
        const firstAlarm = alarms[0];
        if (!firstAlarm || disposed) return;

        setFeed({
          status: 'connected',
          alarm: normalizeAlarm(firstAlarm, 'ws'),
          message: '',
        });
      });

      socket.addEventListener('error', () => {
        if (disposed || mockAlarmTimer !== undefined) return;
        fallBackOrError('报警推送连接失败');
      });

      socket.addEventListener('close', () => {
        if (disposed || mockAlarmTimer !== undefined) return;
        fallBackOrError('报警推送已断开');
      });
    } catch {
      window.setTimeout(() => {
        if (disposed) return;
        fallBackOrError('报警推送初始化失败');
      }, 0);
    }

    return () => {
      disposed = true;
      clearMockAlarmTimer();
      stopSocket();
    };
  }, []);

  return feed;
}

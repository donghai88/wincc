'use client';

import { useEffect, useState } from 'react';
import {
  buildWsUrl,
  canUseMockData,
  isMockOnly,
} from '@/lib/api-config';
import { createMockModbusPayload } from '@/data/ladle-api-config';
import type { LadleModbusPayload } from '@/types/ladle-api';

export type LadleModbusFeedStatus = 'idle' | 'mock' | 'connecting' | 'connected' | 'fallback' | 'error' | 'retrying';
export type LadleModbusFeedSource = 'mock' | 'ws' | 'fallback';

export interface LadleModbusFeed {
  status: LadleModbusFeedStatus;
  source: LadleModbusFeedSource;
  message: string;
  payload: LadleModbusPayload | null;
  updatedAt: string;
}

const MODBUS_WS_PATH = '/ws/modbus';
const MOCK_PUSH_INTERVAL_MS = 5000;
const WS_HEARTBEAT_INTERVAL_MS = 30000;
const WS_RETRY_DELAY_MS = 3000;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const parseModbusPayload = (raw: unknown): LadleModbusPayload | null => {
  if (!isRecord(raw)) return null;
  const tempResults = Array.isArray(raw.tempResults)
    ? raw.tempResults.filter(isRecord).map((item) => ({
        deviceId: String(item.deviceId ?? ''),
        maxTemp: typeof item.maxTemp === 'number' ? item.maxTemp : item.maxTemp === null ? null : Number(item.maxTemp) || null,
        minTemp: typeof item.minTemp === 'number' ? item.minTemp : item.minTemp === null ? null : Number(item.minTemp) || null,
        avgTemp: typeof item.avgTemp === 'number' ? item.avgTemp : item.avgTemp === null ? null : Number(item.avgTemp) || null,
        success: Boolean(item.success),
      }))
    : [];

  return {
    currentLadleNo: typeof raw.currentLadleNo === 'string' ? raw.currentLadleNo : raw.currentLadleNo === null ? null : null,
    tempResults,
  };
};

const formatUpdatedAt = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });

export function useLadleModbusFeed(): LadleModbusFeed {
  const [feed, setFeed] = useState<LadleModbusFeed>({
    status: isMockOnly ? 'mock' : 'connecting',
    source: isMockOnly ? 'mock' : 'ws',
    message: '',
    payload: isMockOnly ? createMockModbusPayload(0) : null,
    updatedAt: formatUpdatedAt(),
  });

  useEffect(() => {
    let disposed = false;
    let mockTimer: number | undefined;
    let heartbeatTimer: number | undefined;
    let retryTimer: number | undefined;
    let mockTick = 1;
    let socket: WebSocket | undefined;

    const updateFeed = (next: Partial<LadleModbusFeed>) => {
      if (disposed) return;
      setFeed((current) => ({
        ...current,
        ...next,
        updatedAt: formatUpdatedAt(),
      }));
    };

    const clearMockTimer = () => {
      if (mockTimer !== undefined) {
        window.clearInterval(mockTimer);
        mockTimer = undefined;
      }
    };

    const clearRetryTimer = () => {
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    };

    const clearHeartbeatTimer = () => {
      if (heartbeatTimer !== undefined) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = undefined;
      }
    };

    const pushMockPayload = (source: Extract<LadleModbusFeedSource, 'mock' | 'fallback'>, message = '') => {
      updateFeed({
        status: source,
        source,
        message,
        payload: createMockModbusPayload(mockTick),
      });
      mockTick += 1;
    };

    const startMockFeed = (source: Extract<LadleModbusFeedSource, 'mock' | 'fallback'>, message = '') => {
      clearMockTimer();
      pushMockPayload(source, message);
      mockTimer = window.setInterval(() => pushMockPayload(source, message), MOCK_PUSH_INTERVAL_MS);
    };

    const connectWebSocket = () => {
      clearRetryTimer();
      clearHeartbeatTimer();
      clearMockTimer();
      socket?.close();

      if (isMockOnly) {
        startMockFeed('mock');
        return;
      }

      updateFeed({ status: 'connecting', source: 'ws', message: '' });

      try {
        socket = new WebSocket(buildWsUrl(MODBUS_WS_PATH));
      } catch {
        if (canUseMockData) {
          startMockFeed('fallback', 'WebSocket 不可用，已切换演示数据');
        } else {
          updateFeed({ status: 'error', source: 'ws', message: 'WebSocket 连接失败', payload: null });
        }
        return;
      }

      socket.onopen = () => {
        updateFeed({ status: 'connected', source: 'ws', message: '' });
        heartbeatTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send('ping');
        }, WS_HEARTBEAT_INTERVAL_MS);
      };

      socket.onmessage = (event) => {
        try {
          const payload = parseModbusPayload(JSON.parse(String(event.data)));
          if (!payload) return;
          updateFeed({ status: 'connected', source: 'ws', message: '', payload });
        } catch {
          // Ignore malformed frames.
        }
      };

      socket.onerror = () => {
        if (canUseMockData) {
          startMockFeed('fallback', '实时连接异常，已切换演示数据');
        } else {
          updateFeed({ status: 'error', source: 'ws', message: '实时连接异常', payload: null });
        }
      };

      socket.onclose = () => {
        clearHeartbeatTimer();
        if (disposed) return;
        // 真实接口模式也自动重连，但不回落 mock
        updateFeed({ status: 'retrying', source: 'ws', message: '连接断开，准备重连' });
        retryTimer = window.setTimeout(connectWebSocket, WS_RETRY_DELAY_MS);
      };
    };

    connectWebSocket();

    return () => {
      disposed = true;
      clearMockTimer();
      clearRetryTimer();
      clearHeartbeatTimer();
      socket?.close();
    };
  }, []);

  return feed;
}

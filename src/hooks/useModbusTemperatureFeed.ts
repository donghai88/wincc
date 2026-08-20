'use client';

import { useEffect, useState } from 'react';
import {
  buildWsUrl,
  canUseMockData,
  isMockOnly,
  unwrapApiData,
} from '@/lib/api-config';
import type {
  DigitalTwinTemperaturePoint,
  ModbusFeedSource,
  ModbusFeedStatus,
  ModbusTemperatureFeed,
} from '@/types/digital-twin';

const MODBUS_WS_PATH = '/ws/modbus';
const MOCK_PUSH_INTERVAL_MS = 5000;
const MOCK_SOCKET_BREAK_DELAY_MS = 20000;
const MOCK_RETRY_DELAY_MS = 3000;
const MOCK_RECONNECT_DELAY_MS = 3000;
const WS_RETRY_DELAY_MS = 3000;
const WS_HEARTBEAT_INTERVAL_MS = 30000;
const MOCK_SOCKET_BREAK_MESSAGE = '数据连接中断';
const MOCK_SOCKET_RETRY_MESSAGE = '正在重连';
const WS_RETRY_MESSAGE = '正在重连';
const MOCK_LOCATION = {
  locationId: 'loc_1',
  locationName: '位置1',
};

interface ModbusTemperatureMessage {
  locationId: string;
  locationName: string;
  temperature: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const readString = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (typeof value === 'string') return value.trim();
  // Some backends serialize numeric fields as JSON numbers; coerce so pushes are not dropped.
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
};

const formatReceivedAt = () => {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
};

const createMockMessage = (tick: number): ModbusTemperatureMessage => {
  const wave = Math.sin(tick * 0.74) * 0.55 + Math.cos(tick * 0.31) * 0.18;
  const temperature = tick === 0 ? '35' : (35 + wave).toFixed(1);

  return {
    ...MOCK_LOCATION,
    temperature,
  };
};

const normalizeMessage = (
  message: ModbusTemperatureMessage,
  source: ModbusFeedSource
): DigitalTwinTemperaturePoint => {
  const temperature = Number(message.temperature);

  return {
    locationId: message.locationId,
    locationName: message.locationName,
    temperature: Number.isFinite(temperature) ? temperature : 0,
    rawTemperature: message.temperature,
    receivedAt: formatReceivedAt(),
    source,
  };
};

const pickModbusMessages = (payload: unknown): ModbusTemperatureMessage[] => {
  const body = unwrapApiData(payload);
  const rows = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.list)
      ? body.list
      : [];

  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];

    const locationId = readString(row, 'locationId');
    const locationName = readString(row, 'locationName');
    const temperature = readString(row, 'temperature');

    if (!locationId || !locationName || !temperature) return [];
    return [{ locationId, locationName, temperature }];
  });
};

const parseSocketPayload = (data: unknown) => {
  if (typeof data !== 'string') return [];

  try {
    return pickModbusMessages(JSON.parse(data));
  } catch {
    return [];
  }
};

const createMockPoint = (tick: number, source: ModbusFeedSource) => {
  return normalizeMessage(createMockMessage(tick), source);
};

const mergeTemperaturePoints = (
  currentPoints: DigitalTwinTemperaturePoint[],
  incomingPoints: DigitalTwinTemperaturePoint[]
) => {
  const pointsByLocation = new Map(currentPoints.map((point) => [point.locationId, point]));
  incomingPoints.forEach((point) => pointsByLocation.set(point.locationId, point));
  return [...pointsByLocation.values()];
};

const createInitialFeed = (): ModbusTemperatureFeed => {
  if (isMockOnly) {
    const point = createMockPoint(0, 'mock');
    return {
      status: 'mock',
      point,
      points: [point],
      message: '',
    };
  }

  return {
    status: 'connecting',
    point: null,
    points: [],
    message: '',
  };
};

export function useModbusTemperatureFeed(): ModbusTemperatureFeed {
  const [feed, setFeed] = useState<ModbusTemperatureFeed>(() => createInitialFeed());

  useEffect(() => {
    let disposed = false;
    let mockTick = isMockOnly ? 1 : 0;
    let mockTimer: number | undefined;
    let mockBreakTimer: number | undefined;
    let mockRetryTimer: number | undefined;
    let mockReconnectTimer: number | undefined;
    let wsRetryTimer: number | undefined;
    let heartbeatTimer: number | undefined;
    let socket: WebSocket | undefined;

    const clearMockTimer = () => {
      if (mockTimer !== undefined) {
        window.clearInterval(mockTimer);
        mockTimer = undefined;
      }
    };

    const clearMockBreakTimer = () => {
      if (mockBreakTimer !== undefined) {
        window.clearTimeout(mockBreakTimer);
        mockBreakTimer = undefined;
      }
    };

    const clearMockRetryTimers = () => {
      if (mockRetryTimer !== undefined) {
        window.clearTimeout(mockRetryTimer);
        mockRetryTimer = undefined;
      }
      if (mockReconnectTimer !== undefined) {
        window.clearTimeout(mockReconnectTimer);
        mockReconnectTimer = undefined;
      }
    };

    const clearWsRetryTimer = () => {
      if (wsRetryTimer !== undefined) {
        window.clearTimeout(wsRetryTimer);
        wsRetryTimer = undefined;
      }
    };

    const clearHeartbeatTimer = () => {
      if (heartbeatTimer !== undefined) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = undefined;
      }
    };

    const startHeartbeatTimer = () => {
      clearHeartbeatTimer();
      const sendHeartbeat = () => {
        if (socket?.readyState === WebSocket.OPEN) {
          // The backend only requires any client message to keep the session alive.
          socket.send('ping');
        }
      };
      // Send immediately on connect so the 90s idle timeout does not race the first interval.
      sendHeartbeat();
      heartbeatTimer = window.setInterval(sendHeartbeat, WS_HEARTBEAT_INTERVAL_MS);
    };

    const pushMockPoint = (status: Extract<ModbusFeedStatus, 'mock' | 'fallback'>, message: string) => {
      if (disposed) return;
      const source = status === 'fallback' ? 'fallback' : 'mock';
      const point = createMockPoint(mockTick, source);
      setFeed((current) => ({
        status,
        point,
        points: mergeTemperaturePoints(current.points, [point]),
        message,
      }));
      mockTick += 1;
    };

    const startMockTimer = (
      status: Extract<ModbusFeedStatus, 'mock' | 'fallback'>,
      message = '',
      pushImmediately = false
    ) => {
      clearMockTimer();
      if (pushImmediately) {
        pushMockPoint(status, message);
      }
      mockTimer = window.setInterval(() => pushMockPoint(status, message), MOCK_PUSH_INTERVAL_MS);
    };

    const simulateMockSocketBreak = () => {
      clearMockTimer();
      setFeed((current) => ({
        ...current,
        status: 'error',
        message: MOCK_SOCKET_BREAK_MESSAGE,
      }));

      mockRetryTimer = window.setTimeout(() => {
        if (disposed) return;
        setFeed((current) => ({
          ...current,
          status: 'retrying',
          message: MOCK_SOCKET_RETRY_MESSAGE,
        }));

        mockReconnectTimer = window.setTimeout(() => {
          if (disposed) return;
          startMockTimer('mock', '', true);
        }, MOCK_RECONNECT_DELAY_MS);
      }, MOCK_RETRY_DELAY_MS);
    };

    const stopSocket = () => {
      clearHeartbeatTimer();
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
      socket = undefined;
    };

    if (isMockOnly) {
      startMockTimer('mock');
      mockBreakTimer = window.setTimeout(simulateMockSocketBreak, MOCK_SOCKET_BREAK_DELAY_MS);
      return () => {
        disposed = true;
        clearMockTimer();
        clearMockBreakTimer();
        clearMockRetryTimers();
        clearWsRetryTimer();
        clearHeartbeatTimer();
        stopSocket();
      };
    }

    const startWsConnection = () => {
      try {
        stopSocket();
        socket = new WebSocket(buildWsUrl(MODBUS_WS_PATH));

        socket.addEventListener('open', () => {
          if (disposed) return;
          clearWsRetryTimer();
          startHeartbeatTimer();
          setFeed((current) => ({
            ...current,
            status: 'connected',
            message: '',
          }));
        });

        socket.addEventListener('message', (event) => {
          if (disposed) return;

          const raw = typeof event.data === 'string'
            ? event.data
            : '';
          // Ignore heartbeat echoes / non-JSON keepalives.
          if (!raw || raw === 'ping' || raw === 'pong') return;

          const messages = parseSocketPayload(raw);
          if (messages.length === 0) {
            setFeed((current) => ({
              ...current,
              status: 'connected',
              message: current.point ? current.message : '已连接，收到数据但格式无法识别',
            }));
            return;
          }

          const points = messages.map((message) => normalizeMessage(message, 'ws'));

          setFeed((current) => ({
            status: 'connected',
            point: points[0],
            points: mergeTemperaturePoints(current.points, points),
            message: '',
          }));
        });

        socket.addEventListener('error', () => {
          if (disposed || mockTimer !== undefined || wsRetryTimer !== undefined) return;
          handleWsDisconnect('数据连接失败');
        });

        socket.addEventListener('close', () => {
          if (disposed || mockTimer !== undefined || wsRetryTimer !== undefined) return;
          handleWsDisconnect('数据连接已断开');
        });
      } catch {
        window.setTimeout(() => {
          if (disposed || wsRetryTimer !== undefined) return;
          handleWsDisconnect('数据连接初始化失败');
        }, 0);
      }
    };

    const fallBackOrRetry = (message: string) => {
      if (canUseMockData) {
        startMockTimer('fallback', message, true);
        return;
      }

      setFeed((current) => ({
        ...current,
        status: 'retrying',
        message: message ? `${message}，${WS_RETRY_MESSAGE}` : WS_RETRY_MESSAGE,
      }));

      wsRetryTimer = window.setTimeout(() => {
        wsRetryTimer = undefined;
        if (!disposed) {
          startWsConnection();
        }
      }, WS_RETRY_DELAY_MS);
    };

    const handleWsDisconnect = (message: string) => {
      setFeed({
        status: 'error',
        point: null,
        points: [],
        message,
      });

      wsRetryTimer = window.setTimeout(() => {
        wsRetryTimer = undefined;
        if (!disposed) {
          fallBackOrRetry(message);
        }
      }, WS_RETRY_DELAY_MS);
    };

    startWsConnection();

    return () => {
      disposed = true;
      clearMockTimer();
      clearMockBreakTimer();
      clearMockRetryTimers();
      clearWsRetryTimer();
      clearHeartbeatTimer();
      stopSocket();
    };
  }, []);

  return feed;
}

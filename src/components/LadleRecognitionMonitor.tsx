'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Clock3,
  LogOut,
  RotateCw,
  ScanText,
  Thermometer,
  User,
} from 'lucide-react';
import type { WinCCInstance } from '@/types/template';
import {
  getCurrentDayInferenceCount,
  queryLatestLadleRecords,
  reconnectModbusDevice,
} from '@/data/ladle-api-config';
import { useLadleModbusFeed } from '@/hooks/useLadleModbusFeed';
import { buildApiUrl, canUseMockData, isMockOnly, resolveSnapshotUrl, unwrapApiData } from '@/lib/api-config';
import { useAuth } from '@/contexts/AuthContext';
import ZlMediaKitFlvPlayer from '@/components/ZlMediaKitFlvPlayer';
import workspaceStyles from './MonitoringWorkspace.module.css';
import styles from './LadleRecognitionMonitor.module.css';

interface LadleRecognitionMonitorProps {
  onBack?: () => void;
  wincc?: WinCCInstance;
  embedded?: boolean;
}

type DeviceKind = 'thermal';

interface DeviceCard {
  id: string;
  name: string;
  kind: DeviceKind;
  location: string;
  online: boolean;
  metrics: Array<{ label: string; value: string }>;
}

interface StreamUrls {
  flv: string;
  wsFlv: string;
  channelName: string;
}

interface ThermalFeed {
  id: string;
  title: string;
  /** 当前 WS / 上游返回的设备 ID，可动态变化 */
  deviceId: string;
  temp: number | null;
  max: number | null;
  avg: number | null;
  min: number | null;
  pkg: string | null;
  flv: string;
  wsFlv: string;
  channelName: string;
  /** WS 三温均有效（非 null 且非负）时为在线 */
  online: boolean;
}

interface LatestSnap {
  id: string;
  pkg: string;
  time: string;
  temp: number | null;
  camera: string;
  snapshotPath: string;
}

const EMPTY = '—';

/** 有效测温：必须是有限数字且 >= 0；null / 负值视为热像仪掉线 */
const isValidThermalReading = (value: number | null | undefined): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
);

const isThermalDeviceOnline = (
  entry: { avgTemp: number | null; maxTemp: number | null; minTemp: number | null } | null | undefined,
) => (
  Boolean(entry)
  && isValidThermalReading(entry?.avgTemp)
  && isValidThermalReading(entry?.maxTemp)
  && isValidThermalReading(entry?.minTemp)
);

const formatTemp = (value: number | null | undefined) => {
  if (!isValidThermalReading(value)) return EMPTY;
  return `${Math.round(value)}°C`;
};

const formatTempNumber = (value: number | null | undefined) => {
  if (!isValidThermalReading(value)) return EMPTY;
  return String(Math.round(value));
};

const formatCount = (value: number | null | undefined) => (
  typeof value === 'number' && Number.isFinite(value) ? String(value) : EMPTY
);

/** 固定 4 个工位槽；设备 ID 以 WS tempResults 当前返回为准（可动态变更） */
const LADLE_THERMAL_SLOTS = [
  { feedId: 'IR-01', name: 'HHW-TN460D-ACS', place: 'HHW-TN460D-ACS' },
  { feedId: 'IR-02', name: 'HHW-TN460D-ACS', place: 'HHW-TN460D-ACS' },
  { feedId: 'IR-03', name: 'HHW-TN460D-ACS', place: 'HHW-TN460D-ACS' },
  { feedId: 'IR-04', name: 'HHW-TN460D-ACS', place: 'HHW-TN460D-ACS' },
] as const;

const LADLE_THERMAL_SLOT_COUNT = LADLE_THERMAL_SLOTS.length;

const feedOrder = LADLE_THERMAL_SLOTS.map((item) => item.feedId);

/**
 * 可选别名：仅用于 /device/live 播流匹配。
 * 在线温度与重连不依赖此表，一律读 WS 当前 deviceId。
 */
const STREAM_DEVICE_ALIASES: Record<string, string> = {
  '南1_1': 'IR-01',
  '南2_1': 'IR-02',
  '北1_1': 'IR-03',
  '北2_1': 'IR-04',
  'TN460-125': 'IR-01',
  'TN460-126': 'IR-02',
  'TN460-127': 'IR-03',
  'TN460-128': 'IR-04',
  '11_1': 'IR-01',
  '12_1': 'IR-02',
  '17_1': 'IR-03',
};

const emptyStream: StreamUrls = { flv: '', wsFlv: '', channelName: '' };

/** Mock-only：复用铁水沟 MonitorCenter 文档样例的前 4 路播流 */
const mockLadleStreams: StreamUrls[] = [
  {
    channelName: '3_1',
    flv: 'https://192.168.1.202:7443/rtp/2065239822875885578_0-0.live.flv',
    wsFlv: 'wss://192.168.1.202:7443/rtp/2065239822875885578_0-0.live.flv',
  },
  {
    channelName: '4_1',
    flv: 'https://192.168.1.202:7443/rtp/2065239946444275812_0-0.live.flv',
    wsFlv: 'wss://192.168.1.202:7443/rtp/2065239946444275812_0-0.live.flv',
  },
  {
    channelName: '5_1',
    flv: 'https://192.168.1.202:7443/rtp/2065240074886447120_0-0.live.flv',
    wsFlv: 'wss://192.168.1.202:7443/rtp/2065240074886447120_0-0.live.flv',
  },
  {
    channelName: '6_1',
    flv: 'https://192.168.1.202:7443/rtp/2065240187994243142_0-0.live.flv',
    wsFlv: 'wss://192.168.1.202:7443/rtp/2065240187994243142_0-0.live.flv',
  },
];

const mockStreamByFeedId: Record<string, StreamUrls> = Object.fromEntries(
  feedOrder.map((feedId, index) => [feedId, mockLadleStreams[index] ?? { ...emptyStream }]),
);

const mockFeedSeed: ThermalFeed[] = LADLE_THERMAL_SLOTS.map((slot, index) => ({
  id: slot.feedId,
  title: slot.place,
  deviceId: ['南1_1', '南2_1', '北1_1', '北2_1'][index] ?? `通道${index + 1}`,
  pkg: 'A3256',
  online: false,
  temp: null,
  max: null,
  avg: null,
  min: null,
  flv: '',
  wsFlv: '',
  channelName: '',
}));

const emptyFeeds: ThermalFeed[] = LADLE_THERMAL_SLOTS.map((slot) => ({
  id: slot.feedId,
  title: slot.place,
  deviceId: '',
  temp: null,
  max: null,
  avg: null,
  min: null,
  pkg: null,
  online: false,
  ...emptyStream,
}));

const readString = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

/**
 * 钢包版无独立热成像 API：复用铁水沟 /device/live。
 * 优先按已知别名匹配；匹配不到则按列表顺序填满 4 路（兼容 deviceId 动态变更）。
 */
function pickLadleStreamsFromLive(payload: unknown): Record<string, StreamUrls> {
  const data = unwrapApiData(payload);
  const result: Record<string, StreamUrls> = {};
  if (!Array.isArray(data)) return result;

  const unused: StreamUrls[] = [];

  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue;

    const record = item as Record<string, unknown>;
    const channelName = readString(record, 'displayName')
      || readString(record, 'name')
      || readString(record, 'deviceName');
    const deviceId = readString(record, 'deviceId') || readString(record, 'deviceID');
    const flv = readString(record, 'flv');
    const wsFlv = readString(record, 'wsFlv');
    if (!flv && !wsFlv) continue;

    const stream: StreamUrls = { flv, wsFlv, channelName: channelName || deviceId };
    const mappedFeedId = STREAM_DEVICE_ALIASES[deviceId]
      || STREAM_DEVICE_ALIASES[channelName]
      || Object.entries(STREAM_DEVICE_ALIASES).find(([alias]) => (
        deviceId.includes(alias) || channelName.includes(alias)
      ))?.[1];

    if (mappedFeedId && !result[mappedFeedId]) {
      result[mappedFeedId] = stream;
    } else {
      unused.push(stream);
    }
  }

  let unusedIndex = 0;
  for (const feedId of feedOrder) {
    if (result[feedId]) continue;
    const next = unused[unusedIndex];
    if (!next) break;
    result[feedId] = next;
    unusedIndex += 1;
  }

  return result;
}

function ThermalCameraCard({
  feed,
  streamKey,
  hardwareId,
  reconnecting,
  onReconnect,
}: {
  feed: ThermalFeed;
  streamKey: number;
  hardwareId: string;
  reconnecting: boolean;
  onReconnect: (deviceId: string) => void;
}) {
  const hasStream = Boolean(feed.flv || feed.wsFlv);
  const isOnline = feed.online;
  const playStream = isOnline && hasStream;

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>{feed.title}</h3>
        <div className={styles.panelHeadActions}>
          {!isOnline && hardwareId && (
            <button
              type="button"
              className={styles.reconnectChip}
              disabled={reconnecting}
              onClick={() => onReconnect(hardwareId)}
              title={`重连 ${hardwareId}`}
              aria-label={`重连 ${hardwareId}`}
            >
              <RotateCw size={11} className={reconnecting ? styles.reconnectSpin : undefined} aria-hidden="true" />
              {reconnecting ? '重连中' : '重连'}
            </button>
          )}
          <span className={styles.feedOnline} data-online={isOnline ? 'true' : 'false'}>
            <span className={styles.statusDot} data-online={isOnline ? 'true' : 'false'} />
            {isOnline ? '在线' : '离线'}
          </span>
        </div>
      </div>
      <div className={styles.thermalFeed} data-empty={playStream ? undefined : 'true'}>
        {playStream ? (
          <div className={styles.thermalPlayer}>
            <ZlMediaKitFlvPlayer
              key={`${feed.id}-${streamKey}`}
              active
              flvUrl={feed.flv}
              wsFlvUrl={feed.wsFlv}
              streamName={feed.title}
            />
          </div>
        ) : (
          <div className={styles.thermalEmpty}>{isOnline ? '暂无热成像画面' : '热成像离线'}</div>
        )}
        <div className={styles.feedLabel}>红外热图 | 640×512 | 25fps{feed.channelName ? ` | ${feed.channelName}` : ''}</div>
        <div className={styles.feedPkg}>{feed.pkg ?? EMPTY}</div>
        <div className={styles.feedTemp}>{formatTemp(feed.temp)}</div>
      </div>
    </section>
  );
}

function SnapshotThumbCard({
  snap,
}: {
  snap: LatestSnap & { empty?: true };
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = !snap.empty && snap.snapshotPath
    ? resolveSnapshotUrl(snap.snapshotPath)
    : '';
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <button type="button" className={styles.snapshotCard}>
      <div className={styles.snapshotThumb} data-empty={showImage ? undefined : 'true'}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote/API snapshot URLs are dynamic
          <img
            src={imageUrl}
            alt={`${snap.camera} 测温截图`}
            className={styles.snapshotImage}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={styles.thermalEmpty}>暂无截图</div>
        )}
        <div className={styles.snapshotOverlayLabel}>
          {snap.camera} · 640×512
        </div>
        <div className={styles.snapshotOverlayTemp}>{formatTemp(snap.temp)}</div>
        <div className={styles.snapshotOverlayTime}>
          {snap.time.includes(' ') ? (snap.time.split(' ')[1] ?? snap.time) : snap.time}
        </div>
      </div>
      <div className={styles.snapshotMeta}>
        <b>{formatTemp(snap.temp)}</b>
        <span>{snap.camera}</span>
      </div>
    </button>
  );
}

function TempMetricCard({ feed }: { feed: ThermalFeed }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>{feed.deviceId ? `${feed.deviceId} 实时温度` : `${feed.id} 实时温度`}</h3>
        <Thermometer size={14} color="#22d3ee" />
      </div>
      <div className={styles.tempGrid}>
        <div>
          <span>最高温 °C</span>
          <b>{formatTempNumber(feed.max)}</b>
        </div>
        <div>
          <span>平均温 °C</span>
          <b>{formatTempNumber(feed.avg)}</b>
        </div>
        <div>
          <span>最低温 °C</span>
          <b>{formatTempNumber(feed.min)}</b>
        </div>
      </div>
    </section>
  );
}

const deviceIdToFeedId: Record<string, string> = { ...STREAM_DEVICE_ALIASES };

/**
 * 绑定策略（兼容 deviceId 动态改名）：
 * 1) 优先按当前 WS deviceId 命中已知别名
 * 2) 否则按 tempResults 数组顺序对齐固定工位槽
 */
function resolveTempEntry(
  tempResults: Array<{ deviceId: string; maxTemp: number | null; minTemp: number | null; avgTemp: number | null; success: boolean }>,
  feedId: string,
  feedIndex: number,
) {
  const byKnownId = tempResults.find((item) => deviceIdToFeedId[item.deviceId] === feedId);
  if (byKnownId) return byKnownId;
  return tempResults[feedIndex] ?? null;
}

function buildFeedTitle(deviceId: string, place: string) {
  if (deviceId && place) return `${deviceId} ${place}`;
  return deviceId || place || EMPTY;
}

export default function LadleRecognitionMonitor({ onBack, wincc, embedded = false }: LadleRecognitionMonitorProps) {
  const { user, logout } = useAuth();
  const modbusFeed = useLadleModbusFeed();
  const [clock, setClock] = useState(() => new Date());
  const [inferenceCount, setInferenceCount] = useState<number | null>(isMockOnly ? 47 : null);
  const [latestRecords, setLatestRecords] = useState<LatestSnap[]>(() => {
    if (!isMockOnly) return [];
    return mockFeedSeed.map((feed, index) => ({
      id: `latest-${index}`,
      pkg: 'Y-111',
      time: '2026-07-30 13:49:26',
      temp: feed.temp,
      camera: feed.id,
      snapshotPath: '',
    }));
  });
  const [reconnectMessage, setReconnectMessage] = useState('');
  const [metricsLoaded, setMetricsLoaded] = useState(isMockOnly);
  const [streamByFeedId, setStreamByFeedId] = useState<Record<string, StreamUrls>>(() => (
    isMockOnly ? mockStreamByFeedId : {}
  ));
  const [streamMessage, setStreamMessage] = useState('');
  const [streamReloadToken, setStreamReloadToken] = useState(0);
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadDashboardMetrics = async () => {
      if (isMockOnly) {
        setInferenceCount(getCurrentDayInferenceCount().data);
        const latest = queryLatestLadleRecords().data;
        setLatestRecords(latest.map((record) => ({
          id: String(record.id),
          pkg: record.ladleNo,
          time: record.recordTime,
          temp: Math.round(record.maxTemp),
          camera: record.deviceName,
          snapshotPath: typeof record.snapshotPath === 'string' ? record.snapshotPath.trim() : '',
        })));
        setMetricsLoaded(true);
        return;
      }

      try {
        const [countResponse, latestResponse] = await Promise.all([
          fetch(buildApiUrl('/ladle/dashboard/currentDayInferenceCount'), { headers: { Accept: 'application/json' } }),
          fetch(buildApiUrl('/ladle-record/latest'), { headers: { Accept: 'application/json' } }),
        ]);
        if (countResponse.ok) {
          const countPayload = await countResponse.json() as unknown;
          const count = unwrapApiData(countPayload);
          setInferenceCount(typeof count === 'number' ? count : null);
        } else {
          setInferenceCount(null);
        }
        if (latestResponse.ok) {
          const latestPayload = await latestResponse.json() as unknown;
          const latest = unwrapApiData(latestPayload);
          if (Array.isArray(latest)) {
            setLatestRecords(latest.map((record: {
              id: number;
              ladleNo: string;
              deviceName: string;
              maxTemp: number;
              recordTime: string;
              snapshotPath?: string | null;
            }) => ({
              id: String(record.id),
              pkg: record.ladleNo,
              time: record.recordTime,
              temp: Math.round(record.maxTemp),
              camera: record.deviceName,
              snapshotPath: typeof record.snapshotPath === 'string' ? record.snapshotPath.trim() : '',
            })));
          } else {
            setLatestRecords([]);
          }
        } else {
          setLatestRecords([]);
        }
      } catch {
        if (canUseMockData) {
          setInferenceCount(getCurrentDayInferenceCount().data);
          const latest = queryLatestLadleRecords().data;
          setLatestRecords(latest.map((record) => ({
            id: String(record.id),
            pkg: record.ladleNo,
            time: record.recordTime,
            temp: Math.round(record.maxTemp),
            camera: record.deviceName,
            snapshotPath: typeof record.snapshotPath === 'string' ? record.snapshotPath.trim() : '',
          })));
        } else {
          setInferenceCount(null);
          setLatestRecords([]);
        }
      } finally {
        setMetricsLoaded(true);
      }
    };

    void loadDashboardMetrics();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadThermalStreams = async () => {
      if (isMockOnly) {
        setStreamByFeedId(mockStreamByFeedId);
        setStreamMessage('');
        return;
      }

      try {
        const response = await fetch(buildApiUrl('/device/live'), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = await response.json() as unknown;
        const mapped = pickLadleStreamsFromLive(payload);
        setStreamByFeedId(mapped);

        const matchedCount = feedOrder.filter((feedId) => mapped[feedId]?.flv || mapped[feedId]?.wsFlv).length;
        setStreamMessage(
          matchedCount >= LADLE_THERMAL_SLOT_COUNT
            ? ''
            : matchedCount === 0
              ? '未从 /device/live 获取到可播放热成像流'
              : `仅匹配到 ${matchedCount}/${LADLE_THERMAL_SLOT_COUNT} 路热成像流`,
        );
      } catch (error) {
        if (controller.signal.aborted) return;

        if (canUseMockData) {
          setStreamByFeedId(mockStreamByFeedId);
          setStreamMessage('热成像列表加载异常，已展示备用播流地址');
        } else {
          setStreamByFeedId({});
          setStreamMessage(error instanceof Error ? `热成像列表加载失败：${error.message}` : '热成像列表加载失败');
        }
      }
    };

    void loadThermalStreams();
    return () => controller.abort();
  }, [streamReloadToken]);

  const feeds = useMemo(() => {
    // 真实模式始终从空骨架叠加 WS；仅 mock-only 用演示种子
    const skeleton = isMockOnly ? mockFeedSeed : emptyFeeds;
    const tempResults = modbusFeed.payload?.tempResults ?? [];
    return skeleton.map((feed, feedIndex) => {
      const slot = LADLE_THERMAL_SLOTS[feedIndex];
      const place = slot?.place ?? feed.title;
      const stream = streamByFeedId[feed.id];
      const withStream: ThermalFeed = stream
        ? { ...feed, flv: stream.flv, wsFlv: stream.wsFlv, channelName: stream.channelName || feed.channelName }
        : feed;

      const deviceEntry = resolveTempEntry(tempResults, feed.id, feedIndex);
      const liveDeviceId = deviceEntry?.deviceId?.trim() || withStream.deviceId || '';
      const title = buildFeedTitle(liveDeviceId, place);
      const online = isThermalDeviceOnline(deviceEntry);

      if (!deviceEntry || !online) {
        return {
          ...withStream,
          title,
          deviceId: liveDeviceId,
          temp: null,
          max: null,
          avg: null,
          min: null,
          online: false,
          flv: '',
          wsFlv: '',
          pkg: modbusFeed.payload?.currentLadleNo ?? withStream.pkg,
        };
      }

      const avg = deviceEntry.avgTemp;
      const max = deviceEntry.maxTemp;
      const min = deviceEntry.minTemp;
      const temp = avg ?? max ?? min;
      return {
        ...withStream,
        title,
        deviceId: liveDeviceId,
        online: true,
        temp: isValidThermalReading(temp) ? Math.round(temp) : null,
        max: isValidThermalReading(max) ? Math.round(max) : null,
        min: isValidThermalReading(min) ? Math.round(min) : null,
        avg: isValidThermalReading(avg) ? Math.round(avg) : null,
        pkg: modbusFeed.payload?.currentLadleNo ?? withStream.pkg,
      };
    });
  }, [modbusFeed.payload, streamByFeedId]);

  /** 测温截图固定展示 4 路，不足补空位、超出截断 */
  const snapshotSlots = useMemo(() => {
    return Array.from({ length: LADLE_THERMAL_SLOT_COUNT }, (_, index) => {
      const snap = latestRecords[index];
      const feed = feeds[index];
      const cameraLabel = snap?.camera || feed?.deviceId || feed?.title || `IR-0${index + 1}`;
      if (snap) {
        return {
          ...snap,
          camera: cameraLabel,
        };
      }
      return {
        id: `empty-snap-${index}`,
        pkg: EMPTY,
        time: EMPTY,
        temp: null as number | null,
        camera: cameraLabel,
        snapshotPath: '',
        empty: true as const,
      };
    });
  }, [latestRecords, feeds]);

  const deviceCards: DeviceCard[] = useMemo(() => {
    return LADLE_THERMAL_SLOTS.map((slot, index) => {
      const feed = feeds[index];
      const deviceId = feed?.deviceId?.trim() || '';
      return {
        id: deviceId || slot.feedId,
        name: slot.name,
        kind: 'thermal' as const,
        location: deviceId
          ? `设备 ${deviceId} | 位置：${slot.place} | 640×512 | 25fps`
          : `位置：${slot.place} | 640×512 | 25fps | 等待设备 ID`,
        online: feed?.online ?? false,
        metrics: [
          { label: '当前温度', value: formatTemp(feed?.temp) },
          { label: '最高', value: formatTemp(feed?.max) },
        ],
      };
    });
  }, [feeds]);

  const reconnectDevice = async (deviceId: string, feedId?: string) => {
    const targetId = deviceId.trim();
    if (!targetId || reconnectingId) return;
    setReconnectingId(targetId);
    setReconnectMessage(`正在重连 ${targetId}…`);

    if (isMockOnly) {
      const result = reconnectModbusDevice(targetId);
      setReconnectMessage(result.code === 200 ? `设备 ${targetId} 重连成功` : result.msg);
      setReconnectingId(null);
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/ladle/modbus/reconnect/${encodeURIComponent(targetId)}`), {
        method: 'POST',
      });
      const payload = await response.json() as { msg?: string; code?: number };
      const ok = response.ok && (payload.code === undefined || payload.code === 200 || payload.code === 0);
      setReconnectMessage(payload.msg ?? (ok ? `${targetId} 重连成功` : `${targetId} 重连失败`));

      if (ok) {
        setStreamByFeedId((current) => {
          const next = { ...current };
          if (feedId) delete next[feedId];
          return next;
        });
        setStreamReloadToken((token) => token + 1);
      }
    } catch {
      if (canUseMockData) {
        const result = reconnectModbusDevice(targetId);
        setReconnectMessage(result.msg);
        setStreamReloadToken((token) => token + 1);
      } else {
        setReconnectMessage(`${targetId} 重连失败：无法连接后端`);
      }
    } finally {
      setReconnectingId(null);
    }
  };

  const currentPkg = modbusFeed.payload?.currentLadleNo
    ?? latestRecords[0]?.pkg
    ?? null;
  const title = wincc?.name ?? '钢包识别';
  const subtitle = modbusFeed.status === 'mock' || modbusFeed.status === 'fallback'
    ? 'OCR + 红外 / Mock 数据'
    : 'OCR + 红外 / 实时数据';

  return (
    <section className={styles.simShell} aria-label="钢包智能监测实时监控">
      <header className={`${styles.topBar} ${workspaceStyles.topBar}`}>
        <div className={workspaceStyles.topBarInner}>
          {onBack && (
            <button className={styles.backButton} type="button" onClick={onBack} aria-label="返回功能选择">
              <ArrowLeft size={18} aria-hidden="true" />
              <span>{embedded ? '返回功能选择' : '返回'}</span>
            </button>
          )}

          <div className={styles.titleBlock}>
            <div className={styles.titleLine}>
              <h1>{title}</h1>
              <span className={styles.simBadge}>智能监测版</span>
            </div>
            <p>{subtitle}</p>
          </div>

          <div className={styles.statusCluster}>
            <span className={styles.statusPill}>{modbusFeed.message || (metricsLoaded ? '系统运行中' : '加载中…')}</span>
            <span className={styles.clockPill}>
              <Clock3 size={14} aria-hidden="true" />
              {wincc?.lastUpdate ?? clock.toLocaleString('zh-CN', { hour12: false })}
            </span>
            {embedded && user && (
              <span className={styles.clockPill}>
                <User size={14} aria-hidden="true" />
                {user.name}
                <button
                  type="button"
                  className={styles.logoutButton}
                  onClick={logout}
                  title="退出登录"
                  aria-label="退出登录"
                >
                  <LogOut size={14} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        </div>
      </header>

      <div className={`${styles.workspace} ${workspaceStyles.workspace}`}>
        <div className={styles.sectionLabel}>
          <ScanText size={13} aria-hidden="true" />
          DEVICE STATUS · 设备状态总览
        </div>
        <div className={styles.deviceStack}>
          <div className={styles.deviceRowThermal}>
            {deviceCards.map((device) => (
              <article
                key={device.id}
                className={styles.deviceCard}
                data-kind={device.kind}
                data-online={device.online ? 'true' : 'false'}
              >
                <div className={styles.deviceName}>
                  <span className={styles.statusDot} data-online={device.online ? 'true' : 'false'} />
                  <b>{device.id}</b>
                  <span>{device.name}</span>
                  <em className={styles.deviceOnlineTag}>{device.online ? '在线' : '离线'}</em>
                </div>
                <div className={styles.deviceLoc}>{device.location}</div>
                <div className={styles.deviceMetrics}>
                  {device.metrics.map((metric) => (
                    <div key={metric.label} className={styles.deviceMetric}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className={styles.recogStrip}>
          <div className={styles.recogMain}>
            <div className={styles.recogIcon}>
              <ScanText size={22} color="#22d3ee" />
            </div>
            <div>
              <div className={styles.kpiLabel}>当前识别包号</div>
              <div className={styles.pkgValue}>{currentPkg ?? EMPTY}</div>
            </div>
            <div className={styles.recogResult}>
              <div className={styles.resultOk}>{currentPkg ? '✓ 识别成功' : '等待识别'}</div>
              <div className={styles.muted}>WS 推送 {modbusFeed.updatedAt} | {modbusFeed.source}</div>
            </div>
          </div>
          <div className={styles.recogMetric}>
            <div className={styles.kpiValue}>{EMPTY}</div>
            <div className={styles.kpiLabel}>今日识别准确率</div>
          </div>
          <div className={styles.recogMetric}>
            <div className={styles.kpiValue}>{formatCount(inferenceCount)}</div>
            <div className={styles.kpiLabel}>今日识别次数</div>
          </div>
        </div>

        {reconnectMessage && <div className={styles.muted} role="status">{reconnectMessage}</div>}

        <div className={styles.sectionLabel}>
          <Thermometer size={13} aria-hidden="true" />
          四路红外实时监控
        </div>
        {streamMessage && <div className={styles.muted} role="status">{streamMessage}</div>}
        <div className={styles.cameraRow}>
          {feeds.map((feed) => (
            <ThermalCameraCard
              key={feed.id}
              feed={feed}
              streamKey={streamReloadToken}
              hardwareId={feed.deviceId}
              reconnecting={Boolean(feed.deviceId) && reconnectingId === feed.deviceId}
              onReconnect={(deviceId) => void reconnectDevice(deviceId, feed.id)}
            />
          ))}
        </div>

        <div className={styles.tempRow}>
          {feeds.map((feed) => (
            <TempMetricCard key={`temp-${feed.id}`} feed={feed} />
          ))}
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h3>
              <Camera size={15} color="#22d3ee" />
              上一次测温截图 — 包号 {latestRecords[0]?.pkg ?? EMPTY}
            </h3>
            <span>{latestRecords[0]?.time ?? EMPTY} | GET /ladle-record/latest · {LADLE_THERMAL_SLOT_COUNT} 路</span>
          </div>
          <div className={styles.snapshotRow}>
            {snapshotSlots.map((snap) => (
              <SnapshotThumbCard key={`${snap.id}-${snap.snapshotPath || 'empty'}`} snap={snap} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

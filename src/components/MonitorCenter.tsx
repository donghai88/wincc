'use client';

import { useState, useEffect } from 'react';
import {
  apiMockMode,
  apiMockModeLabel,
  buildApiUrl,
  canUseMockData,
  isMockOnly,
  unwrapApiData,
} from '@/lib/api-config';
import {
  Video,
  Activity,
  Clock,
  Power,
} from 'lucide-react';

type ThermalCameraFeedStatus = 'online' | 'standby';
type ApiStatus = 'idle' | 'loading' | 'success' | 'mock' | 'fallback' | 'error';

interface ThermalCameraFeed {
  slot: number;
  displayName: string;
  deviceId: string;
  channelId: string;
  streamId: string;
  delayed: number;
  status: ThermalCameraFeedStatus;
  flv: string;
  wsFlv: string;
  webrtc: string;
  rtmp: string;
  rtsp: string;
}

const DOCUMENT_THERMAL_CAMERA_STREAMS = [
  { displayName: '3_1', deviceId: '2065239822875885578', streamId: '2065239822875885578_0-0' },
  { displayName: '4_1', deviceId: '2065239946444275812', streamId: '2065239946444275812_0-0' },
  { displayName: '5_1', deviceId: '2065240074886447120', streamId: '2065240074886447120_0-0' },
  { displayName: '6_1', deviceId: '2065240187994243142', streamId: '2065240187994243142_0-0' },
  { displayName: '7_1', deviceId: '2065240318709727284', streamId: '2065240318709727284_0-0' },
  { displayName: '8_1', deviceId: '2065240434887753737', streamId: '2065240434887753737_0-0' },
  { displayName: '9_1', deviceId: '2065240548813439066', streamId: '2065240548813439066_0-0' },
  { displayName: '10_1', deviceId: '2065240728270929962', streamId: '2065240728270929962_0-0' },
  { displayName: '11_1', deviceId: '2065240850899796063', streamId: '2065240850899796063_0-0' },
  { displayName: '12_1', deviceId: '2065240958919901196', streamId: '2065240958919901196_0-0' },
  { displayName: '13_1', deviceId: '2065241127249903643', streamId: '2065241127249903643_0-0' },
  { displayName: '14_1', deviceId: '2065241257311076445', streamId: '2065241257311076445_0-0' },
  { displayName: '15_1', deviceId: '2065241382175506494', streamId: '2065241382175506494_0-0' },
] as const;

const buildThermalStreamUrls = (streamId: string) => ({
  flv: streamId ? `https://192.168.1.202:7443/rtp/${streamId}.live.flv` : '',
  wsFlv: streamId ? `wss://192.168.1.202:7443/rtp/${streamId}.live.flv` : '',
  webrtc: streamId ? `https://192.168.1.202:7443/index/api/webrtc?app=rtp&stream=${streamId}&type=play` : '',
  rtmp: streamId ? `rtmp://192.168.1.202:11935/rtp/${streamId}` : '',
  rtsp: streamId ? `rtsp://192.168.1.202:8554/rtp/${streamId}` : '',
});

const documentThermalCameraFeeds: ThermalCameraFeed[] = Array.from({ length: 16 }, (_, index) => {
  const source = DOCUMENT_THERMAL_CAMERA_STREAMS[index];
  const streamId = source?.streamId ?? '';
  const deviceId = source?.deviceId ?? '';

  return {
    slot: index + 1,
    displayName: source?.displayName ?? `${index + 3}_1`,
    deviceId,
    channelId: deviceId ? `${deviceId}_0` : '',
    streamId,
    delayed: source ? 1 : 0,
    status: source ? 'online' : 'standby',
    ...buildThermalStreamUrls(streamId),
  };
});

const readString = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === 'string' ? value : '';
};

const readNumber = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const extractStreamId = (record: Record<string, unknown>) => {
  const explicit = readString(record, 'streamId') || readString(record, 'stream');
  if (explicit) return explicit;

  const sourceUrl = readString(record, 'webrtc') || readString(record, 'flv') || readString(record, 'rtsp');
  const match = sourceUrl.match(/rtp\/([^/?]+?)(?:\.live\.[a-z]+)?(?:[/?]|$)/i);
  return match?.[1] ?? '';
};

const normalizeThermalCameraFeeds = (payload: unknown): ThermalCameraFeed[] => {
  const data = unwrapApiData(payload);

  if (!Array.isArray(data)) {
    throw new Error('热成像列表接口返回结构不符合文档：应为数组');
  }

  return Array.from({ length: 16 }, (_, index) => {
    const record = typeof data[index] === 'object' && data[index] !== null
      ? data[index] as Record<string, unknown>
      : {};
    const streamId = extractStreamId(record);
    const deviceId = readString(record, 'deviceId') || readString(record, 'deviceID');
    const fallbackUrls = buildThermalStreamUrls(streamId);
    const isConfigured = Boolean(deviceId || streamId || readString(record, 'flv'));

    return {
      slot: index + 1,
      displayName: readString(record, 'displayName') || readString(record, 'name') || `${index + 3}_1`,
      deviceId,
      channelId: readString(record, 'channelId') || (deviceId ? `${deviceId}_0` : ''),
      streamId,
      delayed: readNumber(record, 'delayed') ?? (isConfigured ? 1 : 0),
      status: isConfigured ? 'online' : 'standby',
      flv: readString(record, 'flv') || fallbackUrls.flv,
      wsFlv: readString(record, 'wsFlv') || fallbackUrls.wsFlv,
      webrtc: readString(record, 'webrtc') || fallbackUrls.webrtc,
      rtmp: readString(record, 'rtmp') || fallbackUrls.rtmp,
      rtsp: readString(record, 'rtsp') || fallbackUrls.rtsp,
    };
  });
};

function renderThermalCameraCard(
  camera: ThermalCameraFeed,
  thermalCameraEnabled: Record<number, boolean>,
  toggleThermalCamera: (slot: number) => void,
) {
    const isConfigured = camera.status === 'online';
    const isEnabled = thermalCameraEnabled[camera.slot] ?? true;
    const isLive = isConfigured && isEnabled;
    const isStandby = !isConfigured && isEnabled;
    const statusColor = isLive
      ? 'var(--status-online)'
      : isStandby
        ? 'rgba(255, 255, 255, 0.46)'
        : 'var(--text-muted)';
    const statusText = isLive ? '在线' : isStandby ? '待接入' : '已停用';
    const primaryStream = camera.webrtc || camera.flv || '未配置';
    const switchLabel = `${isEnabled ? '关闭' : '开启'}热成像 ${camera.displayName}`;

    return (
      <article
        key={camera.slot}
        className="thermal-camera-card"
        style={{
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: isEnabled
            ? 'linear-gradient(180deg, rgba(18, 20, 22, 0.98), rgba(5, 8, 10, 0.98))'
            : 'linear-gradient(180deg, rgba(12, 12, 12, 0.98), rgba(5, 5, 5, 0.98))',
          border: `1px solid ${isLive ? 'rgba(48, 209, 88, 0.36)' : isStandby ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)'}`,
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: isLive
            ? '0 0 0 1px rgba(48, 209, 88, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
          opacity: isEnabled ? 1 : 0.72,
        }}
      >
        <div
          style={{
            minHeight: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '0 8px 0 10px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: statusColor,
                background: isLive ? 'rgba(48, 209, 88, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${isLive ? 'rgba(48, 209, 88, 0.24)' : 'rgba(255, 255, 255, 0.07)'}`,
                flexShrink: 0,
              }}
            >
              <Video size={13} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.25,
                  fontWeight: 650,
                  color: isEnabled ? 'var(--text-primary)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                热成像 {camera.displayName}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 10,
                  lineHeight: 1.2,
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                CH {String(camera.slot).padStart(2, '0')} · {camera.channelId || 'UNASSIGNED'}
              </div>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label={switchLabel}
            title={switchLabel}
            onClick={() => toggleThermalCamera(camera.slot)}
            className="thermal-card-switch"
            style={{
              width: 54,
              height: 44,
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'relative',
                width: 42,
                height: 24,
                borderRadius: 999,
                background: isEnabled ? 'rgba(48, 209, 88, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${isEnabled ? 'rgba(48, 209, 88, 0.38)' : 'rgba(255, 255, 255, 0.1)'}`,
                boxShadow: isEnabled ? '0 0 16px rgba(48, 209, 88, 0.16)' : 'none',
                transition: 'background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast)',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: isEnabled ? 21 : 3,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isEnabled ? '#06130a' : 'rgba(255, 255, 255, 0.42)',
                  background: isEnabled ? 'var(--status-online)' : 'rgba(255, 255, 255, 0.18)',
                  transition: 'left var(--transition-fast), background var(--transition-fast), color var(--transition-fast)',
                }}
              >
                <Power size={9} strokeWidth={2.4} />
              </span>
            </span>
          </button>
        </div>

        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 88,
            background: '#020405',
            overflow: 'hidden',
          }}
        >
          {isLive ? (
            <>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.2), rgba(10, 132, 255, 0.1) 48%, rgba(255, 69, 58, 0.12))',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 9px), repeating-linear-gradient(90deg, rgba(10,132,255,0.08) 0 1px, transparent 1px 28px)',
                  opacity: 0.72,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 12,
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: 6,
                }}
              />
              <div
                className="thermal-scan-line"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  height: '34%',
                  background: 'linear-gradient(180deg, transparent, rgba(10, 132, 255, 0.2), transparent)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '10%',
                  right: '10%',
                  bottom: '17%',
                  height: '45%',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
                  gap: 4,
                  alignItems: 'end',
                }}
              >
                {Array.from({ length: 10 }, (_, segment) => (
                  <span
                    key={segment}
                    style={{
                      height: `${28 + ((camera.slot * 7 + segment * 13) % 58)}%`,
                      borderRadius: '3px 3px 0 0',
                      background: 'linear-gradient(180deg, rgba(255, 69, 58, 0.78), rgba(255, 214, 10, 0.58), rgba(48, 209, 88, 0.28))',
                      opacity: 0.58 + ((segment + camera.slot) % 3) * 0.12,
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 8,
                color: isEnabled ? 'var(--text-muted)' : 'rgba(255, 255, 255, 0.18)',
                background: isEnabled
                  ? 'radial-gradient(circle at center, rgba(255, 255, 255, 0.045), transparent 58%)'
                  : 'repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 10px)',
              }}
            >
              <Activity size={28} strokeWidth={1.2} />
              <span style={{ fontSize: 12 }}>{isEnabled ? '等待接入' : '监控已停用'}</span>
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              left: 10,
              top: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              background: 'rgba(0, 0, 0, 0.48)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 999,
              color: statusColor,
              fontSize: 10,
              lineHeight: 1,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: statusColor,
                boxShadow: isLive ? '0 0 10px rgba(48, 209, 88, 0.8)' : 'none',
              }}
            />
            {statusText}
          </div>

          <div
            style={{
              position: 'absolute',
              left: 10,
              bottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              background: 'rgba(0, 0, 0, 0.48)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 6,
              color: isLive ? 'var(--text-secondary)' : 'var(--text-muted)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Clock size={11} />
            DELAY {camera.delayed || 0}s
          </div>
        </div>

        <div
          style={{
            padding: '9px 10px 10px',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.35fr)',
            gap: 8,
            borderTop: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>设备ID</div>
            <span
              title={camera.deviceId || '未配置'}
              style={{
                display: 'block',
                fontSize: 10,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {camera.deviceId || '未配置'}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>流地址</div>
            <span
              title={primaryStream}
              style={{
                display: 'block',
                fontSize: 10,
                color: isLive ? 'rgba(94, 234, 212, 0.82)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {primaryStream}
            </span>
          </div>
        </div>
      </article>
    );
}

export default function MonitorCenter() {
  const [thermalCameraFeeds, setThermalCameraFeeds] = useState<ThermalCameraFeed[]>(() => documentThermalCameraFeeds);
  const [thermalCameraStatus, setThermalCameraStatus] = useState<ApiStatus>('idle');
  const [thermalCameraMessage, setThermalCameraMessage] = useState('');
  const [thermalCameraEnabled, setThermalCameraEnabled] = useState<Record<number, boolean>>(() =>
    documentThermalCameraFeeds.reduce<Record<number, boolean>>((state, camera) => {
      state[camera.slot] = true;
      return state;
    }, {})
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadThermalCameraFeeds() {
      setThermalCameraMessage('');

      if (isMockOnly) {
        setThermalCameraFeeds(documentThermalCameraFeeds);
        setThermalCameraStatus('mock');
        return;
      }

      setThermalCameraStatus('loading');

      try {
        const response = await fetch(buildApiUrl('/device/live'), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json() as unknown;
        setThermalCameraFeeds(normalizeThermalCameraFeeds(payload));
        setThermalCameraStatus('success');
      } catch (error) {
        if (controller.signal.aborted) return;

        if (canUseMockData) {
          setThermalCameraFeeds(documentThermalCameraFeeds);
          setThermalCameraStatus('fallback');
        } else {
          setThermalCameraFeeds(normalizeThermalCameraFeeds([]));
          setThermalCameraStatus('error');
        }

        setThermalCameraMessage(error instanceof Error ? error.message : '接口请求失败');
      }
    }

    loadThermalCameraFeeds();

    return () => controller.abort();
  }, []);

  const toggleThermalCamera = (slot: number) => {
    setThermalCameraEnabled((prev) => ({
      ...prev,
      [slot]: !(prev[slot] ?? true),
    }));
  };

  const onlineCount = thermalCameraFeeds.filter((camera) => camera.status === 'online' && (thermalCameraEnabled[camera.slot] ?? true)).length;
  const standbyCount = thermalCameraFeeds.filter((camera) => camera.status === 'standby' && (thermalCameraEnabled[camera.slot] ?? true)).length;
  const pausedCount = thermalCameraFeeds.length - onlineCount - standbyCount;
  const thermalStatusText = thermalCameraStatus === 'loading'
    ? '查询中'
    : thermalCameraStatus === 'success'
      ? '接口数据'
      : thermalCameraStatus === 'fallback'
        ? '接口失败 · 样例'
        : thermalCameraStatus === 'error'
          ? '接口失败'
          : apiMockModeLabel[apiMockMode];

  return (
    <>
      <style jsx global>{`@keyframes thermalScan {
  0% { transform: translateY(-140%); opacity: 0; }
  18% { opacity: 0.8; }
  82% { opacity: 0.8; }
  100% { transform: translateY(360%); opacity: 0; }
}

.thermal-scan-line {
  animation: thermalScan 4.2s linear infinite;
  pointer-events: none;
}

.thermal-camera-card {
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    opacity var(--transition-fast);
}

.thermal-camera-card:hover {
  transform: translateY(-1px);
}

.thermal-card-switch {
  border-radius: 999px;
  -webkit-tap-highlight-color: transparent;
}

.thermal-card-switch > span {
  transition: filter var(--transition-fast);
}

.thermal-card-switch:hover > span {
  filter: brightness(1.12);
}

.thermal-card-switch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.monitor-center-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(4, minmax(0, 1fr));
  gap: 12px;
  flex: 1;
  min-height: 0;
}

@media (max-width: 1100px) {
  .monitor-center-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: none;
  }
}

@media (max-width: 720px) {
  .monitor-center-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .thermal-scan-line,
  .thermal-camera-card,
  .thermal-card-switch,
  .thermal-card-switch * {
    animation: none !important;
    transition: none !important;
  }

  .thermal-camera-card:hover {
    transform: none;
  }
}`}</style>
      <section
        style={{
          height: '100%',
          minHeight: 720,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '14px',
            background: 'linear-gradient(135deg, rgba(17, 17, 17, 0.98), rgba(8, 12, 14, 0.98))',
            border: '1px solid var(--border)',
            borderRadius: 8,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                background: 'linear-gradient(135deg, rgba(10, 132, 255, 0.16), rgba(48, 209, 88, 0.08))',
                border: '1px solid rgba(10, 132, 255, 0.26)',
                flexShrink: 0,
              }}
            >
              <Video size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  fontSize: 16,
                  lineHeight: 1.3,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                16个热成像监控列表
              </h2>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                GET /device/live · {thermalStatusText}
              </div>
              {thermalCameraMessage && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: thermalCameraStatus === 'error' ? 'var(--status-error)' : 'var(--status-warning)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 560,
                  }}
                  title={thermalCameraMessage}
                >
                  {thermalCameraStatus === 'fallback' ? `接口未连通，当前展示文档样例数据：${thermalCameraMessage}` : thermalCameraMessage}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            {[
              { label: '通道', value: thermalCameraFeeds.length },
              { label: '在线', value: onlineCount },
              { label: '待接入', value: standbyCount },
              { label: '停用', value: pausedCount },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  minWidth: 70,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 1 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="monitor-center-grid">
          {thermalCameraFeeds.map((camera) => renderThermalCameraCard(camera, thermalCameraEnabled, toggleThermalCamera))}
        </div>
      </section>
    </>
  );
}

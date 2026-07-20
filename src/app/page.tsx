'use client';

import { useState, useEffect, useMemo } from 'react';
import type { WinCCInstance, MetricValue, DeviceType, IronLevelMetrics } from '@/types/template';
import { winccInstances, getAlarms, getIronLevelMetrics, getIronLevelAlarms, getDeviceTypeConfig, groupWinCCByDeviceType, getIronLevelTrend, getIronLevelHistoryTrend } from '@/data/wincc-config';
import type { TrendDataPoint } from '@/data/wincc-config';
import Sidebar from '@/components/Sidebar';
import DeviceSelector from '@/components/DeviceSelector';
import DeviceTypeOverview from '@/components/DeviceTypeOverview';
import SystemOverview from '@/components/SystemOverview';
import AlarmCenter from '@/components/AlarmCenter';
import HotMetalTroughTwin from '@/components/digital-twin/HotMetalTroughTwin';
import HotMetalTroughSimTwin from '@/components/digital-twin/HotMetalTroughSimTwin';
import TemperatureTrendReport from '@/components/TemperatureTrendReport';
import WeeklyReportQuery from '@/components/WeeklyReportQuery';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiMockMode,
  apiMockModeLabel,
  buildApiUrl,
  canUseMockData,
  isMockOnly,
  unwrapApiData,
} from '@/lib/api-config';
import {
  Thermometer,
  Weight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Video,
  TrendingUp,
  TrendingDown,
  LogOut,
  Power,
  User,
  Waves,
  Activity,
  CircleDot,
  Clock,
  Tag,
  History,
} from 'lucide-react';

// 判断指标状态
function getMetricStatus(metric: MetricValue): 'normal' | 'warning' | 'critical' {
  const { current, min, max, warningLow, warningHigh } = metric;

  if ((max !== undefined && current > max) || (min !== undefined && current < min)) {
    return 'critical';
  }
  if ((warningHigh !== undefined && current > warningHigh) || (warningLow !== undefined && current < warningLow)) {
    return 'warning';
  }
  return 'normal';
}

const statusColors = {
  normal: 'var(--status-online)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-error)',
};

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

export default function Home() {
  const { user, isLoading, logout } = useAuth();
  const [selectedWinCC, setSelectedWinCC] = useState<WinCCInstance | null>(null);
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [historyHoursAgo, setHistoryHoursAgo] = useState<number | null>(null); // null = 不显示历史对比
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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const updateViewportState = () => setIsNarrowViewport(mediaQuery.matches);

    updateViewportState();
    mediaQuery.addEventListener('change', updateViewportState);
    return () => mediaQuery.removeEventListener('change', updateViewportState);
  }, []);

  // 当选择设备类型时，自动选择第一个设备
  useEffect(() => {
    if (selectedDeviceType) {
      const grouped = groupWinCCByDeviceType();
      const instances = grouped[selectedDeviceType] || [];
      if (instances.length > 0) {
        setSelectedWinCC(instances[0]);
      }
    }
  }, [selectedDeviceType]);

  // 趋势数据（必须在条件返回之前调用 Hook）
  const isLadleType = selectedWinCC?.deviceType === 'ladle';
  const trendData = useMemo(() => {
    if (!isLadleType || !selectedWinCC) return null;
    return getIronLevelTrend(selectedWinCC.id);
  }, [isLadleType, selectedWinCC, currentTime]);

  const historyTrendData = useMemo(() => {
    if (!isLadleType || !selectedWinCC || historyHoursAgo === null) return null;
    return getIronLevelHistoryTrend(selectedWinCC.id, historyHoursAgo);
  }, [isLadleType, selectedWinCC, historyHoursAgo]);

  if (isLoading || !user) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--void)',
          color: 'var(--text-tertiary)',
        }}
      >
        加载中...
      </div>
    );
  }

  const isLadle = selectedWinCC?.deviceType === 'ladle';
  const isHotMetalTrough = selectedDeviceType === 'hot-metal-trough';
  const isHotMetalTroughSim = selectedDeviceType === 'hot-metal-trough-sim';
  const isImmersiveTwin = isHotMetalTrough || isHotMetalTroughSim;
  const isReportView = activeNav === 'reports';
  const isIronLevel = isLadle;
  const ironLevelData = isIronLevel && selectedWinCC ? getIronLevelMetrics(selectedWinCC.id) : null;
  const alarms = selectedWinCC ? (isIronLevel ? getIronLevelAlarms(selectedWinCC.id) : getAlarms(selectedWinCC.id)) : [];
  const deviceConfig = selectedWinCC ? getDeviceTypeConfig(selectedWinCC.deviceType) : null;
  const effectiveSidebarCollapsed = sidebarCollapsed || isNarrowViewport;

  // 处理设备类型选择
  const handleSelectDeviceType = (deviceType: DeviceType) => {
    setSelectedDeviceType(deviceType);
  };

  // 返回设备类型总览
  const handleBackToOverview = () => {
    setSelectedDeviceType(null);
    setSelectedWinCC(null);
  };

  const toggleThermalCamera = (slot: number) => {
    setThermalCameraEnabled((prev) => ({
      ...prev,
      [slot]: !(prev[slot] ?? true),
    }));
  };

  const renderMetricCard = (
    label: string,
    metric: MetricValue,
    icon: React.ReactNode,
    showThreshold?: boolean
  ) => {
    const status = getMetricStatus(metric);
    const isAbnormal = status !== 'normal';

    return (
      <div
        style={{
          background: isAbnormal
            ? `linear-gradient(135deg, ${statusColors[status]}08, ${statusColors[status]}03)`
            : 'var(--surface)',
          borderRadius: 12,
          padding: '16px 20px',
          border: `1px solid ${isAbnormal ? statusColors[status] + '40' : 'var(--border)'}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isAbnormal && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColors[status],
              animation: status === 'critical' ? 'pulse 1s infinite' : 'pulse 2s infinite',
            }}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ color: isAbnormal ? statusColors[status] : 'var(--text-tertiary)' }}>
            {icon}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontSize: 32,
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              color: isAbnormal ? statusColors[status] : 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            {metric.current}
          </span>
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
            {metric.unit}
          </span>
          {metric.trend !== undefined && metric.trend !== 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                marginLeft: 8,
                color: metric.trend > 0 ? 'var(--status-error)' : 'var(--status-online)',
              }}
            >
              {metric.trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                {metric.trend > 0 ? '+' : ''}{metric.trend}%
              </span>
            </div>
          )}
        </div>

        {showThreshold && (metric.warningHigh || metric.max) && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                height: 4,
                background: 'var(--border)',
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {metric.max && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${Math.min((metric.current / metric.max) * 100, 100)}%`,
                    top: -2,
                    width: 2,
                    height: 8,
                    background: isAbnormal ? statusColors[status] : 'var(--accent)',
                    transform: 'translateX(-50%)',
                  }}
                />
              )}
              {metric.warningHigh && metric.max && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${(metric.warningHigh / metric.max) * 100}%`,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    background: 'var(--status-warning)',
                    opacity: 0.3,
                  }}
                />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {metric.min ?? 0}
              </span>
              {metric.warningHigh && (
                <span style={{ fontSize: 10, color: 'var(--status-warning)' }}>
                  预警: {metric.warningHigh}
                </span>
              )}
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {metric.max}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 渲染设备监控面板
  const renderDeviceMonitor = () => {
    if (!selectedWinCC || !selectedDeviceType) return null;

    // 铁水沟：全屏数字孪生
    if (isHotMetalTrough) {
      return (
        <HotMetalTroughTwin
          wincc={selectedWinCC}
          onBack={handleBackToOverview}
        />
      );
    }

    // 铁水沟：视觉仿真数字孪生
    if (isHotMetalTroughSim) {
      return (
        <HotMetalTroughSimTwin
          wincc={selectedWinCC}
          onBack={handleBackToOverview}
        />
      );
    }

    return (
      <>
        {/* 系统概览 - 始终显示 */}
        <SystemOverview />

        {/* 设备选择器 - 只显示当前类型的设备 */}
        <div style={{ marginBottom: 16 }}>
          <DeviceSelector
            deviceType={selectedDeviceType}
            selectedWinCC={selectedWinCC}
            onSelectWinCC={setSelectedWinCC}
            onBack={handleBackToOverview}
          />
        </div>

        {isIronLevel && ironLevelData ? (
          <>
            {/* 铁水液位检测系统 - 双出铁口监控 */}
            {/* 第一行：双摄像头画面 左右排列 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                marginBottom: 16,
              }}
            >
              {/* 出铁口1 视频 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  aspectRatio: '16/9',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 6,
                    zIndex: 1,
                  }}
                >
                  <Video size={14} color="#06b6d4" />
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>出铁口1</span>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--status-error)',
                      animation: 'pulse 1.5s infinite',
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    padding: '4px 8px',
                    background: ironLevelData.tap1.levelStatus === 'normal'
                      ? 'rgba(52, 199, 89, 0.2)'
                      : ironLevelData.tap1.levelStatus === 'alarm'
                      ? 'rgba(255, 69, 58, 0.2)'
                      : 'rgba(255, 214, 10, 0.2)',
                    border: `1px solid ${ironLevelData.tap1.levelStatus === 'normal'
                      ? 'rgba(52, 199, 89, 0.4)'
                      : ironLevelData.tap1.levelStatus === 'alarm'
                      ? 'rgba(255, 69, 58, 0.4)'
                      : 'rgba(255, 214, 10, 0.4)'}`,
                    borderRadius: 4,
                    fontSize: 10,
                    color: ironLevelData.tap1.levelStatus === 'normal'
                      ? 'var(--status-online)'
                      : ironLevelData.tap1.levelStatus === 'alarm'
                      ? 'var(--status-error)'
                      : 'var(--status-warning)',
                    fontWeight: 500,
                    zIndex: 1,
                  }}
                >
                  {ironLevelData.tap1.levelStatus === 'normal' ? '正常' : ironLevelData.tap1.levelStatus === 'high' ? '偏高' : ironLevelData.tap1.levelStatus === 'low' ? '偏低' : '报警'}
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(180deg, #0d1b2a 0%, #0a0a0f 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                  }}
                >
                  <Video size={40} color="var(--text-muted)" strokeWidth={1} />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    红外热像仪 Camera1
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {selectedWinCC.ipAddress}:8080/tap1
                  </span>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 12,
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#06b6d4',
                  }}
                >
                  液位: {ironLevelData.tap1.levelHeight.current} mm
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#fff',
                  }}
                >
                  {currentTime.toLocaleString('zh-CN', { hour12: false })}
                </div>
              </div>

              {/* 出铁口2 视频 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  aspectRatio: '16/9',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 6,
                    zIndex: 1,
                  }}
                >
                  <Video size={14} color="#06b6d4" />
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>出铁口2</span>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--status-error)',
                      animation: 'pulse 1.5s infinite',
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    padding: '4px 8px',
                    background: ironLevelData.tap2.levelStatus === 'normal'
                      ? 'rgba(52, 199, 89, 0.2)'
                      : ironLevelData.tap2.levelStatus === 'alarm'
                      ? 'rgba(255, 69, 58, 0.2)'
                      : 'rgba(255, 214, 10, 0.2)',
                    border: `1px solid ${ironLevelData.tap2.levelStatus === 'normal'
                      ? 'rgba(52, 199, 89, 0.4)'
                      : ironLevelData.tap2.levelStatus === 'alarm'
                      ? 'rgba(255, 69, 58, 0.4)'
                      : 'rgba(255, 214, 10, 0.4)'}`,
                    borderRadius: 4,
                    fontSize: 10,
                    color: ironLevelData.tap2.levelStatus === 'normal'
                      ? 'var(--status-online)'
                      : ironLevelData.tap2.levelStatus === 'alarm'
                      ? 'var(--status-error)'
                      : 'var(--status-warning)',
                    fontWeight: 500,
                    zIndex: 1,
                  }}
                >
                  {ironLevelData.tap2.levelStatus === 'normal' ? '正常' : ironLevelData.tap2.levelStatus === 'high' ? '偏高' : ironLevelData.tap2.levelStatus === 'low' ? '偏低' : '报警'}
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(180deg, #0d1b2a 0%, #0a0a0f 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                  }}
                >
                  <Video size={40} color="var(--text-muted)" strokeWidth={1} />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    红外热像仪 Camera2
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {selectedWinCC.ipAddress}:8080/tap2
                  </span>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 12,
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#06b6d4',
                  }}
                >
                  液位: {ironLevelData.tap2.levelHeight.current} mm
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#fff',
                  }}
                >
                  {currentTime.toLocaleString('zh-CN', { hour12: false })}
                </div>
              </div>
            </div>

            {/* 第二行：双出铁口核心参数 左右对称布局 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                marginBottom: 16,
              }}
            >
              {/* 出铁口1 参数 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <CircleDot size={14} color="#06b6d4" />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>出铁口1 检测参数</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>铁包: {ironLevelData.tap1.ladleId}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {renderMetricCard('液位高度', ironLevelData.tap1.levelHeight, <Waves size={16} />, true)}
                  {renderMetricCard('铁水温度', ironLevelData.tap1.tempSurface, <Thermometer size={16} />, true)}
                  {renderMetricCard('铁水重量', ironLevelData.tap1.weightCalculated, <Weight size={16} />, true)}
                  {renderMetricCard('结壳面积', ironLevelData.tap1.crustingArea, <Activity size={16} />, true)}
                </div>
              </div>

              {/* 出铁口2 参数 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <CircleDot size={14} color="#06b6d4" />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>出铁口2 检测参数</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>铁包: {ironLevelData.tap2.ladleId}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {renderMetricCard('液位高度', ironLevelData.tap2.levelHeight, <Waves size={16} />, true)}
                  {renderMetricCard('铁水温度', ironLevelData.tap2.tempSurface, <Thermometer size={16} />, true)}
                  {renderMetricCard('铁水重量', ironLevelData.tap2.weightCalculated, <Weight size={16} />, true)}
                  {renderMetricCard('结壳面积', ironLevelData.tap2.crustingArea, <Activity size={16} />, true)}
                </div>
              </div>
            </div>

            {/* 第三行：报警阈值 + 告警列表 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* 报警阈值与状态 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  报警阈值设置
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>液位上限阈值</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--status-error)' }}>
                        {ironLevelData.tap1.levelThresholdHigh}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>mm</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                        ({Math.round((ironLevelData.tap1.levelThresholdHigh / 800) * 100)}%)
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>液位下限阈值</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--status-warning)' }}>
                        {ironLevelData.tap1.levelThresholdLow}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>mm</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                        ({Math.round((ironLevelData.tap1.levelThresholdLow / 800) * 100)}%)
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>最近报警时间</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} color="var(--text-tertiary)" />
                      <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {ironLevelData.tap1.alarmTime || '无'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>工作模式</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-online)' }} />
                      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>1对2 双出铁口</span>
                    </div>
                  </div>
                </div>
                {/* 液位范围可视化 */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>液位范围示意</div>
                  <div style={{ position: 'relative', height: 32, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                    {/* 安全区域 */}
                    <div style={{
                      position: 'absolute',
                      left: `${(ironLevelData.tap1.levelThresholdLow / 800) * 100}%`,
                      right: `${100 - (ironLevelData.tap1.levelThresholdHigh / 800) * 100}%`,
                      top: 0,
                      bottom: 0,
                      background: 'rgba(52, 199, 89, 0.15)',
                      borderLeft: '2px solid var(--status-warning)',
                      borderRight: '2px solid var(--status-error)',
                    }} />
                    {/* 出铁口1 当前位置 */}
                    <div style={{
                      position: 'absolute',
                      left: `${(ironLevelData.tap1.levelHeight.current / 800) * 100}%`,
                      top: 2,
                      bottom: 2,
                      width: 3,
                      background: '#06b6d4',
                      borderRadius: 2,
                      transform: 'translateX(-50%)',
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: -16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 9,
                        color: '#06b6d4',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        1#
                      </div>
                    </div>
                    {/* 出铁口2 当前位置 */}
                    <div style={{
                      position: 'absolute',
                      left: `${(ironLevelData.tap2.levelHeight.current / 800) * 100}%`,
                      top: 2,
                      bottom: 2,
                      width: 3,
                      background: '#a78bfa',
                      borderRadius: 2,
                      transform: 'translateX(-50%)',
                    }}>
                      <div style={{
                        position: 'absolute',
                        bottom: -16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 9,
                        color: '#a78bfa',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        2#
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>0</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>800 mm</span>
                  </div>
                </div>
              </div>

              {/* 告警列表 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>告警信息</span>
                  {alarms.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                      共 {alarms.length} 条
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                  {alarms.length === 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '32px 0',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <CheckCircle2 size={32} strokeWidth={1} />
                      <span style={{ fontSize: 13, marginTop: 8 }}>暂无告警</span>
                    </div>
                  ) : (
                    alarms.map((alarm) => (
                      <div
                        key={alarm.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: '12px',
                          background:
                            alarm.level === 'critical'
                              ? 'rgba(255, 69, 58, 0.08)'
                              : alarm.level === 'warning'
                              ? 'rgba(255, 214, 10, 0.08)'
                              : 'rgba(255,255,255,0.02)',
                          borderRadius: 8,
                          border: `1px solid ${
                            alarm.level === 'critical'
                              ? 'rgba(255, 69, 58, 0.2)'
                              : alarm.level === 'warning'
                              ? 'rgba(255, 214, 10, 0.2)'
                              : 'var(--border)'
                          }`,
                          opacity: alarm.acknowledged ? 0.5 : 1,
                        }}
                      >
                        <div style={{ flexShrink: 0, marginTop: 2 }}>
                          {alarm.level === 'critical' ? (
                            <XCircle size={16} color="var(--status-error)" />
                          ) : alarm.level === 'warning' ? (
                            <AlertTriangle size={16} color="var(--status-warning)" />
                          ) : (
                            <CheckCircle2 size={16} color="var(--text-tertiary)" />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
                            {alarm.message}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 12 }}>
                            {alarm.value !== undefined && alarm.threshold !== undefined && (
                              <span>
                                当前:{' '}
                                <span style={{ color: alarm.level === 'critical' ? 'var(--status-error)' : 'var(--status-warning)' }}>
                                  {alarm.value}
                                </span>{' '}
                                / 阈值: {alarm.threshold}
                              </span>
                            )}
                            <span>{alarm.time}</span>
                          </div>
                        </div>
                        {alarm.acknowledged && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              background: 'var(--border)',
                              borderRadius: 4,
                              color: 'var(--text-muted)',
                            }}
                          >
                            已确认
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 第四行：液位趋势曲线 + 历史对比 */}
            {trendData && (
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid var(--border)',
                  marginTop: 16,
                }}
              >
                {/* 标题栏 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={14} color="#06b6d4" />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>液位趋势曲线</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>（最近30分钟）</span>
                  </div>
                  {/* 历史对比按钮组 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <History size={13} color="var(--text-muted)" />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>对比:</span>
                    {[1, 2, 4, 8].map((h) => (
                      <button
                        key={h}
                        onClick={() => setHistoryHoursAgo(historyHoursAgo === h ? null : h)}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: `1px solid ${historyHoursAgo === h ? '#06b6d4' : 'var(--border)'}`,
                          background: historyHoursAgo === h ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                          color: historyHoursAgo === h ? '#06b6d4' : 'var(--text-muted)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        {h}h前
                      </button>
                    ))}
                  </div>
                </div>

                {/* 双出铁口趋势图 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* 出铁口1趋势 */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 3, borderRadius: 2, background: '#06b6d4' }} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>出铁口1 实时</span>
                      {historyTrendData && (
                        <>
                          <div style={{ width: 10, height: 3, borderRadius: 2, background: '#06b6d4', opacity: 0.35 }} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{historyHoursAgo}h前</span>
                        </>
                      )}
                    </div>
                    <svg viewBox="0 0 500 160" style={{ width: '100%', height: 160, display: 'block' }}>
                      {/* 背景网格 */}
                      {[0, 1, 2, 3, 4].map((i) => (
                        <line key={`g1-${i}`} x1={40} y1={20 + i * 30} x2={490} y2={20 + i * 30} stroke="var(--border)" strokeWidth={0.5} />
                      ))}
                      {/* Y轴标签 */}
                      {[800, 600, 400, 200, 0].map((v, i) => (
                        <text key={`y1-${i}`} x={35} y={24 + i * 30} textAnchor="end" fill="var(--text-muted)" fontSize={9} fontFamily="var(--font-mono)">{v}</text>
                      ))}
                      {/* 阈值线 */}
                      <line x1={40} y1={20 + ((800 - ironLevelData!.tap1.levelThresholdHigh) / 800) * 120} x2={490} y2={20 + ((800 - ironLevelData!.tap1.levelThresholdHigh) / 800) * 120} stroke="var(--status-error)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                      <line x1={40} y1={20 + ((800 - ironLevelData!.tap1.levelThresholdLow) / 800) * 120} x2={490} y2={20 + ((800 - ironLevelData!.tap1.levelThresholdLow) / 800) * 120} stroke="var(--status-warning)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                      {/* 历史对比曲线 */}
                      {historyTrendData && (
                        <polyline
                          fill="none"
                          stroke="#06b6d4"
                          strokeWidth={1.5}
                          opacity={0.3}
                          points={historyTrendData.tap1.map((p, i) => `${40 + (i / (historyTrendData.tap1.length - 1)) * 450},${20 + ((800 - p.value) / 800) * 120}`).join(' ')}
                        />
                      )}
                      {/* 实时曲线 */}
                      <polyline
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        points={trendData.tap1.map((p, i) => `${40 + (i / (trendData.tap1.length - 1)) * 450},${20 + ((800 - p.value) / 800) * 120}`).join(' ')}
                      />
                      {/* 当前值标记 */}
                      <circle cx={490} cy={20 + ((800 - trendData.tap1[trendData.tap1.length - 1].value) / 800) * 120} r={4} fill="#06b6d4" />
                      <text x={490} y={14 + ((800 - trendData.tap1[trendData.tap1.length - 1].value) / 800) * 120} textAnchor="end" fill="#06b6d4" fontSize={10} fontFamily="var(--font-mono)">{trendData.tap1[trendData.tap1.length - 1].value}mm</text>
                      {/* X轴时间标签 */}
                      {[0, 15, 30, 45, 59].map((idx) => (
                        <text key={`x1-${idx}`} x={40 + (idx / 59) * 450} y={155} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontFamily="var(--font-mono)">
                          {trendData.tap1[idx]?.time.slice(0, 5) || ''}
                        </text>
                      ))}
                    </svg>
                  </div>

                  {/* 出铁口2趋势 */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 3, borderRadius: 2, background: '#a78bfa' }} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>出铁口2 实时</span>
                      {historyTrendData && (
                        <>
                          <div style={{ width: 10, height: 3, borderRadius: 2, background: '#a78bfa', opacity: 0.35 }} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{historyHoursAgo}h前</span>
                        </>
                      )}
                    </div>
                    <svg viewBox="0 0 500 160" style={{ width: '100%', height: 160, display: 'block' }}>
                      {/* 背景网格 */}
                      {[0, 1, 2, 3, 4].map((i) => (
                        <line key={`g2-${i}`} x1={40} y1={20 + i * 30} x2={490} y2={20 + i * 30} stroke="var(--border)" strokeWidth={0.5} />
                      ))}
                      {/* Y轴标签 */}
                      {[800, 600, 400, 200, 0].map((v, i) => (
                        <text key={`y2-${i}`} x={35} y={24 + i * 30} textAnchor="end" fill="var(--text-muted)" fontSize={9} fontFamily="var(--font-mono)">{v}</text>
                      ))}
                      {/* 阈值线 */}
                      <line x1={40} y1={20 + ((800 - ironLevelData!.tap2.levelThresholdHigh) / 800) * 120} x2={490} y2={20 + ((800 - ironLevelData!.tap2.levelThresholdHigh) / 800) * 120} stroke="var(--status-error)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                      <line x1={40} y1={20 + ((800 - ironLevelData!.tap2.levelThresholdLow) / 800) * 120} x2={490} y2={20 + ((800 - ironLevelData!.tap2.levelThresholdLow) / 800) * 120} stroke="var(--status-warning)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                      {/* 历史对比曲线 */}
                      {historyTrendData && (
                        <polyline
                          fill="none"
                          stroke="#a78bfa"
                          strokeWidth={1.5}
                          opacity={0.3}
                          points={historyTrendData.tap2.map((p, i) => `${40 + (i / (historyTrendData.tap2.length - 1)) * 450},${20 + ((800 - p.value) / 800) * 120}`).join(' ')}
                        />
                      )}
                      {/* 实时曲线 */}
                      <polyline
                        fill="none"
                        stroke="#a78bfa"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        points={trendData.tap2.map((p, i) => `${40 + (i / (trendData.tap2.length - 1)) * 450},${20 + ((800 - p.value) / 800) * 120}`).join(' ')}
                      />
                      {/* 当前值标记 */}
                      <circle cx={490} cy={20 + ((800 - trendData.tap2[trendData.tap2.length - 1].value) / 800) * 120} r={4} fill="#a78bfa" />
                      <text x={490} y={14 + ((800 - trendData.tap2[trendData.tap2.length - 1].value) / 800) * 120} textAnchor="end" fill="#a78bfa" fontSize={10} fontFamily="var(--font-mono)">{trendData.tap2[trendData.tap2.length - 1].value}mm</text>
                      {/* X轴时间标签 */}
                      {[0, 15, 30, 45, 59].map((idx) => (
                        <text key={`x2-${idx}`} x={40 + (idx / 59) * 450} y={155} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontFamily="var(--font-mono)">
                          {trendData.tap2[idx]?.time.slice(0, 5) || ''}
                        </text>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 400,
              color: 'var(--text-tertiary)',
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 16,
                background: `${deviceConfig?.color || '#666'}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Video size={32} color={deviceConfig?.color || '#666'} />
            </div>
            <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {deviceConfig?.name || selectedWinCC.deviceType} 监控
            </div>
            <div style={{ fontSize: 13 }}>{deviceConfig?.description || '监控模板开发中...'}</div>
          </div>
        )}
      </>
    );
  };

  // 渲染监控总览页面
  const renderDashboard = () => {
    // 如果已选择设备类型，显示设备监控面板
    if (selectedDeviceType) {
      return renderDeviceMonitor();
    }

    // 否则显示设备类型总览
    return (
      <>
        <SystemOverview />
        <DeviceTypeOverview onSelectDeviceType={handleSelectDeviceType} />
      </>
    );
  };

  // 渲染占位页面
  const renderPlaceholder = (title: string, description: string) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 400,
        color: 'var(--text-tertiary)',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{description}</div>
    </div>
  );

  const renderThermalCameraCard = (camera: ThermalCameraFeed) => {
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
  };

  const renderMonitorCenter = () => {
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
          {thermalCameraFeeds.map((camera) => renderThermalCameraCard(camera))}
        </div>
      </section>
    );
  };

  // 根据导航渲染内容
  const renderContent = () => {
    switch (activeNav) {
      case 'dashboard':
        return renderDashboard();
      case 'devices':
        return renderMonitorCenter();
      case 'reports':
        return <TemperatureTrendReport />;
      case 'alarms':
        return <AlarmCenter />;
      case 'settings':
        return <WeeklyReportQuery />;
      case 'help':
        return renderPlaceholder('帮助文档', '使用说明和帮助文档编写中...');
      default:
        return renderDashboard();
    }
  };

  // 当切换导航时，重置设备类型选择
  const handleNavChange = (navId: string) => {
    setActiveNav(navId);
    if (navId !== 'dashboard') {
      setSelectedDeviceType(null);
      setSelectedWinCC(null);
    }
  };

  const navTitles: Record<string, string> = {
    dashboard: '监控总览',
    devices: '监控中心',
    reports: '报表分析',
    alarms: '告警中心',
    settings: '查询周报',
    help: '帮助文档',
  };

  // 获取当前标题
  const getCurrentTitle = () => {
    if (activeNav === 'dashboard' && selectedDeviceType === 'hot-metal-trough-sim') {
      return '铁水沟一视觉仿真';
    }
    if (activeNav === 'dashboard' && selectedDeviceType === 'hot-metal-trough') {
      return '铁水沟数字孪生';
    }
    if (activeNav === 'dashboard' && selectedDeviceType && deviceConfig) {
      return `${deviceConfig.name}监控`;
    }
    return navTitles[activeNav];
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--void)' }}>
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @keyframes thermalScan {
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
        }
      `}</style>

      <Sidebar
        activeNav={activeNav}
        onNavChange={handleNavChange}
        collapsed={effectiveSidebarCollapsed}
        onToggleCollapse={isNarrowViewport ? undefined : () => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isNarrowViewport ? '0 12px' : '0 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h1 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
              {getCurrentTitle()}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {!isNarrowViewport && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                background: 'var(--surface-hover)',
                borderRadius: 8,
              }}
            >
              <User size={14} color="var(--text-tertiary)" />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user.name}</span>
              <button
                onClick={logout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  marginLeft: 4,
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 69, 58, 0.1)';
                  e.currentTarget.style.color = 'var(--status-error)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
                title="退出登录"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: isImmersiveTwin || isReportView ? 'hidden' : 'auto',
            padding: isImmersiveTwin ? 0 : isNarrowViewport ? 12 : isReportView ? 16 : 20,
          }}
        >
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

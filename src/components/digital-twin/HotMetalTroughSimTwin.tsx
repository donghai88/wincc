'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import {
  ArrowLeft,
  Clock3,
  MousePointer2,
  Move,
  RotateCcw,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { WinCCInstance } from '@/types/template';
import { useBusinessAlarmFeed } from '@/hooks/useBusinessAlarmFeed';
import { useModbusTemperatureFeed } from '@/hooks/useModbusTemperatureFeed';
import type { HotMetalTroughSimSceneProps } from './HotMetalTroughSimScene';
import workspaceStyles from '../MonitoringWorkspace.module.css';
import styles from './HotMetalTroughSimTwin.module.css';

export type SimulationLayer = 'cad' | 'temperature' | 'pressure' | 'erosion' | 'burden' | 'flow';

const HotMetalTroughSimScene = dynamic<HotMetalTroughSimSceneProps>(() => import('./HotMetalTroughSimScene'), {
  ssr: false,
  loading: () => (
    <div className={styles.sceneLoading} role="status" aria-live="polite">
      <div className={styles.loadingMark} />
      <span>正在加载视觉仿真场景</span>
    </div>
  ),
});

interface HotMetalTroughSimTwinProps {
  wincc: WinCCInstance;
  onBack: () => void;
}

interface LayerConfig {
  id: SimulationLayer;
  name: string;
  color: string;
  legendMin: string;
  legendMax: string;
}

/** 右侧列表按第1～7排中文名固定顺序展示，避免随 locationId 跳动 */
const MONITOR_DISPLAY_ORDER = [
  '第一排左侧',
  '第一排右侧',
  '第二排左侧',
  '第二排右侧',
  '第三排左侧',
  '第三排右侧',
  '第四排左侧',
  '第四排右侧',
  '第五排左侧',
  '第五排右侧',
  '第六排左侧前',
  '第六排左侧后',
  '第六排右侧前',
  '第六排右侧后',
  '第七排左侧',
  '第七排右侧',
] as const;

const cadLayerConfig: LayerConfig = {
  id: 'cad',
  name: '模型本体',
  color: '#7dd3fc',
  legendMin: '原始几何',
  legendMax: '渲染增强',
};

const modbusFeedLabels = {
  mock: '演示推送',
  connecting: '连接中',
  connected: '实时数据',
  fallback: '备用数据',
  error: '推送异常',
  retrying: '重连中',
} as const;

const normalizeLocationId = (locationId: string) => (
  locationId.toLowerCase().replace(/^loc_0+/, 'loc_')
);

const formatPointLabel = (locationId?: string) => {
  if (!locationId) return '测点 --';
  const match = normalizeLocationId(locationId).match(/^loc_(\d+)$/);
  if (!match) return locationId;
  return `测点 ${match[1].padStart(2, '0')}`;
};

export default function HotMetalTroughSimTwin({ wincc, onBack }: HotMetalTroughSimTwinProps) {
  const activeLayer: SimulationLayer = 'cad';
  const modbusFeed = useModbusTemperatureFeed();
  const businessAlarmFeed = useBusinessAlarmFeed();
  const modbusPoint = modbusFeed.point;
  const modbusPoints = modbusFeed.points;
  const businessAlarm = businessAlarmFeed.alarm;
  const isModbusDisconnected = modbusFeed.status === 'error';
  const isModbusRetrying = modbusFeed.status === 'retrying';
  const isModbusConnectionIssue = isModbusDisconnected || isModbusRetrying;
  const isBusinessAlarmActive = Boolean(businessAlarm) && !isModbusConnectionIssue;
  const feedStatusLabel = isModbusDisconnected
    ? '连接中断'
    : isModbusRetrying
      ? '重连中'
      : isBusinessAlarmActive
        ? '高温报警'
        : modbusFeedLabels[modbusFeed.status];
  const activeConfig = cadLayerConfig;

  const pointsByName = useMemo(() => {
    const map = new Map<string, (typeof modbusPoints)[number]>();
    modbusPoints.forEach((point) => {
      map.set(point.locationName.trim(), point);
    });
    return map;
  }, [modbusPoints]);

  const latestLocationName = modbusPoint?.locationName.trim() ?? '';
  const alarmLocationName = isBusinessAlarmActive ? businessAlarm?.locationName.trim() ?? '' : '';

  const pointRows = useMemo(() => (
    MONITOR_DISPLAY_ORDER.map((locationName) => {
      const live = pointsByName.get(locationName);
      return {
        id: locationName,
        label: formatPointLabel(live?.locationId),
        temperature: live?.temperature,
        receivedAt: live?.receivedAt,
        locationName,
        isLive: Boolean(live),
        isLatest: latestLocationName === locationName,
        isAlarm: alarmLocationName === locationName,
      };
    })
  ), [alarmLocationName, latestLocationName, pointsByName]);

  const liveCount = pointRows.filter((row) => row.isLive).length;

  const statusRows = [
    { label: '连接状态', value: feedStatusLabel },
    { label: '已更新', value: `${liveCount} / 16` },
    { label: '最后推送', value: modbusPoint?.receivedAt ?? '--' },
  ];

  const accentStyle = {
    '--active-color': activeConfig.color,
  } as CSSProperties;

  return (
    <section className={styles.simShell} aria-label={`${wincc.name}视觉仿真数字孪生`}>
      <header className={`${styles.topBar} ${workspaceStyles.topBar}`}>
        <div className={workspaceStyles.topBarInner}>
          <button className={styles.backButton} type="button" onClick={onBack} aria-label="返回设备类型总览">
            <ArrowLeft size={18} aria-hidden="true" />
            <span>返回</span>
          </button>

          <div className={styles.titleBlock}>
            <div className={styles.titleLine}>
              <h1>{wincc.name}</h1>
              <span className={styles.simBadge}>数字孪生版</span>
            </div>
            <p>{wincc.location} · 三维模型联动测点温度</p>
          </div>

          <div className={styles.statusCluster}>
            <span className={styles.statusPill}>{feedStatusLabel}</span>
            <span className={styles.clockPill}>
              <Clock3 size={14} aria-hidden="true" />
              {modbusPoint?.receivedAt ?? '等待实时数据'}
            </span>
          </div>
        </div>
      </header>

      <div className={`${styles.workspace} ${workspaceStyles.workspace}`} style={accentStyle}>
        <main className={styles.sceneDeck}>
          <HotMetalTroughSimScene
            activeLayer={activeLayer}
            temperaturePoint={modbusPoint}
            temperaturePoints={modbusPoints}
            feedStatus={modbusFeed.status}
            businessAlarm={businessAlarm}
          />

          <div className={styles.sceneControls} aria-label="三维模型操作提示">
            <span>
              <MousePointer2 size={15} aria-hidden="true" />
              拖拽旋转
            </span>
            <span>
              <Move size={15} aria-hidden="true" />
              右键平移
            </span>
            <span>
              <RotateCcw size={15} aria-hidden="true" />
              滚轮缩放
            </span>
          </div>
        </main>

        <aside className={styles.inspector} aria-label="资源状态">
          <section className={styles.statusPanel}>
            <div className={styles.panelHeader}>
              <strong>资源状态</strong>
              <span className={styles.panelHint}>16 测点总览</span>
            </div>

            <div className={styles.statusStrip} aria-label="连接概览" data-status={isBusinessAlarmActive ? 'alarm' : modbusFeed.status}>
              {statusRows.map((row) => (
                <div className={styles.statusStripCell} key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>

            {isBusinessAlarmActive && businessAlarm && (
              <div className={styles.alarmBanner} role="status">
                <div>
                  <span>高温报警</span>
                  <strong>{businessAlarm.locationName || '测点告警'}</strong>
                </div>
                <p>
                  峰值 {businessAlarm.maxTemp.toFixed(1)}°C · 阈值 {businessAlarm.thresholdTemp.toFixed(1)}°C · {businessAlarm.receivedAt}
                </p>
              </div>
            )}

            {(modbusFeed.message || (businessAlarmFeed.message && isBusinessAlarmActive)) && (
              <p className={styles.feedMessage}>
                {modbusFeed.message || businessAlarmFeed.message}
              </p>
            )}

            <div className={styles.pointSectionHeader}>
              <span>测点温度</span>
              <strong>有数 {liveCount} · 空位 {16 - liveCount}</strong>
            </div>

            <div className={styles.pointGrid} aria-label="十六测点温度">
              {pointRows.map((row) => (
                <div
                  key={row.id}
                  className={styles.pointCell}
                  data-live={row.isLive ? 'true' : 'false'}
                  data-latest={row.isLatest ? 'true' : 'false'}
                  data-alarm={row.isAlarm ? 'true' : 'false'}
                >
                  <span>{row.locationName}</span>
                  <strong>
                    {row.temperature !== undefined ? row.temperature.toFixed(1) : '--'}
                    <small>°C</small>
                  </strong>
                  <em>{row.isLive ? row.label : '暂无数据'}</em>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

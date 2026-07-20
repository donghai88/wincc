'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import {
  ArrowLeft,
  Box,
  Clock3,
  MousePointer2,
  Move,
  RadioTower,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { HotMetalTroughMetrics, MetricValue, WinCCInstance } from '@/types/template';
import { getHotMetalTroughMetrics } from '@/data/wincc-config';
import { useBusinessAlarmFeed } from '@/hooks/useBusinessAlarmFeed';
import { useModbusTemperatureFeed } from '@/hooks/useModbusTemperatureFeed';
import type { HotMetalTroughSimSceneProps } from './HotMetalTroughSimScene';
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
  icon: LucideIcon;
  color: string;
  value: number;
  unit: string;
  legendMin: string;
  legendMax: string;
}

const cadLayerConfig: LayerConfig = {
  id: 'cad',
  name: 'CAD 本体增强',
  icon: Box,
  color: '#7dd3fc',
  value: 9,
  unit: 'mesh',
  legendMin: '原始几何',
  legendMax: '渲染增强',
};

const qualityRows = [
  { label: '模型基准', value: 'langan.glb' },
  { label: '仿真状态', value: '演示运行' },
  { label: '刷新周期', value: '1.2s' },
  { label: '空间基准', value: '模型归一' },
];

const modbusFeedLabels = {
  mock: 'Mock 推送',
  connecting: 'WS 连接中',
  connected: 'WS 实时',
  fallback: 'WS 回退 Mock',
  error: 'WS 异常',
  retrying: '重连中',
} as const;

function formatMetric(metric: MetricValue) {
  return Number.isInteger(metric.current) ? `${metric.current}${metric.unit}` : `${metric.current.toFixed(1)}${metric.unit}`;
}

function dataCells(metrics: HotMetalTroughMetrics) {
  return [
    { label: '铁水液位', value: formatMetric(metrics.ironLevel) },
    { label: '铁水温度', value: formatMetric(metrics.ironTemp) },
    { label: '沟体流量', value: formatMetric(metrics.flowRate) },
    { label: '沟体温度', value: formatMetric(metrics.trenchTemp) },
  ];
}

export default function HotMetalTroughSimTwin({ wincc, onBack }: HotMetalTroughSimTwinProps) {
  const activeLayer: SimulationLayer = 'cad';
  const metrics = getHotMetalTroughMetrics(wincc.id);
  const modbusFeed = useModbusTemperatureFeed();
  const businessAlarmFeed = useBusinessAlarmFeed();
  const modbusPoint = modbusFeed.point;
  const businessAlarm = businessAlarmFeed.alarm;
  const isModbusDisconnected = modbusFeed.status === 'error';
  const isModbusRetrying = modbusFeed.status === 'retrying';
  const isModbusConnectionIssue = isModbusDisconnected || isModbusRetrying;
  const isBusinessAlarmActive = Boolean(businessAlarm) && !isModbusConnectionIssue;
  const modbusCardStatus = isModbusDisconnected ? 'error' : isModbusRetrying ? 'retrying' : isBusinessAlarmActive ? 'alarm' : modbusFeed.status;
  const modbusCardLabel = isModbusDisconnected
    ? '连接中断'
    : isModbusRetrying
      ? '重连中'
      : isBusinessAlarmActive
        ? '高温报警'
        : modbusFeedLabels[modbusFeed.status];
  const modbusCardValue = isBusinessAlarmActive && businessAlarm
    ? businessAlarm.maxTemp
    : modbusPoint?.temperature;
  const activeConfig = cadLayerConfig;
  const ActiveIcon = activeConfig.icon;
  const metricCells = useMemo(() => dataCells(metrics), [metrics]);

  const accentStyle = {
    '--active-color': activeConfig.color,
  } as CSSProperties;

  return (
    <section className={styles.simShell} aria-label={`${wincc.name}视觉仿真数字孪生`}>
      <header className={styles.topBar}>
        <button className={styles.backButton} type="button" onClick={onBack} aria-label="返回设备类型总览">
          <ArrowLeft size={18} aria-hidden="true" />
          <span>返回</span>
        </button>

        <div className={styles.titleBlock}>
          <div className={styles.titleLine}>
            <h1>{wincc.name}</h1>
            <span className={styles.simBadge}>数字孪生版</span>
          </div>
          <p>{wincc.location} / 基准模型: langan.glb / 仿真覆盖层为演示数据</p>
        </div>

        <div className={styles.statusCluster}>
          <span className={styles.statusPill}>在线仿真</span>
          <span className={styles.clockPill}>
            <Clock3 size={14} aria-hidden="true" />
            {wincc.lastUpdate}
          </span>
        </div>
      </header>

      <div className={styles.workspace} style={accentStyle}>
        <main className={styles.sceneDeck}>
          <HotMetalTroughSimScene
            activeLayer={activeLayer}
            temperaturePoint={modbusPoint}
            feedStatus={modbusFeed.status}
            businessAlarm={businessAlarm}
          />

          <div className={styles.legendStrip} aria-label="当前图层色标">
            <div className={styles.legendHeader}>
              <span>渲染层级</span>
              <strong>{activeConfig.name}</strong>
            </div>
            <div className={`${styles.legendGradient} ${styles.cadLegend}`} aria-hidden="true" />
            <div className={styles.legendTicks}>
              <span>{activeConfig.legendMin}</span>
              <span>{activeConfig.legendMax}</span>
            </div>
          </div>

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

        <aside className={styles.inspector} aria-label="仿真参数">
          <section>
            <div className={styles.panelHeader}>
              <div>
                <span>ACTIVE SIMULATION</span>
                <strong>{activeConfig.name}</strong>
              </div>
              <ActiveIcon size={22} color={activeConfig.color} aria-hidden="true" />
            </div>

            <div className={styles.activeReadout}>
              <div className={styles.readoutTop}>
                <span>当前模型量</span>
                <Sparkles size={16} color={activeConfig.color} aria-hidden="true" />
              </div>
              <div className={styles.readoutValue}>
                <strong>{activeConfig.value}</strong>
                <span>{activeConfig.unit}</span>
              </div>
              <p className={styles.readoutCopy}>
                当前为 CAD 本体增强模式：只展示 langan.glb 原始几何，并按几何特征应用工业材质、灯光、接触阴影和少量边线。
              </p>
            </div>
          </section>

          <section>
            <div className={styles.panelHeader}>
              <div>
                <span>PROCESS DATA</span>
                <strong>关键工况</strong>
              </div>
              <RadioTower size={20} color="#22d3ee" aria-hidden="true" />
            </div>
            <div className={styles.dataGrid}>
              {metricCells.map((cell) => (
                <div className={styles.dataCell} key={cell.label}>
                  <span>{cell.label}</span>
                  <strong>{cell.value}</strong>
                </div>
              ))}
            </div>
            <div className={styles.modbusCard} data-status={modbusCardStatus} aria-label="WS 推送数字孪生点位">
              <div className={styles.modbusTop}>
                <span>{modbusPoint?.locationName ?? '位置1'}</span>
                <strong>{modbusCardLabel}</strong>
              </div>
              <div className={styles.modbusValue}>
                <strong>{modbusCardValue !== undefined ? modbusCardValue.toFixed(1) : '--'}</strong>
                <span>°C</span>
              </div>
              <div className={styles.modbusMeta}>
                <span>{businessAlarm && isBusinessAlarmActive ? `${businessAlarm.ruleType} / ${businessAlarm.level}级` : modbusPoint?.locationId ?? 'loc_1'}</span>
                <span>{isBusinessAlarmActive && businessAlarm ? businessAlarm.receivedAt : modbusPoint?.receivedAt ?? '--'}</span>
              </div>
              {businessAlarm && isBusinessAlarmActive && (
                <div className={styles.modbusAlarmMeta}>
                  <span>阈值 {businessAlarm.thresholdTemp.toFixed(1)}°C</span>
                  <span>均温 {businessAlarm.avgTemp.toFixed(1)}°C</span>
                  <span>{businessAlarm.isRead === 0 ? '未读' : '已读'}</span>
                </div>
              )}
              {modbusFeed.message && <p>{modbusFeed.message}</p>}
              {businessAlarmFeed.message && isBusinessAlarmActive && <p>{businessAlarmFeed.message}</p>}
            </div>
          </section>

          <section>
            <div className={styles.panelHeader}>
              <div>
                <span>MODEL QUALITY</span>
                <strong>资源状态</strong>
              </div>
              <Box size={20} color="#fbbf24" aria-hidden="true" />
            </div>
            <div className={styles.qualityList}>
              {qualityRows.map((row) => (
                <div className={styles.qualityRow} key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

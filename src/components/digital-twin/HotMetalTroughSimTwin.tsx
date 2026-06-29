'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Box,
  Clock3,
  Crosshair,
  Gauge,
  Layers3,
  MousePointer2,
  RadioTower,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { HotMetalTroughMetrics, MetricValue, WinCCInstance } from '@/types/template';
import { getHotMetalTroughMetrics } from '@/data/wincc-config';
import styles from './HotMetalTroughSimTwin.module.css';

export type SimulationLayer = 'cad' | 'temperature' | 'pressure' | 'erosion' | 'burden' | 'flow';

const HotMetalTroughSimScene = dynamic(() => import('./HotMetalTroughSimScene'), {
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
  shortName: string;
  description: string;
  icon: LucideIcon;
  color: string;
  value: number;
  unit: string;
  legendMin: string;
  legendMax: string;
}

const layerConfigs: LayerConfig[] = [
  {
    id: 'cad',
    name: 'CAD 本体增强',
    shortName: 'CAD本体',
    description: '仅展示 gaolu.fbx 原始 CAD 构造，叠加灯光、材质、边线和景深层次，不新增任何实体建筑。',
    icon: Box,
    color: '#7dd3fc',
    value: 2006,
    unit: 'mesh',
    legendMin: '原始几何',
    legendMax: '渲染增强',
  },
  {
    id: 'temperature',
    name: '温度场仿真',
    shortName: '温度场',
    description: '按出铁沟、炉缸、沟体周边的热区做分层热力覆盖，突出高温核心与冷却边界。',
    icon: Thermometer,
    color: '#fb923c',
    value: 1498,
    unit: '°C',
    legendMin: '780°C',
    legendMax: '1550°C',
  },
  {
    id: 'pressure',
    name: '等压线仿真',
    shortName: '等压线',
    description: '用多层闭合曲线表现炉顶、管网和炉缸区域的压差场分布。',
    icon: Gauge,
    color: '#60a5fa',
    value: 2.1,
    unit: 'kPa',
    legendMin: '0.4kPa',
    legendMax: '3.2kPa',
  },
  {
    id: 'erosion',
    name: '炉衬侵蚀仿真',
    shortName: '侵蚀',
    description: '用剖切色带表现沟体耐材侵蚀厚度、薄弱带和剩余寿命趋势。',
    icon: ShieldCheck,
    color: '#a78bfa',
    value: 18.6,
    unit: 'mm',
    legendMin: '0mm',
    legendMax: '42mm',
  },
  {
    id: 'burden',
    name: '布料轨迹仿真',
    shortName: '布料',
    description: '模拟炉顶装料落点、料面分布环带和中心偏析趋势。',
    icon: Crosshair,
    color: '#34d399',
    value: 76,
    unit: '%',
    legendMin: '42%',
    legendMax: '96%',
  },
  {
    id: 'flow',
    name: '铁水流场仿真',
    shortName: '流场',
    description: '沿铁水沟走向表现铁水流速、流线和高亮粒子方向。',
    icon: Waves,
    color: '#22d3ee',
    value: 3.6,
    unit: 't/min',
    legendMin: '0.8t/min',
    legendMax: '6.8t/min',
  },
];

const qualityRows = [
  { label: '模型基准', value: 'gaolu.fbx' },
  { label: '仿真状态', value: '演示运行' },
  { label: '刷新周期', value: '1.2s' },
  { label: '空间基准', value: '模型归一' },
];

const eventRows = [
  { time: '14:30', text: '温度场覆盖层完成重采样' },
  { time: '14:28', text: '铁水流场粒子速度稳定' },
  { time: '14:24', text: '炉衬侵蚀剖面进入关注区' },
];

const trendSeed: Record<SimulationLayer, number[]> = {
  cad: [44, 46, 48, 49, 51, 54, 55, 57, 59, 58, 60, 63, 64, 62, 65, 67, 68, 66, 69, 71, 70, 72, 73, 74],
  temperature: [52, 55, 58, 61, 65, 68, 72, 76, 74, 79, 83, 87, 84, 81, 86, 89, 92, 88, 85, 82, 86, 90, 87, 91],
  pressure: [35, 38, 41, 44, 43, 47, 52, 49, 55, 58, 61, 59, 62, 66, 64, 68, 71, 69, 72, 75, 73, 70, 74, 76],
  erosion: [22, 24, 26, 27, 29, 31, 32, 34, 33, 36, 37, 39, 41, 40, 43, 45, 47, 49, 48, 50, 53, 55, 56, 58],
  burden: [47, 51, 54, 57, 61, 64, 68, 71, 69, 72, 76, 78, 75, 79, 82, 80, 84, 87, 85, 88, 90, 86, 89, 92],
  flow: [32, 37, 44, 49, 54, 52, 58, 63, 68, 72, 69, 74, 79, 76, 81, 86, 83, 88, 91, 87, 84, 89, 92, 90],
};

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
  const [activeLayer, setActiveLayer] = useState<SimulationLayer>('cad');
  const metrics = getHotMetalTroughMetrics(wincc.id);
  const activeConfig = layerConfigs.find((layer) => layer.id === activeLayer) ?? layerConfigs[0];
  const ActiveIcon = activeConfig.icon;
  const metricCells = useMemo(() => dataCells(metrics), [metrics]);
  const chartValues = trendSeed[activeLayer];

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
          <span className={styles.eyebrow}>HOT METAL TROUGH VISUAL SIMULATION</span>
          <div className={styles.titleLine}>
            <h1>{wincc.name}</h1>
            <span className={styles.simBadge}>视觉仿真版</span>
          </div>
          <p>{wincc.location} / 基准模型: gaolu.fbx / 仿真覆盖层为演示数据</p>
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
        <nav className={styles.layerRail} aria-label="仿真图层">
          <div className={styles.railTitle}>
            <Layers3 size={18} aria-hidden="true" />
          </div>
          {layerConfigs.map((layer) => {
            const Icon = layer.icon;
            const layerStyle = { '--layer-color': layer.color } as CSSProperties;
            return (
              <button
                key={layer.id}
                type="button"
                className={`${styles.layerButton} ${activeLayer === layer.id ? styles.activeLayer : ''}`}
                style={layerStyle}
                onClick={() => setActiveLayer(layer.id)}
                aria-pressed={activeLayer === layer.id}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{layer.shortName}</span>
              </button>
            );
          })}
        </nav>

        <main className={styles.sceneDeck}>
          <HotMetalTroughSimScene activeLayer={activeLayer} />

          <div className={styles.sceneHud}>
            {/* <div className={styles.sceneTitle}>
              <span>场景基准</span>
              <strong>FBX CAD 模型 + 程序化仿真覆盖层</strong>
            </div> */}
            {/* <div className={styles.modeBanner}>
              <ActiveIcon size={18} aria-hidden="true" />
              <div>
                <strong>{activeConfig.name}</strong>
                <span>{activeConfig.description}</span>
              </div>
            </div> */}
          </div>

            <div className={styles.legendStrip} aria-label="当前图层色标">
              <div className={styles.legendHeader}>
              <span>{activeLayer === 'cad' ? '渲染层级' : '仿真色标'}</span>
              <strong>{activeConfig.name}</strong>
            </div>
            <div className={`${styles.legendGradient} ${activeLayer === 'cad' ? styles.cadLegend : ''}`} aria-hidden="true" />
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
                <span>{activeLayer === 'cad' ? '当前模型量' : '当前估算值'}</span>
                <Sparkles size={16} color={activeConfig.color} aria-hidden="true" />
              </div>
              <div className={styles.readoutValue}>
                <strong>{activeConfig.value}</strong>
                <span>{activeConfig.unit}</span>
              </div>
              <p className={styles.readoutCopy}>
                {activeLayer === 'cad'
                  ? '当前为 CAD 本体增强模式：只展示 gaolu.fbx 原始几何，并通过材质、灯光、边线和镜头层次提升可读性。'
                  : '当前为可选分析覆盖层：模型来自 FBX 文件，热力、流线、等值线和剖切效果为前端程序化表达。'}
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
                  <Activity size={14} aria-hidden="true" />
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className={styles.telemetry} aria-label="仿真趋势与事件">
          <div className={styles.trendPanel}>
            <div className={styles.trendHeader}>
              <strong>仿真趋势</strong>
              <span>{activeConfig.name} / 最近 24 点</span>
            </div>
            <div className={styles.trendBars} aria-label={`${activeConfig.name}趋势柱状图`}>
              {chartValues.map((value, index) => (
                <span
                  className={styles.trendBar}
                  style={{ height: `${value}%` }}
                  key={`${activeLayer}-${index}`}
                  title={`${index + 1}: ${value}%`}
                />
              ))}
            </div>
          </div>

          <div className={styles.eventsPanel}>
            <div className={styles.eventsHeader}>
              <strong>仿真事件</strong>
              <span>DEMO</span>
            </div>
            <div className={styles.eventStack}>
              {eventRows.map((row) => (
                <div className={styles.eventRow} key={`${row.time}-${row.text}`}>
                  <time>{row.time}</time>
                  <span>{row.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

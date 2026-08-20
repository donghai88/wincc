'use client';

import dynamic from 'next/dynamic';
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  Clock,
  Droplets,
  MousePointer2,
  RotateCcw,
  Server,
  Thermometer,
  Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WinCCInstance, HotMetalTroughMetrics, MetricValue } from '@/types/template';
import { getHotMetalTroughMetrics } from '@/data/wincc-config';
import { useBusinessAlarmFeed } from '@/hooks/useBusinessAlarmFeed';
import { useModbusTemperatureFeed } from '@/hooks/useModbusTemperatureFeed';
import type { BlastFurnaceSceneProps } from './BlastFurnaceScene';
import styles from './HotMetalTroughTwin.module.css';

const BlastFurnaceScene = dynamic<BlastFurnaceSceneProps>(() => import('./BlastFurnaceScene'), {
  ssr: false,
  loading: () => (
    <div className={styles.sceneLoading} role="status" aria-live="polite">
      <div className={styles.loadingMark} />
      <span>正在加载数字孪生模型</span>
    </div>
  ),
});

interface HotMetalTroughTwinProps {
  wincc: WinCCInstance;
  onBack: () => void;
}

type MetricTone = 'cyan' | 'amber' | 'green' | 'slate';

const statusLabels = {
  normal: { text: '运行正常', tone: 'normal' },
  warning: { text: '预警关注', tone: 'warning' },
  alarm: { text: '报警处理', tone: 'alarm' },
} as const;

const modbusFeedLabels = {
  mock: '演示推送',
  connecting: '连接中',
  connected: '实时数据',
  fallback: '备用数据',
  error: '推送异常',
  retrying: '重连中',
} as const;

const metricConfig: Array<{
  key: keyof Pick<HotMetalTroughMetrics, 'ironLevel' | 'ironTemp' | 'flowRate' | 'trenchTemp'>;
  label: string;
  icon: LucideIcon;
  tone: MetricTone;
}> = [
  { key: 'ironLevel', label: '铁水液位', icon: Droplets, tone: 'cyan' },
  { key: 'ironTemp', label: '铁水温度', icon: Thermometer, tone: 'amber' },
  { key: 'flowRate', label: '铁水流量', icon: Activity, tone: 'green' },
  { key: 'trenchTemp', label: '沟体温度', icon: Waves, tone: 'slate' },
];

function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getMetricPercent(metric: MetricValue) {
  const min = metric.min ?? 0;
  const max = metric.max ?? metric.warningHigh ?? metric.current;
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((metric.current - min) / (max - min)) * 100));
}

function metricState(metric: MetricValue) {
  if ((metric.max !== undefined && metric.current > metric.max) || (metric.min !== undefined && metric.current < metric.min)) {
    return 'alarm';
  }
  if (
    (metric.warningHigh !== undefined && metric.current > metric.warningHigh) ||
    (metric.warningLow !== undefined && metric.current < metric.warningLow)
  ) {
    return 'warning';
  }
  return 'normal';
}

function MetricCard({
  label,
  metric,
  icon: Icon,
  tone,
}: {
  label: string;
  metric: MetricValue;
  icon: LucideIcon;
  tone: MetricTone;
}) {
  const state = metricState(metric);
  const percent = getMetricPercent(metric);

  return (
    <article className={`${styles.metricCard} ${styles[tone]}`} aria-label={`${label} ${metric.current}${metric.unit}`}>
      <div className={styles.metricHeader}>
        <span className={styles.metricIcon}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <span>{label}</span>
        <span className={`${styles.metricState} ${styles[state]}`}>
          {state === 'normal' ? '正常' : state === 'warning' ? '预警' : '报警'}
        </span>
      </div>
      <div className={styles.metricValue}>
        <strong>{formatValue(metric.current)}</strong>
        <span>{metric.unit}</span>
      </div>
      <div className={styles.metricScale} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.metricRange}>
        <span>{metric.min ?? 0}</span>
        {metric.warningHigh !== undefined && <span>预警 {metric.warningHigh}</span>}
        <span>{metric.max ?? metric.warningHigh ?? '--'}</span>
      </div>
    </article>
  );
}

function SystemRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.systemRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function HotMetalTroughTwin({ wincc, onBack }: HotMetalTroughTwinProps) {
  const metrics: HotMetalTroughMetrics = getHotMetalTroughMetrics(wincc.id);
  const statusInfo = statusLabels[metrics.status];
  const modbusFeed = useModbusTemperatureFeed();
  const businessAlarmFeed = useBusinessAlarmFeed();
  const modbusPoint = modbusFeed.point;
  const businessAlarm = businessAlarmFeed.alarm;
  const isModbusDisconnected = modbusFeed.status === 'error';
  const isModbusRetrying = modbusFeed.status === 'retrying';
  const isModbusConnectionIssue = isModbusDisconnected || isModbusRetrying;
  const isBusinessAlarmActive = Boolean(businessAlarm) && !isModbusConnectionIssue;
  const livePointCardStatus = isModbusDisconnected ? 'error' : isModbusRetrying ? 'retrying' : isBusinessAlarmActive ? 'alarm' : modbusFeed.status;
  const livePointCardLabel = isModbusDisconnected
    ? '连接中断'
    : isModbusRetrying
      ? '重连中'
      : isBusinessAlarmActive
        ? '高温报警'
        : modbusFeedLabels[modbusFeed.status];
  const livePointValue = isBusinessAlarmActive && businessAlarm
    ? businessAlarm.maxTemp
    : modbusPoint?.temperature;

  return (
    <section className={styles.twinShell} aria-label={`${wincc.name}数字孪生监控`}>
      <div className={styles.header}>
        <button className={styles.backButton} type="button" onClick={onBack} aria-label="返回设备类型总览">
          <ChevronLeft size={18} aria-hidden="true" />
          <span>返回</span>
        </button>

        <div className={styles.titleBlock}>
          <h1>{wincc.name}</h1>
          <p>{wincc.location} · 三维模型联动测点温度</p>
        </div>

        <div className={`${styles.statusPill} ${styles[statusInfo.tone]}`}>
          <span aria-hidden="true" />
          {statusInfo.text}
        </div>
      </div>

      <div className={styles.contentGrid}>
        <aside className={styles.leftPanel} aria-label="设备信息">
          <div className={styles.panelSection}>
            <div className={styles.sectionTitle}>
              <Server size={16} aria-hidden="true" />
              设备档案
            </div>
            <SystemRow label="设备名称" value={wincc.name} />
            <SystemRow label="所在区域" value={wincc.location} />
            <SystemRow label="控制地址" value={wincc.ipAddress ?? '--'} />
            <SystemRow
              label="资产状态"
              value={wincc.status === 'online' ? '在线' : wincc.status === 'maintenance' ? '维护中' : '离线'}
            />
          </div>

          <div className={styles.panelSection}>
            <div className={styles.sectionTitle}>
              <AlertTriangle size={16} aria-hidden="true" />
              阈值概览
            </div>
            <SystemRow label="液位预警" value={`${metrics.ironLevel.warningHigh ?? '--'} ${metrics.ironLevel.unit}`} />
            <SystemRow label="温度预警" value={`${metrics.ironTemp.warningHigh ?? '--'} ${metrics.ironTemp.unit}`} />
            <SystemRow label="流量预警" value={`${metrics.flowRate.warningHigh ?? '--'} ${metrics.flowRate.unit}`} />
            <SystemRow label="沟体预警" value={`${metrics.trenchTemp.warningHigh ?? '--'} ${metrics.trenchTemp.unit}`} />
          </div>

          <div className={styles.panelSection}>
            <div className={styles.sectionTitle}>
              <Clock size={16} aria-hidden="true" />
              数据时间
            </div>
            <p className={styles.updateText}>{wincc.lastUpdate}</p>
            <div className={styles.tags} aria-label="设备标签">
              {wincc.tags?.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        </aside>

        <main className={styles.scenePanel}>
          <BlastFurnaceScene
            temperaturePoint={modbusPoint}
            feedStatus={modbusFeed.status}
            businessAlarm={businessAlarm}
          />
          <div className={styles.sceneCaption}>
            <span>模型视图</span>
            <strong>主沟三维模型 · {modbusPoint?.locationName ?? '等待点位'}</strong>
          </div>
          <div className={styles.controlHint} aria-label="三维模型操作提示">
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

        <aside className={styles.rightPanel} aria-label="实时指标">
          <div className={styles.livePointCard} data-status={livePointCardStatus} aria-label="点位温度">
            <div className={styles.livePointHeader}>
              <span>点位温度</span>
              <strong>{livePointCardLabel}</strong>
            </div>
            <div className={styles.livePointValue}>
              <span>{modbusPoint?.locationName ?? '位置1'}</span>
              <strong>{livePointValue !== undefined ? formatValue(livePointValue) : '--'}</strong>
              <em>°C</em>
            </div>
            <div className={styles.livePointMeta}>
              <span>{businessAlarm && isBusinessAlarmActive ? `${businessAlarm.ruleType} / ${businessAlarm.level}级` : modbusPoint?.locationId ?? 'loc_1'}</span>
              <span>{isBusinessAlarmActive && businessAlarm ? businessAlarm.receivedAt : modbusPoint?.receivedAt ?? '--'}</span>
            </div>
            {businessAlarm && isBusinessAlarmActive && (
              <div className={styles.livePointAlarmMeta}>
                <span>阈值 {businessAlarm.thresholdTemp.toFixed(1)}°C</span>
                <span>均温 {businessAlarm.avgTemp.toFixed(1)}°C</span>
                <span>{businessAlarm.isRead === 0 ? '未读' : '已读'}</span>
              </div>
            )}
            {modbusFeed.message && <p className={styles.livePointMessage}>{modbusFeed.message}</p>}
            {businessAlarmFeed.message && isBusinessAlarmActive && <p className={styles.livePointMessage}>{businessAlarmFeed.message}</p>}
          </div>

          <div className={styles.metricsHeader}>
            <span>实时指标</span>
            <strong>4 项</strong>
          </div>
          <div className={styles.metricStack}>
            {metricConfig.map((item) => (
              <MetricCard
                key={item.key}
                label={item.label}
                metric={metrics[item.key]}
                icon={item.icon}
                tone={item.tone}
              />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

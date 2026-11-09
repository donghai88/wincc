'use client';

import { riskLevelNames, riskLevelTone, slagThresholds, tempLevel } from '@/lib/benxi-ladle-rules';
import type { DataSourceStatus } from '@/lib/benxi-ladle-api';
import type { LadleRunState, RiskLevel } from '@/types/benxi-ladle';
import styles from './Benxi.module.css';

export const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={cx(styles.badge, styles[riskLevelTone[level]])}>{riskLevelNames[level]}</span>;
}

export function RunStateBadge({ state }: { state: LadleRunState }) {
  if (state === '在线运行') return <span className={cx(styles.badge, styles.neutral)}>{state}</span>;
  return <span className={cx(styles.badge, styles.purple)}>{state}</span>;
}

export function DataNotice({ status, message }: { status: DataSourceStatus | 'loading'; message?: string }) {
  if (status === 'loading') return <div className={styles.notice}>数据加载中…</div>;
  if (status === 'fallback' || status === 'error') {
    return <div className={cx(styles.notice, styles.noticeWarn)}>{message ?? '数据加载异常'}</div>;
  }
  return null;
}

export function tempTone(temp: number | null) {
  return riskLevelTone[tempLevel(temp)];
}

export function depthTone(depth: number) {
  if (depth >= slagThresholds.depthAlarmMm) return 'danger';
  if (depth >= slagThresholds.depthWarnMm) return 'warning';
  return 'safe';
}

export interface TrendSeries {
  name: string;
  color: string;
  values: Array<number | null>;
  axis?: 'left' | 'right';
  bars?: boolean;
}

interface TrendChartProps {
  labels: Array<string | number>;
  series: TrendSeries[];
  left: { min: number; max: number; unit: string; warn?: number; alarm?: number };
  right?: { min: number; max: number; unit: string };
  xTitle?: string;
  height?: number;
}

/** 轻量 SVG 折线图，支持双纵轴与阈值线。 */
export function TrendChart({ labels, series, left, right, xTitle, height = 200 }: TrendChartProps) {
  const width = 640;
  const pad = { l: 40, r: right ? 44 : 14, t: 12, b: 24 };
  const gw = width - pad.l - pad.r;
  const gh = height - pad.t - pad.b;
  const n = Math.max(labels.length, 1);
  const px = (index: number) => pad.l + (n === 1 ? gw / 2 : (gw * index) / (n - 1));
  const scaleFor = (axis: 'left' | 'right' = 'left') => {
    const range = axis === 'right' && right ? right : left;
    return (value: number) => pad.t + gh * (1 - (value - range.min) / Math.max(range.max - range.min, 1));
  };
  const leftY = scaleFor('left');
  const labelStep = Math.max(1, Math.ceil(n / 8));

  return (
    <div className={styles.chart}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="趋势图">
        {[0, 1, 2, 3, 4].map((k) => {
          const y = pad.t + (gh * k) / 4;
          const leftValue = left.max - ((left.max - left.min) * k) / 4;
          const rightValue = right ? right.max - ((right.max - right.min) * k) / 4 : null;
          return (
            <g key={k}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="rgba(232,240,250,.07)" />
              <text x={pad.l - 6} y={y + 3} fill="rgba(126,144,172,.85)" fontSize={9} textAnchor="end">{Math.round(leftValue)}</text>
              {rightValue !== null ? (
                <text x={width - pad.r + 6} y={y + 3} fill="rgba(34,211,238,.8)" fontSize={9}>{Math.round(rightValue)}</text>
              ) : null}
            </g>
          );
        })}
        {left.warn !== undefined ? (
          <line x1={pad.l} x2={width - pad.r} y1={leftY(left.warn)} y2={leftY(left.warn)} stroke="rgba(251,191,36,.75)" strokeDasharray="4 3" />
        ) : null}
        {left.alarm !== undefined ? (
          <line x1={pad.l} x2={width - pad.r} y1={leftY(left.alarm)} y2={leftY(left.alarm)} stroke="rgba(248,113,113,.9)" strokeWidth={1.4} strokeDasharray="6 3" />
        ) : null}
        {series.map((item) => {
          const y = scaleFor(item.axis);
          const points = item.values
            .map((value, index) => (value === null ? null : [px(index), y(value)] as const))
            .filter((point): point is readonly [number, number] => point !== null);
          if (points.length === 0) return null;
          const path = points.map(([x, py], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${py.toFixed(1)}`).join(' ');
          const last = points[points.length - 1];
          return (
            <g key={item.name}>
              {item.bars
                ? points.map(([x, py], index) => (
                    <rect key={index} x={x - 5} y={py} width={10} height={pad.t + gh - py} fill={item.color} opacity={0.16} />
                  ))
                : null}
              <path d={path} fill="none" stroke={item.color} strokeWidth={1.8} />
              <circle cx={last[0]} cy={last[1]} r={3} fill={item.color} />
            </g>
          );
        })}
        {labels.map((label, index) => (
          index % labelStep === 0 || index === n - 1 ? (
            <text key={index} x={px(index)} y={height - 8} fill="rgba(126,144,172,.85)" fontSize={9} textAnchor="middle">{label}</text>
          ) : null
        ))}
        <text x={pad.l} y={9} fill="rgba(126,144,172,.7)" fontSize={9}>{left.unit}</text>
        {right ? <text x={width - pad.r + 4} y={9} fill="rgba(34,211,238,.7)" fontSize={9}>{right.unit}</text> : null}
        {xTitle ? <text x={width - pad.r} y={height - 8} fill="rgba(126,144,172,.6)" fontSize={9} textAnchor="end">{xTitle}</text> : null}
      </svg>
      <div className={styles.legend}>
        {series.map((item) => (
          <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>
        ))}
        {left.warn !== undefined ? <span><i className={styles.dash} />预警</span> : null}
        {left.alarm !== undefined ? <span><i className={styles.dashRed} />报警</span> : null}
      </div>
    </div>
  );
}

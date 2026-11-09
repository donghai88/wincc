import type { RiskLevel, SlagThresholds, ThermalChannel } from '@/types/benxi-ladle';

/** 客户确认前的模拟阈值（Excel ① 页底部），最终值以客户确认为准。 */
export const slagThresholds: SlagThresholds = {
  designThicknessMm: 200,
  depthWarnMm: 80,
  depthAlarmMm: 160,
  tempWarnC: 350,
  tempAlarmC: 380,
};

export const thermalChannels: ThermalChannel[] = [
  { id: 'P1-1', station: 'P1', name: 'P1检测区1#热像仪' },
  { id: 'P1-2', station: 'P1', name: 'P1检测区2#热像仪' },
  { id: 'P1-3', station: 'P1', name: 'P1检测区3#热像仪' },
  { id: 'P2-1', station: 'P2', name: 'P2热维位1#热像仪' },
  { id: 'P2-2', station: 'P2', name: 'P2热维位2#热像仪' },
  { id: 'P2-3', station: 'P2', name: 'P2热维位3#热像仪' },
];

/**
 * 雷达点云几何参数（单位 mm，钢包轴线为 z 轴）。
 * 真实 PCD 的单位、0° 方位与渣线带范围需与雷达侧标定后在此调整。
 */
export const radarGeometry = {
  innerRadiusMm: 1500,
  slagBandBottomMm: 0,
  slagBandTopMm: 1200,
  /** 0° 方位（出钢口）相对点云 +x 轴的偏转角，度 */
  azimuthZeroDeg: 0,
  /** PCD 坐标乘以该系数换算成 mm */
  unitScale: 1,
  repeatabilityMm: 5,
};

export const radarZones: Array<{ name: string; from: number; to: number }> = [
  { name: '出钢口区域', from: 330, to: 30 },
  { name: 'A 侧耳轴区', from: 60, to: 120 },
  { name: 'B 侧普通区', from: 120, to: 240 },
  { name: 'A 侧普通区', from: 240, to: 300 },
];

export const riskLevelNames: Record<RiskLevel, string> = { 0: '正常', 1: '关注', 2: '危险' };
export const riskLevelTone: Record<RiskLevel, 'safe' | 'warning' | 'danger'> = {
  0: 'safe',
  1: 'warning',
  2: 'danger',
};

const adviceByLevel: Record<RiskLevel, string> = {
  0: '按期周转',
  1: '检测周期缩短至 20 炉',
  2: '立即下线大修',
};

export function depthLevel(depthMm: number, thresholds = slagThresholds): RiskLevel {
  if (depthMm >= thresholds.depthAlarmMm) return 2;
  if (depthMm >= thresholds.depthWarnMm) return 1;
  return 0;
}

export function tempLevel(tempC: number | null, thresholds = slagThresholds): RiskLevel {
  if (tempC === null) return 0;
  if (tempC >= thresholds.tempAlarmC) return 2;
  if (tempC >= thresholds.tempWarnC) return 1;
  return 0;
}

export function maxTemp(temps: Array<number | null>): number | null {
  const valid = temps.filter((value): value is number => typeof value === 'number');
  return valid.length > 0 ? Math.max(...valid) : null;
}

/** 判定结论 = 温度与渣线两项取更严重者，不做平均。 */
export function judgeLadle(depthMm: number, temps: Array<number | null>, thresholds = slagThresholds) {
  const level = Math.max(depthLevel(depthMm, thresholds), tempLevel(maxTemp(temps), thresholds)) as RiskLevel;
  return { level, verdict: riskLevelNames[level], advice: adviceByLevel[level] };
}

export function riskScore(depthMm: number, temps: Array<number | null>, thresholds = slagThresholds) {
  const hottest = maxTemp(temps) ?? 0;
  const depthRatio = depthMm / thresholds.depthAlarmMm;
  const tempRatio = (hottest - 200) / (thresholds.tempAlarmC - 200);
  return Math.round(Math.min(99, Math.max(3, Math.max(depthRatio, tempRatio) * 82)));
}

/** 按当前磨损速率推算距离报警深度的剩余炉次。 */
export function remainingHeats(depthMm: number, wearRateMmPerHeat: number, thresholds = slagThresholds) {
  if (depthMm >= thresholds.depthAlarmMm) return 0;
  return Math.max(0, Math.floor((thresholds.depthAlarmMm - depthMm) / Math.max(wearRateMmPerHeat, 0.3)));
}

export function formatAzimuth(deg: number) {
  return `${Math.round(((deg % 360) + 360) % 360)}°`;
}

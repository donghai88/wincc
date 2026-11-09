import { radarGeometry, radarZones, slagThresholds } from '@/lib/benxi-ladle-rules';
import type { RiskLevel, SlagThresholds } from '@/types/benxi-ladle';

export const AZ_BINS = 180;
export const H_BINS = 48;
const TAU = Math.PI * 2;

/** 侵蚀速率超过该值（mm/炉）视为加速侵蚀 */
export const WEAR_RATE_WARN = 1.6;
export const WEAR_RATE_ALARM = 2.2;

export type SlagGeometry = typeof radarGeometry;

export type SlagDefectType = 'depth' | 'pit' | 'rate' | 'area';

export interface SlagDefect {
  id: number;
  type: SlagDefectType;
  level: Exclude<RiskLevel, 0>;
  value: number;
  /** 度；全周统计类缺陷为 null */
  azimuth: number | null;
  /** 渣线带内高度，mm；全周统计类缺陷为 null */
  height: number | null;
  areaRatio: number;
}

export interface SlagAnalysis {
  pointCount: number;
  center: { x: number; y: number };
  zRange: [number, number];
  /** 每格平均半径（mm），行优先：index = h * AZ_BINS + az */
  radiusGrid: Float32Array;
  depthGrid: Float32Array;
  /** 与输入点一一对应 */
  pointDepth: Float32Array;
  pointAzimuth: Float32Array;
  maxDepth: number;
  maxAzimuth: number;
  maxHeight: number;
  avgDepth: number;
  stdDepth: number;
  minResidual: number;
  overWarnRatio: number;
  defects: SlagDefect[];
}

export const slagDefectNames: Record<SlagDefectType, string> = {
  depth: '侵蚀深度超限',
  pit: '局部异常凹陷',
  rate: '侵蚀速率异常（加速侵蚀）',
  area: '超标面积占比过高',
};

export function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gridIndex = (az: number, h: number) => h * AZ_BINS + az;
const wrapAz = (az: number) => ((az % AZ_BINS) + AZ_BINS) % AZ_BINS;
const binToDeg = (az: number) => (az + 0.5) * (360 / AZ_BINS);
const binToHeight = (h: number, geometry: SlagGeometry) => (
  geometry.slagBandBottomMm + ((h + 0.5) / H_BINS) * (geometry.slagBandTopMm - geometry.slagBandBottomMm)
);

/**
 * 演示用侵蚀深度场：渣线中部侵蚀更重 + 若干高斯凹坑 + 周向波纹，
 * 最终缩放到指定最大深度。同一 seed 生成的形状一致，便于跨检测对比。
 */
export function generateDepthField(seed: number, targetMax: number, variationSeed = 0): Float32Array {
  const random = mulberry32(seed * 7919 + 17);
  const pitCount = 2 + Math.floor(random() * 3);
  const pits = Array.from({ length: pitCount }, (_, index) => ({
    theta: random() * TAU,
    yn: 0.3 + random() * 0.4,
    amp: index === 0 ? 1 : 0.35 + random() * 0.45,
    sa: 0.14 + random() * 0.26,
    sy: 0.12 + random() * 0.18,
  }));
  const base = 0.38 + random() * 0.12;
  const phase = random() * TAU;
  const ripple = mulberry32(variationSeed * 104729 + 3);
  const ripplePhase = ripple() * TAU;

  const field = new Float32Array(AZ_BINS * H_BINS);
  let rawMax = 0;
  for (let h = 0; h < H_BINS; h += 1) {
    const yn = (h + 0.5) / H_BINS;
    for (let az = 0; az < AZ_BINS; az += 1) {
      const theta = ((az + 0.5) / AZ_BINS) * TAU;
      let value = base * (0.5 + 0.5 * Math.sin(Math.PI * yn));
      for (const pit of pits) {
        let da = theta - pit.theta;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        const dy = (yn - pit.yn) * 1.25;
        value += pit.amp * Math.exp(-((da / pit.sa) ** 2 + (dy / pit.sy) ** 2));
      }
      value += 0.025 * Math.sin(theta * 3 + phase) + 0.018 * Math.sin(theta * 7.3 + yn * 5 + ripplePhase);
      const clamped = Math.max(0, value);
      field[gridIndex(az, h)] = clamped;
      if (clamped > rawMax) rawMax = clamped;
    }
  }

  const scale = rawMax > 0 ? targetMax / rawMax : 0;
  for (let index = 0; index < field.length; index += 1) field[index] *= scale;
  return field;
}

function sampleGrid(grid: Float32Array, azFloat: number, hFloat: number) {
  const a0 = Math.floor(azFloat);
  const h0 = Math.min(H_BINS - 1, Math.max(0, Math.floor(hFloat)));
  const h1 = Math.min(H_BINS - 1, h0 + 1);
  const ta = azFloat - a0;
  const th = Math.min(1, Math.max(0, hFloat - h0));
  const a = wrapAz(a0);
  const b = wrapAz(a0 + 1);
  const top = grid[gridIndex(a, h0)] * (1 - ta) + grid[gridIndex(b, h0)] * ta;
  const bottom = grid[gridIndex(a, h1)] * (1 - ta) + grid[gridIndex(b, h1)] * ta;
  return top * (1 - th) + bottom * th;
}

/**
 * 由深度场合成与雷达 PCD 同构的 xyz 点（mm），演示模式下替代真实 PCD 文件。
 * 点按方位角排列，扫描重放可直接按顺序截取。
 */
export function synthesizeSlagPoints(depthGrid: Float32Array, seed: number, geometry: SlagGeometry = radarGeometry) {
  const azSteps = 720;
  const hSteps = 110;
  const random = mulberry32(seed * 31 + 7);
  const positions = new Float32Array(azSteps * hSteps * 3);
  const zero = (geometry.azimuthZeroDeg * Math.PI) / 180;
  const band = geometry.slagBandTopMm - geometry.slagBandBottomMm;
  let offset = 0;
  for (let i = 0; i < azSteps; i += 1) {
    for (let j = 0; j < hSteps; j += 1) {
      const azFloat = ((i + random()) / azSteps) * AZ_BINS - 0.5;
      const hFloat = ((j + random()) / hSteps) * H_BINS - 0.5;
      const depth = sampleGrid(depthGrid, azFloat, hFloat);
      const theta = ((azFloat + 0.5) / AZ_BINS) * TAU + zero;
      const radius = geometry.innerRadiusMm + depth + (random() - 0.5) * 3;
      positions[offset] = Math.cos(theta) * radius;
      positions[offset + 1] = Math.sin(theta) * radius;
      positions[offset + 2] = geometry.slagBandBottomMm + ((hFloat + 0.5) / H_BINS) * band;
      offset += 3;
    }
  }
  return positions;
}

/** Kåsa 最小二乘圆拟合，求钢包轴线在 xy 平面的位置。 */
function fitCircleCenter(positions: Float32Array, scale: number) {
  const count = positions.length / 3;
  const step = Math.max(1, Math.floor(count / 60000));
  let sxx = 0; let sxy = 0; let syy = 0; let sx = 0; let sy = 0; let n = 0;
  let sxz = 0; let syz = 0; let sz = 0;
  for (let index = 0; index < count; index += step) {
    const x = positions[index * 3] * scale;
    const y = positions[index * 3 + 1] * scale;
    const z = x * x + y * y;
    sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y; n += 1;
    sxz += x * z; syz += y * z; sz += z;
  }
  // 解 [sxx sxy sx; sxy syy sy; sx sy n] · [D E F]ᵀ = -[sxz syz sz]ᵀ
  const m = [
    [sxx, sxy, sx, -sxz],
    [sxy, syy, sy, -syz],
    [sx, sy, n, -sz],
  ];
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    if (Math.abs(m[col][col]) < 1e-9) return { x: 0, y: 0 };
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k < 4; k += 1) m[row][k] -= factor * m[col][k];
    }
  }
  const D = m[0][3] / m[0][0];
  const E = m[1][3] / m[1][1];
  return { x: -D / 2, y: -E / 2 };
}

function robustZRange(positions: Float32Array, scale: number): [number, number] {
  const count = positions.length / 3;
  const step = Math.max(1, Math.floor(count / 40000));
  const values: number[] = [];
  for (let index = 0; index < count; index += step) values.push(positions[index * 3 + 2] * scale);
  values.sort((a, b) => a - b);
  const low = values[Math.floor(values.length * 0.005)] ?? 0;
  const high = values[Math.floor(values.length * 0.995)] ?? 1;
  return [low, Math.max(high, low + 1)];
}

function fillEmptyCells(sum: Float64Array, count: Uint32Array) {
  const grid = new Float32Array(AZ_BINS * H_BINS);
  const filled = new Uint8Array(grid.length);
  for (let index = 0; index < grid.length; index += 1) {
    if (count[index] > 0) {
      grid[index] = sum[index] / count[index];
      filled[index] = 1;
    }
  }
  for (let pass = 0; pass < 8; pass += 1) {
    let missing = 0;
    for (let h = 0; h < H_BINS; h += 1) {
      for (let az = 0; az < AZ_BINS; az += 1) {
        const index = gridIndex(az, h);
        if (filled[index]) continue;
        let acc = 0; let n = 0;
        const neighbours = [gridIndex(wrapAz(az - 1), h), gridIndex(wrapAz(az + 1), h)];
        if (h > 0) neighbours.push(gridIndex(az, h - 1));
        if (h < H_BINS - 1) neighbours.push(gridIndex(az, h + 1));
        for (const neighbour of neighbours) if (filled[neighbour]) { acc += grid[neighbour]; n += 1; }
        if (n > 0) { grid[index] = acc / n; filled[index] = 2; } else missing += 1;
      }
    }
    for (let index = 0; index < filled.length; index += 1) if (filled[index] === 2) filled[index] = 1;
    if (missing === 0) break;
  }
  return grid;
}

interface AnalyzeOptions {
  geometry?: SlagGeometry;
  thresholds?: SlagThresholds;
  /** 基准半径网格（新修后首次检测）；缺省时以设计内半径为基准 */
  baselineRadius?: Float32Array | null;
  heatsInCampaign?: number;
}

export function analyzeSlagCloud(positions: Float32Array, options: AnalyzeOptions = {}): SlagAnalysis {
  const geometry = options.geometry ?? radarGeometry;
  const thresholds = options.thresholds ?? slagThresholds;
  const scale = geometry.unitScale;
  const count = Math.floor(positions.length / 3);
  const center = fitCircleCenter(positions, scale);
  const zRange = robustZRange(positions, scale);
  const zero = (geometry.azimuthZeroDeg * Math.PI) / 180;

  const sum = new Float64Array(AZ_BINS * H_BINS);
  const hits = new Uint32Array(AZ_BINS * H_BINS);
  const pointRadius = new Float32Array(count);
  const pointCell = new Int32Array(count);
  const pointAzimuth = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const x = positions[index * 3] * scale - center.x;
    const y = positions[index * 3 + 1] * scale - center.y;
    const z = positions[index * 3 + 2] * scale;
    let theta = Math.atan2(y, x) - zero;
    theta = ((theta % TAU) + TAU) % TAU;
    const radius = Math.hypot(x, y);
    const az = Math.min(AZ_BINS - 1, Math.floor((theta / TAU) * AZ_BINS));
    const hn = (z - zRange[0]) / (zRange[1] - zRange[0]);
    const h = Math.min(H_BINS - 1, Math.max(0, Math.floor(hn * H_BINS)));
    const cell = gridIndex(az, h);
    pointRadius[index] = radius;
    pointCell[index] = cell;
    pointAzimuth[index] = (theta * 180) / Math.PI;
    sum[cell] += radius;
    hits[cell] += 1;
  }

  const radiusGrid = fillEmptyCells(sum, hits);
  const baseline = options.baselineRadius ?? null;
  const depthGrid = new Float32Array(radiusGrid.length);
  for (let index = 0; index < depthGrid.length; index += 1) {
    const base = baseline ? baseline[index] : geometry.innerRadiusMm;
    depthGrid[index] = Math.min(thresholds.designThicknessMm, Math.max(0, radiusGrid[index] - base));
  }

  const pointDepth = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const cell = pointCell[index];
    const base = baseline ? baseline[cell] : geometry.innerRadiusMm;
    pointDepth[index] = Math.min(thresholds.designThicknessMm, Math.max(0, pointRadius[index] - base));
  }

  let maxDepth = 0; let maxCell = 0; let total = 0; let overWarn = 0;
  for (let index = 0; index < depthGrid.length; index += 1) {
    const value = depthGrid[index];
    total += value;
    if (value > maxDepth) { maxDepth = value; maxCell = index; }
    if (value >= thresholds.depthWarnMm) overWarn += 1;
  }
  const avgDepth = total / depthGrid.length;
  let variance = 0;
  for (let index = 0; index < depthGrid.length; index += 1) variance += (depthGrid[index] - avgDepth) ** 2;
  const maxAz = maxCell % AZ_BINS;
  const maxH = Math.floor(maxCell / AZ_BINS);
  const overWarnRatio = overWarn / depthGrid.length;

  return {
    pointCount: count,
    center,
    zRange,
    radiusGrid,
    depthGrid,
    pointDepth,
    pointAzimuth,
    maxDepth,
    maxAzimuth: binToDeg(maxAz),
    maxHeight: binToHeight(maxH, geometry),
    avgDepth,
    stdDepth: Math.sqrt(variance / depthGrid.length),
    minResidual: thresholds.designThicknessMm - maxDepth,
    overWarnRatio,
    defects: detectDefects(depthGrid, {
      geometry,
      thresholds,
      overWarnRatio,
      maxDepth,
      heatsInCampaign: options.heatsInCampaign,
    }),
  };
}

interface DefectOptions {
  geometry: SlagGeometry;
  thresholds: SlagThresholds;
  overWarnRatio: number;
  maxDepth: number;
  heatsInCampaign?: number;
}

function detectDefects(depthGrid: Float32Array, options: DefectOptions): SlagDefect[] {
  const { geometry, thresholds } = options;
  const defects: Omit<SlagDefect, 'id'>[] = [];
  const visited = new Uint8Array(depthGrid.length);

  for (let start = 0; start < depthGrid.length; start += 1) {
    if (visited[start] || depthGrid[start] < thresholds.depthWarnMm) continue;
    const stack = [start];
    visited[start] = 1;
    let cells = 0; let peak = 0; let peakCell = start;
    while (stack.length > 0) {
      const cell = stack.pop() as number;
      cells += 1;
      if (depthGrid[cell] > peak) { peak = depthGrid[cell]; peakCell = cell; }
      const az = cell % AZ_BINS;
      const h = Math.floor(cell / AZ_BINS);
      const neighbours = [gridIndex(wrapAz(az - 1), h), gridIndex(wrapAz(az + 1), h)];
      if (h > 0) neighbours.push(gridIndex(az, h - 1));
      if (h < H_BINS - 1) neighbours.push(gridIndex(az, h + 1));
      for (const neighbour of neighbours) {
        if (!visited[neighbour] && depthGrid[neighbour] >= thresholds.depthWarnMm) {
          visited[neighbour] = 1;
          stack.push(neighbour);
        }
      }
    }
    if (cells < 4) continue;
    defects.push({
      type: 'depth',
      level: peak >= thresholds.depthAlarmMm ? 2 : 1,
      value: peak,
      azimuth: binToDeg(peakCell % AZ_BINS),
      height: binToHeight(Math.floor(peakCell / AZ_BINS), geometry),
      areaRatio: cells / depthGrid.length,
    });
  }

  // 局部凹陷：相对周边环带明显更深的局部极值
  const pits: Omit<SlagDefect, 'id'>[] = [];
  for (let h = 4; h < H_BINS - 4; h += 2) {
    for (let az = 0; az < AZ_BINS; az += 2) {
      const value = depthGrid[gridIndex(az, h)];
      let ring = 0; let n = 0; let isPeak = true;
      for (let dh = -6; dh <= 6 && isPeak; dh += 1) {
        const hh = h + dh;
        if (hh < 0 || hh >= H_BINS) continue;
        for (let da = -14; da <= 14; da += 1) {
          const neighbour = depthGrid[gridIndex(wrapAz(az + da), hh)];
          if (Math.abs(dh) <= 2 && Math.abs(da) <= 3) {
            if (neighbour > value) { isPeak = false; break; }
            continue;
          }
          ring += neighbour; n += 1;
        }
      }
      if (!isPeak || n === 0) continue;
      const prominence = value - ring / n;
      if (prominence < 38) continue;
      pits.push({
        type: 'pit',
        level: prominence >= 62 ? 2 : 1,
        value: prominence,
        azimuth: binToDeg(az),
        height: binToHeight(h, geometry),
        areaRatio: 0,
      });
    }
  }
  pits.sort((a, b) => b.value - a.value);
  defects.push(...pits.slice(0, 2));

  if (options.heatsInCampaign && options.heatsInCampaign > 0) {
    const rate = options.maxDepth / options.heatsInCampaign;
    if (rate >= WEAR_RATE_WARN) {
      defects.push({ type: 'rate', level: rate >= WEAR_RATE_ALARM ? 2 : 1, value: rate, azimuth: null, height: null, areaRatio: 0 });
    }
  }

  if (options.overWarnRatio >= 0.3) {
    defects.push({
      type: 'area',
      level: options.overWarnRatio >= 0.5 ? 2 : 1,
      value: options.overWarnRatio * 100,
      azimuth: null,
      height: null,
      areaRatio: options.overWarnRatio,
    });
  }

  return defects
    .sort((a, b) => b.level - a.level || b.value - a.value)
    .map((defect, index) => ({ ...defect, id: index + 1 }));
}

export interface ZoneStat {
  name: string;
  from: number;
  to: number;
  maxDepth: number;
  avgDepth: number;
  overWarnRatio: number;
  increment: number | null;
  level: RiskLevel;
}

const inZone = (deg: number, from: number, to: number) => (from <= to ? deg >= from && deg < to : deg >= from || deg < to);

export function computeZoneStats(depthGrid: Float32Array, previous: Float32Array | null, thresholds = slagThresholds): ZoneStat[] {
  return radarZones.map((zone) => {
    let max = 0; let total = 0; let n = 0; let over = 0; let delta = 0;
    for (let az = 0; az < AZ_BINS; az += 1) {
      if (!inZone(binToDeg(az), zone.from, zone.to)) continue;
      for (let h = 0; h < H_BINS; h += 1) {
        const index = gridIndex(az, h);
        const value = depthGrid[index];
        max = Math.max(max, value);
        total += value; n += 1;
        if (value >= thresholds.depthWarnMm) over += 1;
        if (previous) delta += value - previous[index];
      }
    }
    const level: RiskLevel = max >= thresholds.depthAlarmMm ? 2 : max >= thresholds.depthWarnMm ? 1 : 0;
    return {
      ...zone,
      maxDepth: max,
      avgDepth: n ? total / n : 0,
      overWarnRatio: n ? over / n : 0,
      increment: previous && n ? delta / n : null,
      level,
    };
  });
}

export function diffGrids(current: Float32Array, base: Float32Array) {
  const diff = new Float32Array(current.length);
  for (let index = 0; index < current.length; index += 1) diff[index] = current[index] - base[index];
  return diff;
}

type Rgb = [number, number, number];
const DEPTH_STOPS: Array<[number, Rgb]> = [
  [0, [14, 92, 58]], [0.18, [22, 163, 74]], [0.34, [132, 204, 22]], [0.5, [234, 179, 8]],
  [0.68, [249, 115, 22]], [0.86, [239, 68, 68]], [1, [139, 20, 20]],
];
const DIFF_STOPS: Array<[number, Rgb]> = [
  [0, [30, 111, 217]], [0.24, [62, 91, 122]], [1 / 3, [58, 66, 82]], [0.42, [180, 120, 10]], [0.62, [249, 115, 22]], [1, [239, 68, 68]],
];

function ramp(stops: Array<[number, Rgb]>, t: number): Rgb {
  const value = Math.min(1, Math.max(0, t));
  for (let index = 0; index < stops.length - 1; index += 1) {
    const [p0, c0] = stops[index];
    const [p1, c1] = stops[index + 1];
    if (value >= p0 && value <= p1) {
      const k = (value - p0) / (p1 - p0 || 1);
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
    }
  }
  return stops[stops.length - 1][1];
}

/** 侵蚀深度色阶：绿（健康）→ 黄 → 橙 → 红（报警深度）→ 暗红 */
export const depthRgb = (mm: number, thresholds = slagThresholds) => ramp(DEPTH_STOPS, mm / thresholds.depthAlarmMm);
export const depthCss = (mm: number) => {
  const [r, g, b] = depthRgb(mm);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
};
export const diffRgb = (mm: number) => ramp(DIFF_STOPS, (mm + 40) / 120);

export { binToDeg, gridIndex };

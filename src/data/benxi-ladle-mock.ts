import {
  depthLevel,
  judgeLadle,
  maxTemp,
  remainingHeats,
  riskScore,
  slagThresholds,
  tempLevel,
  thermalChannels,
} from '@/lib/benxi-ladle-rules';
import { AZ_BINS, generateDepthField, mulberry32 } from '@/lib/slag-analysis';
import type { LadleAlarmRecord, LadleEntity, LadleRecordDetail, LadleStatusCode } from '@/types/ladle-api';
import type {
  LadleCampaign,
  LadleCampaignDetail,
  LadleEvent,
  LadleReportDetail,
  LadleReportRow,
  LadleRunState,
  RadarScan,
  RepairRecord,
  ThermalDetection,
} from '@/types/benxi-ladle';

const pad = (value: number) => String(value).padStart(2, '0');
const formatDateTime = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
const formatDate = (time: number) => formatDateTime(time).slice(0, 10);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();

interface LadleSeed {
  no: string;
  state: LadleRunState;
  heats: number;
  total: number;
  /** P1 三路最高温；P2 由 P1 推算 */
  p1: [number, number, number];
  depth: number;
  preRepairTemp?: number;
  /** 往役各自炉次（不含当前役），缺省时按 total - heats 视为一役 */
  history?: number[];
  /** 当前役起止的固定日期（Excel ② 页示例） */
  fixedDates?: { history: Array<[string, string]>; currentStart: string };
}

// Excel ① 页 10 只 + 扩充 14 只
const ladleSeeds: LadleSeed[] = [
  { no: 'A01', state: '在线运行', heats: 58, total: 58, p1: [262, 245, 330], depth: 46 },
  { no: 'A02', state: '在线运行', heats: 96, total: 96, p1: [271, 253, 341], depth: 74 },
  { no: 'A06', state: '在线运行', heats: 41, total: 41, p1: [259, 242, 326], depth: 38 },
  { no: 'B02', state: '在线运行', heats: 32, total: 32, p1: [257, 240, 324], depth: 32 },
  { no: 'C09', state: '在线运行', heats: 24, total: 24, p1: [255, 238, 321], depth: 26 },
  { no: 'A03', state: '在线运行', heats: 112, total: 112, p1: [282, 264, 352], depth: 96 },
  { no: 'B11', state: '在线运行', heats: 88, total: 88, p1: [278, 260, 348], depth: 88 },
  { no: 'B07', state: '在线运行', heats: 61, total: 204, p1: [291, 273, 361], depth: 112, history: [72, 71] },
  {
    no: 'A05',
    state: '下线待修',
    heats: 87,
    total: 219,
    p1: [310, 292, 383],
    depth: 137,
    preRepairTemp: 371,
    history: [132],
    fixedDates: { history: [['2026-01-12', '2026-04-20']], currentStart: '2026-05-06' },
  },
  { no: 'C04', state: '在线运行', heats: 151, total: 151, p1: [322, 305, 397], depth: 169, preRepairTemp: 382 },
  { no: 'A04', state: '在线运行', heats: 70, total: 70, p1: [266, 249, 333], depth: 58 },
  { no: 'A07', state: '在线运行', heats: 104, total: 236, p1: [284, 266, 355], depth: 101 },
  { no: 'A08', state: '在线运行', heats: 45, total: 45, p1: [258, 241, 322], depth: 35 },
  { no: 'B01', state: '大修中', heats: 142, total: 142, p1: [305, 288, 376], depth: 158, preRepairTemp: 369 },
  { no: 'B03', state: '在线运行', heats: 92, total: 92, p1: [276, 259, 346], depth: 84 },
  { no: 'B04', state: '在线运行', heats: 36, total: 36, p1: [256, 239, 320], depth: 29 },
  { no: 'B05', state: '在线运行', heats: 128, total: 128, p1: [300, 282, 371], depth: 141 },
  { no: 'B06', state: '在线运行', heats: 52, total: 52, p1: [261, 244, 329], depth: 44 },
  { no: 'B08', state: '热修中', heats: 76, total: 198, p1: [288, 270, 357], depth: 105, preRepairTemp: 352 },
  { no: 'B09', state: '在线运行', heats: 18, total: 18, p1: [252, 236, 316], depth: 15 },
  { no: 'C01', state: '在线运行', heats: 63, total: 63, p1: [264, 247, 331], depth: 55 },
  { no: 'C02', state: '下线待修', heats: 133, total: 133, p1: [316, 299, 386], depth: 163, preRepairTemp: 378 },
  { no: 'C03', state: '在线运行', heats: 27, total: 27, p1: [254, 237, 318], depth: 22 },
  { no: 'C05', state: '在线运行', heats: 99, total: 99, p1: [279, 262, 349], depth: 79 },
];

const operators = ['张伟', '李强', '王磊', '刘洋', '陈刚', '赵敏'];
const HEATS_PER_DAY = 0.62;
const SCAN_INTERVAL_HEATS = 10;
const THERMAL_INTERVAL_HEATS = 3;
const HOT_REPAIR_INTERVAL_HEATS = 36;

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
};

const depthAt = (finalDepth: number, heat: number, heats: number) => (
  heats <= 0 ? 0 : Math.max(2, finalDepth * Math.pow(Math.max(heat, 1) / heats, 0.92))
);

/** 同一役内各次检测共用一个深度场形状，按最大深度缩放。 */
const fieldShapeCache = new Map<number, { maxAzimuth: number; maxHeight: number; avgRatio: number }>();
function fieldShape(seed: number) {
  const cached = fieldShapeCache.get(seed);
  if (cached) return cached;
  const field = generateDepthField(seed, 100);
  let maxCell = 0; let total = 0;
  for (let index = 0; index < field.length; index += 1) {
    total += field[index];
    if (field[index] > field[maxCell]) maxCell = index;
  }
  const shape = {
    maxAzimuth: ((maxCell % AZ_BINS) + 0.5) * (360 / AZ_BINS),
    maxHeight: Math.round(((Math.floor(maxCell / AZ_BINS) + 0.5) / 48) * 1200),
    avgRatio: total / field.length / 100,
  };
  fieldShapeCache.set(seed, shape);
  return shape;
}

const campaignFieldSeed = (ladleNo: string, campaignNo: number) => (hashString(ladleNo) % 100000) * 10 + campaignNo;

interface BuiltLadle {
  row: LadleReportRow;
  campaigns: LadleCampaign[];
  details: Map<number, LadleCampaignDetail>;
}

function buildCampaignDetail(
  seed: LadleSeed,
  campaign: LadleCampaign,
  startTime: number,
  endTime: number,
  finalTemps: number[],
  ongoing: boolean,
  random: () => number,
): LadleCampaignDetail {
  const { heats } = campaign;
  const timeAt = (heat: number) => startTime + ((endTime - startTime) * heat) / Math.max(heats, 1);
  const shape = fieldShape(campaignFieldSeed(seed.no, campaign.campaignNo));
  const fieldSeed = campaignFieldSeed(seed.no, campaign.campaignNo);

  const scanHeats: number[] = [1];
  for (let heat = SCAN_INTERVAL_HEATS; heat < heats; heat += SCAN_INTERVAL_HEATS) scanHeats.push(heat);
  if (heats > 1 && scanHeats[scanHeats.length - 1] !== heats) scanHeats.push(heats);

  const scans: RadarScan[] = scanHeats.map((heat, index) => {
    // 役内首次检测即侵蚀基准，深度按定义为 0
    const maxDepth = index === 0 ? 0 : Math.round(depthAt(campaign.finalMaxDepth, heat, heats));
    return {
      id: `${seed.no}-${campaign.campaignNo}-${index + 1}`,
      ladleNo: seed.no,
      campaignNo: campaign.campaignNo,
      seq: index + 1,
      time: formatDateTime(timeAt(heat)),
      heatInCampaign: heat,
      totalHeat: campaign.startTotalHeat + heat - 1,
      maxDepth,
      avgDepth: Math.round(maxDepth * shape.avgRatio),
      minResidual: slagThresholds.designThicknessMm - maxDepth,
      maxAzimuth: Math.round(shape.maxAzimuth),
      maxHeight: shape.maxHeight,
      wearRate: Number((maxDepth / Math.max(heat, 1)).toFixed(2)),
      seed: fieldSeed,
      coverage: Number((98.6 + random() * 1.2).toFixed(1)),
      durationSec: Math.round(84 + random() * 26),
      ocrConfidence: Number((93.5 + random() * 5.8).toFixed(1)),
    };
  });

  const baseTemps = finalTemps.map((value) => value - 62 - random() * 14);
  const thermal: ThermalDetection[] = [];
  for (let heat = 1; heat <= heats; heat += THERMAL_INTERVAL_HEATS) {
    const progress = Math.pow(heat / heats, 1.1);
    thermal.push({
      campaignNo: campaign.campaignNo,
      time: formatDateTime(timeAt(heat) + 40 * 60 * 1000),
      heatInCampaign: heat,
      totalHeat: campaign.startTotalHeat + heat - 1,
      temps: finalTemps.map((value, index) => Math.round(baseTemps[index] + (value - baseTemps[index]) * progress + (random() - 0.5) * 8)),
    });
  }
  if (thermal.length === 0 || thermal[thermal.length - 1].heatInCampaign !== heats) {
    thermal.push({
      campaignNo: campaign.campaignNo,
      time: formatDateTime(endTime + 30 * 60 * 1000),
      heatInCampaign: heats,
      totalHeat: campaign.startTotalHeat + heats - 1,
      temps: [...finalTemps],
    });
  } else {
    thermal[thermal.length - 1].temps = [...finalTemps];
  }

  const hottestAt = (heat: number) => {
    const detection = thermal.reduce((best, item) => (
      Math.abs(item.heatInCampaign - heat) < Math.abs(best.heatInCampaign - heat) ? item : best
    ), thermal[0]);
    return maxTemp(detection.temps) ?? 0;
  };

  const events: LadleEvent[] = [];
  const repairs: RepairRecord[] = [];
  const pushEvent = (type: LadleEvent['type'], heat: number, station: string, time: number) => {
    events.push({
      campaignNo: campaign.campaignNo,
      seq: events.length + 1,
      type,
      time: formatDateTime(time),
      station,
      heatInCampaign: heat,
      totalHeat: campaign.startTotalHeat + Math.max(heat, 1) - 1,
      operator: operators[Math.floor(random() * operators.length)],
    });
  };

  pushEvent('上线', 1, '转炉出钢位', startTime);
  for (let heat = HOT_REPAIR_INTERVAL_HEATS; heat < heats - 4; heat += HOT_REPAIR_INTERVAL_HEATS) {
    const time = timeAt(heat) + 2 * HOUR;
    pushEvent('下线', heat, 'P2 热维位', time);
    pushEvent('热修', heat, '热修位', time + HOUR);
    pushEvent('上线', heat, '转炉出钢位', time + 7 * HOUR);
    const depthBefore = Math.round(depthAt(campaign.finalMaxDepth, heat, heats));
    const tempBefore = hottestAt(heat);
    repairs.push({
      campaignNo: campaign.campaignNo,
      type: '热修',
      time: formatDateTime(time + HOUR),
      heatInCampaign: heat,
      depthBefore,
      depthAfter: Math.max(0, depthBefore - Math.round(9 + random() * 9)),
      tempBefore,
      tempAfter: tempBefore - Math.round(24 + random() * 16),
      content: '渣线局部补浇 + 包沿清理',
    });
  }

  const endHeat = heats;
  if (!ongoing) {
    pushEvent('下线', endHeat, 'P2 热维位', endTime + 2 * HOUR);
    pushEvent('大修', endHeat, '大修车间', endTime + 6 * HOUR);
    const tempBefore = hottestAt(endHeat);
    repairs.push({
      campaignNo: campaign.campaignNo,
      type: '大修',
      time: formatDateTime(endTime + 6 * HOUR),
      heatInCampaign: endHeat,
      depthBefore: campaign.finalMaxDepth,
      depthAfter: 0,
      tempBefore,
      tempAfter: 238 + Math.round(random() * 14),
      content: '整体拆除重砌渣线砖，侵蚀基准归零',
    });
  } else if (seed.state === '下线待修') {
    pushEvent('下线', endHeat, 'P2 热维位', endTime + 2 * HOUR);
  } else if (seed.state === '热修中') {
    pushEvent('下线', endHeat, 'P2 热维位', endTime + 2 * HOUR);
    pushEvent('热修', endHeat, '热修位', endTime + 3 * HOUR);
  } else if (seed.state === '大修中') {
    pushEvent('下线', endHeat, 'P2 热维位', endTime + 2 * HOUR);
    pushEvent('大修', endHeat, '大修车间', endTime + 5 * HOUR);
  }

  return { campaign, scans, thermal, events, repairs };
}

function buildLadle(seed: LadleSeed, index: number): BuiltLadle {
  const random = mulberry32(hashString(seed.no));
  const p2Offsets = [9 + Math.round(random() * 8), 6 + Math.round(random() * 8), 11 + Math.round(random() * 9)];
  const currentTemps = [...seed.p1, ...seed.p1.map((value, i) => value - p2Offsets[i])];

  const historyHeats = seed.history ?? (seed.total > seed.heats ? [seed.total - seed.heats] : []);
  const lastScanTime = NOW - (0.6 + ((index * 7) % 30)) * HOUR;
  const currentStart = seed.fixedDates
    ? new Date(`${seed.fixedDates.currentStart}T08:00:00`).getTime()
    : lastScanTime - (seed.heats / HEATS_PER_DAY) * DAY;

  const campaigns: LadleCampaign[] = [];
  const details = new Map<number, LadleCampaignDetail>();
  let totalCursor = 1;
  let cursorEnd = currentStart - (10 + random() * 8) * DAY;
  const historyWindows: Array<[number, number]> = [];
  for (let i = historyHeats.length - 1; i >= 0; i -= 1) {
    const fixed = seed.fixedDates?.history[i];
    const end = fixed ? new Date(`${fixed[1]}T16:00:00`).getTime() : cursorEnd;
    const start = fixed ? new Date(`${fixed[0]}T08:00:00`).getTime() : end - (historyHeats[i] / HEATS_PER_DAY) * DAY;
    historyWindows[i] = [start, end];
    cursorEnd = start - (10 + random() * 8) * DAY;
  }

  historyHeats.forEach((heats, i) => {
    const [start, end] = historyWindows[i];
    const finalDepth = Math.round(118 + random() * 30);
    const campaign: LadleCampaign = {
      campaignNo: i + 1,
      startDate: formatDate(start),
      endDate: formatDate(end),
      startTotalHeat: totalCursor,
      heats,
      sealed: true,
      finalMaxDepth: finalDepth,
      finalNote: `${finalDepth} mm，下线大修（已封存·只读）`,
    };
    const finalTemps = currentTemps.map((value) => value - Math.round(4 + random() * 12));
    campaigns.push(campaign);
    details.set(campaign.campaignNo, buildCampaignDetail(seed, campaign, start, end, finalTemps, false, random));
    totalCursor += heats;
  });

  const currentNo = historyHeats.length + 1;
  const { level, verdict, advice } = judgeLadle(seed.depth, currentTemps);
  const current: LadleCampaign = {
    campaignNo: currentNo,
    startDate: formatDate(currentStart),
    endDate: null,
    startTotalHeat: totalCursor,
    heats: seed.heats,
    sealed: false,
    finalMaxDepth: seed.depth,
    finalNote: seed.state === '在线运行'
      ? `${seed.depth} mm，${verdict}（当前役·可写）`
      : `${seed.depth} mm + ${maxTemp(currentTemps)} ℃，${seed.state}（当前役·可写）`,
  };
  campaigns.push(current);
  const currentDetail = buildCampaignDetail(seed, current, currentStart, lastScanTime, currentTemps, true, random);
  details.set(currentNo, currentDetail);

  const lastScan = currentDetail.scans[currentDetail.scans.length - 1];
  const wearRate = Number((seed.depth / Math.max(seed.heats, 1)).toFixed(2));

  return {
    campaigns,
    details,
    row: {
      ladleNo: seed.no,
      ladleType: '120t 钢包',
      runState: seed.state,
      campaignNo: currentNo,
      heatsInCampaign: seed.heats,
      totalHeats: seed.total,
      commissionDate: campaigns[0].startDate,
      temps: currentTemps,
      preRepairTemp: seed.preRepairTemp ?? null,
      maxDepth: seed.depth,
      minResidual: slagThresholds.designThicknessMm - seed.depth,
      maxAzimuth: lastScan.maxAzimuth,
      maxHeight: lastScan.maxHeight,
      wearRate,
      level,
      verdict,
      advice,
      riskScore: riskScore(seed.depth, currentTemps),
      lifeLeft: remainingHeats(seed.depth, wearRate),
      lastScanTime: lastScan.time,
      ocrConfidence: lastScan.ocrConfidence,
    },
  };
}

const builtLadles = ladleSeeds.map(buildLadle);
const builtByNo = new Map(builtLadles.map((item) => [item.row.ladleNo, item]));

export function getMockLadleReportRows(): LadleReportRow[] {
  return builtLadles.map((item) => ({ ...item.row, temps: [...item.row.temps] }));
}

export function getMockLadleReportDetail(ladleNo: string, campaignNo?: number): LadleReportDetail | null {
  const built = builtByNo.get(ladleNo);
  if (!built) return null;
  const targetNo = campaignNo ?? built.row.campaignNo;
  const current = built.details.get(targetNo) ?? built.details.get(built.row.campaignNo);
  if (!current) return null;
  return { row: { ...built.row }, campaigns: built.campaigns.map((item) => ({ ...item })), current };
}

export function getMockRadarScans(ladleNo: string): RadarScan[] {
  const built = builtByNo.get(ladleNo);
  if (!built) return [];
  return built.campaigns.flatMap((campaign) => built.details.get(campaign.campaignNo)?.scans ?? []);
}

export const benxiMockLadleNos = ladleSeeds.map((seed) => seed.no);

const runStateToStatus = (row: LadleReportRow): LadleStatusCode => {
  if (row.runState === '下线待修') return '2';
  if (row.runState === '热修中' || row.runState === '大修中') return '4';
  return row.level > 0 ? '3' : '1';
};

/** 供现有钢包管理模块使用的档案数据（对齐 Java /ladle 字段）。 */
export function buildBenxiLadleEntities(): LadleEntity[] {
  return builtLadles.map((item, index) => {
    const { row } = item;
    const random = mulberry32(index + 101);
    const lastDate = row.lastScanTime.slice(0, 10);
    return {
      id: index + 1,
      ladleNo: row.ladleNo,
      inLadleTime: lastDate,
      outLadleTime: lastDate,
      inLadleWeight: Number((2.0 + random() * 0.3).toFixed(1)),
      outLadleWeight: Number((1.9 + random() * 0.3).toFixed(1)),
      outLadleTemperature: maxTemp(row.temps) ?? 0,
      lastMaintenanceTime: item.campaigns[item.campaigns.length - 1].startDate,
      totalUsageCount: row.totalHeats,
      currentStatus: runStateToStatus(row),
      postMaintenanceUsageCount: row.heatsInCampaign,
      createBy: 'admin',
      createTime: `${row.commissionDate} 08:00:00`,
      updateBy: '',
      updateTime: null,
      remark: `第 ${row.campaignNo} 役`,
    };
  });
}

const THERMAL_PASS_INTERVAL_HOURS = 3.2;
const THERMAL_HISTORY_DAYS = 7;
/** 四台热像仪各覆盖的测温通道下标（P1 三路 + P2 三路）。 */
const deviceChannelIndexes = [[0, 1], [2], [3, 4], [5]];

/**
 * 供现有数据查询 / 曲线分析模块使用的过站测温明细（对齐 Java /ladle-record 字段）。
 * 在线钢包近 7 天约每 3 小时过站一次；下线、修理中的钢包在最后一次检测后不再过站。
 * 温度沿时间缓慢升至报表中的当前外壁温度，保证与报表、告警一致。
 */
export function buildBenxiThermalRecords(deviceNames: readonly string[], currentLadleNo: string): LadleRecordDetail[] {
  const records: Omit<LadleRecordDetail, 'id'>[] = [];
  const windowStart = NOW - THERMAL_HISTORY_DAYS * DAY;

  builtLadles.forEach((item, ladleIndex) => {
    const { row } = item;
    const random = mulberry32(hashString(`${row.ladleNo}-thermal`));
    let lastPass = new Date(row.lastScanTime.replace(' ', 'T')).getTime();
    if (row.ladleNo === currentLadleNo) lastPass = NOW - 0.1 * HOUR;
    else if (row.runState === '在线运行') lastPass = NOW - (0.3 + (ladleIndex % 8) * 0.35) * HOUR;
    const fallback = maxTemp(row.temps) ?? 280;
    const deviceFinal = deviceChannelIndexes.map((indexes) => Math.max(...indexes.map((index) => row.temps[index] ?? fallback)));

    for (let time = lastPass; time >= windowStart; time -= THERMAL_PASS_INTERVAL_HOURS * HOUR * (0.8 + random() * 0.4)) {
      const ageDays = (NOW - time) / DAY;
      const recordTime = formatDateTime(time);
      deviceNames.forEach((deviceName, deviceIndex) => {
        const max = Math.round(deviceFinal[deviceIndex % deviceFinal.length] - ageDays * 2.2 + (random() - 0.5) * 10);
        const min = Math.round(96 + random() * 38);
        records.push({
          ladleNo: row.ladleNo,
          deviceName,
          maxTemp: max,
          minTemp: min,
          avgTemp: Number((min + (max - min) * (0.48 + random() * 0.1)).toFixed(1)),
          recordTime,
          createTime: formatDateTime(time + (20 + random() * 40) * 1000),
        });
      });
    }
  });

  return records
    .sort((a, b) => a.recordTime.localeCompare(b.recordTime))
    .map((record, index) => ({ ...record, id: index + 1 }));
}

/** 供现有报警模块使用的告警数据：外壁高温 + 渣线侵蚀两类，含历史已处理记录。 */
export function buildBenxiAlarmRecords(): LadleAlarmRecord[] {
  const records: Omit<LadleAlarmRecord, 'id' | 'eventId' | 'alarmId'>[] = [];
  builtLadles.forEach((item, ladleIndex) => {
    const { row } = item;
    const hottest = maxTemp(row.temps) ?? 0;
    const hottestChannel = thermalChannels[row.temps.indexOf(hottest)] ?? thermalChannels[0];
    const valid = row.temps.filter((value): value is number => typeof value === 'number');
    const avg = valid.reduce((sum, value) => sum + value, 0) / Math.max(valid.length, 1);
    const tLevel = tempLevel(hottest);
    const dLevel = depthLevel(row.maxDepth);
    const baseTime = NOW - (1 + ladleIndex * 3.7) * HOUR;

    if (tLevel > 0) {
      records.push({
        eventTimeStamp: formatDateTime(baseTime),
        devId: `TN460-${120 + (ladleIndex % 6)}`,
        channelName: hottestChannel.name,
        num: 1,
        ruleType: '外壁高温大于',
        level: tLevel === 2 ? '2' : '1',
        avgTemp: Number(avg.toFixed(1)),
        minTemp: Math.min(...valid),
        maxTemp: hottest,
        thresholdTemp: tLevel === 2 ? slagThresholds.tempAlarmC : slagThresholds.tempWarnC,
        ladleNo: row.ladleNo,
        isRead: 0,
        processor: null,
        processContent: null,
        processTime: null,
      });
    }
    if (dLevel > 0) {
      records.push({
        eventTimeStamp: formatDateTime(baseTime - 25 * 60 * 1000),
        devId: 'RH-LR1540',
        channelName: `渣线雷达 · ${Math.round(row.maxAzimuth)}° 方位`,
        num: 1,
        ruleType: `渣线侵蚀深度超限（${row.maxDepth}mm）`,
        level: dLevel === 2 ? '2' : '1',
        avgTemp: Number(avg.toFixed(1)),
        minTemp: Math.min(...valid),
        maxTemp: hottest,
        thresholdTemp: dLevel === 2 ? slagThresholds.tempAlarmC : slagThresholds.tempWarnC,
        ladleNo: row.ladleNo,
        isRead: 0,
        processor: null,
        processContent: null,
        processTime: null,
      });
    }
    if (ladleIndex % 3 === 0) {
      const time = NOW - (30 + ladleIndex * 5) * HOUR;
      records.push({
        eventTimeStamp: formatDateTime(time),
        devId: `TN460-${120 + (ladleIndex % 6)}`,
        channelName: thermalChannels[ladleIndex % thermalChannels.length].name,
        num: 1,
        ruleType: '温度波动异常',
        level: '1',
        avgTemp: Number((avg - 18).toFixed(1)),
        minTemp: Math.min(...valid) - 20,
        maxTemp: hottest - 22,
        thresholdTemp: slagThresholds.tempWarnC,
        ladleNo: row.ladleNo,
        isRead: 1,
        processor: operators[ladleIndex % operators.length],
        processContent: '已复测，温度恢复正常',
        processTime: formatDateTime(time + 2 * HOUR),
      });
    }
  });

  return records
    .sort((a, b) => b.eventTimeStamp.localeCompare(a.eventTimeStamp))
    .map((record, index) => {
      const sequence = String(index + 1).padStart(3, '0');
      return { ...record, id: index + 1, eventId: `benxi-alarm-${sequence}`, alarmId: `benxi-alarm-${sequence}` };
    });
}

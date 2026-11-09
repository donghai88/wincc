/** 0 正常 / 1 关注 / 2 危险 */
export type RiskLevel = 0 | 1 | 2;

export type LadleRunState = '在线运行' | '下线待修' | '热修中' | '大修中';

export type LadleEventType = '上线' | '下线' | '热修' | '大修';

export interface ThermalChannel {
  id: string;
  station: 'P1' | 'P2';
  name: string;
}

export interface SlagThresholds {
  designThicknessMm: number;
  depthWarnMm: number;
  depthAlarmMm: number;
  tempWarnC: number;
  tempAlarmC: number;
}

/** 一役 = 一次大修到下一次大修之间的服役周期 */
export interface LadleCampaign {
  campaignNo: number;
  startDate: string;
  endDate: string | null;
  /** 本役起始时的累计炉次（本役第 1 炉对应的累计炉次） */
  startTotalHeat: number;
  heats: number;
  sealed: boolean;
  finalMaxDepth: number;
  finalNote: string;
}

export interface RadarScan {
  id: string;
  ladleNo: string;
  campaignNo: number;
  /** 役内检测序号，大修后从 1 开始 */
  seq: number;
  time: string;
  heatInCampaign: number;
  totalHeat: number;
  maxDepth: number;
  avgDepth: number;
  minResidual: number;
  maxAzimuth: number;
  maxHeight: number;
  wearRate: number;
  /** 演示点云深度场随机种子；真实环境由 pcdUrl 提供点云 */
  seed: number;
  pcdUrl?: string;
  coverage: number;
  durationSec: number;
  ocrConfidence: number;
}

export interface ThermalDetection {
  campaignNo: number;
  time: string;
  heatInCampaign: number;
  totalHeat: number;
  /** 与 thermalChannels 顺序一一对应 */
  temps: Array<number | null>;
}

export interface LadleEvent {
  campaignNo: number;
  /** 役内事件序号，大修后从 1 开始 */
  seq: number;
  type: LadleEventType;
  time: string;
  station: string;
  heatInCampaign: number;
  totalHeat: number;
  operator: string;
}

export interface RepairRecord {
  campaignNo: number;
  type: '热修' | '大修';
  time: string;
  heatInCampaign: number;
  depthBefore: number;
  depthAfter: number;
  tempBefore: number;
  tempAfter: number;
  content: string;
}

export interface LadleReportRow {
  ladleNo: string;
  ladleType: string;
  runState: LadleRunState;
  campaignNo: number;
  heatsInCampaign: number;
  totalHeats: number;
  commissionDate: string;
  temps: Array<number | null>;
  preRepairTemp: number | null;
  maxDepth: number;
  minResidual: number;
  maxAzimuth: number;
  maxHeight: number;
  wearRate: number;
  level: RiskLevel;
  verdict: string;
  advice: string;
  riskScore: number;
  lifeLeft: number;
  lastScanTime: string;
  ocrConfidence: number;
}

export interface LadleCampaignDetail {
  campaign: LadleCampaign;
  scans: RadarScan[];
  thermal: ThermalDetection[];
  events: LadleEvent[];
  repairs: RepairRecord[];
}

export interface LadleReportDetail {
  row: LadleReportRow;
  campaigns: LadleCampaign[];
  /** 当前请求的役 */
  current: LadleCampaignDetail;
}

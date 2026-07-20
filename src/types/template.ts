// WinCC Template Types - 钢包监控系统

// 设备类型枚举
export type DeviceType =
  | 'ladle'           // 钢包
  | 'converter'       // 转炉
  | 'continuous-cast' // 连铸机
  | 'heating-furnace' // 加热炉
  | 'hot-metal-trough' // 铁水沟
  | 'hot-metal-trough-sim'; // 铁水沟一（视觉仿真）

// 设备类型配置
export interface DeviceTypeConfig {
  id: DeviceType;
  name: string;
  description: string;
  icon: string;
  color: string;
  templateId: string;
}

// WinCC 实例
export interface WinCCInstance {
  id: string;
  name: string;
  location: string;
  deviceType: DeviceType;
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance';
  lastUpdate: string;
  ipAddress?: string;
  tags?: string[];
}

// 模板配置
export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  supportedDeviceTypes: DeviceType[];
}

// 钢包监控指标
export interface LadleMetrics {
  // 温度相关
  steelTemp: MetricValue;        // 钢水温度
  shellTemp: MetricValue;        // 包壳温度
  bottomTemp: MetricValue;       // 包底温度

  // 重量相关
  grossWeight: MetricValue;      // 总重量
  steelWeight: MetricValue;      // 钢水重量

  // 状态相关
  tiltAngle: MetricValue;        // 倾斜角度
  lidStatus: 'open' | 'closed';  // 包盖状态
  argonFlow: MetricValue;        // 氩气流量
  argonPressure: MetricValue;    // 氩气压力

  // 使用信息
  heatNumber: string;            // 炉次号
  steelGrade: string;            // 钢种
  pourCount: number;             // 浇注次数
  serviceLife: number;           // 使用寿命（次）
  maxServiceLife: number;        // 最大使用寿命
}

// 铁水液位检测系统指标
export interface IronLevelMetrics {
  // 核心检测参数
  levelHeight: MetricValue;           // 实时液位高度 (mm), AI视觉识别
  levelStatus: 'normal' | 'high' | 'low' | 'alarm';  // 液位状态
  tempSurface: MetricValue;           // 当前温度 (℃), 高温计PLC
  weightCalculated: MetricValue;      // 铁水重量 (t), 轨道秤PLC
  crustingArea: MetricValue;          // 结壳面积 (%), AI视觉识别

  // 报警相关参数
  levelThresholdHigh: number;         // 液位报警阈值-高 (mm)
  levelThresholdLow: number;          // 液位报警阈值-低 (mm)
  alarmTime: string | null;           // 最近一次报警时间

  // 历史记录
  ladleId: string;                    // 铁包编号

  // 出铁口信息
  tapHole: 1 | 2;                     // 出铁口编号
}

// 带阈值的指标值
export interface MetricValue {
  current: number;
  unit: string;
  min?: number;           // 最小阈值
  max?: number;           // 最大阈值
  warningLow?: number;    // 低警告阈值
  warningHigh?: number;   // 高警告阈值
  trend?: number;         // 趋势变化百分比
}

// 铁水沟数字孪生指标
export interface HotMetalTroughMetrics {
  ironLevel: MetricValue;
  ironTemp: MetricValue;
  flowRate: MetricValue;
  trenchTemp: MetricValue;
  status: 'normal' | 'warning' | 'alarm';
}

// 告警信息
export interface AlarmInfo {
  id: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
  time: string;
  acknowledged: boolean;
}

export type AlarmPageLevel = '1' | '2';
export type AlarmReadState = 0 | 1;

export interface ApiSuccessResponse<T> {
  msg: '操作成功';
  code: 200;
  data: T;
}

export interface AlarmPageRecord {
  id: number;
  eventId: string;
  alarmId: string;
  eventTimeStamp: string;
  devId: string;
  channelName: string;
  num: number;
  ruleType: string;
  level: AlarmPageLevel;
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  thresholdTemp: number;
  locationName: string;
  isRead: AlarmReadState;
  processor: string | null;
  processContent: string | null;
  processTime: string | null;
}

export interface AlarmPageQuery {
  pageNum: number;
  pageSize: number;
  locationName?: string;
  level?: AlarmPageLevel;
  isRead?: AlarmReadState;
  startTime?: string;
  endTime?: string;
}

export interface AlarmPageData {
  total: number;
  list: AlarmPageRecord[];
}

export interface AlarmLocationStat {
  locationName: string;
  alarmCount: number;
  unreadCount: number;
  maxTemp: number;
  minTemp: number;
}

export interface AlarmLocationStatQuery {
  startTime?: string;
  endTime?: string;
}

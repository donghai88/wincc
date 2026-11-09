export type LadleApiResponse<T> = {
  msg: string;
  code: number;
  data: T;
};

export type LadlePagedRows<T> = {
  total: number;
  rows: T[];
  code?: number;
  msg?: string;
};

export interface LadleTempResult {
  deviceId: string;
  maxTemp: number | null;
  minTemp: number | null;
  avgTemp: number | null;
  success: boolean;
}

export interface LadleModbusPayload {
  currentLadleNo: string | null;
  tempResults: LadleTempResult[];
}

export interface LadleRecordRow {
  id: number | null;
  ladleNo: string;
  deviceName: string;
  maxTemp: number | null;
  minTemp: number | null;
  avgTemp: number | null;
  recordTime: string;
  createTime: string | null;
  snapshotPath?: string | null;
}

export interface LadleRecordDetail extends Omit<LadleRecordRow, 'id'> {
  id: number;
  /** Absolute image URL/path for the last thermal snapshot (GET /ladle-record/latest). */
  snapshotPath?: string | null;
}

export interface LadleRecordListQuery {
  ladleNo?: string;
  deviceNameList?: string;
  maxTemp?: number;
  minTemp?: number;
  avgTemp?: number;
  startTime?: string;
  endTime?: string;
  pageNum?: number;
  pageSize?: number;
}

export type LadleRecordExportQuery = Omit<LadleRecordListQuery, 'pageNum' | 'pageSize'>;

/** GET /ladle-record/export：钢包号可不填，填写时只能一个；时间为空则由服务端处理。 */
export interface LadleMonitorExportQuery {
  ladleNo?: string;
  startTime?: string;
  endTime?: string;
}

export interface LadleChartPoint {
  ladleNo: string;
  maxTemp: number;
  minTemp: number;
  avgTemp: number;
  recordTime: string;
}

export interface LadleChartQuery {
  ladleNo?: string;
  startTime?: string;
  endTime?: string;
}

export type LadleStatusCode = '1' | '2' | '3' | '4';

export interface LadleEntity {
  id: number;
  ladleNo: string;
  /** 进包时间 */
  inLadleTime: string;
  /** 出包时间 */
  outLadleTime: string;
  /** 进包重量（小数 1 位）；列表/详情可能是 number */
  inLadleWeight: number;
  /** 出包重量（小数 1 位）；列表/详情可能是 number */
  outLadleWeight: number;
  /** 出包温度（整数）；列表/详情可能是 number */
  outLadleTemperature: number;
  lastMaintenanceTime: string;
  totalUsageCount: number;
  currentStatus: LadleStatusCode;
  /** 后端监测用 sequence，前端不展示 */
  postMaintenanceUsageCount?: number;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string | null;
  remark?: string | null;
}

/**
 * POST /ladle、PUT /ladle 请求体（对齐文档示例）：
 * 重量、出包温度为 string；不含 postMaintenanceUsageCount。
 */
export interface LadleWritePayload {
  ladleNo: string;
  inLadleTime: string;
  outLadleTime: string;
  inLadleWeight: string;
  outLadleWeight: string;
  outLadleTemperature: string;
  lastMaintenanceTime: string;
  totalUsageCount: number;
  currentStatus: LadleStatusCode;
  id?: number;
}

export interface LadleListQuery {
  ladleNo?: string;
  currentStatus?: LadleStatusCode;
  lastMaintenanceTime?: string;
  totalUsageCount?: number;
  inLadleTime?: string;
  outLadleTime?: string;
  pageNum?: number;
  pageSize?: number;
}

export type LadleAlarmLevel = '1' | '2';
export type LadleAlarmReadState = 0 | 1;

export interface LadleAlarmRecord {
  id: number;
  eventId: string;
  alarmId: string;
  eventTimeStamp: string;
  devId: string;
  channelName: string;
  num: number;
  ruleType: string;
  level: LadleAlarmLevel;
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  thresholdTemp: number;
  ladleNo: string;
  isRead: LadleAlarmReadState;
  processor: string | null;
  processContent: string | null;
  processTime: string | null;
}

export interface LadleAlarmPageQuery {
  pageNum: number;
  pageSize: number;
  ladleNo?: string;
  level?: LadleAlarmLevel;
  isRead?: LadleAlarmReadState;
  startTime?: string;
  endTime?: string;
}

export interface LadleAlarmPageData {
  total: number;
  list: LadleAlarmRecord[];
  pageNum?: number;
  pageSize?: number;
  pages?: number;
}

export interface LadleAlarmBatchProcessRequest {
  eventIds: string[];
  processor: string;
  processContent: string;
}

export const ladleStatusLabels: Record<LadleStatusCode, string> = {
  '1': '使用中',
  '2': '待检修',
  '3': '需关注',
  '4': '正在检修',
};

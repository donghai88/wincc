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
  maxTemp: number;
  minTemp: number;
  avgTemp: number;
  recordTime: string;
  createTime: string | null;
}

export interface LadleRecordDetail extends Omit<LadleRecordRow, 'id'> {
  id: number;
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
  productionDate: string;
  plannedLifespan: number;
  estimatedRemainingLife: number;
  latestTemperature: number;
  lastMaintenanceTime: string;
  totalUsageCount: number;
  currentStatus: LadleStatusCode;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string | null;
  remark?: string | null;
}

export interface LadleListQuery {
  ladleNo?: string;
  productionDate?: string;
  plannedLifespan?: number;
  estimatedRemainingLife?: number;
  latestTemperature?: number;
  lastMaintenanceTime?: string;
  totalUsageCount?: number;
  currentStatus?: LadleStatusCode;
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

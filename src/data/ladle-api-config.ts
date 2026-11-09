import type {
  LadleAlarmBatchProcessRequest,
  LadleAlarmPageData,
  LadleAlarmPageQuery,
  LadleAlarmReadState,
  LadleAlarmRecord,
  LadleApiResponse,
  LadleChartPoint,
  LadleChartQuery,
  LadleEntity,
  LadleListQuery,
  LadleModbusPayload,
  LadlePagedRows,
  LadleRecordDetail,
  LadleMonitorExportQuery,
  LadleRecordExportQuery,
  LadleRecordListQuery,
  LadleRecordRow,
  LadleTempResult,
  LadleWritePayload,
} from '@/types/ladle-api';
import { buildBenxiAlarmRecords, buildBenxiLadleEntities, buildBenxiThermalRecords } from '@/data/benxi-ladle-mock';
import { isBenxiSuiteEnabled } from '@/lib/product-mode';

const pad = (value: number) => String(value).padStart(2, '0');

export const formatLadleDateTime = (date: Date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
);

const createSuccess = <T,>(data: T, msg = '操作成功'): LadleApiResponse<T> => ({
  msg,
  code: 200,
  data,
});

const THERMAL_DEVICE_IDS = ['南1_1', '南2_1', '北1_1', '北2_1'] as const;
const THERMAL_DEVICE_NAMES = ['南1_1', '南2_1', '北1_1', '北2_1'] as const;

/** Keep mock rows inside the UI's default recent windows (24h / 7d). */
const hoursAgo = (hours: number, minuteOffset = 0) => {
  const date = new Date(Date.now() - hours * 60 * 60 * 1000 - minuteOffset * 60 * 1000);
  return formatLadleDateTime(date);
};

const latestRecordTime = hoursAgo(2);
const midRecordTime = hoursAgo(3, 1);
const earlyRecordTime = hoursAgo(5);

const mockRecordDetails: LadleRecordDetail[] = [
  {
    id: 1,
    ladleNo: 'Y-111',
    deviceName: '南1_1',
    maxTemp: 300,
    minTemp: 100,
    avgTemp: 200,
    recordTime: latestRecordTime,
    createTime: hoursAgo(2, 1),
  },
  {
    id: 2,
    ladleNo: 'Y-111',
    deviceName: '南2_1',
    maxTemp: 310,
    minTemp: 110,
    avgTemp: 205,
    recordTime: latestRecordTime,
    createTime: hoursAgo(2, 1),
  },
  {
    id: 3,
    ladleNo: 'Y-111',
    deviceName: '北1_1',
    maxTemp: 320,
    minTemp: 120,
    avgTemp: 210,
    recordTime: latestRecordTime,
    createTime: hoursAgo(2, 1),
  },
  {
    id: 4,
    ladleNo: 'Y-121',
    deviceName: '南1_1',
    maxTemp: 295,
    minTemp: 105,
    avgTemp: 198,
    recordTime: midRecordTime,
    createTime: hoursAgo(3, 2),
  },
  {
    id: 5,
    ladleNo: 'Y-121',
    deviceName: '南2_1',
    maxTemp: 305,
    minTemp: 115,
    avgTemp: 203,
    recordTime: midRecordTime,
    createTime: hoursAgo(3, 2),
  },
  {
    id: 6,
    ladleNo: 'Y-121',
    deviceName: '北1_1',
    maxTemp: 315,
    minTemp: 125,
    avgTemp: 208,
    recordTime: midRecordTime,
    createTime: hoursAgo(3, 2),
  },
  {
    id: 7,
    ladleNo: 'Y-131',
    deviceName: '南1_1',
    maxTemp: 288,
    minTemp: 98,
    avgTemp: 192,
    recordTime: earlyRecordTime,
    createTime: hoursAgo(5, 1),
  },
  {
    id: 8,
    ladleNo: 'Y-131',
    deviceName: '南2_1',
    maxTemp: 298,
    minTemp: 108,
    avgTemp: 197,
    recordTime: earlyRecordTime,
    createTime: hoursAgo(5, 1),
  },
  {
    id: 9,
    ladleNo: 'Y-131',
    deviceName: '北1_1',
    maxTemp: 308,
    minTemp: 118,
    avgTemp: 202,
    recordTime: earlyRecordTime,
    createTime: hoursAgo(5, 1),
  },
];

const aggregateRecords = (details: LadleRecordDetail[]): LadleRecordRow[] => {
  const groups = new Map<string, LadleRecordDetail[]>();

  details.forEach((detail) => {
    const key = `${detail.ladleNo}::${detail.recordTime}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(detail);
    groups.set(key, bucket);
  });

  return Array.from(groups.values()).map((items) => {
    const temps = items
      .flatMap((item) => [item.maxTemp, item.minTemp, item.avgTemp])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    const maxTemps = items
      .map((item) => item.maxTemp)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return {
      id: null,
      ladleNo: items[0].ladleNo,
      deviceName: items.map((item) => item.deviceName).join(', '),
      maxTemp: maxTemps.length > 0 ? Math.max(...maxTemps) : null,
      minTemp: temps.length > 0 ? Math.min(...temps) : null,
      avgTemp: temps.length > 0
        ? Number((temps.reduce((sum, value) => sum + value, 0) / temps.length).toFixed(6))
        : null,
      recordTime: items[0].recordTime,
      createTime: null,
    };
  });
};

const demoCurrentLadleNo = isBenxiSuiteEnabled ? 'A05' : 'Y-111';

/** 本溪演示数据按全部在役钢包生成近 7 天测温记录，与报表、告警保持一致。 */
const mockRecordStore = isBenxiSuiteEnabled
  ? buildBenxiThermalRecords(THERMAL_DEVICE_NAMES, demoCurrentLadleNo)
  : [...mockRecordDetails];
const shanxiMockLadles: LadleEntity[] = [
  {
    id: 1,
    ladleNo: 'Y-111',
    inLadleTime: '2026-07-20',
    outLadleTime: '2026-07-21',
    inLadleWeight: 2.1,
    outLadleWeight: 2.0,
    outLadleTemperature: 300,
    lastMaintenanceTime: '2026-07-30',
    totalUsageCount: 100,
    currentStatus: '1',
    postMaintenanceUsageCount: 2,
    createBy: '',
    createTime: '2026-07-30 16:18:34',
    updateBy: '',
    updateTime: null,
    remark: null,
  },
  {
    id: 2,
    ladleNo: 'Y-121',
    inLadleTime: '2026-06-15',
    outLadleTime: '2026-06-16',
    inLadleWeight: 2.3,
    outLadleWeight: 2.1,
    outLadleTemperature: 305,
    lastMaintenanceTime: '2026-07-28',
    totalUsageCount: 140,
    currentStatus: '3',
    postMaintenanceUsageCount: 0,
    createBy: '',
    createTime: '2026-07-28 10:12:00',
    updateBy: '',
    updateTime: '2026-07-31 10:22:59',
    remark: null,
  },
  {
    id: 3,
    ladleNo: 'Y-131',
    inLadleTime: '2026-05-01',
    outLadleTime: '2026-05-02',
    inLadleWeight: 2.0,
    outLadleWeight: 1.9,
    outLadleTemperature: 298,
    lastMaintenanceTime: '2026-07-25',
    totalUsageCount: 80,
    currentStatus: '1',
    postMaintenanceUsageCount: 1,
    createBy: '',
    createTime: '2026-07-25 09:00:00',
    updateBy: '',
    updateTime: null,
    remark: null,
  },
];

let mockLadleStore: LadleEntity[] = isBenxiSuiteEnabled ? buildBenxiLadleEntities() : shanxiMockLadles;

const mockAlarmSeeds: Array<[string, string, LadleAlarmRecord['level'], number, LadleAlarmReadState]> = [
  ['Y-111', '11_1', '1', 0, 0],
  ['Y-121', '12_1', '2', 1, 0],
  ['Y-131', '17_1', '1', 0, 1],
  ['Y-111', '11_1', '2', 1, 1],
  ['Y-141', '12_1', '1', 0, 0],
];

const shanxiMockAlarms: LadleAlarmRecord[] = mockAlarmSeeds.map((seed, index) => {
  const [ladleNo, channelName, level, num, isRead] = seed;
  const sequence = String(index + 1).padStart(2, '0');
  const processed = isRead === 1;

  return {
    id: index + 1,
    eventId: `ladle-alarm-${sequence}`,
    alarmId: `ladle-alarm-${sequence}`,
    eventTimeStamp: hoursAgo(index + 1, index * 3),
    devId: `20652408515608699${index}`,
    channelName,
    num,
    ruleType: index % 2 === 0 ? '高温大于' : '温度波动异常',
    level,
    avgTemp: 28.9 + index,
    minTemp: 27.7 + index * 0.4,
    maxTemp: 44.1 + index,
    thresholdTemp: 40,
    ladleNo,
    isRead,
    processor: processed ? '张三' : null,
    processContent: processed ? '已现场排查，恢复正常' : null,
    processTime: processed ? hoursAgo(index, 10) : null,
  };
});

let mockAlarmStore: LadleAlarmRecord[] = isBenxiSuiteEnabled ? buildBenxiAlarmRecords() : shanxiMockAlarms;

let inferenceCount = 47;
let modbusTick = 0;

export function getCurrentDayInferenceCount(): LadleApiResponse<number> {
  return createSuccess(inferenceCount);
}

export function createMockModbusPayload(tick = modbusTick): LadleModbusPayload {
  modbusTick = tick + 1;
  const hasLadle = tick % 7 !== 0;

  // 本地预览离线态：四路均返回哨兵负温，便于验证「离线 + 重连按钮」
  const tempResults: LadleTempResult[] = THERMAL_DEVICE_IDS.map((deviceId) => ({
    deviceId,
    maxTemp: -273.2,
    minTemp: -273.2,
    avgTemp: -273.2,
    success: true,
  }));

  return {
    currentLadleNo: hasLadle ? demoCurrentLadleNo : null,
    tempResults,
  };
}

export function reconnectModbusDevice(deviceId: string): LadleApiResponse<null> {
  if (!deviceId.trim()) {
    return { msg: '设备 ID 无效，无法重连', code: 500, data: null };
  }
  return createSuccess(null);
}

export function queryLatestLadleRecords(): LadleApiResponse<LadleRecordDetail[]> {
  const latestTime = mockRecordStore
    .map((record) => record.recordTime)
    .sort()
    .at(-1);
  const data = mockRecordStore.filter((record) => record.recordTime === latestTime);
  return createSuccess(data.map((record) => ({ ...record })));
}

export function queryLadleRecordList(query: LadleRecordListQuery): LadlePagedRows<LadleRecordRow> {
  const aggregated = aggregateRecords(mockRecordStore);
  const filtered = aggregated.filter((row) => {
    if (query.ladleNo && !row.ladleNo.includes(query.ladleNo)) return false;
    if (query.deviceNameList) {
      const devices = query.deviceNameList.split(',').map((item) => item.trim()).filter(Boolean);
      if (devices.length > 0 && !devices.some((device) => row.deviceName.includes(device))) return false;
    }
    if (query.maxTemp !== undefined && (row.maxTemp == null || row.maxTemp < query.maxTemp)) return false;
    if (query.minTemp !== undefined && (row.minTemp == null || row.minTemp < query.minTemp)) return false;
    if (query.avgTemp !== undefined && (row.avgTemp == null || row.avgTemp < query.avgTemp)) return false;
    if (query.startTime && row.recordTime < query.startTime) return false;
    if (query.endTime && row.recordTime > query.endTime) return false;
    return true;
  });

  const pageSize = Math.max(1, query.pageSize ?? 10);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageNum = Math.min(Math.max(1, query.pageNum ?? 1), totalPages);
  const start = (pageNum - 1) * pageSize;

  return {
    total: filtered.length,
    rows: filtered.slice(start, start + pageSize),
    code: 200,
    msg: '查询成功',
  };
}

export function queryLadleRecordDetail(ladleNo: string, recordTime: string): LadleApiResponse<LadleRecordDetail[]> {
  const data = mockRecordStore.filter(
    (record) => record.ladleNo === ladleNo && record.recordTime === recordTime,
  );
  return createSuccess(data.map((record) => ({ ...record })));
}

export function buildLadleRecordDownloadPath(query: LadleRecordExportQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return `/ladle-record/download?${params.toString()}`;
}

/** 新 Excel 导出。只带包号和时间，不替代 /ladle-record/download。 */
export function buildLadleRecordExportPath(query: LadleMonitorExportQuery) {
  const params = new URLSearchParams();
  if (query.ladleNo) params.set('ladleNo', query.ladleNo);
  if (query.startTime) params.set('startTime', query.startTime);
  if (query.endTime) params.set('endTime', query.endTime);
  const search = params.toString();
  return search ? `/ladle-record/export?${search}` : '/ladle-record/export';
}

export function buildLadleRecordListPath(query: LadleRecordListQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return `/ladle-record/list?${params.toString()}`;
}

export function buildLadleRecordDetailPath(ladleNo: string, recordTime: string) {
  return `/ladle-record/${encodeURIComponent(ladleNo)}/${encodeURIComponent(recordTime)}`;
}

export function queryLadleChartList(query: LadleChartQuery): LadleApiResponse<LadleChartPoint[]> {
  const aggregated = aggregateRecords(mockRecordStore);
  const filtered = aggregated
    .filter((row) => {
      if (query.ladleNo && row.ladleNo !== query.ladleNo) return false;
      if (query.startTime && row.recordTime < query.startTime) return false;
      if (query.endTime && row.recordTime > query.endTime) return false;
      if (row.maxTemp == null || row.minTemp == null || row.avgTemp == null) return false;
      return true;
    })
    .map((row) => ({
      ladleNo: row.ladleNo,
      maxTemp: row.maxTemp as number,
      minTemp: row.minTemp as number,
      avgTemp: row.avgTemp as number,
      recordTime: row.recordTime,
    }));

  return createSuccess(filtered);
}

export function buildLadleChartListPath(query: LadleChartQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return `/ladle-chart/list?${params.toString()}`;
}

function filterLadles(query: LadleListQuery) {
  return mockLadleStore.filter((ladle) => {
    if (query.ladleNo && !ladle.ladleNo.includes(query.ladleNo)) return false;
    if (query.currentStatus && ladle.currentStatus !== query.currentStatus) return false;
    if (query.lastMaintenanceTime && ladle.lastMaintenanceTime !== query.lastMaintenanceTime) return false;
    if (query.totalUsageCount !== undefined && ladle.totalUsageCount !== query.totalUsageCount) return false;
    if (query.inLadleTime && ladle.inLadleTime !== query.inLadleTime) return false;
    if (query.outLadleTime && ladle.outLadleTime !== query.outLadleTime) return false;
    return true;
  });
}

export function queryLadleList(query: LadleListQuery): LadlePagedRows<LadleEntity> {
  const filtered = filterLadles(query);
  const pageSize = Math.max(1, query.pageSize ?? 10);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageNum = Math.min(Math.max(1, query.pageNum ?? 1), totalPages);
  const start = (pageNum - 1) * pageSize;

  return {
    total: filtered.length,
    rows: filtered.slice(start, start + pageSize).map((item) => ({ ...item })),
    code: 200,
    msg: '查询成功',
  };
}

export function queryLadleListNoPage(ladleNo?: string): LadleApiResponse<string[]> {
  const filtered = filterLadles({ ladleNo });
  return createSuccess(filtered.map((item) => item.ladleNo));
}

export function getLadleById(id: number): LadleApiResponse<LadleEntity> {
  const entity = mockLadleStore.find((item) => item.id === id);
  if (!entity) throw new Error('钢包不存在');
  return createSuccess({ ...entity });
}

const writePayloadToEntity = (payload: LadleWritePayload, id: number): LadleEntity => ({
  id,
  ladleNo: payload.ladleNo,
  inLadleTime: payload.inLadleTime,
  outLadleTime: payload.outLadleTime,
  inLadleWeight: Number(Number(payload.inLadleWeight).toFixed(1)),
  outLadleWeight: Number(Number(payload.outLadleWeight).toFixed(1)),
  outLadleTemperature: Math.round(Number(payload.outLadleTemperature) || 0),
  lastMaintenanceTime: payload.lastMaintenanceTime,
  totalUsageCount: payload.totalUsageCount,
  currentStatus: payload.currentStatus,
  postMaintenanceUsageCount: 0,
  createBy: '',
  createTime: formatLadleDateTime(new Date()),
  updateBy: '',
  updateTime: null,
  remark: null,
});

export function createLadle(payload: LadleWritePayload): LadleApiResponse<null> {
  const nextId = Math.max(0, ...mockLadleStore.map((item) => item.id)) + 1;
  mockLadleStore = [writePayloadToEntity(payload, nextId), ...mockLadleStore];
  return createSuccess(null);
}

export function updateLadle(payload: LadleWritePayload & { id: number }): LadleApiResponse<null> {
  const existing = mockLadleStore.find((item) => item.id === payload.id);
  const next = writePayloadToEntity(payload, payload.id);
  mockLadleStore = mockLadleStore.map((item) => (
    item.id === payload.id
      ? {
          ...next,
          createBy: existing?.createBy ?? '',
          createTime: existing?.createTime,
          postMaintenanceUsageCount: existing?.postMaintenanceUsageCount ?? 0,
          updateTime: formatLadleDateTime(new Date()),
        }
      : item
  ));
  return createSuccess(null);
}

export function deleteLadles(ids: number[]): LadleApiResponse<null> {
  const idSet = new Set(ids);
  mockLadleStore = mockLadleStore.filter((item) => !idSet.has(item.id));
  return createSuccess(null);
}

export function queryLadleAlarmPage(query: LadleAlarmPageQuery): LadleApiResponse<LadleAlarmPageData> {
  const filtered = mockAlarmStore.filter((record) => {
    if (query.ladleNo && record.ladleNo !== query.ladleNo) return false;
    if (query.level && record.level !== query.level) return false;
    if (query.isRead !== undefined && record.isRead !== query.isRead) return false;
    if (query.startTime && record.eventTimeStamp < query.startTime) return false;
    if (query.endTime && record.eventTimeStamp > query.endTime) return false;
    return true;
  });

  const pageSize = Math.max(1, query.pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageNum = Math.min(Math.max(1, query.pageNum), totalPages);
  const start = (pageNum - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize);

  return createSuccess({
    total: filtered.length,
    list,
    pageNum,
    pageSize,
    pages: totalPages,
  });
}

export function processLadleAlarmBatch(request: LadleAlarmBatchProcessRequest): LadleApiResponse<boolean> {
  const eventIds = new Set(request.eventIds);
  const processTime = formatLadleDateTime(new Date());
  mockAlarmStore = mockAlarmStore.map((record) => {
    if (!eventIds.has(record.eventId)) return record;
    return {
      ...record,
      isRead: 1,
      processor: request.processor,
      processContent: request.processContent,
      processTime,
    };
  });
  return createSuccess(true);
}

export function buildLadleAlarmPagePath(query: LadleAlarmPageQuery) {
  const params = new URLSearchParams({
    pageNum: String(query.pageNum),
    pageSize: String(query.pageSize),
  });
  if (query.ladleNo) params.set('ladleNo', query.ladleNo);
  if (query.level) params.set('level', query.level);
  if (query.isRead !== undefined) params.set('isRead', String(query.isRead));
  if (query.startTime) params.set('startTime', query.startTime);
  if (query.endTime) params.set('endTime', query.endTime);
  return `/alarm/page?${params.toString()}`;
}

export function buildLadleListPath(query: LadleListQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return `/ladle/list?${params.toString()}`;
}

/** GET /ladle/listNoPage — 返回钢包号字符串数组，供下拉选项使用 */
export function buildLadleListNoPagePath(ladleNo?: string) {
  const params = new URLSearchParams();
  if (ladleNo?.trim()) params.set('ladleNo', ladleNo.trim());
  const query = params.toString();
  return query ? `/ladle/listNoPage?${query}` : '/ladle/listNoPage';
}

export const ladleThermalDeviceLabels: Record<string, string> = {
  '南1_1': 'HHW-TN460D-ACS',
  '南2_1': 'HHW-TN460D-ACS',
  '北1_1': 'HHW-TN460D-ACS',
  '北2_1': 'HHW-TN460D-ACS',
  'TN460-125': 'HHW-TN460D-ACS',
  'TN460-126': 'HHW-TN460D-ACS',
  'TN460-127': 'HHW-TN460D-ACS',
  'TN460-128': 'HHW-TN460D-ACS',
  '11_1': 'HHW-TN460D-ACS',
  '12_1': 'HHW-TN460D-ACS',
  '17_1': 'HHW-TN460D-ACS',
};

export const ladleDeviceNameOptions = [...THERMAL_DEVICE_NAMES];

export function bumpInferenceCount() {
  inferenceCount += 1;
}

export function getMockLadleNos() {
  return mockLadleStore.map((item) => item.ladleNo);
}

const monitorZones = [
  { label: '南一', pattern: /南\s*1|南一/ },
  { label: '南二', pattern: /南\s*2|南二/ },
  { label: '北一', pattern: /北\s*1|北一/ },
  { label: '北二', pattern: /北\s*2|北二/ },
] as const;

/** 文档约定：只写日期时，开始补 00:00:00，结束补 23:59:59。真实接口由服务端补齐。 */
function normalizeMonitorExportTime(value: string | undefined, bound: 'start' | 'end') {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return bound === 'start' ? `${trimmed} 00:00:00` : `${trimmed} 23:59:59`;
  }
  return trimmed;
}

export function exportLadleMonitorSheetCsv(query: LadleMonitorExportQuery) {
  const startTime = normalizeMonitorExportTime(query.startTime, 'start');
  const endTime = normalizeMonitorExportTime(query.endTime, 'end');
  const filtered = mockRecordStore.filter((record) => {
    if (query.ladleNo && record.ladleNo !== query.ladleNo) return false;
    if (startTime && record.recordTime < startTime) return false;
    if (endTime && record.recordTime > endTime) return false;
    return true;
  });

  const groups = new Map<string, LadleRecordDetail[]>();
  filtered.forEach((record) => {
    const key = `${record.ladleNo}::${record.recordTime}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(record);
    groups.set(key, bucket);
  });

  const rows = Array.from(groups.values()).sort((left, right) => (
    left[0].recordTime.localeCompare(right[0].recordTime) || left[0].ladleNo.localeCompare(right[0].ladleNo)
  ));
  const seenByLadle = new Map<string, number>();
  const header = ['包号', '监测时间', '监测次数', ...monitorZones.map((zone) => zone.label)];
  const lines = rows.map((items) => {
    const ladleNo = items[0].ladleNo;
    const count = (seenByLadle.get(ladleNo) ?? 0) + 1;
    seenByLadle.set(ladleNo, count);
    const zoneTemps = monitorZones.map((zone) => {
      const match = items.find((item) => zone.pattern.test(item.deviceName));
      return match?.maxTemp ?? '';
    });
    return [ladleNo, items[0].recordTime, count, ...zoneTemps].join(',');
  });

  return [header.join(','), ...lines].join('\n');
}

export function exportLadleRecordsCsv(query: LadleRecordExportQuery) {
  const rows = queryLadleRecordList({ ...query, pageNum: 1, pageSize: 1000 }).rows;
  const header = ['钢包号', '设备名', '最高温', '最低温', '平均温', '记录时间'];
  const lines = [
    header.join(','),
    ...rows.map((row) => [
      row.ladleNo,
      `"${row.deviceName}"`,
      row.maxTemp,
      row.minTemp,
      row.avgTemp,
      row.recordTime,
    ].join(',')),
  ];
  return lines.join('\n');
}

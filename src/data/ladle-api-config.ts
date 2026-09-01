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
  LadleRecordExportQuery,
  LadleRecordListQuery,
  LadleRecordRow,
  LadleTempResult,
} from '@/types/ladle-api';

const pad = (value: number) => String(value).padStart(2, '0');

export const formatLadleDateTime = (date: Date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
);

const createSuccess = <T,>(data: T, msg = '操作成功'): LadleApiResponse<T> => ({
  msg,
  code: 200,
  data,
});

const THERMAL_DEVICE_IDS = ['11_1', '12_1', '17_1'] as const;
const THERMAL_DEVICE_NAMES = ['1-1', '2-1', '3-1'] as const;

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
    deviceName: '1-1',
    maxTemp: 300,
    minTemp: 100,
    avgTemp: 200,
    recordTime: latestRecordTime,
    createTime: hoursAgo(2, 1),
  },
  {
    id: 2,
    ladleNo: 'Y-111',
    deviceName: '2-1',
    maxTemp: 310,
    minTemp: 110,
    avgTemp: 205,
    recordTime: latestRecordTime,
    createTime: hoursAgo(2, 1),
  },
  {
    id: 3,
    ladleNo: 'Y-111',
    deviceName: '3-1',
    maxTemp: 320,
    minTemp: 120,
    avgTemp: 210,
    recordTime: latestRecordTime,
    createTime: hoursAgo(2, 1),
  },
  {
    id: 4,
    ladleNo: 'Y-121',
    deviceName: '1-1',
    maxTemp: 295,
    minTemp: 105,
    avgTemp: 198,
    recordTime: midRecordTime,
    createTime: hoursAgo(3, 2),
  },
  {
    id: 5,
    ladleNo: 'Y-121',
    deviceName: '2-1',
    maxTemp: 305,
    minTemp: 115,
    avgTemp: 203,
    recordTime: midRecordTime,
    createTime: hoursAgo(3, 2),
  },
  {
    id: 6,
    ladleNo: 'Y-121',
    deviceName: '3-1',
    maxTemp: 315,
    minTemp: 125,
    avgTemp: 208,
    recordTime: midRecordTime,
    createTime: hoursAgo(3, 2),
  },
  {
    id: 7,
    ladleNo: 'Y-131',
    deviceName: '1-1',
    maxTemp: 288,
    minTemp: 98,
    avgTemp: 192,
    recordTime: earlyRecordTime,
    createTime: hoursAgo(5, 1),
  },
  {
    id: 8,
    ladleNo: 'Y-131',
    deviceName: '2-1',
    maxTemp: 298,
    minTemp: 108,
    avgTemp: 197,
    recordTime: earlyRecordTime,
    createTime: hoursAgo(5, 1),
  },
  {
    id: 9,
    ladleNo: 'Y-131',
    deviceName: '3-1',
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
    const temps = items.flatMap((item) => [item.maxTemp, item.minTemp, item.avgTemp].filter((value) => value > 0));
    return {
      id: null,
      ladleNo: items[0].ladleNo,
      deviceName: items.map((item) => item.deviceName).join(', '),
      maxTemp: Math.max(...items.map((item) => item.maxTemp)),
      minTemp: Math.min(...temps),
      avgTemp: Number((temps.reduce((sum, value) => sum + value, 0) / temps.length).toFixed(6)),
      recordTime: items[0].recordTime,
      createTime: null,
    };
  });
};

let mockRecordStore = [...mockRecordDetails];
let mockLadleStore: LadleEntity[] = [
  {
    id: 1,
    ladleNo: 'Y-111',
    productionDate: '2026-07-20',
    plannedLifespan: 500,
    estimatedRemainingLife: 400,
    latestTemperature: 300,
    lastMaintenanceTime: '2026-07-30',
    totalUsageCount: 100,
    currentStatus: '1',
    createBy: '',
    createTime: '2026-07-30 16:18:34',
    updateBy: '',
    updateTime: null,
    remark: null,
  },
  {
    id: 2,
    ladleNo: 'Y-121',
    productionDate: '2026-06-15',
    plannedLifespan: 500,
    estimatedRemainingLife: 360,
    latestTemperature: 305,
    lastMaintenanceTime: '2026-07-28',
    totalUsageCount: 140,
    currentStatus: '3',
    createBy: '',
    createTime: '2026-07-28 10:12:00',
    updateBy: '',
    updateTime: '2026-07-31 10:22:59',
    remark: null,
  },
  {
    id: 3,
    ladleNo: 'Y-131',
    productionDate: '2026-05-01',
    plannedLifespan: 500,
    estimatedRemainingLife: 420,
    latestTemperature: 298,
    lastMaintenanceTime: '2026-07-25',
    totalUsageCount: 80,
    currentStatus: '1',
    createBy: '',
    createTime: '2026-07-25 09:00:00',
    updateBy: '',
    updateTime: null,
    remark: null,
  },
];

const mockAlarmSeeds: Array<[string, string, LadleAlarmRecord['level'], number, LadleAlarmReadState]> = [
  ['Y-111', '11_1', '1', 0, 0],
  ['Y-121', '12_1', '2', 1, 0],
  ['Y-131', '17_1', '1', 0, 1],
  ['Y-111', '11_1', '2', 1, 1],
  ['Y-141', '12_1', '1', 0, 0],
];

let mockAlarmStore: LadleAlarmRecord[] = mockAlarmSeeds.map((seed, index) => {
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

let inferenceCount = 47;
let modbusTick = 0;

export function getCurrentDayInferenceCount(): LadleApiResponse<number> {
  return createSuccess(inferenceCount);
}

export function createMockModbusPayload(tick = modbusTick): LadleModbusPayload {
  modbusTick = tick + 1;
  const hasLadle = tick % 7 !== 0;
  const wave = Math.sin(tick * 0.45);

  const tempResults: LadleTempResult[] = THERMAL_DEVICE_IDS.map((deviceId, index) => {
    if (tick % 11 === 0 && index === 2) {
      return { deviceId, maxTemp: null, minTemp: null, avgTemp: null, success: false };
    }

    const base = 280 + index * 10 + wave * 8;
    return {
      deviceId,
      maxTemp: Number((base + 12).toFixed(2)),
      minTemp: Number((base - 18).toFixed(2)),
      avgTemp: Number(base.toFixed(2)),
      success: true,
    };
  });

  return {
    currentLadleNo: hasLadle ? 'Y-111' : null,
    tempResults,
  };
}

export function reconnectModbusDevice(deviceId: string): LadleApiResponse<null> {
  if (!THERMAL_DEVICE_IDS.includes(deviceId as typeof THERMAL_DEVICE_IDS[number])) {
    return { msg: `设备 ${deviceId} 重连失败，请检查网络或设备电源`, code: 500, data: null };
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
    if (query.maxTemp !== undefined && row.maxTemp < query.maxTemp) return false;
    if (query.minTemp !== undefined && row.minTemp < query.minTemp) return false;
    if (query.avgTemp !== undefined && row.avgTemp < query.avgTemp) return false;
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
      return true;
    })
    .map((row) => ({
      ladleNo: row.ladleNo,
      maxTemp: row.maxTemp,
      minTemp: row.minTemp,
      avgTemp: row.avgTemp,
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
    if (query.productionDate && ladle.productionDate !== query.productionDate) return false;
    if (query.plannedLifespan !== undefined && ladle.plannedLifespan !== query.plannedLifespan) return false;
    if (query.estimatedRemainingLife !== undefined && ladle.estimatedRemainingLife !== query.estimatedRemainingLife) return false;
    if (query.latestTemperature !== undefined && ladle.latestTemperature !== query.latestTemperature) return false;
    if (query.lastMaintenanceTime && ladle.lastMaintenanceTime !== query.lastMaintenanceTime) return false;
    if (query.totalUsageCount !== undefined && ladle.totalUsageCount !== query.totalUsageCount) return false;
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

export function createLadle(payload: Omit<LadleEntity, 'id'>): LadleApiResponse<null> {
  const nextId = Math.max(0, ...mockLadleStore.map((item) => item.id)) + 1;
  mockLadleStore = [{ ...payload, id: nextId }, ...mockLadleStore];
  return createSuccess(null);
}

export function updateLadle(payload: LadleEntity): LadleApiResponse<null> {
  mockLadleStore = mockLadleStore.map((item) => (item.id === payload.id ? { ...payload } : item));
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

export const ladleThermalDeviceLabels: Record<string, string> = {
  '11_1': 'IR-01 出钢位',
  '12_1': 'IR-02 浇铸位',
  '17_1': 'IR-03 热修位',
};

export const ladleDeviceNameOptions = [...THERMAL_DEVICE_NAMES];

export function bumpInferenceCount() {
  inferenceCount += 1;
}

export function getMockLadleNos() {
  return mockLadleStore.map((item) => item.ladleNo);
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

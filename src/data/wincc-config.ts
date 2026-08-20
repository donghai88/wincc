// WinCC 系统配置数据 - 钢铁冶金行业
import type { WinCCInstance, DeviceTypeConfig, TemplateConfig, DeviceType, LadleMetrics, IronLevelMetrics, AlarmInfo, HotMetalTroughMetrics, AlarmPageData, AlarmPageQuery, AlarmPageRecord, AlarmBatchProcessRequest, AlarmLocationStat, AlarmLocationStatQuery, ApiSuccessResponse } from '@/types/template';

// 设备类型配置
export const deviceTypes: DeviceTypeConfig[] = [
  // {
  //   id: 'ladle',
  //   name: '液位监测',
  //   description: '铁水液位AI视觉检测系统',
  //   icon: 'container',
  //   color: '#f59e0b',
  //   templateId: 'ladle-monitor',
  // },
  // {
  //   id: 'converter',
  //   name: '转炉',
  //   description: '转炉炼钢监控系统',
  //   icon: 'flame',
  //   color: '#ef4444',
  //   templateId: 'converter-monitor',
  // },
  // {
  //   id: 'continuous-cast',
  //   name: '连铸机',
  //   description: '连续铸造监控系统',
  //   icon: 'git-branch',
  //   color: '#3b82f6',
  //   templateId: 'cast-monitor',
  // },
  // {
  //   id: 'heating-furnace',
  //   name: '加热炉',
  //   description: '钢坯加热监控系统',
  //   icon: 'thermometer',
  //   color: '#f97316',
  //   templateId: 'furnace-monitor',
  // },
  // {
  //   id: 'hot-metal-trough',
  //   name: '铁水沟',
  //   description: '铁水沟通道数字孪生监控',
  //   icon: 'waves',
  //   color: '#8b5cf6',
  //   templateId: 'trough-monitor',
  // },
  {
    id: 'hot-metal-trough-sim',
    name: '铁水沟',
    description: '铁水沟视觉仿真数字孪生',
    icon: 'waves',
    color: '#06b6d4',
    templateId: 'trough-sim-monitor',
  },
  {
    id: 'ladle-recognition',
    name: '钢包识别',
    description: '红外测温 + 雷达渣线检测 + OCR包号识别',
    icon: 'scan-text',
    color: '#0a84ff',
    templateId: 'ladle-recognition-monitor',
  },
];

// 模板配置
export const templates: TemplateConfig[] = [
  {
    id: 'ladle-monitor',
    name: '液位监测',
    description: '铁水液位AI视觉检测与监控',
    icon: 'container',
    color: '#f59e0b',
    supportedDeviceTypes: ['ladle'],
  },
  {
    id: 'converter-monitor',
    name: '转炉监控',
    description: '转炉冶炼过程监控',
    icon: 'flame',
    color: '#ef4444',
    supportedDeviceTypes: ['converter'],
  },
  {
    id: 'cast-monitor',
    name: '连铸监控',
    description: '连铸机运行状态监控',
    icon: 'git-branch',
    color: '#3b82f6',
    supportedDeviceTypes: ['continuous-cast'],
  },
  {
    id: 'furnace-monitor',
    name: '加热炉监控',
    description: '加热炉温度控制监控',
    icon: 'thermometer',
    color: '#f97316',
    supportedDeviceTypes: ['heating-furnace'],
  },
  {
    id: 'trough-monitor',
    name: '铁水沟监控',
    description: '铁水沟通道数字孪生监控',
    icon: 'waves',
    color: '#8b5cf6',
    supportedDeviceTypes: ['hot-metal-trough'],
  },
  {
    id: 'trough-sim-monitor',
    name: '铁水沟一仿真',
    description: '铁水沟视觉仿真数字孪生演示',
    icon: 'waves',
    color: '#06b6d4',
    supportedDeviceTypes: ['hot-metal-trough-sim'],
  },
  {
    id: 'ladle-recognition-monitor',
    name: '钢包识别',
    description: '红外测温、雷达渣线与 OCR 包号三模态监测',
    icon: 'scan-text',
    color: '#0a84ff',
    supportedDeviceTypes: ['ladle-recognition'],
  },
];

// WinCC 实例数据
export const winccInstances: WinCCInstance[] = [
  // 液位监测
  {
    id: 'ladle-001',
    name: '1号钢包',
    location: '炼钢车间 - 精炼区',
    deviceType: 'ladle',
    status: 'online',
    lastUpdate: '2024-01-15 14:30:22',
    ipAddress: '192.168.10.101',
    tags: ['在线', '浇注中'],
  },
  {
    id: 'ladle-002',
    name: '2号钢包',
    location: '炼钢车间 - 精炼区',
    deviceType: 'ladle',
    status: 'warning',
    lastUpdate: '2024-01-15 14:30:18',
    ipAddress: '192.168.10.102',
    tags: ['温度预警'],
  },
  {
    id: 'ladle-003',
    name: '3号钢包',
    location: '炼钢车间 - 连铸区',
    deviceType: 'ladle',
    status: 'online',
    lastUpdate: '2024-01-15 14:30:20',
    ipAddress: '192.168.10.103',
    tags: ['待命'],
  },
  {
    id: 'ladle-004',
    name: '4号钢包',
    location: '炼钢车间 - 维修区',
    deviceType: 'ladle',
    status: 'maintenance',
    lastUpdate: '2024-01-15 10:00:00',
    ipAddress: '192.168.10.104',
    tags: ['检修中'],
  },
  // 转炉
  {
    id: 'converter-001',
    name: '1号转炉',
    location: '炼钢车间 - 转炉区',
    deviceType: 'converter',
    status: 'online',
    lastUpdate: '2024-01-15 14:30:15',
    ipAddress: '192.168.10.201',
    tags: ['冶炼中'],
  },
  {
    id: 'converter-002',
    name: '2号转炉',
    location: '炼钢车间 - 转炉区',
    deviceType: 'converter',
    status: 'online',
    lastUpdate: '2024-01-15 14:30:10',
    ipAddress: '192.168.10.202',
    tags: ['出钢准备'],
  },
  // 连铸机
  {
    id: 'caster-001',
    name: '1号连铸机',
    location: '连铸车间 - A跨',
    deviceType: 'continuous-cast',
    status: 'online',
    lastUpdate: '2024-01-15 14:30:25',
    ipAddress: '192.168.10.301',
    tags: ['浇注中', '6流'],
  },
  {
    id: 'caster-002',
    name: '2号连铸机',
    location: '连铸车间 - B跨',
    deviceType: 'continuous-cast',
    status: 'error',
    lastUpdate: '2024-01-15 14:28:00',
    ipAddress: '192.168.10.302',
    tags: ['故障', '需处理'],
  },
  // 加热炉
  {
    id: 'furnace-001',
    name: '1号加热炉',
    location: '轧钢车间 - 加热区',
    deviceType: 'heating-furnace',
    status: 'online',
    lastUpdate: '2024-01-15 14:30:12',
    ipAddress: '192.168.10.401',
    tags: ['加热中'],
  },
  // 铁水沟
  {
    id: 'trough-001',
    name: '1号铁水沟',
    location: '高炉车间 - 铁水沟',
    deviceType: 'hot-metal-trough',
    status: 'online',
    lastUpdate: '2024-01-15 14:30:08',
    ipAddress: '192.168.10.501',
    tags: ['运行中', '数字孪生'],
  },
  {
    id: 'trough-sim-001',
    name: '铁水沟',
    location: '高炉车间 - 出铁区',
    deviceType: 'hot-metal-trough-sim',
    status: 'online',
    lastUpdate: '2024-01-15 14:30:28',
    ipAddress: '192.168.10.511',
    tags: ['视觉仿真', '演示层', '数字孪生'],
  },
  {
    id: 'ladle-recognition-001',
    name: '热修位钢包识别',
    location: '炼钢二厂 - 热修位',
    deviceType: 'ladle-recognition',
    status: 'online',
    lastUpdate: '2026-07-23 14:30:28',
    ipAddress: '192.168.10.521',
    tags: ['OCR识别', '雷达扫描', '双模态检测'],
  },
];

// 模拟钢包监控数据
export function getLadleMetrics(ladleId: string): LadleMetrics {
  // 根据不同钢包返回不同的模拟数据
  const metricsMap: Record<string, LadleMetrics> = {
    'ladle-001': {
      steelTemp: { current: 1565, unit: '°C', min: 1500, max: 1650, warningLow: 1520, warningHigh: 1620 },
      shellTemp: { current: 285, unit: '°C', max: 350, warningHigh: 320 },
      bottomTemp: { current: 312, unit: '°C', max: 400, warningHigh: 360 },
      grossWeight: { current: 165.8, unit: 't' },
      steelWeight: { current: 142.3, unit: 't', min: 0, max: 150 },
      tiltAngle: { current: 0, unit: '°', min: -5, max: 90 },
      lidStatus: 'closed',
      argonFlow: { current: 420, unit: 'L/min', min: 200, max: 800, warningLow: 250, warningHigh: 700 },
      argonPressure: { current: 0.45, unit: 'MPa', min: 0.3, max: 0.8, warningLow: 0.35, warningHigh: 0.7 },
      heatNumber: 'H2401150086',
      steelGrade: 'Q235B',
      pourCount: 0,
      serviceLife: 45,
      maxServiceLife: 80,
    },
    'ladle-002': {
      steelTemp: { current: 1628, unit: '°C', min: 1500, max: 1650, warningLow: 1520, warningHigh: 1620, trend: 2.1 },
      shellTemp: { current: 338, unit: '°C', max: 350, warningHigh: 320, trend: 5.2 },
      bottomTemp: { current: 375, unit: '°C', max: 400, warningHigh: 360, trend: 3.8 },
      grossWeight: { current: 158.2, unit: 't' },
      steelWeight: { current: 135.6, unit: 't', min: 0, max: 150, trend: -0.5 },
      tiltAngle: { current: 15, unit: '°', min: -5, max: 90 },
      lidStatus: 'open',
      argonFlow: { current: 385, unit: 'L/min', min: 200, max: 800, warningLow: 250, warningHigh: 700 },
      argonPressure: { current: 0.42, unit: 'MPa', min: 0.3, max: 0.8, warningLow: 0.35, warningHigh: 0.7 },
      heatNumber: 'H2401150082',
      steelGrade: 'HRB400E',
      pourCount: 2,
      serviceLife: 72,
      maxServiceLife: 80,
    },
    'ladle-003': {
      steelTemp: { current: 1548, unit: '°C', min: 1500, max: 1650, warningLow: 1520, warningHigh: 1620 },
      shellTemp: { current: 156, unit: '°C', max: 350, warningHigh: 320 },
      bottomTemp: { current: 178, unit: '°C', max: 400, warningHigh: 360 },
      grossWeight: { current: 23.5, unit: 't' },
      steelWeight: { current: 0, unit: 't', min: 0, max: 150 },
      tiltAngle: { current: 0, unit: '°', min: -5, max: 90 },
      lidStatus: 'closed',
      argonFlow: { current: 0, unit: 'L/min', min: 200, max: 800, warningLow: 250, warningHigh: 700 },
      argonPressure: { current: 0, unit: 'MPa', min: 0.3, max: 0.8, warningLow: 0.35, warningHigh: 0.7 },
      heatNumber: '-',
      steelGrade: '-',
      pourCount: 0,
      serviceLife: 28,
      maxServiceLife: 80,
    },
  };

  return metricsMap[ladleId] || metricsMap['ladle-001'];
}

// 获取告警信息
export function getAlarms(instanceId: string): AlarmInfo[] {
  const alarmsMap: Record<string, AlarmInfo[]> = {
    'ladle-002': [
      {
        id: 'alarm-001',
        level: 'warning',
        message: '钢水温度接近上限',
        metric: '钢水温度',
        value: 1628,
        threshold: 1620,
        time: '14:28:15',
        acknowledged: false,
      },
      {
        id: 'alarm-002',
        level: 'warning',
        message: '包壳温度超过预警值',
        metric: '包壳温度',
        value: 338,
        threshold: 320,
        time: '14:25:42',
        acknowledged: false,
      },
      {
        id: 'alarm-003',
        level: 'critical',
        message: '使用寿命即将达到上限',
        metric: '使用次数',
        value: 72,
        threshold: 80,
        time: '14:20:00',
        acknowledged: true,
      },
    ],
    'caster-002': [
      {
        id: 'alarm-004',
        level: 'critical',
        message: '结晶器水流量异常',
        metric: '冷却水流量',
        value: 85,
        threshold: 120,
        time: '14:28:00',
        acknowledged: false,
      },
    ],
  };

  return alarmsMap[instanceId] || [];
}

export const documentAlarmPageRecords: AlarmPageRecord[] = [
  {
    id: 3,
    eventId: '2069940622583791701',
    alarmId: '2069940622583791701',
    eventTimeStamp: '2026-06-30 08:27:56',
    devId: '2065240851560869980',
    channelName: '11_1',
    num: 2,
    ruleType: '高温大于',
    level: '1',
    avgTemp: 28.9,
    minTemp: 27.7,
    maxTemp: 44.1,
    thresholdTemp: 40.0,
    locationName: '位置3',
    isRead: 1,
    processor: '张三',
    processContent: '已现场排查，恢复正常',
    processTime: '2026-07-01 06:03:24',
  },
];

/**
 * Local-only alarm fixture used when the frontend runs in Mock mode (or uses
 * Mock as a fallback). Keep the documented one-row response above intact: it
 * is a contract example, whereas this data lets the UI exercise paging,
 * filtering, unread states, and the region charts with realistic volume.
 */
const mockAlarmSeeds = [
  ['位置3', '11_1', '高温大于', '2', 41.8, 39.6, 58.4, 48.0, 0],
  ['位置1', '03_2', '温度波动异常', '1', 35.7, 31.8, 45.2, 42.0, 0],
  ['位置2', '07_1', '高温大于', '2', 46.1, 43.5, 62.8, 55.0, 0],
  ['位置4', '14_1', '低温小于', '1', 22.8, 16.9, 29.4, 20.0, 1],
  ['位置5', '06_3', '温度波动异常', '1', 37.2, 29.8, 47.5, 15.0, 0],
  ['位置1', '02_1', '高温大于', '1', 38.4, 34.2, 49.3, 45.0, 1],
  ['位置3', '12_2', '低温小于', '2', 19.7, 13.8, 26.6, 18.0, 0],
  ['位置2', '09_1', '高温大于', '1', 42.5, 38.6, 51.7, 50.0, 1],
  ['位置4', '15_2', '温度波动异常', '2', 33.1, 24.6, 54.9, 20.0, 0],
  ['位置5', '08_1', '高温大于', '1', 40.3, 36.4, 46.8, 44.0, 1],
  ['位置1', '05_2', '低温小于', '1', 24.6, 18.7, 31.5, 22.0, 0],
  ['位置3', '10_1', '高温大于', '2', 48.2, 44.8, 66.3, 58.0, 1],
  ['位置2', '04_3', '温度波动异常', '1', 34.9, 27.5, 48.1, 18.0, 0],
  ['位置4', '16_1', '高温大于', '1', 39.8, 35.4, 47.9, 46.0, 1],
  ['位置5', '01_2', '低温小于', '2', 18.9, 12.6, 25.8, 17.0, 0],
  ['位置1', '13_1', '高温大于', '1', 43.6, 40.1, 53.2, 51.0, 1],
  ['位置3', '11_2', '温度波动异常', '1', 36.4, 28.9, 49.6, 19.0, 0],
  ['位置2', '07_2', '低温小于', '1', 23.5, 17.2, 30.4, 21.0, 1],
  ['位置4', '14_2', '高温大于', '2', 45.9, 41.6, 61.5, 54.0, 0],
  ['位置5', '06_1', '温度波动异常', '1', 32.7, 25.1, 43.8, 16.0, 1],
] as const satisfies ReadonlyArray<readonly [string, string, string, AlarmPageRecord['level'], number, number, number, number, AlarmPageRecord['isRead']]>;

export const mockAlarmPageRecords: AlarmPageRecord[] = mockAlarmSeeds.map((seed, index) => {
  const [locationName, channelName, ruleType, level, avgTemp, minTemp, maxTemp, thresholdTemp, isRead] = seed;
  const sequence = String(index + 1).padStart(2, '0');
  const seconds = String(55 - index * 2).padStart(2, '0');
  const eventTimeStamp = `2026-06-30 08:27:${seconds}`;
  const isProcessed = isRead === 1;

  return {
    id: 100 + index,
    eventId: `mock-alarm-20260630-${sequence}`,
    alarmId: `mock-alarm-20260630-${sequence}`,
    eventTimeStamp,
    devId: `mock-device-${String((index % 5) + 1).padStart(2, '0')}`,
    channelName,
    num: (index % 4) + 1,
    ruleType,
    level,
    avgTemp,
    minTemp,
    maxTemp,
    thresholdTemp,
    locationName,
    isRead,
    processor: isProcessed ? ['张三', '李四', '王五'][index % 3] : null,
    processContent: isProcessed ? '已现场复核，设备运行正常' : null,
    processTime: isProcessed ? `2026-06-30 08:${String(28 + (index % 12)).padStart(2, '0')}:00` : null,
  };
});

const createSuccessResponse = <T,>(data: T): ApiSuccessResponse<T> => ({
  msg: '操作成功',
  code: 200,
  data,
});

export const documentAlarmLocationStats: AlarmLocationStat[] = [
  {
    locationName: '位置3',
    alarmCount: 1,
    unreadCount: 0,
    maxTemp: 44.1,
    minTemp: 27.7,
  },
  {
    locationName: '位置1',
    alarmCount: 1,
    unreadCount: 0,
    maxTemp: 54.1,
    minTemp: 37.7,
  },
];

export const alarmPageLocationNames = ['位置1', '位置3'];

// The sheet's sample request filters 位置1, while the sample row itself is 位置3.
// Keep this exact request mapped to the documented response instead of inventing a correction.
const documentAlarmPageExampleQuery: Required<AlarmPageQuery> = {
  pageNum: 1,
  pageSize: 10,
  locationName: '位置1',
  isRead: 1,
  level: '1',
  startTime: '2026-06-25 08:26:56',
  endTime: '2026-06-30 08:27:56',
};

const matchesDocumentAlarmPageExample = (query: AlarmPageQuery) => {
  return (
    query.pageNum === documentAlarmPageExampleQuery.pageNum &&
    query.pageSize === documentAlarmPageExampleQuery.pageSize &&
    query.locationName === documentAlarmPageExampleQuery.locationName &&
    query.isRead === documentAlarmPageExampleQuery.isRead &&
    query.level === documentAlarmPageExampleQuery.level &&
    query.startTime === documentAlarmPageExampleQuery.startTime &&
    query.endTime === documentAlarmPageExampleQuery.endTime
  );
};

export function queryAlarmPage(query: AlarmPageQuery): AlarmPageData {
  if (matchesDocumentAlarmPageExample(query)) {
    return {
      total: 1,
      list: documentAlarmPageRecords.map((record) => ({ ...record })),
    };
  }

  const filtered = mockAlarmPageRecords.filter((record) => {
    if (query.locationName && record.locationName !== query.locationName) return false;
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

  return {
    total: filtered.length,
    list: filtered.slice(start, start + pageSize),
  };
}

export function queryAlarmPageApi(query: AlarmPageQuery): ApiSuccessResponse<AlarmPageData> {
  return createSuccessResponse(queryAlarmPage(query));
}

export function buildAlarmPageApiPath(query: AlarmPageQuery) {
  const params = new URLSearchParams({
    pageNum: String(query.pageNum),
    pageSize: String(query.pageSize),
  });

  if (query.locationName) params.set('locationName', query.locationName);
  if (query.isRead !== undefined) params.set('isRead', String(query.isRead));
  if (query.level) params.set('level', query.level);
  if (query.startTime) params.set('startTime', query.startTime);
  if (query.endTime) params.set('endTime', query.endTime);

  return `/alarm/page?${params.toString()}`;
}

const formatProcessTime = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(' ');
};

const applyAlarmBatchProcess = (
  records: AlarmPageRecord[],
  request: AlarmBatchProcessRequest,
  processTime: string,
) => {
  const eventIds = new Set(request.eventIds);
  records.forEach((record) => {
    if (!eventIds.has(record.eventId)) return;
    record.isRead = 1;
    record.processor = request.processor;
    record.processContent = request.processContent;
    record.processTime = processTime;
  });
};

/** Local mock for POST /alarm/batch-process — mirrors the sheet contract. */
export function processAlarmBatch(request: AlarmBatchProcessRequest): boolean {
  const eventIds = request.eventIds.map((id) => id.trim()).filter(Boolean);
  const processor = request.processor.trim();
  const processContent = request.processContent.trim();

  if (eventIds.length === 0) throw new Error('eventIds 不能为空');
  if (!processor) throw new Error('处理人不能为空');
  if (!processContent) throw new Error('处理内容不能为空');

  const normalized: AlarmBatchProcessRequest = { eventIds, processor, processContent };
  const processTime = formatProcessTime();
  applyAlarmBatchProcess(mockAlarmPageRecords, normalized, processTime);
  applyAlarmBatchProcess(documentAlarmPageRecords, normalized, processTime);
  return true;
}

export function processAlarmBatchApi(request: AlarmBatchProcessRequest): ApiSuccessResponse<boolean> {
  return createSuccessResponse(processAlarmBatch(request));
}

export function buildAlarmBatchProcessApiPath() {
  return '/alarm/batch-process';
}

export function queryAlarmStatsByLocation(query: AlarmLocationStatQuery): AlarmLocationStat[] {
  const recordsInRange = mockAlarmPageRecords.filter((record) => {
    if (query.startTime && record.eventTimeStamp < query.startTime) return false;
    if (query.endTime && record.eventTimeStamp > query.endTime) return false;
    return true;
  });

  return Array.from(
    recordsInRange.reduce((stats, record) => {
      const current = stats.get(record.locationName) ?? {
        locationName: record.locationName,
        alarmCount: 0,
        unreadCount: 0,
        maxTemp: Number.NEGATIVE_INFINITY,
        minTemp: Number.POSITIVE_INFINITY,
      };

      current.alarmCount += 1;
      current.unreadCount += record.isRead === 0 ? 1 : 0;
      current.maxTemp = Math.max(current.maxTemp, record.maxTemp);
      current.minTemp = Math.min(current.minTemp, record.minTemp);
      stats.set(record.locationName, current);
      return stats;
    }, new Map<string, AlarmLocationStat>()).values()
  )
    .map((stat) => ({
      ...stat,
      maxTemp: Number.isFinite(stat.maxTemp) ? stat.maxTemp : 0,
      minTemp: Number.isFinite(stat.minTemp) ? stat.minTemp : 0,
    }))
    .sort((left, right) => left.locationName.localeCompare(right.locationName, 'zh-CN'));
}

export function queryAlarmStatsByLocationApi(query: AlarmLocationStatQuery): ApiSuccessResponse<AlarmLocationStat[]> {
  return createSuccessResponse(queryAlarmStatsByLocation(query));
}

export function buildAlarmLocationStatApiPath(query: AlarmLocationStatQuery) {
  const params = new URLSearchParams();

  if (query.startTime) params.set('startTime', query.startTime);
  if (query.endTime) params.set('endTime', query.endTime);

  return `/alarm/stat-by-location?${params.toString()}`;
}

// 模拟铁水液位检测数据 - 每个出铁场有2个出铁口
export function getIronLevelMetrics(instanceId: string): { tap1: IronLevelMetrics; tap2: IronLevelMetrics } {
  const metricsMap: Record<string, { tap1: IronLevelMetrics; tap2: IronLevelMetrics }> = {
    'ladle-001': {
      tap1: {
        levelHeight: { current: 425, unit: 'mm', min: 100, max: 800, warningLow: 150, warningHigh: 700 },
        levelStatus: 'normal',
        tempSurface: { current: 1485, unit: '℃', min: 1300, max: 1550, warningLow: 1350, warningHigh: 1520, trend: 0.8 },
        weightCalculated: { current: 98.5, unit: 't', min: 0, max: 120, warningHigh: 110, trend: 1.2 },
        crustingArea: { current: 12, unit: '%', min: 0, max: 100, warningHigh: 30 },
        levelThresholdHigh: 700,
        levelThresholdLow: 150,
        alarmTime: null,
        ladleId: 'TL-2401-0086',
        tapHole: 1,
      },
      tap2: {
        levelHeight: { current: 382, unit: 'mm', min: 100, max: 800, warningLow: 150, warningHigh: 700, trend: -1.5 },
        levelStatus: 'normal',
        tempSurface: { current: 1462, unit: '℃', min: 1300, max: 1550, warningLow: 1350, warningHigh: 1520 },
        weightCalculated: { current: 85.2, unit: 't', min: 0, max: 120, warningHigh: 110 },
        crustingArea: { current: 8, unit: '%', min: 0, max: 100, warningHigh: 30 },
        levelThresholdHigh: 700,
        levelThresholdLow: 150,
        alarmTime: null,
        ladleId: 'TL-2401-0087',
        tapHole: 2,
      },
    },
    'ladle-002': {
      tap1: {
        levelHeight: { current: 685, unit: 'mm', min: 100, max: 800, warningLow: 150, warningHigh: 700, trend: 3.2 },
        levelStatus: 'high',
        tempSurface: { current: 1528, unit: '℃', min: 1300, max: 1550, warningLow: 1350, warningHigh: 1520, trend: 1.5 },
        weightCalculated: { current: 112.8, unit: 't', min: 0, max: 120, warningHigh: 110, trend: 2.1 },
        crustingArea: { current: 35, unit: '%', min: 0, max: 100, warningHigh: 30, trend: 5.0 },
        levelThresholdHigh: 700,
        levelThresholdLow: 150,
        alarmTime: '14:25:30',
        ladleId: 'TL-2401-0092',
        tapHole: 1,
      },
      tap2: {
        levelHeight: { current: 135, unit: 'mm', min: 100, max: 800, warningLow: 150, warningHigh: 700, trend: -4.2 },
        levelStatus: 'low',
        tempSurface: { current: 1378, unit: '℃', min: 1300, max: 1550, warningLow: 1350, warningHigh: 1520 },
        weightCalculated: { current: 22.5, unit: 't', min: 0, max: 120, warningHigh: 110 },
        crustingArea: { current: 5, unit: '%', min: 0, max: 100, warningHigh: 30 },
        levelThresholdHigh: 700,
        levelThresholdLow: 150,
        alarmTime: '14:22:10',
        ladleId: 'TL-2401-0093',
        tapHole: 2,
      },
    },
    'ladle-003': {
      tap1: {
        levelHeight: { current: 520, unit: 'mm', min: 100, max: 800, warningLow: 150, warningHigh: 700 },
        levelStatus: 'normal',
        tempSurface: { current: 1450, unit: '℃', min: 1300, max: 1550, warningLow: 1350, warningHigh: 1520 },
        weightCalculated: { current: 78.3, unit: 't', min: 0, max: 120, warningHigh: 110 },
        crustingArea: { current: 6, unit: '%', min: 0, max: 100, warningHigh: 30 },
        levelThresholdHigh: 700,
        levelThresholdLow: 150,
        alarmTime: null,
        ladleId: 'TL-2401-0088',
        tapHole: 1,
      },
      tap2: {
        levelHeight: { current: 480, unit: 'mm', min: 100, max: 800, warningLow: 150, warningHigh: 700 },
        levelStatus: 'normal',
        tempSurface: { current: 1445, unit: '℃', min: 1300, max: 1550, warningLow: 1350, warningHigh: 1520 },
        weightCalculated: { current: 72.1, unit: 't', min: 0, max: 120, warningHigh: 110 },
        crustingArea: { current: 9, unit: '%', min: 0, max: 100, warningHigh: 30 },
        levelThresholdHigh: 700,
        levelThresholdLow: 150,
        alarmTime: null,
        ladleId: 'TL-2401-0089',
        tapHole: 2,
      },
    },
    'ladle-004': {
      tap1: {
        levelHeight: { current: 310, unit: 'mm', min: 100, max: 800, warningLow: 150, warningHigh: 700 },
        levelStatus: 'normal',
        tempSurface: { current: 1380, unit: '℃', min: 1300, max: 1550, warningLow: 1350, warningHigh: 1520 },
        weightCalculated: { current: 45.0, unit: 't', min: 0, max: 120, warningHigh: 110 },
        crustingArea: { current: 3, unit: '%', min: 0, max: 100, warningHigh: 30 },
        levelThresholdHigh: 700,
        levelThresholdLow: 150,
        alarmTime: null,
        ladleId: 'TL-2401-0090',
        tapHole: 1,
      },
      tap2: {
        levelHeight: { current: 290, unit: 'mm', min: 100, max: 800, warningLow: 150, warningHigh: 700 },
        levelStatus: 'normal',
        tempSurface: { current: 1365, unit: '℃', min: 1300, max: 1550, warningLow: 1350, warningHigh: 1520 },
        weightCalculated: { current: 38.6, unit: 't', min: 0, max: 120, warningHigh: 110 },
        crustingArea: { current: 4, unit: '%', min: 0, max: 100, warningHigh: 30 },
        levelThresholdHigh: 700,
        levelThresholdLow: 150,
        alarmTime: null,
        ladleId: 'TL-2401-0091',
        tapHole: 2,
      },
    },
  };

  return metricsMap[instanceId] || metricsMap['ladle-001'];
}

// 获取铁水液位检测告警
export function getIronLevelAlarms(instanceId: string): AlarmInfo[] {
  const alarmsMap: Record<string, AlarmInfo[]> = {
    'ladle-002': [
      {
        id: 'il-alarm-001',
        level: 'warning',
        message: '1号出铁口液位偏高',
        metric: '液位高度',
        value: 685,
        threshold: 700,
        time: '14:25:30',
        acknowledged: false,
      },
      {
        id: 'il-alarm-002',
        level: 'critical',
        message: '1号出铁口结壳面积超标',
        metric: '结壳面积',
        value: 35,
        threshold: 30,
        time: '14:26:15',
        acknowledged: false,
      },
      {
        id: 'il-alarm-003',
        level: 'warning',
        message: '2号出铁口液位偏低',
        metric: '液位高度',
        value: 135,
        threshold: 150,
        time: '14:22:10',
        acknowledged: false,
      },
      {
        id: 'il-alarm-004',
        level: 'warning',
        message: '1号出铁口温度接近上限',
        metric: '铁水温度',
        value: 1528,
        threshold: 1520,
        time: '14:24:00',
        acknowledged: true,
      },
    ],
  };

  return alarmsMap[instanceId] || [];
}

// 铁水沟数字孪生模拟数据
export function getHotMetalTroughMetrics(instanceId: string): HotMetalTroughMetrics {
  const metricsMap: Record<string, HotMetalTroughMetrics> = {
    'trough-001': {
      ironLevel: { current: 420, unit: 'mm', min: 100, max: 600, warningLow: 150, warningHigh: 520 },
      ironTemp: { current: 1485, unit: '°C', min: 1350, max: 1550, warningHigh: 1520 },
      flowRate: { current: 3.2, unit: 't/min', min: 0, max: 8, warningHigh: 6.5 },
      trenchTemp: { current: 865, unit: '°C', max: 1100, warningHigh: 980 },
      status: 'normal',
    },
    'trough-sim-001': {
      ironLevel: { current: 438, unit: 'mm', min: 100, max: 600, warningLow: 150, warningHigh: 520, trend: 1.8 },
      ironTemp: { current: 1498, unit: '°C', min: 1350, max: 1550, warningHigh: 1520, trend: 0.9 },
      flowRate: { current: 3.6, unit: 't/min', min: 0, max: 8, warningHigh: 6.5, trend: 3.1 },
      trenchTemp: { current: 902, unit: '°C', max: 1100, warningHigh: 980, trend: 1.4 },
      status: 'normal',
    },
  };
  return metricsMap[instanceId] || metricsMap['trough-001'];
}

// 根据设备类型获取模板
export function getTemplateByDeviceType(deviceType: DeviceType): TemplateConfig | undefined {
  const deviceConfig = deviceTypes.find((d) => d.id === deviceType);
  if (!deviceConfig) return undefined;
  return templates.find((t) => t.id === deviceConfig.templateId);
}

// 根据WinCC实例获取模板
export function getTemplateByWinCC(wincc: WinCCInstance): TemplateConfig | undefined {
  return getTemplateByDeviceType(wincc.deviceType);
}

// 按设备类型分组WinCC实例
export function groupWinCCByDeviceType(): Record<DeviceType, WinCCInstance[]> {
  const grouped: Record<string, WinCCInstance[]> = {};
  for (const instance of winccInstances) {
    if (!grouped[instance.deviceType]) {
      grouped[instance.deviceType] = [];
    }
    grouped[instance.deviceType].push(instance);
  }
  return grouped as Record<DeviceType, WinCCInstance[]>;
}

// 获取设备类型配置
export function getDeviceTypeConfig(deviceType: DeviceType): DeviceTypeConfig | undefined {
  return deviceTypes.find((d) => d.id === deviceType);
}

// 液位趋势数据点
export interface TrendDataPoint {
  time: string;       // HH:mm:ss 格式
  timestamp: number;  // 用于排序
  value: number;      // 液位高度 mm
}

// 生成模拟液位趋势数据（最近30分钟，每30秒一个数据点）
export function getIronLevelTrend(instanceId: string): { tap1: TrendDataPoint[]; tap2: TrendDataPoint[] } {
  const metrics = getIronLevelMetrics(instanceId);
  const now = new Date();
  const points = 60; // 30分钟，每30秒一个点

  function generateTrend(baseValue: number, trend: number | undefined, seed: number): TrendDataPoint[] {
    const data: TrendDataPoint[] = [];
    const trendRate = trend || 0;
    for (let i = 0; i < points; i++) {
      const t = new Date(now.getTime() - (points - 1 - i) * 30000);
      // 模拟从历史到当前的渐变 + 随机波动
      const progress = i / (points - 1);
      const historicalBase = baseValue - trendRate * 30; // 30分钟前的估算值
      const value = historicalBase + (baseValue - historicalBase) * progress
        + Math.sin(i * 0.5 + seed) * 8  // 周期性波动
        + (Math.sin(i * 1.3 + seed * 2) * 4); // 次要波动
      data.push({
        time: t.toLocaleTimeString('zh-CN', { hour12: false }),
        timestamp: t.getTime(),
        value: Math.round(Math.max(50, Math.min(780, value))),
      });
    }
    return data;
  }

  return {
    tap1: generateTrend(metrics.tap1.levelHeight.current, metrics.tap1.levelHeight.trend, 1),
    tap2: generateTrend(metrics.tap2.levelHeight.current, metrics.tap2.levelHeight.trend, 7),
  };
}

// 生成历史对比趋势数据（指定小时数之前的数据）
export function getIronLevelHistoryTrend(instanceId: string, hoursAgo: number): { tap1: TrendDataPoint[]; tap2: TrendDataPoint[] } {
  const metrics = getIronLevelMetrics(instanceId);
  const now = new Date();
  const baseTime = new Date(now.getTime() - hoursAgo * 3600000);
  const points = 60;

  function generateHistoryTrend(baseValue: number, seed: number): TrendDataPoint[] {
    const data: TrendDataPoint[] = [];
    // 历史数据围绕一个偏移的基准值波动
    const historyBase = baseValue * (0.85 + Math.sin(seed + hoursAgo) * 0.1);
    for (let i = 0; i < points; i++) {
      const t = new Date(baseTime.getTime() - (points - 1 - i) * 30000);
      const value = historyBase
        + Math.sin(i * 0.4 + seed * 3) * 15
        + Math.sin(i * 1.1 + seed) * 8
        + (i / points) * 20;
      data.push({
        time: t.toLocaleTimeString('zh-CN', { hour12: false }),
        timestamp: t.getTime(),
        value: Math.round(Math.max(50, Math.min(780, value))),
      });
    }
    return data;
  }

  return {
    tap1: generateHistoryTrend(metrics.tap1.levelHeight.current, 1),
    tap2: generateHistoryTrend(metrics.tap2.levelHeight.current, 7),
  };
}

/**
 * 铁水沟数字孪生 16 个监控点。
 * 与服务端对照只用 locationId（loc_1～loc_16）。locationName 是初始显示名，
 * 推送里若带了新名称，画面改用推送名称。
 */
export interface TroughMonitorPoint {
  locationId: string;
  locationName: string;
  row: number;
  side: '左侧' | '右侧';
  depth: '前' | '后' | null;
}

export const TROUGH_MONITOR_POINTS: readonly TroughMonitorPoint[] = [
  { locationId: 'loc_7', locationName: '第一排左侧', row: 1, side: '左侧', depth: null },
  { locationId: 'loc_8', locationName: '第一排右侧', row: 1, side: '右侧', depth: null },
  { locationId: 'loc_12', locationName: '第二排左侧', row: 2, side: '左侧', depth: null },
  { locationId: 'loc_13', locationName: '第二排右侧', row: 2, side: '右侧', depth: null },
  { locationId: 'loc_9', locationName: '第三排左侧', row: 3, side: '左侧', depth: null },
  { locationId: 'loc_10', locationName: '第三排右侧', row: 3, side: '右侧', depth: null },
  { locationId: 'loc_11', locationName: '第四排左侧', row: 4, side: '左侧', depth: null },
  { locationId: 'loc_16', locationName: '第四排右侧', row: 4, side: '右侧', depth: null },
  { locationId: 'loc_14', locationName: '第五排左侧', row: 5, side: '左侧', depth: null },
  { locationId: 'loc_15', locationName: '第五排右侧', row: 5, side: '右侧', depth: null },
  { locationId: 'loc_2', locationName: '第六排左侧前', row: 6, side: '左侧', depth: '前' },
  { locationId: 'loc_1', locationName: '第六排左侧后', row: 6, side: '左侧', depth: '后' },
  { locationId: 'loc_5', locationName: '第六排右侧前', row: 6, side: '右侧', depth: '前' },
  { locationId: 'loc_3', locationName: '第六排右侧后', row: 6, side: '右侧', depth: '后' },
  { locationId: 'loc_4', locationName: '第七排左侧', row: 7, side: '左侧', depth: null },
  { locationId: 'loc_6', locationName: '第七排右侧', row: 7, side: '右侧', depth: null },
];

const pointsById = new Map(TROUGH_MONITOR_POINTS.map((point) => [point.locationId, point]));

export function normalizeTroughLocationId(locationId: string) {
  return locationId.trim().toLowerCase().replace(/^loc_0+/, 'loc_');
}

export function getTroughMonitorPoint(locationId?: string | null) {
  if (!locationId) return null;
  return pointsById.get(normalizeTroughLocationId(locationId)) ?? null;
}

interface TroughLocationRef {
  locationId: string;
  locationName: string;
}

/** 告警目前仍只带显示名。先对初始名称，再对已经改名的实时点。 */
export function resolveTroughAlarmLocationId(
  locationName: string | null | undefined,
  livePoints: readonly TroughLocationRef[] = [],
) {
  const name = locationName?.trim() ?? '';
  if (!name) return '';

  const catalogPoint = TROUGH_MONITOR_POINTS.find((point) => point.locationName === name);
  if (catalogPoint) return catalogPoint.locationId;

  const livePoint = livePoints.find((point) => point.locationName.trim() === name);
  return getTroughMonitorPoint(livePoint?.locationId)?.locationId ?? '';
}

/**
 * 东华中间包 13 个监控点。
 * 与服务端对照只用 locationId（loc_1～loc_13）。locationName 是初始显示名，
 * 推送里若带了新名称，画面改用推送名称。
 * 三维位置不写在这里，由场景按模型上表面均匀采样。
 */
export interface TroughMonitorPoint {
  locationId: string;
  locationName: string;
}

export const TROUGH_MONITOR_POINTS: readonly TroughMonitorPoint[] = Array.from({ length: 13 }, (_, index) => {
  const number = index + 1;
  return {
    locationId: `loc_${number}`,
    locationName: `测点 ${String(number).padStart(2, '0')}`,
  };
});

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

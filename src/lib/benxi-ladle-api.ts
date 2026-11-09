import {
  getMockLadleReportDetail,
  getMockLadleReportRows,
  getMockRadarScans,
} from '@/data/benxi-ladle-mock';
import { buildApiUrl, canUseMockData, isMockOnly, unwrapApiData } from '@/lib/api-config';
import { generateDepthField, synthesizeSlagPoints } from '@/lib/slag-analysis';
import type { LadleReportDetail, LadleReportRow, RadarScan } from '@/types/benxi-ladle';

export type DataSourceStatus = 'mock' | 'success' | 'fallback' | 'error';

export interface DataResult<T> {
  data: T;
  status: DataSourceStatus;
  message?: string;
}

/** Java 侧报表 / 雷达检测接口（约定中，路径与字段以后端最终文档为准）。 */
export const benxiApiPaths = {
  reportList: '/ladle-report/list',
  reportDetail: '/ladle-report/detail',
  radarScans: '/radar-scan/list',
};

async function requestJson(path: string, params?: Record<string, string | number | undefined>) {
  const response = await fetch(buildApiUrl(path, params), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return unwrapApiData(await response.json() as unknown);
}

async function withFallback<T>(load: () => Promise<T>, mock: () => T, empty: T): Promise<DataResult<T>> {
  if (isMockOnly) return { data: mock(), status: 'mock' };
  try {
    return { data: await load(), status: 'success' };
  } catch {
    if (canUseMockData) return { data: mock(), status: 'fallback', message: '接口异常，已展示备用数据' };
    return { data: empty, status: 'error', message: '加载失败，请稍后重试' };
  }
}

export function fetchLadleReportRows() {
  return withFallback(
    async () => {
      const data = await requestJson(benxiApiPaths.reportList);
      if (!Array.isArray(data)) throw new Error('invalid payload');
      return data as LadleReportRow[];
    },
    getMockLadleReportRows,
    [] as LadleReportRow[],
  );
}

export function fetchLadleReportDetail(ladleNo: string, campaignNo?: number) {
  return withFallback<LadleReportDetail | null>(
    async () => {
      const data = await requestJson(benxiApiPaths.reportDetail, { ladleNo, campaignNo });
      if (!data || typeof data !== 'object') throw new Error('invalid payload');
      return data as LadleReportDetail;
    },
    () => getMockLadleReportDetail(ladleNo, campaignNo),
    null,
  );
}

export function fetchRadarScans(ladleNo: string) {
  return withFallback(
    async () => {
      const data = await requestJson(benxiApiPaths.radarScans, { ladleNo });
      if (!Array.isArray(data)) throw new Error('invalid payload');
      return data as RadarScan[];
    },
    () => getMockRadarScans(ladleNo),
    [] as RadarScan[],
  );
}

/**
 * 取一次雷达检测的点云坐标（mm）。真实环境加载 Python 服务落盘的 PCD；
 * 演示模式由深度场合成同构点云，后续分析流程完全一致。
 */
export async function loadScanPoints(scan: RadarScan, onProgress?: (ratio: number) => void): Promise<Float32Array> {
  if (scan.pcdUrl && !isMockOnly) {
    const { PCDLoader } = await import('three/examples/jsm/loaders/PCDLoader.js');
    const loader = new PCDLoader();
    const points = await loader.loadAsync(scan.pcdUrl, (event) => {
      if (event.total) onProgress?.(event.loaded / event.total);
    });
    const position = points.geometry.getAttribute('position');
    return new Float32Array(position.array as ArrayLike<number>);
  }
  onProgress?.(1);
  return synthesizeSlagPoints(generateDepthField(scan.seed, scan.maxDepth, scan.seq), scan.seed + scan.seq);
}

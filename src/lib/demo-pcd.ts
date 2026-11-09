/**
 * 演示模式的三维显示点云：一份真实雷达 PCD（ASCII，xyz，单位 mm，轴线沿 z）。
 * 侵蚀数值仍来自与 Excel 对齐的 Mock 深度场，仅三维外观使用真实扫描。
 */
export const DEMO_PCD_URL = '/pointclouds/Img3d_20260526-134208807.pcd';

export interface DisplayCloudGeometry {
  /** 筒壁轴线在 xy 平面的位置（mm） */
  centerX: number;
  centerY: number;
  radiusMm: number;
  /** 判定为筒壁点的径向容差（mm） */
  wallToleranceMm: number;
  /** 筒壁 z 范围（mm），较大的 z 为开口端 */
  wallBottomZ: number;
  wallTopZ: number;
}

/** 由该文件实测：Kåsa 圆拟合 + 径向直方图 + z 分位数 */
export const demoPcdGeometry: DisplayCloudGeometry = {
  centerX: 6.25,
  centerY: -0.1,
  radiusMm: 154.4,
  wallToleranceMm: 22,
  wallBottomZ: -591,
  wallTopZ: -323,
};

/** 传感器近处的无效重复点（约 225 万个，集中在 z > -100 的小块区域） */
const NEAR_SENSOR_Z = -100;
/** 只保留筒体周边：筒口法兰、桶底，去掉远处地面与杂物 */
const KEEP_RADIUS_FACTOR = 1.8;
const KEEP_BELOW_MM = 110;
const KEEP_ABOVE_MM = 70;

export interface DisplayCloud {
  positions: Float32Array;
  geometry: DisplayCloudGeometry;
  sourcePointCount: number;
  label: string;
}

let demoCloudPromise: Promise<DisplayCloud> | null = null;

export function loadDemoDisplayCloud(): Promise<DisplayCloud> {
  if (!demoCloudPromise) {
    demoCloudPromise = (async () => {
      const { PCDLoader } = await import('three/examples/jsm/loaders/PCDLoader.js');
      const points = await new PCDLoader().loadAsync(DEMO_PCD_URL);
      const source = points.geometry.getAttribute('position').array as Float32Array;
      const sourcePointCount = source.length / 3;
      const g = demoPcdGeometry;
      const kept = new Float32Array(source.length);
      let count = 0;
      for (let index = 0; index < sourcePointCount; index += 1) {
        const z = source[index * 3 + 2];
        if (z > NEAR_SENSOR_Z) continue;
        if (z < g.wallBottomZ - KEEP_BELOW_MM || z > g.wallTopZ + KEEP_ABOVE_MM) continue;
        const r = Math.hypot(source[index * 3] - g.centerX, source[index * 3 + 1] - g.centerY);
        if (r > g.radiusMm * KEEP_RADIUS_FACTOR) continue;
        kept[count * 3] = source[index * 3];
        kept[count * 3 + 1] = source[index * 3 + 1];
        kept[count * 3 + 2] = z;
        count += 1;
      }
      points.geometry.dispose();
      return {
        positions: kept.slice(0, count * 3),
        geometry: demoPcdGeometry,
        sourcePointCount,
        label: DEMO_PCD_URL.split('/').pop() ?? 'demo.pcd',
      };
    })().catch((error: unknown) => {
      demoCloudPromise = null;
      throw error;
    });
  }
  return demoCloudPromise;
}

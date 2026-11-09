'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';

/** 本地能力边界测试：全量 ASCII PCD（约 89MB / 282 万点） */
export const LOCAL_FULL_PCD_URL = '/pointclouds/Img3d_20260526-134208807.pcd';

const BENCH_LEVELS = [100_000, 300_000, 500_000, 1_000_000, 1_500_000, 2_000_000];
const BENCH_DPRS: Dpr[] = [1, 1.5, 2];
const BENCH_WARMUP_MS = 1200;
const BENCH_MEASURE_MS = 3000;

type LoadState =
  | { status: 'loading'; progress: number; loaded: number; total: number; phase: 'download' | 'parse' }
  | { status: 'ready'; pointCount: number; elapsedMs: number }
  | { status: 'error'; message: string };

interface FpsSample {
  fps: number;
  frameMs: number;
  bufferWidth: number;
  bufferHeight: number;
}

interface BenchResult {
  dpr: Dpr;
  points: number;
  avgFps: number;
  minFps: number;
  frameMs: number;
  bufferWidth: number;
  bufferHeight: number;
}

type Dpr = 1 | 1.5 | 2;

function formatBytes(loaded: number, total: number) {
  const toMb = (value: number) => `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (!total) return toMb(loaded);
  return `${toMb(loaded)} / ${toMb(total)}`;
}

function formatPoints(points: number) {
  return points >= 1_000_000 ? `${(points / 1_000_000).toFixed(2)}M` : `${Math.round(points / 10_000)}万`;
}

function fpsColor(fps: number) {
  if (fps >= 50) return '#6ee7b7';
  if (fps >= 30) return '#fcd34d';
  return '#fca5a5';
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/** 打乱点序，使 drawRange 截取前 N 个点时是全局均匀抽样，而不是只截到扫描的某一段。 */
function shuffleGeometryPoints(geometry: THREE.BufferGeometry) {
  const attributes = Object.values(geometry.attributes) as THREE.BufferAttribute[];
  const count = geometry.getAttribute('position')?.count ?? 0;
  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    for (const attribute of attributes) {
      const size = attribute.itemSize;
      const array = attribute.array as Float32Array;
      for (let k = 0; k < size; k += 1) {
        const a = i * size + k;
        const b = j * size + k;
        const temp = array[a];
        array[a] = array[b];
        array[b] = temp;
      }
    }
  }
  for (const attribute of attributes) attribute.needsUpdate = true;
}

/**
 * 以各轴中位数作为旋转中心，按 2%–98% 分位范围估算视野半径。
 * 包围盒中心和包围盒尺寸会被零散离群点拉偏，导致旋转时点云绕空点甩动、相机被推得过远。
 */
function measureRobustExtent(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position');
  const count = position.count;
  const step = Math.max(1, Math.floor(count / 100_000));
  const axes: number[][] = [[], [], []];
  for (let index = 0; index < count; index += step) {
    axes[0].push(position.getX(index));
    axes[1].push(position.getY(index));
    axes[2].push(position.getZ(index));
  }
  const quantile = (sorted: number[], ratio: number) => sorted[Math.floor(ratio * (sorted.length - 1))];
  const center = new THREE.Vector3();
  const halfSize = new THREE.Vector3();
  axes.forEach((values, axis) => {
    const sorted = values.sort((a, b) => a - b);
    const median = quantile(sorted, 0.5);
    center.setComponent(axis, median);
    halfSize.setComponent(
      axis,
      Math.max(median - quantile(sorted, 0.02), quantile(sorted, 0.98) - median),
    );
  });
  return { center, radius: Math.max(halfSize.length(), 1) };
}

function FitCameraOnce({ points, radius }: { points: THREE.Points | null; radius: number }) {
  const get = useThree((state) => state.get);

  useEffect(() => {
    if (!points) return;
    const { camera, controls } = get();
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const distance = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2)) * 1.1;
    camera.position.copy(new THREE.Vector3(1, 0.75, 1).normalize().multiplyScalar(distance));
    camera.near = distance / 1000;
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    const orbit = controls as unknown as { target: THREE.Vector3; maxDistance: number; update: () => void } | null;
    if (orbit) {
      orbit.target.set(0, 0, 0);
      orbit.maxDistance = distance * 10;
      orbit.update();
    }
  }, [get, points, radius]);

  return null;
}

function FpsMeter({ onSample }: { onSample: (sample: FpsSample) => void }) {
  const accumulator = useRef({ frames: 0, start: 0 });
  const canvas = useThree((state) => state.gl.domElement);

  useFrame(() => {
    const now = performance.now();
    const current = accumulator.current;
    if (current.start === 0) {
      current.start = now;
      current.frames = 0;
      return;
    }
    current.frames += 1;
    const elapsed = now - current.start;
    if (elapsed >= 500) {
      onSample({
        fps: (current.frames * 1000) / elapsed,
        frameMs: elapsed / current.frames,
        bufferWidth: canvas.width,
        bufferHeight: canvas.height,
      });
      current.start = now;
      current.frames = 0;
    }
  });

  return null;
}

function PcdPoints({
  url,
  visibleCount,
  transparent,
  onStateChange,
}: {
  url: string;
  visibleCount: number | null;
  transparent: boolean;
  onStateChange: (state: LoadState) => void;
}) {
  const pointsRef = useRef<THREE.Points | null>(null);
  const [points, setPoints] = useState<THREE.Points | null>(null);
  const [fitRadius, setFitRadius] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    const loader = new PCDLoader();
    onStateChange({ status: 'loading', progress: 0, loaded: 0, total: 0, phase: 'download' });

    loader.load(
      url,
      (loaded) => {
        if (cancelled) {
          loaded.geometry.dispose();
          const material = loaded.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
          return;
        }

        const { center, radius } = measureRobustExtent(loaded.geometry);
        loaded.geometry.translate(-center.x, -center.y, -center.z);
        loaded.geometry.computeBoundingSphere();
        shuffleGeometryPoints(loaded.geometry);

        const material = loaded.material as THREE.PointsMaterial;
        material.size = 0.35;
        material.sizeAttenuation = true;
        material.color = new THREE.Color('#22d3ee');

        const pointCount = loaded.geometry.getAttribute('position')?.count ?? 0;
        pointsRef.current = loaded;
        setFitRadius(radius);
        setPoints(loaded);
        onStateChange({
          status: 'ready',
          pointCount,
          elapsedMs: Math.round(performance.now() - started),
        });
      },
      (event) => {
        if (cancelled) return;
        const progress = event.total ? event.loaded / event.total : 0;
        const downloadDone = Boolean(event.total) && event.loaded >= event.total;
        if (downloadDone) {
          // FileLoader 下载完成后会同步 parse ASCII，主线程可能卡几秒到几十秒
          onStateChange({
            status: 'loading',
            progress: 1,
            loaded: event.loaded,
            total: event.total,
            phase: 'parse',
          });
          return;
        }
        onStateChange({
          status: 'loading',
          progress,
          loaded: event.loaded,
          total: event.total,
          phase: 'download',
        });
      },
      (error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'PCD 加载失败';
        onStateChange({ status: 'error', message });
      },
    );

    return () => {
      cancelled = true;
      const current = pointsRef.current;
      pointsRef.current = null;
      setPoints(null);
      if (!current) return;
      current.geometry.dispose();
      const material = current.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
    };
  }, [url, onStateChange]);

  useEffect(() => {
    pointsRef.current?.geometry.setDrawRange(0, visibleCount ?? Infinity);
  }, [points, visibleCount]);

  useEffect(() => {
    const current = pointsRef.current;
    if (!current) return;
    const material = current.material as THREE.PointsMaterial;
    material.transparent = transparent;
    material.opacity = transparent ? 0.92 : 1;
    material.depthWrite = !transparent;
    material.needsUpdate = true;
  }, [points, transparent]);

  return (
    <>
      <FitCameraOnce points={points} radius={fitRadius} />
      {points ? <primitive object={points} /> : null}
    </>
  );
}

interface PointCloudPcdViewerProps {
  url?: string;
}

const panelStyle: CSSProperties = {
  padding: '8px 10px',
  border: '1px solid rgba(34, 211, 238, .22)',
  borderRadius: 5,
  background: 'rgba(3, 9, 16, .82)',
  color: 'rgba(202, 219, 237, .86)',
  font: '11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
};

const controlStyle: CSSProperties = {
  height: 22,
  padding: '0 6px',
  border: '1px solid rgba(151, 178, 210, .25)',
  borderRadius: 4,
  background: 'rgba(255, 255, 255, .04)',
  color: 'inherit',
  font: 'inherit',
};

export default function PointCloudPcdViewer({
  url = LOCAL_FULL_PCD_URL,
}: PointCloudPcdViewerProps) {
  const [loadState, setLoadState] = useState<LoadState>({
    status: 'loading',
    progress: 0,
    loaded: 0,
    total: 0,
    phase: 'download',
  });
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const [transparent, setTransparent] = useState(true);
  const [dpr, setDpr] = useState<Dpr>(1.5);
  const [autoRotate, setAutoRotate] = useState(false);
  const [liveFps, setLiveFps] = useState<FpsSample | null>(null);
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchResults, setBenchResults] = useState<BenchResult[]>([]);
  const measuringRef = useRef(false);
  const samplesRef = useRef<FpsSample[]>([]);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const handleSample = useCallback((sample: FpsSample) => {
    setLiveFps(sample);
    if (measuringRef.current) samplesRef.current.push(sample);
  }, []);

  const totalPoints = loadState.status === 'ready' ? loadState.pointCount : 0;
  const renderedPoints = visibleCount === null ? totalPoints : Math.min(visibleCount, totalPoints);

  const runBenchmark = async () => {
    if (loadState.status !== 'ready' || benchRunning) return;
    const levels = [...BENCH_LEVELS.filter((level) => level < totalPoints), totalPoints];
    const initialDpr = dpr;
    setBenchRunning(true);
    setBenchResults([]);
    setAutoRotate(true);

    for (const benchDpr of BENCH_DPRS) {
      setDpr(benchDpr);
      for (const points of levels) {
        if (unmountedRef.current) return;
        setVisibleCount(points);
        await sleep(BENCH_WARMUP_MS);
        samplesRef.current = [];
        measuringRef.current = true;
        await sleep(BENCH_MEASURE_MS);
        measuringRef.current = false;
        const samples = samplesRef.current;
        if (samples.length === 0) continue;
        const avgFps = samples.reduce((sum, item) => sum + item.fps, 0) / samples.length;
        const minFps = Math.min(...samples.map((item) => item.fps));
        const frameMs = samples.reduce((sum, item) => sum + item.frameMs, 0) / samples.length;
        const { bufferWidth, bufferHeight } = samples[samples.length - 1];
        if (unmountedRef.current) return;
        setBenchResults((previous) => [
          ...previous,
          { dpr: benchDpr, points, avgFps, minFps, frameMs, bufferWidth, bufferHeight },
        ]);
      }
    }

    if (unmountedRef.current) return;
    setDpr(initialDpr);
    setVisibleCount(null);
    setAutoRotate(false);
    setBenchRunning(false);
  };

  const benchLevels = [...new Set(benchResults.map((result) => result.points))];
  const benchDprs = [...new Set(benchResults.map((result) => result.dpr))];
  const benchTotal = BENCH_DPRS.length * (BENCH_LEVELS.filter((level) => level < totalPoints).length + 1);

  const copyBenchReport = () => {
    const header = `| 点数 | ${benchDprs.map((value) => `DPR ${value} 平均/最低 FPS`).join(' | ')} |`;
    const divider = `| --- | ${benchDprs.map(() => '---').join(' | ')} |`;
    const rows = benchLevels.map((points) => {
      const cells = benchDprs.map((value) => {
        const result = benchResults.find((item) => item.points === points && item.dpr === value);
        return result ? `${result.avgFps.toFixed(0)} / ${result.minFps.toFixed(0)}` : '-';
      });
      return `| ${formatPoints(points)} | ${cells.join(' | ')} |`;
    });
    const resolutions = benchDprs
      .map((value) => {
        const result = benchResults.find((item) => item.dpr === value);
        return result ? `DPR ${value}: ${result.bufferWidth}×${result.bufferHeight}` : '';
      })
      .filter(Boolean)
      .join('；');
    const text = [
      `测试环境：${navigator.userAgent}`,
      `半透明混合：${transparent ? '开' : '关'}；渲染分辨率 ${resolutions}`,
      '',
      header,
      divider,
      ...rows,
    ].join('\n');
    void navigator.clipboard?.writeText(text);
  };

  const statusText = useMemo(() => {
    if (loadState.status === 'loading') {
      if (loadState.phase === 'parse') {
        return '下载完成，正在解析 ASCII PCD（主线程可能短暂卡顿）…';
      }
      const percent = Math.round(loadState.progress * 100);
      const bytes =
        loadState.loaded > 0 ? ` · ${formatBytes(loadState.loaded, loadState.total)}` : '';
      return `全量下载中 ${percent}% · ASCII PCD · 约 89MB / 282 万点${bytes}`;
    }
    if (loadState.status === 'error') return `加载失败：${loadState.message}`;
    return `已加载 ${formatPoints(loadState.pointCount)} 点 · 当前渲染 ${formatPoints(renderedPoints)} · 耗时 ${(loadState.elapsedMs / 1000).toFixed(1)}s · 拖拽旋转 / 滚轮缩放`;
  }, [loadState, renderedPoints]);

  const ready = loadState.status === 'ready';
  const pointOptions = ready
    ? [...BENCH_LEVELS.filter((level) => level < totalPoints), totalPoints]
    : [];

  return (
    <div style={{ position: 'relative', width: '100%', height: 480, background: '#030910' }}>
      <Canvas
        camera={{ position: [80, 60, 80], fov: 50, near: 0.1, far: 5000 }}
        dpr={dpr}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <color attach="background" args={['#030910']} />
        <ambientLight intensity={0.85} />
        <PcdPoints
          url={url}
          visibleCount={visibleCount}
          transparent={transparent}
          onStateChange={setLoadState}
        />
        <OrbitControls makeDefault enableDamping={false} autoRotate={autoRotate} autoRotateSpeed={6} />
        <FpsMeter onSample={handleSample} />
      </Canvas>

      {ready ? (
        <div style={{ ...panelStyle, position: 'absolute', top: 10, left: 10, display: 'grid', gap: 6, minWidth: 250 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            渲染点数
            <select
              style={controlStyle}
              disabled={benchRunning}
              value={visibleCount ?? totalPoints}
              onChange={(event) => {
                const value = Number(event.target.value);
                setVisibleCount(value >= totalPoints ? null : value);
              }}
            >
              {pointOptions.map((points) => (
                <option key={points} value={points}>
                  {formatPoints(points)}{points === totalPoints ? '（全量）' : ''}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            像素比 DPR
            <select
              style={controlStyle}
              disabled={benchRunning}
              value={dpr}
              onChange={(event) => setDpr(Number(event.target.value) as Dpr)}
            >
              <option value={1}>1</option>
              <option value={1.5}>1.5</option>
              <option value={2}>2</option>
            </select>
          </label>
          <label style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            半透明混合
            <input type="checkbox" disabled={benchRunning} checked={transparent} onChange={(event) => setTransparent(event.target.checked)} />
          </label>
          <label style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            自动旋转（模拟拖拽）
            <input type="checkbox" disabled={benchRunning} checked={autoRotate} onChange={(event) => setAutoRotate(event.target.checked)} />
          </label>
          <button
            type="button"
            disabled={benchRunning}
            onClick={() => void runBenchmark()}
            style={{ ...controlStyle, height: 26, cursor: benchRunning ? 'wait' : 'pointer', color: '#a5f3fc', borderColor: 'rgba(34, 211, 238, .45)' }}
          >
            {benchRunning
              ? `压测中…（${benchResults.length}/${benchTotal}，当前 DPR ${dpr}）`
              : '一键压测（DPR 1 / 1.5 / 2 × 10万 → 全量）'}
          </button>

          {benchResults.length > 0 ? (
            <>
              <table data-testid="pcd-bench-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: 2 }}>
                <thead>
                  <tr style={{ color: 'rgba(202, 219, 237, .55)' }}>
                    <th style={{ textAlign: 'left', fontWeight: 500 }}>点数</th>
                    {benchDprs.map((value) => (
                      <th key={value} style={{ textAlign: 'right', fontWeight: 500 }}>DPR {value}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {benchLevels.map((points) => (
                    <tr key={points}>
                      <td>{formatPoints(points)}</td>
                      {benchDprs.map((value) => {
                        const result = benchResults.find((item) => item.points === points && item.dpr === value);
                        return (
                          <td key={value} style={{ textAlign: 'right' }}>
                            {result ? (
                              <>
                                <span style={{ color: fpsColor(result.avgFps) }}>{result.avgFps.toFixed(0)}</span>
                                <span style={{ color: 'rgba(202, 219, 237, .45)' }}> / </span>
                                <span style={{ color: fpsColor(result.minFps) }}>{result.minFps.toFixed(0)}</span>
                              </>
                            ) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ color: 'rgba(202, 219, 237, .55)' }}>
                单元格 = 平均 / 最低 FPS；绿 ≥50，黄 30–50，红 &lt;30
              </div>
              {!benchRunning ? (
                <button type="button" onClick={copyBenchReport} style={{ ...controlStyle, cursor: 'pointer' }}>
                  复制结果（Markdown 表格）
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {liveFps ? (
        <div style={{ ...panelStyle, position: 'absolute', top: 10, right: 10, textAlign: 'right' }}>
          <b style={{ color: fpsColor(liveFps.fps), fontSize: 16 }}>{liveFps.fps.toFixed(0)} FPS</b>
          <div>{liveFps.frameMs.toFixed(1)} ms / 帧</div>
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'none',
        }}
      >
        {loadState.status === 'loading' ? (
          <div
            style={{
              height: 4,
              overflow: 'hidden',
              borderRadius: 999,
              background: 'rgba(34, 211, 238, .16)',
            }}
          >
            <i
              style={{
                display: 'block',
                width: `${Math.max(2, Math.round(loadState.progress * 100))}%`,
                height: '100%',
                background: '#22d3ee',
              }}
            />
          </div>
        ) : null}
        <div style={{ ...panelStyle, color: loadState.status === 'error' ? '#fca5a5' : panelStyle.color }}>
          {statusText}
        </div>
      </div>
    </div>
  );
}

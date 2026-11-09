'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import { radarGeometry } from '@/lib/benxi-ladle-rules';
import type { DisplayCloud } from '@/lib/demo-pcd';
import { AZ_BINS, H_BINS, depthRgb, gridIndex, type SlagAnalysis, type SlagDefect } from '@/lib/slag-analysis';
import styles from './Benxi.module.css';

export type CloudView = 'iso' | 'top' | 'front';

interface SlagPointCloudProps {
  positions: Float32Array;
  analysis: SlagAnalysis;
  activeDefectId: number | null;
  onSelectDefect?: (id: number) => void;
  view: CloudView;
  /** 视角按钮每次点击递增，重复点击同一视角也会重新定位 */
  viewNonce: number;
  /** 0~1 扫描重放进度；null 表示显示全部点 */
  replayProgress: number | null;
  /** 演示模式：用真实 PCD 作三维外观，筒壁按 analysis.depthGrid 着色 */
  displayCloud?: DisplayCloud | null;
}

interface CloudScene {
  geometry: THREE.BufferGeometry;
  radius: number;
  /** 视角预设的取景尺度，筒体较高时需大于 radius */
  frameRadius: number;
  pointSize: number;
  markerPosition: (defect: SlagDefect) => THREE.Vector3;
}

/**
 * 把 PCD 坐标（mm）转换到场景坐标（m，y 轴朝上，轴线居中），
 * 并按方位角重排点序，扫描重放只需调整 drawRange。
 */
function buildScene(positions: Float32Array, analysis: SlagAnalysis): CloudScene {
  const { unitScale, innerRadiusMm, slagBandBottomMm, slagBandTopMm, azimuthZeroDeg } = radarGeometry;
  const count = analysis.pointCount;
  const zMid = (analysis.zRange[0] + analysis.zRange[1]) / 2;
  const order = azimuthOrder(analysis.pointAzimuth);

  const xyz = new Float32Array(count * 3);
  const rgb = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const source = order[i];
    xyz[i * 3] = (positions[source * 3] * unitScale - analysis.center.x) / 1000;
    xyz[i * 3 + 1] = (positions[source * 3 + 2] * unitScale - zMid) / 1000;
    xyz[i * 3 + 2] = -(positions[source * 3 + 1] * unitScale - analysis.center.y) / 1000;
    const [r, g, b] = depthRgb(analysis.pointDepth[source]);
    rgb[i * 3] = r / 255;
    rgb[i * 3 + 1] = g / 255;
    rgb[i * 3 + 2] = b / 255;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(xyz, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));

  const radius = innerRadiusMm / 1000;
  const height = (analysis.zRange[1] - analysis.zRange[0]) / 1000;
  const area = Math.PI * 2 * radius * Math.max(height, 0.1);
  const pointSize = Math.min(0.024, Math.max(0.004, Math.sqrt(area / Math.max(count, 1)) * 1.35));

  const markerPosition = (defect: SlagDefect) => {
    const angle = (((defect.azimuth ?? 0) + azimuthZeroDeg) * Math.PI) / 180;
    const r = (innerRadiusMm + defect.value * (defect.type === 'depth' ? 1 : 0.5)) / 1000;
    const hn = ((defect.height ?? 0) - slagBandBottomMm) / (slagBandTopMm - slagBandBottomMm);
    const z = analysis.zRange[0] + hn * (analysis.zRange[1] - analysis.zRange[0]);
    return new THREE.Vector3(Math.cos(angle) * r, (z - zMid) / 1000, -Math.sin(angle) * r);
  };

  return { geometry, radius, frameRadius: radius, pointSize, markerPosition };
}

/** 按方位角计数排序，扫描重放只需调整 drawRange。 */
function azimuthOrder(azimuths: Float32Array) {
  const count = azimuths.length;
  const buckets = new Uint32Array(361);
  for (let index = 0; index < count; index += 1) buckets[Math.min(359, Math.floor(azimuths[index])) + 1] += 1;
  for (let deg = 1; deg <= 360; deg += 1) buckets[deg] += buckets[deg - 1];
  const order = new Uint32Array(count);
  const cursor = buckets.slice(0, 360);
  for (let index = 0; index < count; index += 1) {
    const deg = Math.min(359, Math.floor(azimuths[index]));
    order[cursor[deg]] = index;
    cursor[deg] += 1;
  }
  return order;
}

const CLUTTER_RGB = [0.3, 0.34, 0.4];

/**
 * 真实 PCD 缩放到设计内半径，使视角预设与缺陷标记沿用同一套尺寸；
 * 筒壁点按方位/高度取深度网格着色，其余环境点置灰。
 */
function buildDisplayScene(cloud: DisplayCloud, analysis: SlagAnalysis): CloudScene {
  const { positions, geometry: g } = cloud;
  const { innerRadiusMm, slagBandBottomMm, slagBandTopMm, azimuthZeroDeg } = radarGeometry;
  const count = positions.length / 3;
  const scale = innerRadiusMm / g.radiusMm / 1000;
  const zMid = (g.wallBottomZ + g.wallTopZ) / 2;
  const wallSpan = g.wallTopZ - g.wallBottomZ;
  const zero = (azimuthZeroDeg * Math.PI) / 180;

  const azimuths = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    let theta = Math.atan2(positions[index * 3 + 1] - g.centerY, positions[index * 3] - g.centerX) - zero;
    theta = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    azimuths[index] = (theta * 180) / Math.PI;
  }
  const order = azimuthOrder(azimuths);

  const xyz = new Float32Array(count * 3);
  const rgb = new Float32Array(count * 3);
  let wallPoints = 0;
  for (let i = 0; i < count; i += 1) {
    const source = order[i];
    const dx = positions[source * 3] - g.centerX;
    const dy = positions[source * 3 + 1] - g.centerY;
    const z = positions[source * 3 + 2];
    xyz[i * 3] = dx * scale;
    xyz[i * 3 + 1] = (z - zMid) * scale;
    xyz[i * 3 + 2] = -dy * scale;

    const hn = (z - g.wallBottomZ) / wallSpan;
    const onWall = Math.abs(Math.hypot(dx, dy) - g.radiusMm) <= g.wallToleranceMm && hn >= 0 && hn <= 1;
    let color = CLUTTER_RGB;
    if (onWall) {
      wallPoints += 1;
      const az = Math.min(AZ_BINS - 1, Math.floor((azimuths[source] / 360) * AZ_BINS));
      const h = Math.min(H_BINS - 1, Math.floor(hn * H_BINS));
      const [r, gr, b] = depthRgb(analysis.depthGrid[gridIndex(az, h)]);
      color = [r / 255, gr / 255, b / 255];
    }
    rgb[i * 3] = color[0];
    rgb[i * 3 + 1] = color[1];
    rgb[i * 3 + 2] = color[2];
  }

  const bufferGeometry = new THREE.BufferGeometry();
  bufferGeometry.setAttribute('position', new THREE.BufferAttribute(xyz, 3));
  bufferGeometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));

  const radius = innerRadiusMm / 1000;
  const area = Math.PI * 2 * radius * wallSpan * scale;
  const pointSize = Math.min(0.03, Math.max(0.006, Math.sqrt(area / Math.max(wallPoints, 1)) * 1.6));

  const markerPosition = (defect: SlagDefect) => {
    const angle = (((defect.azimuth ?? 0) + azimuthZeroDeg) * Math.PI) / 180;
    const hn = ((defect.height ?? 0) - slagBandBottomMm) / (slagBandTopMm - slagBandBottomMm);
    const y = (hn * wallSpan + g.wallBottomZ - zMid) * scale;
    return new THREE.Vector3(Math.cos(angle) * radius, y, -Math.sin(angle) * radius);
  };

  const frameRadius = Math.max(radius, (wallSpan * scale) / 2) * 1.25;
  return { geometry: bufferGeometry, radius, frameRadius, pointSize, markerPosition };
}

const viewPresets: Record<CloudView, (radius: number) => { position: THREE.Vector3; target: THREE.Vector3 }> = {
  iso: (radius) => ({ position: new THREE.Vector3(2.1, 1.7, 2.1).multiplyScalar(radius), target: new THREE.Vector3() }),
  top: (radius) => ({ position: new THREE.Vector3(0, 3.4 * radius, 0.001), target: new THREE.Vector3() }),
  front: (radius) => ({ position: new THREE.Vector3(0, 0.25 * radius, 3.2 * radius), target: new THREE.Vector3() }),
};

interface CameraGoal {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

function CameraRig({ goal, goalKey }: { goal: CameraGoal; goalKey: string }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const animating = useRef(false);

  useEffect(() => {
    animating.current = true;
  }, [goal, goalKey]);

  useFrame(() => {
    if (!animating.current || !controls) return;
    camera.position.lerp(goal.position, 0.09);
    controls.target.lerp(goal.target, 0.12);
    controls.update();
    if (camera.position.distanceTo(goal.position) < 0.01 && controls.target.distanceTo(goal.target) < 0.01) {
      animating.current = false;
    }
  });

  return null;
}

function CloudContent({
  scene,
  defects,
  activeDefectId,
  onSelectDefect,
  replayProgress,
}: {
  scene: CloudScene;
  defects: SlagDefect[];
  activeDefectId: number | null;
  onSelectDefect?: (id: number) => void;
  replayProgress: number | null;
}) {
  const count = scene.geometry.getAttribute('position').count;

  useEffect(() => {
    scene.geometry.setDrawRange(0, replayProgress === null ? count : Math.floor(count * replayProgress));
  }, [count, replayProgress, scene.geometry]);

  useEffect(() => () => scene.geometry.dispose(), [scene.geometry]);

  const showMarkers = replayProgress === null || replayProgress >= 1;

  return (
    <>
      <points geometry={scene.geometry}>
        {/* 不开半透明：282 万点下半透明混合会从 60 帧掉到约 17 帧 */}
        <pointsMaterial vertexColors size={scene.pointSize} sizeAttenuation />
      </points>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[scene.radius * 0.995, scene.radius * 1.005, 96]} />
        <meshBasicMaterial color="#7e90ac" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
      {showMarkers && defects.filter((defect) => defect.azimuth !== null).map((defect) => {
        const active = defect.id === activeDefectId;
        const position = scene.markerPosition(defect);
        return (
          <group key={defect.id} position={position}>
            <mesh onClick={(event) => { event.stopPropagation(); onSelectDefect?.(defect.id); }}>
              <sphereGeometry args={[active ? 0.05 : 0.035, 16, 16]} />
              <meshBasicMaterial color={active ? '#22d3ee' : defect.level === 2 ? '#ef4444' : '#f59e0b'} transparent opacity={0.85} />
            </mesh>
            <Html center zIndexRange={[20, 0]}>
              <span className={`${styles.marker} ${active ? styles.markerActive : defect.level === 1 ? styles.markerWarn : ''}`}>{defect.id}</span>
            </Html>
          </group>
        );
      })}
    </>
  );
}

export default function SlagPointCloud({
  positions,
  analysis,
  activeDefectId,
  onSelectDefect,
  view,
  viewNonce,
  replayProgress,
  displayCloud = null,
}: SlagPointCloudProps) {
  const scene = useMemo(
    () => (displayCloud ? buildDisplayScene(displayCloud, analysis) : buildScene(positions, analysis)),
    [analysis, displayCloud, positions],
  );
  const activeDefect = analysis.defects.find((defect) => defect.id === activeDefectId && defect.azimuth !== null) ?? null;

  const goal = useMemo<CameraGoal>(() => {
    if (activeDefect) {
      const target = scene.markerPosition(activeDefect);
      const inward = new THREE.Vector3(-target.x, 0, -target.z).normalize();
      // 从钢包对侧内壁上方看向缺陷，即“内壁视角”
      const position = target.clone().add(inward.multiplyScalar(scene.radius * 1.9)).add(new THREE.Vector3(0, scene.radius * 0.55, 0));
      return { position, target };
    }
    return viewPresets[view](scene.frameRadius);
  }, [activeDefect, scene, view]);

  const initial = viewPresets.iso(scene.frameRadius).position;

  return (
    <Canvas
      camera={{ position: [initial.x, initial.y, initial.z], fov: 45, near: 0.01, far: 100 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%', background: '#050a11' }}
    >
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        autoRotate={!activeDefect && replayProgress === null}
        autoRotateSpeed={0.6}
      />
      <CameraRig goal={goal} goalKey={`${view}-${viewNonce}-${activeDefectId ?? ''}`} />
      <CloudContent
        scene={scene}
        defects={analysis.defects}
        activeDefectId={activeDefectId}
        onSelectDefect={onSelectDefect}
        replayProgress={replayProgress}
      />
    </Canvas>
  );
}

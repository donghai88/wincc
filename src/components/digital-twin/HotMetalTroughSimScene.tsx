'use client';

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Grid, Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { SimulationLayer } from './HotMetalTroughSimTwin';
import {
  TROUGH_MONITOR_POINTS,
  normalizeTroughLocationId,
  resolveTroughAlarmLocationId,
} from '@/data/trough-monitor-points';
import type { DigitalTwinBusinessAlarm, DigitalTwinTemperaturePoint, ModbusFeedStatus } from '@/types/digital-twin';

const MODEL_PATH = '/cad/donghua.glb';
const NORMALIZED_SPAN = 13.8;

const flowCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-1.75, 0.72, 0.08),
  new THREE.Vector3(-0.55, 0.76, 0.06),
  new THREE.Vector3(0.75, 0.74, 0.03),
  new THREE.Vector3(2.0, 0.7, 0.02),
  new THREE.Vector3(3.1, 0.66, 0.02),
]);

export interface HotMetalTroughSimSceneProps {
  activeLayer: SimulationLayer;
  temperaturePoint?: DigitalTwinTemperaturePoint | null;
  temperaturePoints?: DigitalTwinTemperaturePoint[];
  feedStatus?: ModbusFeedStatus;
  businessAlarm?: DigitalTwinBusinessAlarm | null;
}

type IndustrialMaterialKey =
  | 'terrain'
  | 'furnaceShell'
  | 'furnaceCap'
  | 'deckPlate'
  | 'paintedSteel'
  | 'galvanizedRail'
  | 'coolingPipe'
  | 'hotPipe'
  | 'concrete'
  | 'equipment'
  | 'refractory'
  | 'smallDetail';

interface MeshProfile {
  center: THREE.Vector3;
  size: THREE.Vector3;
  longest: number;
  middle: number;
  shortest: number;
  longAxis: 'x' | 'y' | 'z';
  flatAxis: 'x' | 'y' | 'z';
  volume: number;
  prefix: string;
}

function makeIndustrialMaterial({
  color,
  metalness,
  roughness,
  emissive = '#000000',
  emissiveIntensity = 0,
}: {
  color: string;
  metalness: number;
  roughness: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    emissive,
    emissiveIntensity,
  });
}

function createIndustrialMaterials() {
  return {
    terrain: makeIndustrialMaterial({
      color: '#27323a',
      metalness: 0.08,
      roughness: 0.86,
      emissive: '#06080a',
      emissiveIntensity: 0.12,
    }),
    furnaceShell: makeIndustrialMaterial({
      color: '#4b5560',
      metalness: 0.72,
      roughness: 0.34,
      emissive: '#15191c',
      emissiveIntensity: 0.12,
    }),
    furnaceCap: makeIndustrialMaterial({
      color: '#7b8790',
      metalness: 0.68,
      roughness: 0.3,
      emissive: '#202a2f',
      emissiveIntensity: 0.08,
    }),
    deckPlate: makeIndustrialMaterial({
      color: '#38414a',
      metalness: 0.58,
      roughness: 0.56,
      emissive: '#070b0f',
      emissiveIntensity: 0.08,
    }),
    paintedSteel: makeIndustrialMaterial({
      color: '#2f4652',
      metalness: 0.5,
      roughness: 0.42,
      emissive: '#07151a',
      emissiveIntensity: 0.08,
    }),
    galvanizedRail: makeIndustrialMaterial({
      color: '#9aa7ae',
      metalness: 0.72,
      roughness: 0.28,
      emissive: '#111820',
      emissiveIntensity: 0.05,
    }),
    coolingPipe: makeIndustrialMaterial({
      color: '#6fa2b7',
      metalness: 0.62,
      roughness: 0.32,
      emissive: '#0a2630',
      emissiveIntensity: 0.12,
    }),
    hotPipe: makeIndustrialMaterial({
      color: '#7a5543',
      metalness: 0.46,
      roughness: 0.5,
      emissive: '#35140b',
      emissiveIntensity: 0.2,
    }),
    concrete: makeIndustrialMaterial({
      color: '#5d6468',
      metalness: 0.04,
      roughness: 0.92,
    }),
    equipment: makeIndustrialMaterial({
      color: '#56646d',
      metalness: 0.42,
      roughness: 0.48,
      emissive: '#0e171d',
      emissiveIntensity: 0.08,
    }),
    refractory: makeIndustrialMaterial({
      color: '#6b4a3a',
      metalness: 0.1,
      roughness: 0.78,
      emissive: '#3b160b',
      emissiveIntensity: 0.22,
    }),
    smallDetail: makeIndustrialMaterial({
      color: '#b2c1c7',
      metalness: 0.72,
      roughness: 0.26,
      emissive: '#121c22',
      emissiveIntensity: 0.05,
    }),
  } satisfies Record<IndustrialMaterialKey, THREE.MeshStandardMaterial>;
}

function getMeshProfile(mesh: THREE.Mesh): MeshProfile {
  const bounds = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  const axes = [
    { axis: 'x' as const, value: size.x },
    { axis: 'y' as const, value: size.y },
    { axis: 'z' as const, value: size.z },
  ].sort((a, b) => b.value - a.value);
  const prefix = mesh.name.match(/^[A-Za-z]+/)?.[0] ?? 'mesh';

  return {
    center,
    size,
    longest: axes[0].value,
    middle: axes[1].value,
    shortest: axes[2].value,
    longAxis: axes[0].axis,
    flatAxis: axes[2].axis,
    volume: size.x * size.y * size.z,
    prefix,
  };
}

function classifyMesh(profile: MeshProfile): IndustrialMaterialKey {
  const isVeryFlat = profile.middle / Math.max(profile.shortest, 0.001) > 8 && profile.shortest < 0.08;
  const isSlender = profile.longest / Math.max(profile.middle, 0.001) > 7 && profile.middle < 0.16;
  const isTiny = profile.longest < 0.08;

  if (profile.prefix === 'pPlane' || profile.longest > 11) return 'terrain';
  if (profile.prefix === 'LT' || profile.volume > 11) return 'furnaceShell';
  if (profile.prefix === 'pTorus') return profile.center.y > 1.35 ? 'furnaceCap' : 'galvanizedRail';

  if (profile.prefix === 'polySurface') {
    if (isVeryFlat && profile.flatAxis === 'y') return 'deckPlate';
    if (isVeryFlat && profile.center.y > 0.9) return 'furnaceCap';
    if (profile.center.y < 0.35 && profile.volume > 0.05) return 'refractory';
    return profile.volume > 0.28 ? 'furnaceShell' : 'equipment';
  }

  if (profile.prefix === 'pCylinder') {
    if (isTiny) return 'smallDetail';
    if (isSlender && profile.longAxis === 'y') return 'paintedSteel';
    if (isSlender) return profile.center.y < 0.45 ? 'hotPipe' : 'coolingPipe';
    if (profile.center.y < 0.35 && profile.volume > 0.02) return 'refractory';
    return profile.volume > 0.1 ? 'equipment' : 'galvanizedRail';
  }

  if (profile.prefix === 'pCube') {
    if (isVeryFlat && profile.flatAxis === 'y') return 'deckPlate';
    if (isSlender) return profile.longAxis === 'y' ? 'paintedSteel' : 'galvanizedRail';
    if (profile.center.y < 0.3 && profile.volume > 0.03) return 'concrete';
    return profile.volume > 0.24 ? 'equipment' : 'paintedSteel';
  }

  return isTiny ? 'smallDetail' : 'equipment';
}

function shouldShowCadEdge(profile: MeshProfile, materialKey: IndustrialMaterialKey) {
  if (materialKey === 'terrain' || materialKey === 'concrete' || materialKey === 'refractory') return false;
  if (materialKey === 'deckPlate' && profile.longest > 2.4) return false;
  return profile.longest < 2.8 || materialKey === 'galvanizedRail' || materialKey === 'coolingPipe';
}

function lowestMeshWorldY(root: THREE.Object3D) {
  const vertex = new THREE.Vector3();
  let minY = Number.POSITIVE_INFINITY;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry?.getAttribute('position');
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
      if (vertex.y < minY) minY = vertex.y;
    }
  });
  return Number.isFinite(minY) ? minY : 0;
}

function normalizeModel(scene: THREE.Group) {
  const root = scene.clone(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = NORMALIZED_SPAN / Math.max(size.x, size.z, 0.001);

  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  root.updateMatrixWorld(true);
  // 包围盒被模型自带的底部线框拉低，实体沟体因此悬空。离地高度降为当前的一半。
  root.position.y -= lowestMeshWorldY(root) / 2;
  root.updateMatrixWorld(true);

  const materials = createIndustrialMaterials();
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: '#c8e6f4',
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const profile = getMeshProfile(mesh);
      const materialKey = classifyMesh(profile);

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = materials[materialKey];

      if (mesh.geometry && shouldShowCadEdge(profile, materialKey)) {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(mesh.geometry, 24),
          edgeMaterial.clone()
        );
        edges.renderOrder = 2;
        mesh.add(edges);
      }
    }
  });

  return root;
}

function CadModel({ modelRef }: { modelRef: React.RefObject<THREE.Group | null> }) {
  const { scene } = useGLTF(MODEL_PATH);
  const normalized = useMemo(() => normalizeModel(scene), [scene]);
  return <primitive ref={modelRef} object={normalized} />;
}

function Label({
  position,
  label,
  value,
  color,
}: {
  position: [number, number, number];
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Html position={position} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          minWidth: 116,
          padding: '8px 10px',
          border: `1px solid ${color}66`,
          borderRadius: 8,
          background: 'rgba(4, 10, 18, 0.76)',
          boxShadow: `0 0 22px ${color}22`,
          color: 'rgba(245,250,255,0.9)',
          fontSize: 11,
          lineHeight: 1.35,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ color: 'rgba(214,232,248,0.64)' }}>{label}</div>
        <strong style={{ color, fontSize: 13, fontWeight: 700 }}>{value}</strong>
      </div>
    </Html>
  );
}

interface SurfaceMonitorPoint {
  /** Stable key shared with the server, e.g. loc_1. */
  locationId: string;
  radius: number;
}

interface SurfaceSample {
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

const SURFACE_MONITOR_POINTS: SurfaceMonitorPoint[] = TROUGH_MONITOR_POINTS.map((monitorPoint) => ({
  locationId: monitorPoint.locationId,
  radius: 0.12,
}));

/**
 * 13 个点铺在沟体四周和沟底：两条长侧壁各 4 个，两端各 1 个，沟底 3 个。
 * 射线从外侧打到朝向自己的面，并只保留靠近外壳的命中，避免穿进内腔。
 */
function sampleEvenSurfacePoints(model: THREE.Object3D, count: number): SurfaceSample[] {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.x < 0.001 || size.z < 0.001 || size.y < 0.001) return [];

  const longAxis: 'x' | 'z' = size.x >= size.z ? 'x' : 'z';
  const crossAxis: 'x' | 'z' = longAxis === 'x' ? 'z' : 'x';
  const raycaster = new THREE.Raycaster();

  const cast = (origin: THREE.Vector3, direction: THREE.Vector3) => {
    const dir = direction.clone().normalize();
    raycaster.set(origin, dir);
    const hit = raycaster.intersectObject(model, true).find((intersection) => (intersection.object as THREE.Mesh).isMesh && intersection.face);
    if (!hit?.face) return null;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    if (normal.dot(dir) > -0.45) return null;
    return { point: hit.point.clone(), normal };
  };

  const keepOuterShell = (hits: SurfaceSample[], axis: 'x' | 'z', sign: 1 | -1) => {
    const outside = sign > 0 ? box.max[axis] : box.min[axis];
    const ranked = hits
      .map((hit) => ({ hit, depth: Math.abs(hit.point[axis] - outside) }))
      .sort((left, right) => left.depth - right.depth);
    const cutoff = ranked[Math.floor(ranked.length * 0.4)]?.depth ?? 1;
    return ranked.filter((item) => item.depth <= cutoff + 0.2).map((item) => item.hit);
  };

  const collectSide = (axis: 'x' | 'z', sign: 1 | -1, steps: number) => {
    const along = axis === longAxis ? crossAxis : longAxis;
    const hits: SurfaceSample[] = [];
    for (let step = 0; step < steps; step += 1) {
      const alongValue = box.min[along] + size[along] * ((step + 0.5) / steps);
      for (const height of [0.72, 0.84, 0.93]) {
        const origin = new THREE.Vector3();
        origin[along] = alongValue;
        origin.y = box.min.y + size.y * height;
        origin[axis] = sign > 0 ? box.max[axis] + 3 : box.min[axis] - 3;
        const direction = new THREE.Vector3();
        direction[axis] = -sign;
        const hit = cast(origin, direction);
        if (hit) hits.push(hit);
      }
    }
    return keepOuterShell(hits, axis, sign);
  };

  const floorHits: SurfaceSample[] = [];
  for (let step = 0; step < 14; step += 1) {
    for (let across = 0; across < 8; across += 1) {
      const origin = new THREE.Vector3();
      origin[longAxis] = box.min[longAxis] + size[longAxis] * ((step + 0.5) / 14);
      origin[crossAxis] = box.min[crossAxis] + size[crossAxis] * ((across + 0.5) / 8);
      origin.y = box.max.y + 2;
      const hit = cast(origin, new THREE.Vector3(0, -1, 0));
      if (!hit || hit.normal.y < 0.65) continue;
      if (hit.point.y > box.min.y + size.y * 0.85) continue;
      floorHits.push(hit);
    }
  }

  const pickEven = (hits: SurfaceSample[], axis: 'x' | 'z', quota: number) => {
    const pool = [...hits];
    const chosen: SurfaceSample[] = [];
    for (let index = 0; index < quota && pool.length > 0; index += 1) {
      const target = box.min[axis] + size[axis] * ((index + 0.5) / quota);
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      pool.forEach((hit, hitIndex) => {
        const distance = Math.abs(hit.point[axis] - target);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = hitIndex;
        }
      });
      const [hit] = pool.splice(bestIndex, 1);
      chosen.push(hit);
    }
    return chosen;
  };

  const floorQuota = Math.max(1, Math.round(count * 3 / 13));
  const endQuota = count >= 8 ? 1 : 0;
  let sideQuota = Math.floor((count - floorQuota - endQuota * 2) / 2);
  if (sideQuota < 1) sideQuota = 1;

  const positiveCross = collectSide(crossAxis, 1, 16);
  const negativeCross = collectSide(crossAxis, -1, 16);
  const positiveLong = collectSide(longAxis, 1, 8);
  const negativeLong = collectSide(longAxis, -1, 8);
  const chosen = [
    ...pickEven(positiveCross, longAxis, sideQuota),
    ...pickEven(negativeCross, longAxis, sideQuota),
    ...pickEven(positiveLong, crossAxis, endQuota),
    ...pickEven(negativeLong, crossAxis, endQuota),
    ...pickEven(floorHits, longAxis, floorQuota),
  ];
  const used = new Set(chosen);
  [...floorHits, ...positiveCross, ...negativeCross, ...positiveLong, ...negativeLong].forEach((hit) => {
    if (chosen.length >= count || used.has(hit)) return;
    used.add(hit);
    chosen.push(hit);
  });

  chosen.sort((left, right) => (
    left.point[longAxis] - right.point[longAxis] || left.point[crossAxis] - right.point[crossAxis]
  ));
  return chosen.slice(0, count);
}

function ModbusTemperatureSurfaceGrid({
  point,
  points,
  status,
  alarm,
  modelRef,
}: {
  point: DigitalTwinTemperaturePoint | null;
  points: DigitalTwinTemperaturePoint[];
  status: ModbusFeedStatus;
  alarm: DigitalTwinBusinessAlarm | null;
  modelRef: React.RefObject<THREE.Group | null>;
}) {
  const markerRefs = useRef<Array<THREE.Group | null>>([]);
  const labelRefs = useRef<Array<THREE.Group | null>>([]);
  const hasSnapped = useRef(false);
  const isDisconnected = status === 'error';
  const isRetrying = status === 'retrying';
  const isConnectionIssue = isDisconnected || isRetrying;
  const isAlarm = Boolean(alarm) && !isConnectionIssue;
  const alarmLocationId = isAlarm ? resolveTroughAlarmLocationId(alarm?.locationName, points) : '';
  const latestLocationId = point ? normalizeTroughLocationId(point.locationId) : '';
  // Abnormal highlight must follow the alarm location; otherwise fall back to latest push.
  const highlightLocationId = alarmLocationId || latestLocationId;
  const activeMonitorPoint = SURFACE_MONITOR_POINTS.find((monitorPoint) => monitorPoint.locationId === highlightLocationId) ?? null;
  const alarmColor = '#f97316';
  const pointByLocationId = useMemo(() => {
    const map = new Map<string, DigitalTwinTemperaturePoint>();
    points.forEach((temperaturePoint) => {
      const locationId = normalizeTroughLocationId(temperaturePoint.locationId);
      if (!locationId) return;
      map.set(locationId, temperaturePoint);
    });
    return map;
  }, [points]);

  useFrame(({ camera, size }) => {
    const model = modelRef.current;
    const markersReady = markerRefs.current.length >= SURFACE_MONITOR_POINTS.length
      && markerRefs.current.slice(0, SURFACE_MONITOR_POINTS.length).every(Boolean);
    if (model && markersReady && !hasSnapped.current) {
      model.updateWorldMatrix(true, true);
      const samples = sampleEvenSurfacePoints(model, SURFACE_MONITOR_POINTS.length);
      samples.forEach((sample, index) => {
        const marker = markerRefs.current[index];
        if (!marker) return;
        marker.position.copy(sample.point).addScaledVector(sample.normal, 0.018);
        marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sample.normal);
        marker.userData.surfaceNormal = sample.normal;
        marker.userData.snapped = true;
      });
      hasSnapped.current = samples.length > 0;
    }

    const candidates = markerRefs.current
      .map((marker, index) => {
        if (!marker?.userData.snapped) return null;
        const normal = marker.userData.surfaceNormal as THREE.Vector3;
        const cameraDirection = new THREE.Vector3().subVectors(camera.position, marker.getWorldPosition(new THREE.Vector3())).normalize();
        const projected = marker.getWorldPosition(new THREE.Vector3()).project(camera);
        return {
          marker,
          label: labelRefs.current[index],
          active: SURFACE_MONITOR_POINTS[index].locationId === activeMonitorPoint?.locationId,
          eligible: normal.dot(cameraDirection) > 0.05 && projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1.15 && Math.abs(projected.y) <= 1.15,
          x: (projected.x * 0.5 + 0.5) * size.width,
          y: (-projected.y * 0.5 + 0.5) * size.height,
          depth: projected.z,
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .sort((left, right) => Number(right.active) - Number(left.active) || left.depth - right.depth);

    const occupied: Array<{ x: number; y: number }> = [];
    candidates.forEach((candidate) => {
      const hasSpace = occupied.every((position) => Math.hypot(candidate.x - position.x, candidate.y - position.y) >= 88);
      candidate.marker.visible = candidate.eligible;
      if (candidate.label) candidate.label.visible = candidate.eligible && hasSpace;
      if (candidate.eligible && hasSpace) occupied.push(candidate);
    });
  });

  return (
    <group>
      {SURFACE_MONITOR_POINTS.map((monitorPoint, index) => {
        const livePoint = pointByLocationId.get(monitorPoint.locationId);
        const isAlarmPoint = Boolean(alarmLocationId) && monitorPoint.locationId === alarmLocationId;
        const isLatestPoint = !alarmLocationId && Boolean(latestLocationId) && monitorPoint.locationId === latestLocationId;
        const active = activeMonitorPoint?.locationId === monitorPoint.locationId;
        const realTimeTemperature = livePoint?.temperature;
        const markerColor = isAlarmPoint
          ? alarmColor
          : isLatestPoint
            ? '#5eead4'
            : realTimeTemperature === undefined
              ? '#64748b'
              : '#34d399';
        return (
          <group key={monitorPoint.locationId} ref={(node) => { markerRefs.current[index] = node; }} visible={false}>
            <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={active ? 14 : 10}>
              <circleGeometry args={[monitorPoint.radius * 1.7, 32]} />
              <meshBasicMaterial color={markerColor} transparent opacity={active ? 0.26 : 0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={active ? 15 : 11}>
              <torusGeometry args={[monitorPoint.radius * 1.18, active ? 0.014 : 0.008, 8, 56]} />
              <meshBasicMaterial color={markerColor} transparent opacity={active ? 0.96 : 0.64} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh position={[0, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={active ? 16 : 12}>
              <circleGeometry args={[active ? 0.055 : 0.032, 20]} />
              <meshBasicMaterial color={markerColor} transparent opacity={active ? 0.92 : 0.62} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <group ref={(node) => { labelRefs.current[index] = node; }}>
            <Html position={[0, 0.07, 0]} center distanceFactor={12.5} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div
                style={{
                  minWidth: 52,
                  padding: '9px 7px',
                  border: `1.5px solid ${markerColor}cc`,
                  borderRadius: 7,
                  background: 'rgba(3, 10, 17, 0.92)',
                  boxShadow: `0 0 18px ${markerColor}38, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  color: '#f1f7fb',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                <strong style={{ color: markerColor, fontSize: 14, fontWeight: 750, letterSpacing: '0.02em', textShadow: '0 1px 8px rgba(255,255,255,0.2)' }}>
                  {realTimeTemperature === undefined ? '--' : `${realTimeTemperature.toFixed(1)}°C`}
                </strong>
              </div>
            </Html>
            </group>
          </group>
        );
      })}
    </group>
  );
}

function SceneLoader() {
  return (
    <Html center>
      <div
        style={{
          padding: '12px 16px',
          border: '1px solid rgba(125, 211, 252, 0.28)',
          borderRadius: 8,
          background: 'rgba(4, 10, 18, 0.78)',
          color: 'rgba(245,250,255,0.74)',
          fontSize: 13,
          backdropFilter: 'blur(10px)',
        }}
      >
        正在加载三维模型...
      </div>
    </Html>
  );
}

function useLayerOpacity(activeLayer: SimulationLayer, layer: SimulationLayer, inactive = 0.2) {
  return activeLayer === layer ? 1 : inactive;
}

function ThermalField({ activeLayer }: HotMetalTroughSimSceneProps) {
  const opacity = useLayerOpacity(activeLayer, 'temperature', 0);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = 0.04 + Math.sin(clock.elapsedTime * 1.1) * 0.02;
  });

  const bands = [
    { y: 0.5, radius: 1.1, color: '#facc15', opacity: 0.16 },
    { y: 0.68, radius: 0.82, color: '#fb923c', opacity: 0.2 },
    { y: 0.86, radius: 0.48, color: '#ef4444', opacity: 0.24 },
  ];

  return (
    <group ref={groupRef} position={[-2.2, 0.04, -0.42]}>
      {bands.map((band) => (
        <mesh key={`${band.color}-${band.radius}`} position={[0, band.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[band.radius, band.radius * 0.74, 0.08, 80, 1, true]} />
          <meshBasicMaterial
            color={band.color}
            transparent
            opacity={band.opacity * opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      <mesh position={[2.9, 0.45, 0.5]} rotation={[0, -0.34, 0]}>
        <boxGeometry args={[2.35, 0.08, 0.24]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.36 * opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[2.9, 0.52, 0.5]} rotation={[0, -0.34, 0]}>
        <boxGeometry args={[1.86, 0.055, 0.12]} />
        <meshBasicMaterial color="#fef3c7" transparent opacity={0.4 * opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {activeLayer === 'temperature' && <Label position={[-4.0, 1.62, -0.8]} label="炉缸热区" value="1498°C" color="#fb923c" />}
    </group>
  );
}

function PressureContours({ activeLayer }: HotMetalTroughSimSceneProps) {
  const opacity = useLayerOpacity(activeLayer, 'pressure', 0);
  const rings = [
    { radius: 1.1, y: 0.38, value: '0.8kPa' },
    { radius: 1.8, y: 0.62, value: '1.4kPa' },
    { radius: 2.6, y: 0.86, value: '2.1kPa' },
    { radius: 3.5, y: 1.1, value: '2.8kPa' },
  ];

  return (
    <group position={[1.9, 0.1, -0.65]}>
      {rings.map((ring, index) => (
        <group key={ring.value}>
          <mesh position={[0, ring.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[ring.radius, 0.012, 8, 160]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={(0.42 - index * 0.055) * opacity} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
      <Line
        points={[
          new THREE.Vector3(-0.2, 0.2, 3.8),
          new THREE.Vector3(-0.1, 0.72, 1.6),
          new THREE.Vector3(0.12, 1.08, -0.5),
          new THREE.Vector3(0.24, 1.28, -2.8),
        ]}
        color="#60a5fa"
        lineWidth={1.4}
        transparent
        opacity={0.7 * opacity}
      />
      {activeLayer === 'pressure' && <Label position={[2.85, 1.95, 0.4]} label="管网压差" value="2.1kPa" color="#60a5fa" />}
    </group>
  );
}

function ErosionSection({ activeLayer }: HotMetalTroughSimSceneProps) {
  const opacity = useLayerOpacity(activeLayer, 'erosion', 0);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = 0.04 + Math.sin(clock.elapsedTime * 1.2) * 0.018;
  });

  const slices = [
    { z: -0.36, color: '#22d3ee', width: 2.25 },
    { z: -0.12, color: '#34d399', width: 2.05 },
    { z: 0.12, color: '#fbbf24', width: 1.8 },
    { z: 0.36, color: '#f87171', width: 1.46 },
  ];

  return (
    <group ref={groupRef} position={[0.7, 0.34, 1.1]} rotation={[0, -0.24, 0]}>
      {slices.map((slice, index) => (
        <mesh key={slice.color} position={[0, 0.18 + index * 0.08, slice.z]}>
          <boxGeometry args={[slice.width, 0.08, 0.18]} />
          <meshBasicMaterial color={slice.color} transparent opacity={(0.26 + index * 0.05) * opacity} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
      <Line
        points={[
          new THREE.Vector3(-1.24, 0.1, -0.56),
          new THREE.Vector3(1.24, 0.1, -0.56),
          new THREE.Vector3(1.24, 0.56, 0.56),
          new THREE.Vector3(-1.24, 0.56, 0.56),
          new THREE.Vector3(-1.24, 0.1, -0.56),
        ]}
        color="#c4b5fd"
        lineWidth={1.2}
        transparent
        opacity={0.8 * opacity}
      />
      {activeLayer === 'erosion' && <Label position={[1.55, 1.05, 0.2]} label="最大侵蚀厚度" value="18.6mm" color="#a78bfa" />}
    </group>
  );
}

function BurdenDistribution({ activeLayer }: HotMetalTroughSimSceneProps) {
  const opacity = useLayerOpacity(activeLayer, 'burden', 0);
  const groupRef = useRef<THREE.Group>(null);
  const particles = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => {
        const angle = index * 2.399;
        const radius = 0.28 + (index % 8) * 0.17;
        return {
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
          delay: index / 34,
        };
      }),
    []
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = clock.elapsedTime * 0.16;
  });

  return (
    <group ref={groupRef} position={[-2.85, 0.38, -0.54]}>
      {[0.76, 1.24, 1.78].map((radius, index) => (
        <mesh key={radius} position={[0, 0.5 + index * 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.018, 8, 128]} />
          <meshBasicMaterial color={index === 2 ? '#34d399' : '#fbbf24'} transparent opacity={(0.28 - index * 0.035) * opacity} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
      <mesh position={[0, 1.2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.9, 2.2, 96, 1, true]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.11 * opacity} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {particles.map((particle, index) => (
        <DroppingParticle key={index} {...particle} opacity={opacity} />
      ))}
      {activeLayer === 'burden' && <Label position={[2.05, 1.85, -0.2]} label="料面均匀度" value="76%" color="#34d399" />}
    </group>
  );
}

function DroppingParticle({
  x,
  z,
  delay,
  opacity,
}: {
  x: number;
  z: number;
  delay: number;
  opacity: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const phase = (clock.elapsedTime * 0.34 + delay) % 1;
    ref.current.position.set(x * phase, 2.05 - phase * 1.62, z * phase);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.035, 10, 10]} />
      <meshBasicMaterial color="#facc15" transparent opacity={0.72 * opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function FlowField({ activeLayer }: HotMetalTroughSimSceneProps) {
  const opacity = useLayerOpacity(activeLayer, 'flow', 0);
  return (
    <group position={[0.9, 0, 0.06]} rotation={[0, -0.14, 0]}>
      <mesh>
        <tubeGeometry args={[flowCurve, 128, 0.06, 14, false]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.26 * opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <Line points={flowCurve.getPoints(80)} color="#67e8f9" lineWidth={2} transparent opacity={0.62 * opacity} />
      <FlowParticles opacity={opacity} />
      {activeLayer === 'flow' && <Label position={[3.85, 1.28, -0.52]} label="中间包流场" value="3.6t/min" color="#22d3ee" />}
    </group>
  );
}

function FlowParticles({ opacity }: { opacity: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(40 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame(({ clock }) => {
    const attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    const time = clock.elapsedTime * 0.18;
    for (let index = 0; index < 40; index += 1) {
      const point = flowCurve.getPoint((time + index / 40) % 1);
      const drift = Math.sin(clock.elapsedTime * 2.1 + index) * 0.035;
      attribute.setXYZ(index, point.x, point.y + drift, point.z);
    }
    attribute.needsUpdate = true;
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.09} color="#a5f3fc" transparent opacity={0.86 * opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function SimulationOverlays({ activeLayer }: HotMetalTroughSimSceneProps) {
  return (
    <group>
      {activeLayer === 'temperature' && <ThermalField activeLayer={activeLayer} />}
      {activeLayer === 'pressure' && <PressureContours activeLayer={activeLayer} />}
      {activeLayer === 'erosion' && <ErosionSection activeLayer={activeLayer} />}
      {activeLayer === 'burden' && <BurdenDistribution activeLayer={activeLayer} />}
      {activeLayer === 'flow' && <FlowField activeLayer={activeLayer} />}
    </group>
  );
}

useGLTF.preload(MODEL_PATH);

export default function HotMetalTroughSimScene({
  activeLayer,
  temperaturePoint = null,
  temperaturePoints = [],
  feedStatus = 'mock',
  businessAlarm = null,
}: HotMetalTroughSimSceneProps) {
  const cadModelRef = useRef<THREE.Group | null>(null);

  return (
    <Canvas
      camera={{ position: [13.6, 8.6, 12.8], fov: 42, near: 0.1, far: 140 }}
      shadows
      dpr={[1, 1.65]}
      style={{ width: '100%', height: '100%', display: 'block' }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.18,
      }}
    >
      <color attach="background" args={['#040911']} />
      <fog attach="fog" args={['#040911', 18, 48]} />

      <ambientLight intensity={0.84} color="#dbeafe" />
      <hemisphereLight args={['#b8dff5', '#0b1822', 0.3]} />
      <directionalLight position={[7, 9, 7]} intensity={2.25} color="#ffffff" castShadow />
      <directionalLight position={[-8, 5.5, -7]} intensity={1.05} color="#9fd6ef" />
      <pointLight position={[-4, 3.2, 3]} intensity={5.2} color="#22d3ee" distance={10} />
      <pointLight position={[4.5, 2.4, -3.2]} intensity={3.8} color="#fb923c" distance={10} />
      <pointLight position={[-2.6, 1.1, -0.4]} intensity={7.2} color="#f97316" distance={7} />
      <spotLight position={[0, 7, 6]} angle={0.45} penumbra={0.65} intensity={2.2} color="#93c5fd" castShadow />

      <Suspense fallback={<SceneLoader />}>
        <group>
          <CadModel modelRef={cadModelRef} />
          <SimulationOverlays activeLayer={activeLayer} />
          <ModbusTemperatureSurfaceGrid point={temperaturePoint} points={temperaturePoints} status={feedStatus} alarm={businessAlarm} modelRef={cadModelRef} />
          <Grid
            position={[0, -0.02, 0]}
            args={[18, 18]}
            cellSize={0.6}
            cellThickness={0.55}
            cellColor="#244b70"
            sectionSize={3}
            sectionThickness={1.05}
            sectionColor="#0ea5e9"
            fadeDistance={22}
            fadeStrength={1.35}
            infiniteGrid={false}
          />
          <ContactShadows
            position={[0, -0.01, 0]}
            opacity={0.42}
            scale={16}
            blur={2.7}
            far={4.8}
            color="#02070c"
          />
        </group>
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan
        enableRotate
        enableZoom
        enableDamping
        dampingFactor={0.07}
        panSpeed={1.15}
        rotateSpeed={0.72}
        zoomSpeed={0.78}
        screenSpacePanning
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
        minDistance={2.6}
        maxDistance={46}
        maxPolarAngle={Math.PI * 0.54}
        minPolarAngle={Math.PI * 0.1}
        target={[0.1, 0.78, -0.08]}
      />
    </Canvas>
  );
}

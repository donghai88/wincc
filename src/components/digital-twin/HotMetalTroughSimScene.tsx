'use client';

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Grid, Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { SimulationLayer } from './HotMetalTroughSimTwin';
import type { DigitalTwinBusinessAlarm, DigitalTwinTemperaturePoint, ModbusFeedStatus } from '@/types/digital-twin';

const MODEL_PATH = '/cad/langan.glb';
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

const modbusStatusColor: Record<ModbusFeedStatus, string> = {
  mock: '#22d3ee',
  connecting: '#94a3b8',
  connected: '#34d399',
  fallback: '#fbbf24',
  error: '#f87171',
  retrying: '#fbbf24',
};

interface SurfaceMonitorPoint {
  id: string;
  name: string;
  anchor: [number, number];
  rayOrigin?: [number, number, number];
  rayDirection?: [number, number, number];
  temperature: number;
  radius: number;
}

const SURFACE_MONITOR_POINTS: SurfaceMonitorPoint[] = [
  // Every row shares the same layout: outer sensors bind to the side walls,
  // while the two middle sensors use the one-third and two-third positions.
  { id: 'loc_13', name: 'T13', anchor: [-3.42, 4.95], rayOrigin: [-8, 1.05, 4.95], rayDirection: [1, 0, 0], temperature: 56.8, radius: 0.12 },
  { id: 'loc_14', name: 'T14', anchor: [-1.14, 4.95], temperature: 58.4, radius: 0.12 },
  { id: 'loc_15', name: 'T15', anchor: [1.14, 4.95], temperature: 61.2, radius: 0.12 },
  { id: 'loc_16', name: 'T16', anchor: [3.42, 4.95], rayOrigin: [8, 1.05, 4.95], rayDirection: [-1, 0, 0], temperature: 57.9, radius: 0.12 },
  { id: 'loc_9', name: 'T09', anchor: [-3.42, 2.25], rayOrigin: [-8, 1.05, 2.25], rayDirection: [1, 0, 0], temperature: 54.6, radius: 0.12 },
  { id: 'loc_10', name: 'T10', anchor: [-1.14, 2.25], temperature: 59.8, radius: 0.12 },
  { id: 'loc_11', name: 'T11', anchor: [1.14, 2.25], temperature: 62.5, radius: 0.12 },
  { id: 'loc_12', name: 'T12', anchor: [3.42, 2.25], rayOrigin: [8, 1.05, 2.25], rayDirection: [-1, 0, 0], temperature: 60.7, radius: 0.12 },
  { id: 'loc_5', name: 'T05', anchor: [-3.42, -1.8], rayOrigin: [-8, 1.05, -1.8], rayDirection: [1, 0, 0], temperature: 55.2, radius: 0.12 },
  { id: 'loc_6', name: 'T06', anchor: [-1.14, -1.8], temperature: 57.1, radius: 0.12 },
  { id: 'loc_1', name: 'T01', anchor: [1.14, -1.8], temperature: 58.9, radius: 0.13 },
  { id: 'loc_7', name: 'T07', anchor: [3.42, -1.8], rayOrigin: [8, 1.05, -1.8], rayDirection: [-1, 0, 0], temperature: 56.5, radius: 0.12 },
  { id: 'loc_2', name: 'T02', anchor: [-3.42, -5.35], rayOrigin: [-8, 1.05, -5.35], rayDirection: [1, 0, 0], temperature: 53.8, radius: 0.12 },
  { id: 'loc_3', name: 'T03', anchor: [-1.14, -5.35], temperature: 55.7, radius: 0.12 },
  { id: 'loc_4', name: 'T04', anchor: [1.14, -5.35], temperature: 59.4, radius: 0.12 },
  { id: 'loc_8', name: 'T08', anchor: [3.42, -5.35], rayOrigin: [8, 1.05, -5.35], rayDirection: [-1, 0, 0], temperature: 57.6, radius: 0.12 },
];

const normalizeLocationId = (locationId: string) => locationId.toLowerCase().replace(/^loc_0+/, 'loc_');

function getMonitorPointForLocation(locationId: string) {
  const normalizedLocationId = normalizeLocationId(locationId);
  return SURFACE_MONITOR_POINTS.find((monitorPoint) => normalizeLocationId(monitorPoint.id) === normalizedLocationId);
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
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hasSnapped = useRef(false);
  const isDisconnected = status === 'error';
  const isRetrying = status === 'retrying';
  const isConnectionIssue = isDisconnected || isRetrying;
  const isAlarm = Boolean(alarm) && !isConnectionIssue;
  const color = isDisconnected ? modbusStatusColor.error : isRetrying ? modbusStatusColor.retrying : isAlarm ? '#f97316' : modbusStatusColor[status];
  const activeMonitorPoint = point ? getMonitorPointForLocation(point.locationId) : null;
  const temperatureByLocation = useMemo(
    () => new Map(points.map((temperaturePoint) => [normalizeLocationId(temperaturePoint.locationId), temperaturePoint.temperature])),
    [points]
  );

  useFrame(({ camera, size }) => {
    const model = modelRef.current;
    if (model && !hasSnapped.current) {
      model.updateWorldMatrix(true, true);
      SURFACE_MONITOR_POINTS.forEach((monitorPoint, index) => {
        const marker = markerRefs.current[index];
        if (!marker) return;

        // Top sensors project down; the two outer sensors project horizontally
        // into the real CAD side walls. Neither relies on a fixed surface height.
        const origin = monitorPoint.rayOrigin ?? [monitorPoint.anchor[0], 18, monitorPoint.anchor[1]];
        const direction = monitorPoint.rayDirection ?? [0, -1, 0];
        raycaster.set(new THREE.Vector3(...origin), new THREE.Vector3(...direction));
        const hit = raycaster.intersectObject(model, true).find((intersection) => (intersection.object as THREE.Mesh).isMesh);
        if (!hit) {
          marker.visible = false;
          return;
        }

        const normal = hit.face
          ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
          : new THREE.Vector3(0, 1, 0);
        marker.position.copy(hit.point).addScaledVector(normal, 0.018);
        marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        marker.userData.surfaceNormal = normal;
        marker.userData.snapped = true;
      });
      hasSnapped.current = true;
    }

    const candidates = markerRefs.current
      .map((marker, index) => {
        if (!marker?.userData.snapped) return null;
        const normal = marker.userData.surfaceNormal as THREE.Vector3;
        const cameraDirection = new THREE.Vector3().subVectors(camera.position, marker.getWorldPosition(new THREE.Vector3())).normalize();
        const projected = marker.getWorldPosition(new THREE.Vector3()).project(camera);
        return {
          marker,
          active: normalizeLocationId(SURFACE_MONITOR_POINTS[index].id) === activeMonitorPoint?.id,
          eligible: normal.dot(cameraDirection) > 0.1 && projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1.1 && Math.abs(projected.y) <= 1.1,
          x: (projected.x * 0.5 + 0.5) * size.width,
          y: (-projected.y * 0.5 + 0.5) * size.height,
          depth: projected.z,
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .sort((left, right) => Number(right.active) - Number(left.active) || left.depth - right.depth);

    const occupied: Array<{ x: number; y: number }> = [];
    candidates.forEach((candidate) => {
      const hasSpace = occupied.every((position) => Math.hypot(candidate.x - position.x, candidate.y - position.y) >= 128);
      candidate.marker.visible = candidate.eligible && hasSpace;
      if (candidate.marker.visible) occupied.push(candidate);
    });
  });

  return (
    <group>
      {SURFACE_MONITOR_POINTS.map((monitorPoint, index) => {
        const active = activeMonitorPoint?.id === monitorPoint.id;
        const realTimeTemperature = active && isAlarm && alarm
          ? alarm.maxTemp
          : temperatureByLocation.get(normalizeLocationId(monitorPoint.id));
        const markerColor = active ? color : realTimeTemperature === undefined ? '#64748b' : realTimeTemperature >= 60 ? '#f59e0b' : '#38bdf8';
        return (
          <group key={monitorPoint.id} ref={(node) => { markerRefs.current[index] = node; }} visible={false}>
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
            <Html position={[0, 0.04, 0]} center distanceFactor={10.5} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  minWidth: 94,
                  padding: '5px 8px',
                  border: `1px solid ${markerColor}bb`,
                  borderRadius: 6,
                  background: 'rgba(3, 10, 17, 0.9)',
                  boxShadow: `0 0 16px ${markerColor}33, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  color: '#f1f7fb',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: markerColor, fontSize: 11, fontWeight: 700, letterSpacing: '0.035em' }}>{monitorPoint.name}</span>
                <strong style={{ fontSize: 13, fontWeight: 750, letterSpacing: '0.01em', textShadow: '0 1px 8px rgba(255,255,255,0.2)' }}>{realTimeTemperature === undefined ? '--' : `${realTimeTemperature.toFixed(1)}°C`}</strong>
              </div>
            </Html>
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
      {activeLayer === 'flow' && <Label position={[3.85, 1.28, -0.52]} label="铁水沟流场" value="3.6t/min" color="#22d3ee" />}
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
      camera={{ position: [8.8, 5.4, 8.2], fov: 42, near: 0.1, far: 120 }}
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
      <fog attach="fog" args={['#040911', 12, 34]} />

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

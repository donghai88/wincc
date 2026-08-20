'use client';

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bounds, Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { DigitalTwinBusinessAlarm, DigitalTwinTemperaturePoint, ModbusFeedStatus } from '@/types/digital-twin';

const MODEL_PATH = '/cad/langan.glb';
const BACKGROUND = '#05070a';
const NORMALIZED_SPAN = 13.8;

interface SurfaceMonitorPoint {
  id: string;
  position: [number, number, number];
}

// These positions sit on the upper working surface of the normalized CAD model.
// The staggered rows leave enough physical space between sensors before any
// screen-space decluttering is applied.
const SURFACE_MONITOR_POINTS: SurfaceMonitorPoint[] = [
  { id: 'loc_13', position: [-3.12, 2.318, 4.95] },
  { id: 'loc_14', position: [-0.92, 2.318, 5.03] },
  { id: 'loc_15', position: [1.34, 2.318, 4.88] },
  { id: 'loc_16', position: [3.28, 2.318, 5.0] },
  { id: 'loc_9', position: [-3.52, 2.318, 2.22] },
  { id: 'loc_10', position: [-1.24, 2.318, 2.36] },
  { id: 'loc_11', position: [0.98, 2.318, 2.18] },
  { id: 'loc_12', position: [3.08, 2.318, 2.34] },
  { id: 'loc_5', position: [-3.14, 2.318, -1.82] },
  { id: 'loc_6', position: [-0.72, 2.318, -1.64] },
  { id: 'loc_1', position: [1.72, 2.318, -1.9] },
  { id: 'loc_7', position: [3.52, 2.318, -1.72] },
  { id: 'loc_2', position: [-3.44, 2.318, -5.38] },
  { id: 'loc_3', position: [-1.02, 2.318, -5.22] },
  { id: 'loc_4', position: [1.26, 2.318, -5.48] },
  { id: 'loc_8', position: [3.42, 2.318, -5.28] },
];

const normalizeLocationId = (locationId: string) => locationId.toLowerCase().replace(/^loc_0+/, 'loc_');

export interface BlastFurnaceSceneProps {
  temperaturePoint?: DigitalTwinTemperaturePoint | null;
  feedStatus?: ModbusFeedStatus;
  businessAlarm?: DigitalTwinBusinessAlarm | null;
}

const feedStatusColor: Record<ModbusFeedStatus, string> = {
  mock: '#4cc9f0',
  connecting: '#a8b3c7',
  connected: '#45d483',
  fallback: '#f59f38',
  error: '#ff5c57',
  retrying: '#f59f38',
};

function CadModel() {
  const { scene } = useGLTF(MODEL_PATH);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    // The replacement GLB is authored in a very small unit scale. Normalize
    // it before fitting the camera so the same scene remains usable for both
    // the original sensor overlay and the new model.
    const scale = NORMALIZED_SPAN / Math.max(size.x, size.z, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    clone.updateMatrixWorld(true);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return clone;
  }, [scene]);

  return <primitive object={clonedScene} />;
}

function SurfaceMonitorGrid({
  point,
  status,
  alarm,
}: {
  point: DigitalTwinTemperaturePoint | null;
  status: ModbusFeedStatus;
  alarm: DigitalTwinBusinessAlarm | null;
}) {
  const markerRefs = useRef<Array<THREE.Group | null>>([]);
  const activePulseRef = useRef<THREE.Group>(null);
  const isDisconnected = status === 'error';
  const isRetrying = status === 'retrying';
  const isConnectionIssue = isDisconnected || isRetrying;
  const isAlarm = Boolean(alarm) && !isConnectionIssue;
  const color = isDisconnected ? feedStatusColor.error : isRetrying ? feedStatusColor.retrying : isAlarm ? '#f97316' : feedStatusColor[status];

  const activeLocationId = point ? normalizeLocationId(point.locationId) : null;

  useFrame(({ clock, camera, size }) => {
    if (activePulseRef.current) {
    const scale = 1 + Math.sin(clock.elapsedTime * 3.1) * 0.18;
      activePulseRef.current.scale.setScalar(scale);
    }

    const candidates = SURFACE_MONITOR_POINTS.map((monitorPoint, index) => {
      const marker = markerRefs.current[index];
      if (!marker) return null;

      const worldPosition = marker.getWorldPosition(new THREE.Vector3());
      const cameraDirection = new THREE.Vector3().subVectors(camera.position, worldPosition).normalize();
      const facesCamera = cameraDirection.dot(new THREE.Vector3(0, 1, 0)) > 0.12;
      const projected = worldPosition.clone().project(camera);
      const isInViewport = projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1.12 && Math.abs(projected.y) <= 1.12;

      return {
        marker,
        active: normalizeLocationId(monitorPoint.id) === activeLocationId,
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
        depth: projected.z,
        eligible: facesCamera && isInViewport,
      };
    })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      // Preserve the live-data point first, then favour the closest visible points.
      .sort((left, right) => Number(right.active) - Number(left.active) || left.depth - right.depth);

    const accepted: Array<{ x: number; y: number }> = [];
    for (const candidate of candidates) {
      const hasRoom = accepted.every(({ x, y }) => Math.hypot(candidate.x - x, candidate.y - y) >= 42);
      candidate.marker.visible = candidate.eligible && hasRoom;
      if (candidate.marker.visible) accepted.push(candidate);
    }
  });

  return (
    <group>
      {SURFACE_MONITOR_POINTS.map((monitorPoint, index) => {
        const active = normalizeLocationId(monitorPoint.id) === activeLocationId;
        const markerColor = active ? color : '#67d6f3';

        return (
          <group key={monitorPoint.id} ref={(node) => { markerRefs.current[index] = node; }} position={monitorPoint.position}>
            <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={active ? 12 : 10}>
              <torusGeometry args={[active ? 0.16 : 0.105, active ? 0.011 : 0.006, 8, active ? 64 : 48]} />
              <meshBasicMaterial color={markerColor} transparent opacity={active ? 0.9 : 0.46} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh position={[0, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={active ? 13 : 11}>
              <circleGeometry args={[active ? 0.045 : 0.022, 20]} />
              <meshBasicMaterial color={markerColor} transparent opacity={active ? 0.78 : 0.34} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            {active && (
              <group ref={activePulseRef}>
                <mesh position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.29, 0.006, 8, 72]} />
                  <meshBasicMaterial color={color} transparent opacity={0.52} depthWrite={false} blending={THREE.AdditiveBlending} />
                </mesh>
                <pointLight color={color} intensity={0.9} distance={1.25} />
              </group>
            )}
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
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: 8,
          background: 'rgba(5, 7, 10, 0.78)',
          color: 'rgba(255,255,255,0.76)',
          fontSize: 13,
          backdropFilter: 'blur(10px)',
        }}
      >
        正在加载三维模型...
      </div>
    </Html>
  );
}

useGLTF.preload(MODEL_PATH);

export default function BlastFurnaceScene({
  temperaturePoint = null,
  feedStatus = 'mock',
  businessAlarm = null,
}: BlastFurnaceSceneProps) {
  return (
    <Canvas
      camera={{ position: [8, 6, 8], fov: 42, near: 0.1, far: 500 }}
      shadows
      dpr={[1, 1.6]}
      style={{ width: '100%', height: '100%', display: 'block' }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1,
      }}
    >
      <color attach="background" args={[BACKGROUND]} />
      <ambientLight intensity={1.15} color="#ffffff" />
      <directionalLight position={[8, 12, 8]} intensity={1.75} color="#ffffff" />
      <directionalLight position={[-8, 5, -6]} intensity={0.75} color="#c8d7e8" />

      <Suspense fallback={<SceneLoader />}>
        <Bounds fit clip observe margin={1.12}>
          <group>
            <CadModel />
            <SurfaceMonitorGrid point={temperaturePoint} status={feedStatus} alarm={businessAlarm} />
          </group>
        </Bounds>
      </Suspense>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        minDistance={2}
        maxDistance={80}
        maxPolarAngle={Math.PI}
      />
    </Canvas>
  );
}

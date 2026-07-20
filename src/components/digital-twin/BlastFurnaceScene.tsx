'use client';

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bounds, Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { DigitalTwinBusinessAlarm, DigitalTwinTemperaturePoint, ModbusFeedStatus } from '@/types/digital-twin';

const MODEL_PATH = '/cad/langan.glb';
const BACKGROUND = '#05070a';
const NORMALIZED_SPAN = 13.8;
const SENSOR_ANCHOR_POSITION: [number, number, number] = [0, 2.72, 0];

export interface BlastFurnaceSceneProps {
  temperaturePoint?: DigitalTwinTemperaturePoint | null;
  feedStatus?: ModbusFeedStatus;
  businessAlarm?: DigitalTwinBusinessAlarm | null;
}

const feedStatusLabel: Record<ModbusFeedStatus, string> = {
  mock: 'Mock 推送',
  connecting: 'WS 连接中',
  connected: 'WS 实时',
  fallback: 'WS 回退 Mock',
  error: 'WS 异常',
  retrying: '重连中',
};

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

function TemperatureSensorMarker({
  point,
  status,
  alarm,
}: {
  point: DigitalTwinTemperaturePoint | null;
  status: ModbusFeedStatus;
  alarm: DigitalTwinBusinessAlarm | null;
}) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const isDisconnected = status === 'error';
  const isRetrying = status === 'retrying';
  const isConnectionIssue = isDisconnected || isRetrying;
  const isAlarm = Boolean(alarm) && !isConnectionIssue;
  const color = isDisconnected ? feedStatusColor.error : isRetrying ? feedStatusColor.retrying : isAlarm ? '#f97316' : feedStatusColor[status];

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const scale = 1 + Math.sin(clock.elapsedTime * 3.1) * 0.18;
    pulseRef.current.scale.setScalar(scale);
  });

  if (!point) return null;

  const value = isAlarm && alarm ? alarm.maxTemp : point.temperature;
  const statusText = isDisconnected
    ? '连接中断'
    : isRetrying
      ? '重连中'
      : isAlarm && alarm
        ? `高温报警 · ${alarm.level}级`
        : feedStatusLabel[status];
  const detailText = isDisconnected
    ? 'WS /ws/modbus 连接中断'
    : isRetrying
      ? 'WS /ws/modbus 正在重连'
      : isAlarm && alarm
        ? `阈值 ${alarm.thresholdTemp.toFixed(1)} °C · ${alarm.ruleType}`
        : feedStatusLabel[status];

  return (
    <group position={SENSOR_ANCHOR_POSITION}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.4, 14]} />
        <meshBasicMaterial color={color} transparent opacity={0.78} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.07, 24, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} roughness={0.36} metalness={0.15} />
      </mesh>
      <mesh ref={pulseRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.007, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.64} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight color={color} intensity={1.35} distance={1.8} />
      <Html position={[0, 0.54, 0]} center distanceFactor={8.5} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            minWidth: 138,
            padding: '8px 10px',
            border: `1px solid ${color}66`,
            borderRadius: 8,
            background: 'rgba(5, 7, 10, 0.78)',
            boxShadow: `0 0 24px ${color}22`,
            color: 'rgba(245,250,255,0.92)',
            fontSize: 11,
            lineHeight: 1.35,
            transform: 'translateX(-86px)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ color: 'rgba(214,232,248,0.62)' }}>
            {point.locationName} · {point.locationId}
          </div>
          <strong style={{ display: 'block', marginTop: 2, color, fontFamily: 'monospace', fontSize: 18, fontWeight: 700 }}>
            {statusText} {value.toFixed(1)} °C
          </strong>
          <div style={{ marginTop: 2, color: 'rgba(214,232,248,0.62)' }}>
            {detailText} · {isDisconnected ? point.receivedAt : alarm?.receivedAt ?? point.receivedAt}
          </div>
        </div>
      </Html>
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
        加载 GLB CAD 模型...
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
            <TemperatureSensorMarker point={temperaturePoint} status={feedStatus} alarm={businessAlarm} />
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

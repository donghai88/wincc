'use client';

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, Html, Line, OrbitControls, useFBX } from '@react-three/drei';
import * as THREE from 'three';
import type { SimulationLayer } from './HotMetalTroughSimTwin';

const MODEL_PATH = '/cad/gaolu.fbx';
const NORMALIZED_SPAN = 13.8;

const flowCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-1.75, 0.72, 0.08),
  new THREE.Vector3(-0.55, 0.76, 0.06),
  new THREE.Vector3(0.75, 0.74, 0.03),
  new THREE.Vector3(2.0, 0.7, 0.02),
  new THREE.Vector3(3.1, 0.66, 0.02),
]);

interface HotMetalTroughSimSceneProps {
  activeLayer: SimulationLayer;
}

function normalizeModel(scene: THREE.Group) {
  const root = scene.clone(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = NORMALIZED_SPAN / Math.max(size.x, size.z, 1);

  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: '#6f88a2',
    metalness: 0.52,
    roughness: 0.3,
    transparent: true,
    opacity: 0.72,
    emissive: '#0b2032',
    emissiveIntensity: 0.34,
  });

  const highlightMaterial = new THREE.MeshStandardMaterial({
    color: '#9fb7cd',
    metalness: 0.62,
    roughness: 0.24,
    transparent: true,
    opacity: 0.8,
    emissive: '#123b55',
    emissiveIntensity: 0.46,
  });

  const deepMaterial = new THREE.MeshStandardMaterial({
    color: '#33475c',
    metalness: 0.44,
    roughness: 0.42,
    transparent: true,
    opacity: 0.66,
    emissive: '#061522',
    emissiveIntensity: 0.22,
  });

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: '#9bd7ff',
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });

  let meshIndex = 0;
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = meshIndex % 7 === 0
        ? highlightMaterial.clone()
        : meshIndex % 4 === 0
          ? deepMaterial.clone()
          : baseMaterial.clone();

      if (mesh.geometry && meshIndex % 2 === 0) {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(mesh.geometry, 24),
          edgeMaterial.clone()
        );
        edges.renderOrder = 2;
        mesh.add(edges);
      }

      meshIndex += 1;
    }
  });

  return root;
}

function CadModel() {
  const scene = useFBX(MODEL_PATH);
  const normalized = useMemo(() => normalizeModel(scene), [scene]);
  return <primitive object={normalized} />;
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
        加载 FBX 模型与仿真覆盖层...
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

useFBX.preload(MODEL_PATH);

export default function HotMetalTroughSimScene({ activeLayer }: HotMetalTroughSimSceneProps) {
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

      <ambientLight intensity={0.72} color="#dbeafe" />
      <directionalLight position={[7, 9, 7]} intensity={2.25} color="#ffffff" castShadow />
      <pointLight position={[-4, 3.2, 3]} intensity={5.2} color="#22d3ee" distance={10} />
      <pointLight position={[4.5, 2.4, -3.2]} intensity={3.8} color="#fb923c" distance={10} />
      <pointLight position={[-2.6, 1.1, -0.4]} intensity={7.2} color="#f97316" distance={7} />
      <spotLight position={[0, 7, 6]} angle={0.45} penumbra={0.65} intensity={2.2} color="#93c5fd" castShadow />

      <Suspense fallback={<SceneLoader />}>
        <group>
          <CadModel />
          <SimulationOverlays activeLayer={activeLayer} />
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
        </group>
      </Suspense>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        minDistance={5}
        maxDistance={34}
        maxPolarAngle={Math.PI * 0.48}
        minPolarAngle={Math.PI * 0.16}
        target={[0.1, 0.78, -0.08]}
      />
    </Canvas>
  );
}

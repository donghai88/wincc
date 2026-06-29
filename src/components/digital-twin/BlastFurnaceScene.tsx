'use client';

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Html, OrbitControls, useFBX } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_PATH = '/cad/gaolu.fbx';
const BACKGROUND = '#05070a';

function CadModel() {
  const scene = useFBX(MODEL_PATH);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

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
        加载 FBX CAD 模型...
      </div>
    </Html>
  );
}

useFBX.preload(MODEL_PATH);

export default function BlastFurnaceScene() {
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
          <CadModel />
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

"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type * as THREE from "three";

function generateParticlePositions(count: number) {
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 8;
    arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }
  return arr;
}

const PARTICLE_COUNT = 180;
const PARTICLE_POSITIONS = generateParticlePositions(PARTICLE_COUNT);

function Orb() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const t = state.clock.getElapsedTime();
    mesh.rotation.y = t * 0.15;
    mesh.rotation.x = Math.sin(t * 0.2) * 0.15;

    const targetX = state.pointer.x * 0.3;
    const targetY = state.pointer.y * 0.2;
    mesh.position.x += (targetX - mesh.position.x) * 0.03;
    mesh.position.y += (targetY - mesh.position.y) * 0.03;
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.4, 4]} />
      <meshStandardMaterial
        color="#0ea5e9"
        emissive="#0369a1"
        emissiveIntensity={0.6}
        roughness={0.25}
        metalness={0.1}
        wireframe
      />
    </mesh>
  );
}

function Particles() {
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    const points = pointsRef.current;
    if (!points) return;
    points.rotation.y = state.clock.getElapsedTime() * 0.02;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[PARTICLE_POSITIONS, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#bae6fd"
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.7}
      />
    </points>
  );
}

/**
 * Ambient hero visual: a glowing wireframe orb with a soft particle field
 * that responds subtly to pointer position. Kept deliberately lightweight
 * (low particle count, no post-processing) and always dynamically imported
 * with ssr disabled by the caller.
 */
export default function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 3, 3]} intensity={1.2} color="#38bdf8" />
      <Orb />
      <Particles />
    </Canvas>
  );
}

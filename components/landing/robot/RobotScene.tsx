"use client";

import { useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { Robot } from "./Robot";

const COARSE_POINTER_QUERY = "(pointer: coarse)";

function subscribeCoarsePointer(callback: () => void): () => void {
  const mql = window.matchMedia(COARSE_POINTER_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getCoarsePointerSnapshot(): boolean {
  return window.matchMedia(COARSE_POINTER_QUERY).matches;
}

function getCoarsePointerServerSnapshot(): boolean {
  return false;
}

/**
 * The Canvas + lighting shell around the robot mesh (Parts 19/20) —
 * cinematic-but-clean camera, soft ambient + key + a subtle blue rim
 * light, no post-processing, capped pixel ratio and geometry complexity
 * (Part 14). Always dynamically imported with `ssr: false` by the caller
 * (RobotHero.tsx), same pattern the previous HeroScene.tsx used.
 */
export default function RobotScene({ onOpenChat }: { onOpenChat?: () => void }) {
  const isCoarsePointer = useSyncExternalStore(
    subscribeCoarsePointer,
    getCoarsePointerSnapshot,
    getCoarsePointerServerSnapshot
  );

  return (
    <Canvas
      dpr={[1, isCoarsePointer ? 1.5 : 2]}
      camera={{ position: [0, 0.1, 3.4], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      shadows={false}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 2.5]} intensity={1.1} color="#ffffff" />
      <pointLight position={[-2, 0.5, -1.5]} intensity={0.6} color="#38bdf8" />
      <Robot
        enablePointerTracking={!isCoarsePointer}
        reduceIntensity={isCoarsePointer}
        onOpenChat={onOpenChat}
      />
    </Canvas>
  );
}

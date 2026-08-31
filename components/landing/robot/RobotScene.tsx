"use client";

import { Suspense, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { Robot } from "./Robot";
import { RobotGLTFModel } from "./RobotGLTFModel";
import { RobotModelErrorBoundary } from "./RobotModelErrorBoundary";

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
 *
 * Model fallback chain: a real GLB at public/models/career-lens-robot.glb
 * (RobotGLTFModel) is tried first; if that file doesn't exist or fails to
 * parse, RobotModelErrorBoundary catches it and falls back to the
 * hand-built procedural robot (Robot.tsx) — which is what actually
 * renders today, since no GLB has been added yet. Both share the exact
 * same enablePointerTracking/reduceIntensity/onOpenChat interface, so
 * dropping a real model in later needs no change here.
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
      {(() => {
        const proceduralRobot = (
          <Robot enablePointerTracking={!isCoarsePointer} reduceIntensity={isCoarsePointer} onOpenChat={onOpenChat} />
        );
        return (
          <RobotModelErrorBoundary fallback={proceduralRobot}>
            {/* The procedural robot doubles as the Suspense loading state too
                (not just the error fallback) — so there's never a blank
                Canvas while the GLTF fetches/parses, only ever a smooth
                swap once it's ready. */}
            <Suspense fallback={proceduralRobot}>
              <RobotGLTFModel enablePointerTracking={!isCoarsePointer} reduceIntensity={isCoarsePointer} onOpenChat={onOpenChat} />
            </Suspense>
          </RobotModelErrorBoundary>
        );
      })()}
    </Canvas>
  );
}

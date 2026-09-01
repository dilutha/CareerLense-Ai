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
 *
 * Renders the hand-built procedural robot (Robot.tsx) directly. A GLB
 * loading path (RobotGLTFModel.tsx, still present in this directory)
 * was built and integrated but is NOT wired in here: live browser
 * testing (headless Chromium via Playwright, screenshots + pixel-level
 * readback + full console/pageerror capture) found it renders nothing
 * at all — no error, no crash, no console output, just a genuinely
 * empty canvas — even when mounted directly with no Suspense/
 * ErrorBoundary wrapping and even as that boundary's own fallback. The
 * procedural robot was verified working correctly by the same method
 * (screenshot evidence) and is what's actually live. See
 * docs/WSO2_INTEGRATION.md-adjacent UX phase notes for the full
 * debugging trail; the GLB path needs further investigation before
 * being re-enabled, not a quick retry.
 *
 * Camera distance is deliberately generous: at fov=38 and z=3.4 (the
 * original value), the visible vertical frustum (2*z*tan(fov/2) ≈ 2.34
 * units) was almost exactly the procedural robot's own height (~2.3
 * units) — a ~98% fill ratio with next to no margin, which can read as
 * "the robot fills a box" against the square container even with a
 * fully transparent canvas (no CSS border ever existed — this was a
 * framing math issue, not a border/background one). z=4.3 gives ≈2.96
 * visible height, a ~78% fill with real headroom on every side —
 * confirmed visually via the same screenshot method.
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
      camera={{ position: [0, 0.1, 4.3], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      shadows={false}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 2.5]} intensity={1.1} color="#ffffff" />
      <pointLight position={[-2, 0.5, -1.5]} intensity={0.6} color="#38bdf8" />
      <Robot enablePointerTracking={!isCoarsePointer} reduceIntensity={isCoarsePointer} onOpenChat={onOpenChat} />
    </Canvas>
  );
}

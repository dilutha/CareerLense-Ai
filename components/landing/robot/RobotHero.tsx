"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { useWebGLSupport } from "./use-webgl-support";
import { RobotFallback } from "./RobotFallback";
import { RobotSpeechBubble } from "./RobotSpeechBubble";

const RobotScene = dynamic(() => import("./RobotScene"), {
  ssr: false,
  loading: () => null,
});

/**
 * Top-level robot hero visual — decides between the real R3F scene and
 * the static fallback (Parts 16/17/18): `prefers-reduced-motion` disables
 * the 3D scene entirely; WebGL support is unknown during any
 * server-rendered pass (useWebGLSupport's getServerSnapshot is `false`)
 * so the static fallback doubles as the loading placeholder until
 * hydration resolves the real client-side value — never a flash of a
 * Canvas that immediately fails. The CTA/headline never depend on any of
 * this succeeding.
 */
export function RobotHero() {
  const reducedMotion = useReducedMotion();
  const webglSupported = useWebGLSupport();

  const showScene = !reducedMotion && webglSupported;

  return (
    <div className="relative h-full w-full">
      {showScene ? (
        <Suspense fallback={<RobotFallback />}>
          <RobotScene />
        </Suspense>
      ) : (
        <RobotFallback animated={!reducedMotion} />
      )}
      {!reducedMotion && <RobotSpeechBubble />}
    </div>
  );
}

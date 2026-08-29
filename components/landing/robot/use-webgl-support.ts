"use client";

import { useSyncExternalStore } from "react";

/**
 * Cheap, one-time WebGL availability probe (Part 18) — a canvas that
 * fails to get a webgl/webgl2 context means the R3F Canvas would fail
 * silently or throw; callers use this to render a static CSS/SVG
 * fallback instead, so the hero and its CTA never break.
 *
 * Implemented as a `useSyncExternalStore` read (result cached after the
 * first real check, "subscribe" is a no-op since it can't change during
 * a session) rather than `useEffect` + `useState` — this value only
 * exists client-side, and `getServerSnapshot` gives a safe `false` during
 * any server-rendered pass, resolving to the real value on hydration
 * without a synchronous setState-in-effect.
 */
function detectWebGLSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

let cachedResult: boolean | null = null;

function getSnapshot(): boolean {
  if (cachedResult === null) cachedResult = detectWebGLSupport();
  return cachedResult;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(): () => void {
  return () => {};
}

export function useWebGLSupport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

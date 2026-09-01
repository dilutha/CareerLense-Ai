"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

const MAX_OFFSET_PX = 8;

/**
 * A subtle "magnetic" hover effect for a single primary CTA (Part 21 —
 * "keep movement tiny"). Tracks the cursor only while it's over the
 * button's own bounds, translates toward it by a small, capped amount,
 * and springs back on leave. Built on Framer Motion's motion values
 * (useMotionValue/useSpring) rather than useState, so the 60fps pointer
 * tracking never triggers a React re-render — only a direct, GPU-
 * composited transform update.
 */
export function MagneticButton({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.4 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relativeX = e.clientX - (rect.left + rect.width / 2);
    const relativeY = e.clientY - (rect.top + rect.height / 2);
    x.set(Math.max(-MAX_OFFSET_PX, Math.min(MAX_OFFSET_PX, relativeX * 0.25)));
    y.set(Math.max(-MAX_OFFSET_PX, Math.min(MAX_OFFSET_PX, relativeY * 0.25)));
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={reducedMotion ? undefined : { x: springX, y: springY }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
}

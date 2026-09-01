"use client";

import { motion } from "framer-motion";

/**
 * A plain Framer Motion + HTML overlay, not part of the R3F scene (Part
 * 13: Framer Motion owns UI motion, Three.js owns the 3D robot itself —
 * kept out of the Canvas rather than using drei's <Html>, which isn't a
 * project dependency).
 */
export function RobotSpeechBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: 1.1, ease: "easeOut" }}
      // Anchored above the robot's head, centered — never over the face
      // (Part 3's explicit correction: the previous -top-2 right-0
      // placement sat directly on top of the head/face area). The small
      // downward-pointing tail visually connects it to the robot below.
      // Offset is deliberately smaller on mobile — live-verified via
      // screenshot that -top-20 clips against the viewport edge there,
      // since the robot sits near the top of the page in the mobile
      // (flex-col-reverse) layout with much less headroom above it than
      // desktop has.
      className="pointer-events-none absolute -top-11 left-1/2 z-10 w-[180px] -translate-x-1/2 rounded-2xl border border-navy/10 bg-white/95 px-3 py-2 text-center text-xs font-medium text-navy shadow-lg shadow-ocean/10 backdrop-blur sm:-top-20 sm:w-[200px] sm:px-3.5 sm:py-2.5 sm:text-sm lg:-top-24"
    >
      Hi 👋 I&apos;m CareerLens, your AI career buddy.
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-navy/10 bg-white/95"
      />
    </motion.div>
  );
}

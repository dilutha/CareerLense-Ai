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
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: 1.1, ease: "easeOut" }}
      className="pointer-events-none absolute -top-2 right-0 z-10 max-w-[190px] rounded-2xl rounded-br-sm border border-navy/10 bg-white/95 px-3.5 py-2.5 text-left text-xs font-medium text-navy shadow-lg shadow-ocean/10 backdrop-blur sm:text-sm"
    >
      Hi 👋 I&apos;m CareerLens, your AI career buddy.
    </motion.div>
  );
}

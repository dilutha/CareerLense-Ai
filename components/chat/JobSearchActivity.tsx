"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";

/**
 * Time-based, not fake-progress-based: there is no finer-grained real
 * backend event for the job-search phase today (the server sends one
 * "searching_jobs" status, then the actual discovery+matching pipeline
 * runs as a single operation — see app/api/chat/route.ts). These stages
 * are honest, qualitative descriptions of what's plausibly happening
 * during that window, not a claim of measured backend progress — no
 * percentages, matching the product's explicit "never fabricate
 * progress" rule. If the backend ever emits real per-phase events, this
 * should switch to driving off those instead of elapsed time.
 */
const STAGES = [
  "🔎 Looking through the latest opportunities...",
  "👀 Checking roles that actually fit...",
  "🧠 Matching them with your profile...",
  "✨ Almost there...",
] as const;

const STAGE_DELAYS_MS = [0, 1400, 3000, 5000] as const;

export function JobSearchActivity() {
  const reducedMotion = useReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const timers = STAGE_DELAYS_MS.slice(1).map((delay, i) => setTimeout(() => setStageIndex(i + 1), delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      aria-live="polite"
      className="flex w-fit items-center gap-2.5 rounded-2xl border border-navy/10 bg-white px-4 py-3 shadow-sm"
    >
      <motion.span
        animate={reducedMotion ? undefined : { scale: [1, 1.15, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sea-gradient text-white"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </motion.span>
      <AnimatePresence mode="wait">
        <motion.span
          key={stageIndex}
          initial={reducedMotion ? undefined : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-sm font-medium text-navy"
        >
          {STAGES[stageIndex]}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

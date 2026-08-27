"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Waves } from "lucide-react";

export function TypingIndicator() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="flex w-full items-center gap-3" aria-live="polite">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sea-gradient text-white">
        <Waves className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="flex items-center gap-2 text-sm text-navy-light/70">
        <span>CareerLens is thinking</span>
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-ocean"
              animate={
                reducedMotion
                  ? { opacity: 0.6 }
                  : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }
              }
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { ScanSearch, Waves } from "lucide-react";
import type { ChecklistCard } from "@/lib/ai/types";

/**
 * Renders a checklist-style card for CV-related agent steps. A future phase
 * will extend this to render real resume analysis scores once resume
 * processing is implemented.
 */
export function ResumeAnalysisMessage({ card }: { card: ChecklistCard }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex w-full items-start gap-3"
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sea-gradient text-white">
        <Waves className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="max-w-[85%] rounded-2xl border border-navy/10 bg-foam p-4 sm:max-w-[70%]">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
          <ScanSearch className="h-4 w-4 text-ocean" aria-hidden="true" />
          {card.title}
        </div>
        <ul className="flex flex-col gap-1.5">
          {card.items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-sm text-navy-light/80"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-ocean"
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

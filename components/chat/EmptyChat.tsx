"use client";

import { motion } from "framer-motion";
import { SuggestedPrompts } from "./SuggestedPrompts";

export function EmptyChat({
  onSelectPrompt,
}: {
  onSelectPrompt: (message: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-4"
      >
        <span className="text-4xl" aria-hidden="true">
          🌊
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
          Ado, let&apos;s figure this out.
        </h1>
        <p className="max-w-sm text-balance text-navy-light/75">
          Your career doesn&apos;t need to be confusing. Tell me what
          you&apos;re looking for and we&apos;ll figure it out together.
        </p>
        <p className="rounded-2xl border border-navy/10 bg-foam px-5 py-3 text-sm italic text-navy-light/80">
          &ldquo;machan mata internship ekak oni&rdquo;
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="w-full"
      >
        <SuggestedPrompts onSelect={onSelectPrompt} />
      </motion.div>
    </div>
  );
}

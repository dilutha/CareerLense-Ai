"use client";

import { motion } from "framer-motion";

const PROMPTS = [
  { emoji: "💼", label: "Find me an internship", message: "Find me an internship" },
  { emoji: "📄", label: "Check my CV", message: "CV eka check karapan" },
  { emoji: "🌐", label: "Review my portfolio", message: "Can you review my portfolio?" },
  { emoji: "🎤", label: "Practice an interview", message: "Let's practice an interview" },
  {
    emoji: "🔎",
    label: "Find Data Analyst jobs",
    message: "Find me Data Analyst jobs in Colombo",
  },
];

export function SuggestedPrompts({
  onSelect,
}: {
  onSelect: (message: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {PROMPTS.map((prompt, i) => (
        <motion.button
          key={prompt.label}
          type="button"
          onClick={() => onSelect(prompt.message)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06 }}
          whileHover={{ y: -2 }}
          className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white px-4 py-2 text-sm font-medium text-navy shadow-sm transition-colors hover:border-ocean/30 hover:bg-foam focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">{prompt.emoji}</span>
          {prompt.label}
        </motion.button>
      ))}
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import type { ChatMessage } from "@/lib/ai/types";

export function SystemMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      role="alert"
      className="mx-auto flex w-full max-w-[85%] items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:max-w-[70%]"
    >
      <AlertCircle
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
        aria-hidden="true"
      />
      <p className="whitespace-pre-line">{message.content}</p>
    </motion.div>
  );
}

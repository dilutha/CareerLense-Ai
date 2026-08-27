"use client";

import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Waves } from "lucide-react";
import type { ChatMessage } from "@/lib/ai/types";

export function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex w-full items-start gap-3"
      aria-live={message.streaming ? "off" : "polite"}
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sea-gradient text-white">
        <Waves className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 max-w-[85%] text-sm leading-relaxed text-navy sm:max-w-[75%] sm:text-base [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:flex [&_ul]:list-none [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
}

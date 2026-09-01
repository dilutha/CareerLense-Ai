"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { ChatMessage } from "@/lib/ai/types";

/** Memoized: a user message's props never change after creation, but ChatWindow's setState on every streamed token re-renders the whole MessageList — this skips re-executing every already-rendered message on each of those. */
export const UserMessage = memo(function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex w-full justify-end"
    >
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-sea-gradient px-4 py-2.5 text-sm leading-relaxed text-white sm:max-w-[70%] sm:text-base">
        {message.content}
      </div>
    </motion.div>
  );
});

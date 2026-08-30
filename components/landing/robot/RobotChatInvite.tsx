"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Part 22 — clicking the robot reveals this, positioned below/beside it
 * rather than over its face, so it reads as "the robot invited you to
 * chat" rather than a customer-support widget bolted onto the model.
 */
export function RobotChatInvite({ open }: { open: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute -bottom-2 left-1/2 z-10 w-[220px] -translate-x-1/2 rounded-2xl rounded-tl-sm border border-navy/10 bg-white/95 p-3.5 text-center shadow-lg shadow-ocean/10 backdrop-blur"
        >
          <p className="text-xs font-medium text-navy sm:text-sm">
            Hi! I&apos;m CareerLens. Tell me what career you&apos;re looking for.
          </p>
          <Link
            href="/chat"
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-sea-gradient px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
          >
            Start chatting →
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

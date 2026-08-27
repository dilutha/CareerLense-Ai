"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  FileText,
  Globe,
  Mail,
  Mic,
  PenLine,
  Search,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { ToolStatusType } from "@/lib/ai/types";

const TOOL_STATUS_META: Record<
  ToolStatusType,
  { icon: LucideIcon; label: string }
> = {
  searching_jobs: { icon: Search, label: "Looking for relevant jobs..." },
  analyzing_resume: { icon: FileText, label: "Checking your CV..." },
  analyzing_portfolio: { icon: Globe, label: "Looking at your portfolio..." },
  matching_job: { icon: Target, label: "Comparing your profile..." },
  improving_resume: { icon: PenLine, label: "Refining your CV..." },
  generating_cover_letter: {
    icon: Mail,
    label: "Writing your cover letter...",
  },
  preparing_interview: {
    icon: Mic,
    label: "Preparing interview questions...",
  },
};

export function ToolStatus({ toolStatus }: { toolStatus: ToolStatusType }) {
  const reducedMotion = useReducedMotion();
  const { icon: Icon, label } = TOOL_STATUS_META[toolStatus];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex w-fit items-center gap-2 rounded-full bg-foam px-3.5 py-1.5 text-sm font-medium text-ocean"
    >
      <motion.span
        animate={reducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="flex"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </motion.span>
      {label}
    </motion.div>
  );
}

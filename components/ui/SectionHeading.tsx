"use client";

import { motion } from "framer-motion";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  const alignment =
    align === "center"
      ? "items-center text-center"
      : "items-start text-left";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5 }}
      className={`flex flex-col gap-3 ${alignment}`}
    >
      {eyebrow && (
        <span className="text-sm font-medium uppercase tracking-wide text-ocean">
          {eyebrow}
        </span>
      )}
      <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="max-w-xl text-balance text-base text-navy-light/80 sm:text-lg">
          {description}
        </p>
      )}
    </motion.div>
  );
}

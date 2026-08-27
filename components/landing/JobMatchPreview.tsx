"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, HelpCircle, Minus } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const SKILLS = [
  { name: "Python", status: "match" },
  { name: "SQL", status: "match" },
  { name: "Power BI", status: "match" },
  { name: "Excel", status: "partial" },
  { name: "Statistics", status: "unknown" },
] as const;

const STATUS_ICON: Record<(typeof SKILLS)[number]["status"], ReactNode> = {
  match: <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />,
  partial: <Minus className="h-4 w-4 text-amber-500" aria-hidden="true" />,
  unknown: (
    <HelpCircle className="h-4 w-4 text-navy-light/50" aria-hidden="true" />
  ),
};

const STATUS_LABEL: Record<(typeof SKILLS)[number]["status"], string> = {
  match: "Demonstrated",
  partial: "Weak evidence",
  unknown: "Not shown",
};

export function JobMatchPreview() {
  return (
    <section className="bg-sea-gradient-soft py-24">
      <Container className="flex flex-col items-center gap-12">
        <SectionHeading
          eyebrow="Product preview — not a live listing"
          title="Here's what a match looks like."
          description="This is a static example. CareerLens will explain a real match this clearly once it knows your profile."
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md rounded-2xl border border-navy/10 bg-white p-6 shadow-lg shadow-ocean/10"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-navy">
                Data Analyst Intern
              </h3>
              <p className="text-sm text-navy-light/70">ABC Technologies</p>
              <p className="text-sm text-navy-light/70">
                Colombo • Internship
              </p>
            </div>
            <span className="whitespace-nowrap rounded-full bg-sea-gradient px-3 py-1 text-sm font-semibold text-white">
              89% Match 🔥
            </span>
          </div>

          <ul className="mt-5 flex flex-col gap-2 border-t border-navy/10 pt-4">
            {SKILLS.map((skill) => (
              <li
                key={skill.name}
                className="flex items-center justify-between text-sm text-navy"
              >
                <span>{skill.name}</span>
                <span className="flex items-center gap-1.5 text-navy-light/70">
                  {STATUS_ICON[skill.status]}
                  {STATUS_LABEL[skill.status]}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-col gap-3 border-t border-navy/10 pt-4 text-left text-sm">
            <div>
              <p className="font-semibold text-navy">Why this matches</p>
              <p className="text-navy-light/70">
                Strong Python + SQL experience, relevant university projects,
                Power BI demonstrated in portfolio.
              </p>
            </div>
            <div>
              <p className="font-semibold text-navy">Skill gap</p>
              <p className="text-navy-light/70">Excel evidence is weak.</p>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}

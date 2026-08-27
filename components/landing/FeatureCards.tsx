"use client";

import { motion } from "framer-motion";
import { Briefcase, Mic, ScanSearch, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const FEATURES = [
  {
    icon: Briefcase,
    title: "Find Jobs",
    description:
      "Find internships and entry-level opportunities that actually match your profile.",
  },
  {
    icon: ScanSearch,
    title: "Fix My CV",
    description:
      "Compare your CV with a real job and see exactly what needs improvement.",
  },
  {
    icon: Sparkles,
    title: "Improve My Portfolio",
    description:
      "Get recruiter-readiness and basic SEO suggestions for your portfolio.",
  },
  {
    icon: Mic,
    title: "Practice Interviews",
    description:
      "Practice questions based on the actual role you're applying for.",
  },
];

export function FeatureCards() {
  return (
    <section id="features" className="bg-white py-24">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="Everything in one place"
          title="One career buddy. Everything you need."
        />

        <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-foam p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sea-gradient text-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold text-navy">{title}</h3>
              <p className="text-sm text-navy-light/80">{description}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const FLOW = [
  "Your CV",
  "CareerLens understands you",
  "Relevant Job",
  "87% Match",
  "CV refined",
  "Cover Letter",
  "Interview Practice",
  "Apply",
];

export function CareerJourney() {
  return (
    <section className="bg-white py-24">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="The full picture"
          title="From your CV to your first offer."
        />

        <div className="flex w-full max-w-4xl flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
          {FLOW.map((step, i) => (
            <div key={step} className="flex items-center gap-2 sm:gap-3">
              <motion.span
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className="rounded-full border border-navy/10 bg-foam px-4 py-2 text-sm font-medium text-navy shadow-sm"
              >
                {step}
              </motion.span>
              {i < FLOW.length - 1 && (
                <ArrowRight
                  className="h-4 w-4 shrink-0 rotate-90 text-ocean sm:rotate-0"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

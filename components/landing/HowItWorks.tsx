"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const STEPS = [
  { number: "01", title: "Talk to CareerLens" },
  { number: "02", title: "Share your CV / Portfolio" },
  { number: "03", title: "Build your career profile" },
  { number: "04", title: "Find matching opportunities" },
  { number: "05", title: "Improve your application" },
  { number: "06", title: "Practice the interview" },
  { number: "07", title: "Apply with confidence" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-sea-gradient-soft py-24">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading eyebrow="The journey" title="How it works" />

        <ol className="flex w-full max-w-5xl flex-col gap-8 sm:flex-row sm:items-start sm:gap-0">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.number}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="flex gap-4 sm:flex-1 sm:flex-col sm:items-center sm:gap-3 sm:text-center"
            >
              <div className="flex flex-col items-center sm:w-full sm:flex-row">
                <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sea-gradient text-sm font-semibold text-white">
                  {step.number}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="mt-1 h-8 w-px bg-navy/15 sm:ml-2 sm:mt-0 sm:h-px sm:w-full sm:flex-1"
                  />
                )}
              </div>
              <p className="pb-2 text-sm font-medium text-navy sm:px-2 sm:pb-0">
                {step.title}
              </p>
            </motion.li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

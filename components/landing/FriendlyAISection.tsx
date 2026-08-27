"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function FriendlyAISection() {
  return (
    <section className="bg-white py-24">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="Why it feels different"
          title="Career tools don't have to feel like forms."
        />

        <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-foam p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-light/60">
              Other career tools
            </p>
            <p className="text-navy-light/90">
              &ldquo;Please enter your professional experience.&rdquo;
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col gap-3 rounded-2xl bg-sea-gradient p-6 text-white shadow-lg shadow-ocean/20"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
              CareerLens
            </p>
            <p>
              &ldquo;Ado, experience nathnam awulak na 😂 Student projects
              thiyenawanam ewa dapan. Eken start karamu.&rdquo;
            </p>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

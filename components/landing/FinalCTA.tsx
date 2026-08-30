"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/ui/Container";

export function FinalCTA({ isAuthenticated }: { isAuthenticated: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-sea-gradient py-24 text-white">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        animate={reducedMotion ? undefined : { y: [0, 24, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-sky-light/20 blur-3xl"
        animate={reducedMotion ? undefined : { y: [0, -24, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <Container className="relative flex flex-col items-center gap-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Ready da?
        </motion.h2>
        <p className="max-w-md text-balance text-white/85">
          Tell me what kind of job you&apos;re looking for. We&apos;ll figure
          out the rest.
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center gap-1 rounded-full bg-white px-6 py-3 text-sm font-semibold text-navy shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ocean"
        >
          Start Chatting →
        </Link>
        {!isAuthenticated && <p className="text-xs text-white/70">No account needed to start.</p>}
      </Container>
    </section>
  );
}

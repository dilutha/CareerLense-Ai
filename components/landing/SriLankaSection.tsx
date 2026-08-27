"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";

const TAGS = [
  "Internships",
  "Graduate Jobs",
  "Entry-Level Roles",
  "Remote Opportunities",
  "Colombo",
  "Kandy",
  "Galle",
  "Sri Lanka",
];

export function SriLankaSection() {
  return (
    <section id="for-students" className="bg-white py-24">
      <Container className="flex flex-col items-center gap-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-4"
        >
          <h2 className="text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            Built with Sri Lankan job seekers in mind. 🇱🇰
          </h2>
          <p className="max-w-2xl text-balance text-base text-navy-light/80 sm:text-lg">
            From your first internship to your first full-time role,
            CareerLens helps you navigate the job hunt without needing to
            know all the &ldquo;professional English&rdquo; first.
          </p>
        </motion.div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {TAGS.map((tag, i) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-full border border-ocean/20 bg-foam px-4 py-2 text-sm font-medium text-ocean"
            >
              {tag}
            </motion.span>
          ))}
        </div>
      </Container>
    </section>
  );
}

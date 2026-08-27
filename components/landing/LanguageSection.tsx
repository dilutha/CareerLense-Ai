"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";

const EXAMPLES = [
  "mata internship ekak oni",
  "machan CV eka check karapan",
  "I need a Data Analyst job",
  "interview practice karamu",
];

const LANGUAGES = [
  { flag: "🇱🇰", label: "Sinhala" },
  { flag: "💬", label: "Singlish" },
  { flag: "🇬🇧", label: "English" },
];

export function LanguageSection() {
  return (
    <section className="bg-sea-gradient-soft py-24">
      <Container className="flex flex-col items-center gap-10 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="text-3xl font-semibold tracking-tight text-navy sm:text-4xl"
        >
          You can talk normally.
        </motion.h2>

        <ul className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          {EXAMPLES.map((example, i) => (
            <motion.li
              key={example}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-xl border border-navy/10 bg-white px-4 py-3 text-left text-sm text-navy-light/90 shadow-sm sm:text-base"
            >
              &ldquo;{example}&rdquo;
            </motion.li>
          ))}
        </ul>

        <p className="text-lg font-medium text-navy">
          CareerLens understands all of them.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {LANGUAGES.map((lang) => (
            <span
              key={lang.label}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-navy shadow-sm"
            >
              <span aria-hidden="true">{lang.flag}</span>
              {lang.label}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}

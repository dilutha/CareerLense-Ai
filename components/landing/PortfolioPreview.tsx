"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const METRICS = [
  { label: "Recruiter Readiness", value: 84 },
  { label: "Project Evidence", value: 76 },
  { label: "Role Clarity", value: 91 },
  { label: "Basic SEO", value: 72 },
];

export function PortfolioPreview() {
  return (
    <section className="bg-sea-gradient-soft py-24">
      <Container className="grid w-full items-center gap-12 lg:grid-cols-2">
        <SectionHeading
          align="left"
          eyebrow="Product preview"
          title="Your portfolio can do more than look pretty."
          description="CareerLens checks your portfolio against what recruiters actually look for — and only ever suggests improvements backed by real evidence, never fabricated projects."
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-5 rounded-2xl border border-navy/10 bg-white p-6 shadow-lg shadow-ocean/10"
        >
          <p className="text-sm font-semibold text-navy">Portfolio Health</p>

          <div className="flex flex-col gap-4">
            {METRICS.map((metric, i) => (
              <div key={metric.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-navy-light/80">{metric.label}</span>
                  <span className="font-semibold text-navy">
                    {metric.value}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-foam">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${metric.value}%` }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.7,
                      delay: i * 0.1,
                      ease: "easeOut",
                    }}
                    className="h-full rounded-full bg-sea-gradient"
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="rounded-xl bg-foam px-4 py-3 text-sm italic text-navy-light/80">
            &ldquo;Your Power BI skill is listed, but where&apos;s the
            project?&rdquo;
          </p>
        </motion.div>
      </Container>
    </section>
  );
}

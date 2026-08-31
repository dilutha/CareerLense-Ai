"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { RobotHero } from "./robot/RobotHero";

export function Hero({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="relative overflow-hidden bg-sea-gradient-soft">
      <div className="relative mx-auto flex w-full max-w-6xl flex-col-reverse items-center gap-10 px-6 pb-20 pt-16 sm:pb-28 sm:pt-24 lg:flex-row lg:gap-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="flex flex-1 flex-col items-center gap-5 text-center lg:items-start lg:text-left"
        >
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-navy sm:text-5xl md:text-6xl">
            Let&apos;s Find Job 🌊
          </h1>
          <p className="max-w-lg text-balance text-lg text-navy-light/80">
            Your friendly AI career buddy for finding jobs, improving your CV
            and getting interview-ready.
          </p>

          <Link
            href="/chat"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-sea-gradient px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-ocean/25 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
          >
            Let&apos;s Talk →
          </Link>

          {!isAuthenticated && (
            <p className="text-sm text-navy-light/60">
              No account needed —{" "}
              <Link href="/signup" className="font-medium text-ocean hover:text-navy">
                sign up
              </Link>{" "}
              later to save your progress.
            </p>
          )}

          <p className="text-sm font-medium text-navy-light/60">
            Sinhala • Singlish • English
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative h-64 w-64 shrink-0 sm:h-80 sm:w-80 lg:h-96 lg:w-96"
        >
          <RobotHero />
        </motion.div>
      </div>
    </section>
  );
}

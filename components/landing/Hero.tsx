"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => null,
});

export function Hero({ isAuthenticated }: { isAuthenticated: boolean }) {
  const reducedMotion = useReducedMotion();
  const chatHref = isAuthenticated ? "/chat" : "/login?next=/chat";

  return (
    <section className="relative overflow-hidden bg-sea-gradient-soft">
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-6 pb-20 pt-16 text-center sm:pb-28 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative h-52 w-52 sm:h-72 sm:w-72"
        >
          {!reducedMotion ? (
            <Suspense fallback={null}>
              <HeroScene />
            </Suspense>
          ) : (
            <div
              aria-hidden="true"
              className="h-full w-full rounded-full bg-sea-gradient opacity-80 blur-2xl"
            />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="flex flex-col items-center gap-5"
        >
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-navy sm:text-5xl md:text-6xl">
            Ado, job ekak hoyamu. 🌊
          </h1>
          <p className="max-w-lg text-balance text-lg text-navy-light/80">
            Your friendly AI career buddy for finding jobs, improving your CV
            and getting interview-ready.
          </p>

          <Link
            href={chatHref}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-sea-gradient px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-ocean/25 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
          >
            Let&apos;s Talk →
          </Link>

          <p className="text-sm font-medium text-navy-light/60">
            Sinhala • Singlish • English
          </p>
        </motion.div>
      </div>
    </section>
  );
}

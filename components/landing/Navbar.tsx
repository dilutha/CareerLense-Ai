"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, User, Waves, X } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "For Students", href: "#for-students" },
];

export function Navbar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const chatHref = isAuthenticated ? "/chat" : "/login?next=/chat";
  const chatLabel = isAuthenticated ? "Open CareerLens →" : "Start Chatting →";

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-colors duration-300 ${
        scrolled
          ? "bg-white/80 shadow-sm backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 rounded-md"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sea-gradient text-white">
            <Waves className="h-4 w-4" aria-hidden="true" />
          </span>
          CareerLens
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium text-navy-light/80 transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 rounded-md"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-4 md:flex">
          {isAuthenticated ? (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-1.5 text-sm font-medium text-navy-light/80 hover:text-navy"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Profile
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-navy-light/80 hover:text-navy"
            >
              Login
            </Link>
          )}
          <Link
            href={chatHref}
            className="inline-flex items-center gap-1 rounded-full bg-sea-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
          >
            {chatLabel}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 md:hidden"
        >
          {open ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-navy/10 bg-white md:hidden"
          >
            <ul className="flex flex-col gap-1 px-6 py-4">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2 py-2.5 text-sm font-medium text-navy-light/80 hover:bg-foam hover:text-navy"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              {isAuthenticated ? (
                <li>
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2 py-2.5 text-sm font-medium text-navy-light/80 hover:bg-foam hover:text-navy"
                  >
                    Profile
                  </Link>
                </li>
              ) : (
                <li>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2 py-2.5 text-sm font-medium text-navy-light/80 hover:bg-foam hover:text-navy"
                  >
                    Login
                  </Link>
                </li>
              )}
              <li className="pt-2">
                <Link
                  href={chatHref}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-1 rounded-full bg-sea-gradient px-5 py-2.5 text-sm font-semibold text-white"
                >
                  {chatLabel}
                </Link>
              </li>
              {isAuthenticated && (
                <li className="pt-1">
                  <LogoutButton className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium text-navy-light/70 hover:bg-foam hover:text-navy" />
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

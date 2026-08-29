"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth/errors";

const inputClass =
  "w-full rounded-xl border border-navy/10 bg-foam px-4 py-2.5 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none sm:text-base";

export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setError("Fill in your name, email, and a password to get started.");
      return;
    }
    if (password.length < 6) {
      setError("Your password needs to be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords don't match — give it another go.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
            : undefined,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(friendlyAuthError(signUpError.message));
      return;
    }

    if (data.session) {
      // Email confirmation is off — the user is signed in immediately.
      // Chat-first: land them in the conversation, not a multi-step
      // wizard — profile setup is optional now (see /chat's own prompt
      // and CompletionCard on /profile for the progressive alternative).
      router.push(next);
      router.refresh();
      return;
    }

    // Email confirmation is required before a session exists.
    setAwaitingConfirmation(true);
  }

  if (awaitingConfirmation) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-navy/10 bg-foam px-6 py-8 text-center"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sea-gradient text-white">
          <MailCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="font-medium text-navy">Almost there — check your inbox.</p>
        <p className="text-sm text-navy-light/70">
          We sent a confirmation link to <span className="font-medium">{email}</span>. Click it
          to activate your account, then come back and log in.
        </p>
        <Link
          href="/login"
          className="mt-2 text-sm font-medium text-ocean hover:text-navy"
        >
          Back to login
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-name" className="text-sm font-medium text-navy">
          Full name
        </label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
          placeholder="Your name"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-email" className="text-sm font-medium text-navy">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-password" className="text-sm font-medium text-navy">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="At least 6 characters"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-confirm-password" className="text-sm font-medium text-navy">
          Confirm password
        </label>
        <input
          id="signup-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex items-center justify-center gap-2 rounded-full bg-sea-gradient px-6 py-3 text-sm font-semibold text-white shadow-md shadow-ocean/20 transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Create my account →
      </button>

      <p className="text-center text-sm text-navy-light/70">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ocean hover:text-navy">
          Login
        </Link>
      </p>
    </motion.form>
  );
}

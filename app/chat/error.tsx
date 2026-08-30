"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Chat route error:", error);
  }, [error]);

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="font-medium text-navy">I couldn&apos;t load this conversation.</p>
      <p className="max-w-sm text-sm text-navy-light/70">
        Your chats are still safe — this was just a temporary problem loading them. Try again.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-sea-gradient px-5 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
        >
          Try again
        </button>
        <Link href="/chat" className="text-sm font-medium text-ocean hover:text-navy">
          Back to chat
        </Link>
      </div>
    </div>
  );
}

"use client";

import type { RefObject } from "react";
import { Menu, Plus } from "lucide-react";

export function ChatHeader({
  onOpenSidebar,
  onNewChat,
  menuButtonRef,
}: {
  onOpenSidebar: () => void;
  onNewChat: () => void;
  menuButtonRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header className="flex items-center justify-between border-b border-navy/10 bg-white px-4 py-3 sm:px-6">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex flex-col items-center lg:items-start">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-navy">
          CareerLens <span aria-hidden="true">🌊</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-navy-light/60">
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
            aria-hidden="true"
          />
          AI Career Buddy
        </span>
      </div>

      <button
        type="button"
        onClick={onNewChat}
        aria-label="New chat"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-navy-light/70 transition-colors hover:bg-foam hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 lg:hidden"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
    </header>
  );
}

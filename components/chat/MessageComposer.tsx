"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, FileText, Link2, Plus, Square } from "lucide-react";
import type { ChatStatus } from "@/lib/ai/types";

const MAX_TEXTAREA_HEIGHT_PX = 200;

export function MessageComposer({
  onSend,
  onStop,
  status,
}: {
  onSend: (message: string) => void;
  onStop: () => void;
  status: ChatStatus;
}) {
  const busy = status === "sending" || status === "streaming";
  const [value, setValue] = useState("");
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, [value]);

  useEffect(() => {
    if (!attachMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!attachMenuRef.current?.contains(event.target as Node)) {
        setAttachMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [attachMenuOpen]);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !busy;

  function handleSend() {
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-navy/10 bg-white px-4 py-3 sm:px-6 sm:py-4">
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-navy/10 bg-foam px-3 py-2 shadow-sm focus-within:border-ocean/40">
        <div className="relative" ref={attachMenuRef}>
          <button
            type="button"
            onClick={() => setAttachMenuOpen((v) => !v)}
            aria-expanded={attachMenuOpen}
            aria-haspopup="menu"
            aria-label="Add attachment"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-navy-light/70 transition-colors hover:bg-white hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>

          <AnimatePresence>
            {attachMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                role="menu"
                className="absolute bottom-12 left-0 flex w-56 flex-col gap-1 rounded-xl border border-navy/10 bg-white p-1.5 shadow-lg"
              >
                <Link
                  href="/profile"
                  role="menuitem"
                  onClick={() => setAttachMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-navy hover:bg-foam"
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Upload CV
                </Link>
                <span
                  role="menuitem"
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm text-navy-light/50"
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  Add Portfolio URL
                  <span className="ml-auto text-xs">Soon</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <label htmlFor="chat-message-input" className="sr-only">
          Message CareerLens
        </label>
        <textarea
          id="chat-message-input"
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={busy}
          placeholder="Message CareerLens..."
          className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-sm text-navy placeholder:text-navy-light/50 focus:outline-none disabled:opacity-60 sm:text-base"
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
          >
            <Square className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sea-gradient text-white transition-opacity disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mx-auto mt-2 w-full max-w-3xl text-center text-xs text-navy-light/50">
        CareerLens can make mistakes. Nothing you share is saved yet.
      </p>
    </div>
  );
}

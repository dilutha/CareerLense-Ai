"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, MessageSquare, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { deleteConversation, renameConversation } from "@/lib/chat/actions";

type Mode = "idle" | "menu" | "renaming" | "confirmDelete";

export function ConversationItem({
  id,
  title,
  active = false,
  onNavigate,
  onDeleted,
  onRenamed,
}: {
  id: string;
  title: string;
  active?: boolean;
  onNavigate?: () => void;
  onDeleted: (id: string) => void;
  onRenamed: (id: string, title: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [draftTitle, setDraftTitle] = useState(title);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function startRename() {
    setDraftTitle(title);
    setMode("renaming");
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function saveRename() {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === title) {
      setMode("idle");
      return;
    }
    startTransition(async () => {
      const result = await renameConversation(id, trimmed);
      if (result.success) onRenamed(id, trimmed);
      setMode("idle");
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteConversation(id);
      if (result.success) onDeleted(id);
      setMode("idle");
    });
  }

  if (mode === "renaming") {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-foam px-2.5 py-1.5">
        <input
          ref={inputRef}
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveRename();
            if (e.key === "Escape") setMode("idle");
          }}
          disabled={pending}
          className="min-w-0 flex-1 bg-transparent text-sm text-navy focus:outline-none"
        />
        <button
          type="button"
          onClick={saveRename}
          disabled={pending}
          aria-label="Save name"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ocean hover:bg-white"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setMode("idle")}
          disabled={pending}
          aria-label="Cancel"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-navy-light/50 hover:bg-white"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (mode === "confirmDelete") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs">
        <span className="text-amber-900">Delete this chat?</span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("idle")}
            disabled={pending}
            className="rounded px-2 py-1 font-medium text-navy-light/70 hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={pending}
            className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center">
      <Link
        href={`/chat/${id}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`flex w-full items-center gap-2 truncate rounded-lg py-2 pl-2.5 pr-8 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 ${
          active
            ? "bg-foam font-medium text-navy"
            : "text-navy-light/75 hover:bg-foam hover:text-navy"
        }`}
      >
        <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{title}</span>
      </Link>

      <div className="absolute right-1">
        <button
          type="button"
          onClick={() => setMode(mode === "menu" ? "idle" : "menu")}
          aria-label="Chat options"
          aria-expanded={mode === "menu"}
          className={`flex h-6 w-6 items-center justify-center rounded text-navy-light/50 hover:bg-white hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean ${
            mode === "menu" ? "flex" : "hidden group-hover:flex group-focus-within:flex"
          }`}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        {mode === "menu" && (
          <div className="absolute right-0 top-7 z-10 w-32 overflow-hidden rounded-xl border border-navy/10 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={startRename}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-navy hover:bg-foam"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Rename
            </button>
            <button
              type="button"
              onClick={() => setMode("confirmDelete")}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

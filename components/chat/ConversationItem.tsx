"use client";

import { MessageSquare } from "lucide-react";

export function ConversationItem({
  title,
  active = false,
  onClick,
}: {
  title: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 ${
        active
          ? "bg-foam font-medium text-navy"
          : "text-navy-light/75 hover:bg-foam hover:text-navy"
      }`}
    >
      <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{title}</span>
    </button>
  );
}

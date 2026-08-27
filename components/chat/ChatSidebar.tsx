"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  ClipboardList,
  FileText,
  Globe,
  MessageCircle,
  Mic,
  Plus,
  Target,
  User,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ConversationItem } from "./ConversationItem";

const CONVERSATION_HISTORY: { group: string; items: string[] }[] = [
  { group: "Today", items: ["Data Analyst internship", "CV review"] },
  {
    group: "Yesterday",
    items: ["Software internship search", "Interview practice"],
  },
];

const TOOL_NAV: { label: string; icon: LucideIcon; href?: string; active?: boolean }[] = [
  { label: "Chat", icon: MessageCircle, href: "/chat", active: true },
  { label: "Jobs", icon: Briefcase, href: "/jobs" },
  { label: "My CV", icon: FileText, href: "/profile" },
  { label: "Portfolio", icon: Globe },
  { label: "Matches", icon: Target },
  { label: "Applications", icon: ClipboardList },
  { label: "Interview", icon: Mic },
];

export function ChatSidebar({
  onNewChat,
  onNavigate,
}: {
  onNewChat: () => void;
  onNavigate?: () => void;
}) {
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);

  return (
    <div className="flex h-full flex-col gap-4 bg-white p-3">
      <div className="flex items-center justify-between px-1 pt-1">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 text-base font-semibold text-navy"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sea-gradient text-white">
            <Waves className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          CareerLens
        </Link>
      </div>

      <button
        type="button"
        onClick={() => {
          onNewChat();
          onNavigate?.();
        }}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-sea-gradient px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New Chat
      </button>

      <nav
        aria-label="Conversation history"
        className="flex flex-1 flex-col gap-4 overflow-y-auto"
      >
        {CONVERSATION_HISTORY.map((group) => (
          <div key={group.group} className="flex flex-col gap-1">
            <p className="px-2.5 text-xs font-semibold uppercase tracking-wide text-navy-light/40">
              {group.group}
            </p>
            {group.items.map((title) => (
              <ConversationItem
                key={title}
                title={title}
                active={selectedConversation === title}
                onClick={() => setSelectedConversation(title)}
              />
            ))}
          </div>
        ))}

        <div className="flex flex-col gap-1 border-t border-navy/10 pt-3">
          <p className="px-2.5 text-xs font-semibold uppercase tracking-wide text-navy-light/40">
            Tools
          </p>
          {TOOL_NAV.map(({ label, icon: Icon, href, active }) =>
            href ? (
              <Link
                key={label}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium ${
                  active ? "bg-foam text-navy" : "text-navy-light/80 hover:bg-foam hover:text-navy"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            ) : (
              <span
                key={label}
                aria-disabled="true"
                className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-navy-light/45"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
                <span className="ml-auto rounded-full bg-navy/5 px-2 py-0.5 text-xs">
                  Soon
                </span>
              </span>
            )
          )}
        </div>
      </nav>

      <div className="flex flex-col gap-1 border-t border-navy/10 pt-3">
        <Link
          href="/profile"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-navy-light/80 hover:bg-foam hover:text-navy"
        >
          <User className="h-4 w-4" aria-hidden="true" />
          Profile
        </Link>
        <LogoutButton className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-navy-light/80 hover:bg-foam hover:text-navy" />
      </div>
    </div>
  );
}

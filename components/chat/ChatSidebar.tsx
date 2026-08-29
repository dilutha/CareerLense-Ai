"use client";

import Link from "next/link";
import {
  Bell,
  Briefcase,
  ClipboardList,
  FileText,
  Globe,
  Mic,
  Plus,
  Target,
  User,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import type { ConversationRow } from "@/lib/chat/types";
import { ConversationItem } from "./ConversationItem";

const TOOL_NAV: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Jobs", icon: Briefcase, href: "/jobs" },
  { label: "My CV", icon: FileText, href: "/profile" },
  { label: "Portfolio", icon: Globe, href: "/portfolio" },
  { label: "Career", icon: Target, href: "/career" },
  { label: "Applications", icon: ClipboardList, href: "/applications" },
  { label: "Interview", icon: Mic, href: "/interview" },
  { label: "Notifications", icon: Bell, href: "/notifications" },
];

function groupByRecency(conversations: ConversationRow[]): { group: string; items: ConversationRow[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const today: ConversationRow[] = [];
  const yesterday: ConversationRow[] = [];
  const thisWeek: ConversationRow[] = [];
  const older: ConversationRow[] = [];

  for (const c of conversations) {
    const t = new Date(c.last_message_at).getTime();
    if (t >= startOfToday) today.push(c);
    else if (t >= startOfYesterday) yesterday.push(c);
    else if (t >= startOfWeek) thisWeek.push(c);
    else older.push(c);
  }

  return [
    { group: "Today", items: today },
    { group: "Yesterday", items: yesterday },
    { group: "This week", items: thisWeek },
    { group: "Older", items: older },
  ].filter((g) => g.items.length > 0);
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onNewChat,
  onNavigate,
  onDeleted,
  onRenamed,
}: {
  conversations: ConversationRow[];
  activeConversationId: string | null;
  onNewChat: () => void;
  onNavigate?: () => void;
  onDeleted: (id: string) => void;
  onRenamed: (id: string, title: string) => void;
}) {
  const groups = groupByRecency(conversations);

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
        {groups.length === 0 && (
          <p className="px-2.5 text-sm text-navy-light/50">Your conversations will show up here.</p>
        )}

        {groups.map((group) => (
          <div key={group.group} className="flex flex-col gap-1">
            <p className="px-2.5 text-xs font-semibold uppercase tracking-wide text-navy-light/40">
              {group.group}
            </p>
            {group.items.map((c) => (
              <ConversationItem
                key={c.id}
                id={c.id}
                title={c.title}
                active={c.id === activeConversationId}
                onNavigate={onNavigate}
                onDeleted={onDeleted}
                onRenamed={onRenamed}
              />
            ))}
          </div>
        ))}

        <div className="flex flex-col gap-1 border-t border-navy/10 pt-3">
          <p className="px-2.5 text-xs font-semibold uppercase tracking-wide text-navy-light/40">
            Tools
          </p>
          {TOOL_NAV.map(({ label, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              onClick={onNavigate}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-navy-light/80 hover:bg-foam hover:text-navy"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
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

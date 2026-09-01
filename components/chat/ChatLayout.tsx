"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { ChatMessage } from "@/lib/ai/types";
import type { ConversationRow } from "@/lib/chat/types";
import { ChatHeader } from "./ChatHeader";
import type { GuestCandidate } from "./GuestCvUpload";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";

// A stable, module-level reference — NOT an inline `= []` default in the
// destructuring signature below. That would create a genuinely new array
// instance on every single render whenever the caller omits `conversations`
// (exactly guest mode's `<ChatLayout guest />`, which never passes it —
// see app/chat/page.tsx). The render-time state-sync a few lines down
// compares `initialConversations !== seenConversations` by reference; a
// fresh `[]` every render made that comparison ALWAYS true, calling
// setState on every render, which triggered another render, forever —
// "Too many re-renders", live-caught this session via real browser
// testing (this crashed the entire guest chat experience, silently, in
// every previous session — no unit test exercises this render path).
const EMPTY_CONVERSATIONS: ConversationRow[] = [];

export function ChatLayout({
  conversations: initialConversations = EMPTY_CONVERSATIONS,
  conversationsFailed = false,
  activeConversationId = null,
  initialMessages = [],
  guest = false,
}: {
  conversations?: ConversationRow[];
  conversationsFailed?: boolean;
  activeConversationId?: string | null;
  initialMessages?: ChatMessage[];
  guest?: boolean;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [seenConversations, setSeenConversations] = useState(initialConversations);
  const [conversations, setConversations] = useState(initialConversations);
  const [guestCandidate, setGuestCandidate] = useState<GuestCandidate | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Server-fetched conversations change whenever Next re-renders this tree
  // with fresh props (e.g. after router.refresh(), or a rename/delete
  // Server Action's revalidatePath) — resync local state to match.
  // Deliberately done during render (React's own documented pattern for
  // "adjusting state when a prop changes"), not in a useEffect — an
  // effect here would apply the new data one render late and trigger an
  // extra cascading render for something render-time comparison handles
  // in one pass.
  if (initialConversations !== seenConversations) {
    setSeenConversations(initialConversations);
    setConversations(initialConversations);
  }

  function handleNewChat() {
    setResetKey((key) => key + 1);
    router.push("/chat");
  }

  function handleConversationCreated(id: string) {
    // Optimistically add a placeholder row so the sidebar reflects the
    // new chat immediately — revalidatePath (triggered by the rename/
    // delete actions elsewhere) will reconcile it with the real title
    // next time the server data refreshes.
    setConversations((prev) => {
      if (prev.some((c) => c.id === id)) return prev;
      const now = new Date().toISOString();
      return [
        {
          id,
          profile_id: "",
          title: "New chat",
          title_is_custom: false,
          created_at: now,
          updated_at: now,
          last_message_at: now,
        },
        ...prev,
      ];
    });
    router.refresh();
  }

  function handleConversationDeleted(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeConversationId) {
      router.push("/chat");
    }
  }

  function handleConversationRenamed(id: string, title: string) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title, title_is_custom: true } : c)));
  }

  function openSidebar() {
    setSidebarOpen(true);
  }

  function closeSidebar() {
    setSidebarOpen(false);
    menuButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!sidebarOpen) return;

    const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
      "a, button:not([disabled])"
    );
    firstFocusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeSidebar();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  const sidebarProps = {
    conversations,
    conversationsFailed,
    activeConversationId,
    guest,
    onNewChat: handleNewChat,
    onDeleted: handleConversationDeleted,
    onRenamed: handleConversationRenamed,
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white lg:flex-row">
      <aside className="hidden w-72 shrink-0 border-r border-navy/10 lg:block">
        <ChatSidebar {...sidebarProps} />
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeSidebar}
              className="fixed inset-0 z-40 bg-navy/30 lg:hidden"
              aria-hidden="true"
            />
            <motion.div
              key="drawer"
              ref={drawerRef}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
              aria-label="Chat navigation"
              className="fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] border-r border-navy/10 lg:hidden"
            >
              <ChatSidebar {...sidebarProps} onNavigate={closeSidebar} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-h-0 flex-1 flex-col">
        <ChatHeader
          menuButtonRef={menuButtonRef}
          onOpenSidebar={openSidebar}
          onNewChat={handleNewChat}
        />
        <ChatWindow
          key={`${resetKey}-${activeConversationId ?? "new"}`}
          conversationId={activeConversationId}
          initialMessages={initialMessages}
          onConversationCreated={handleConversationCreated}
          guest={guest}
          guestCandidate={guestCandidate}
          onGuestCvParsed={setGuestCandidate}
        />
      </div>
    </div>
  );
}

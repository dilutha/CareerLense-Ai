"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatHeader } from "./ChatHeader";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";

export function ChatLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  function handleNewChat() {
    setResetKey((key) => key + 1);
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

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white lg:flex-row">
      <aside className="hidden w-72 shrink-0 border-r border-navy/10 lg:block">
        <ChatSidebar onNewChat={handleNewChat} />
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
              <ChatSidebar onNewChat={handleNewChat} onNavigate={closeSidebar} />
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
        <ChatWindow key={resetKey} />
      </div>
    </div>
  );
}

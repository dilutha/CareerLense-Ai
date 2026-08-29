"use client";

import { useEffect, useRef, useState } from "react";
import { streamChatReply } from "@/lib/ai/chat-client";
import type { AgentMessage, ChatMessage, ChatRole, ChatStatus } from "@/lib/ai/types";
import { EmptyChat } from "./EmptyChat";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";

const SCROLL_BOTTOM_THRESHOLD_PX = 80;

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toAgentMessages(messages: ChatMessage[]): AgentMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      role: message.role as ChatRole,
      content: message.content,
    }));
}

export function ChatWindow({
  conversationId = null,
  initialMessages = [],
  onConversationCreated,
}: {
  /** The persisted conversation this window is continuing, or null for a fresh chat that hasn't been saved yet. */
  conversationId?: string | null;
  /** Pre-loaded messages when opening an existing conversation (from app/chat/[id]/page.tsx). */
  initialMessages?: ChatMessage[];
  /** Called once, the moment a fresh chat's first turn creates a real conversation row — lets the parent update the sidebar/URL. */
  onConversationCreated?: (id: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Tracks the conversation this window is actually persisting to — starts
  // at the given conversationId (or null for a fresh chat) and is filled
  // in by the "conversation" stream event the first time a brand-new chat
  // gets its first real message saved.
  const activeConversationIdRef = useRef<string | null>(conversationId);

  useEffect(() => {
    // Cancel any in-flight generation if this window unmounts (e.g. "New
    // Chat" remounts a fresh ChatWindow via a key change).
    return () => abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !shouldAutoScrollRef.current) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, chatStatus]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < SCROLL_BOTTOM_THRESHOLD_PX;
  }

  async function handleSend(text: string) {
    if (chatStatus === "sending" || chatStatus === "streaming") return;

    shouldAutoScrollRef.current = true;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: text,
      createdAt: new Date(),
      status: "sent",
    };
    const historyForAgent = toAgentMessages([...messages, userMessage]);

    setMessages((prev) => [...prev, userMessage]);
    setChatStatus("sending");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const assistantMessageId = createId();
    let receivedFirstChunk = false;
    let toolStatusMessageId: string | null = null;

    function clearToolStatus() {
      if (!toolStatusMessageId) return;
      const idToRemove = toolStatusMessageId;
      toolStatusMessageId = null;
      setMessages((prev) => prev.filter((m) => m.id !== idToRemove));
    }

    try {
      for await (const event of streamChatReply(historyForAgent, {
        signal: abortController.signal,
        conversationId: activeConversationIdRef.current,
      })) {
        shouldAutoScrollRef.current = true;

        if (event.type === "conversation") {
          const isNewlyCreated = activeConversationIdRef.current === null;
          activeConversationIdRef.current = event.conversationId;
          if (isNewlyCreated) {
            onConversationCreated?.(event.conversationId);
            // Deliberately the raw History API, not next/navigation's
            // router.replace: a real App Router navigation from /chat to
            // /chat/[id] re-renders app/chat/[id]/page.tsx as a fresh tree,
            // which would remount this exact component mid-stream and
            // discard the reply the user is watching arrive. This only
            // updates the address bar (bookmarkable/shareable/reload-safe
            // — a real page load of that URL goes through Next's router
            // normally) without touching React at all.
            window.history.replaceState(null, "", `/chat/${event.conversationId}`);
          }
          continue;
        }

        if (event.type === "status") {
          const id = createId();
          toolStatusMessageId = id;
          setMessages((prev) => [
            ...prev,
            { id, role: "tool", content: "", createdAt: new Date(), toolStatus: event.toolStatus },
          ]);
          continue;
        }

        if (event.type === "jobs") {
          clearToolStatus();
          setMessages((prev) => [
            ...prev,
            {
              id: createId(),
              role: "assistant",
              content: "",
              createdAt: new Date(),
              status: "sent",
              jobResults: event.jobs,
            },
          ]);
          continue;
        }

        if (event.type === "error") {
          clearToolStatus();
          setMessages((prev) => [
            ...prev,
            { id: createId(), role: "system", content: event.message, createdAt: new Date() },
          ]);
          continue;
        }

        const textChunk = event.content;

        if (!receivedFirstChunk) {
          receivedFirstChunk = true;
          clearToolStatus();
          setChatStatus("streaming");
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: "assistant",
              content: textChunk,
              createdAt: new Date(),
              streaming: true,
            },
          ]);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: m.content + textChunk }
                : m
            )
          );
        }
      }

      if (receivedFirstChunk) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, streaming: false, status: "sent" }
              : m
          )
        );
      }
      setChatStatus("complete");
    } catch (error) {
      const isAbort = (error as { name?: string })?.name === "AbortError";
      clearToolStatus();

      if (receivedFirstChunk) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, streaming: false, status: "sent" }
              : m
          )
        );
      }

      if (isAbort) {
        setChatStatus("complete");
      } else {
        setChatStatus("error");
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "system",
            content:
              error instanceof Error
                ? error.message
                : "Ado 😅 Gemini eka response denna bari una.\n\nTry eka parak aye yamu.",
            createdAt: new Date(),
          },
        ]);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {hasMessages ? (
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
            <MessageList
              messages={messages}
              isThinking={chatStatus === "sending"}
            />
          </div>
        ) : (
          <EmptyChat onSelectPrompt={handleSend} />
        )}
      </div>

      <MessageComposer onSend={handleSend} onStop={handleStop} status={chatStatus} />
    </div>
  );
}

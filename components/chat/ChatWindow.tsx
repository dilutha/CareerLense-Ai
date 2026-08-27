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

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

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

    try {
      for await (const event of streamChatReply(historyForAgent, {
        signal: abortController.signal,
      })) {
        shouldAutoScrollRef.current = true;

        if (event.type === "jobs") {
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
          setMessages((prev) => [
            ...prev,
            { id: createId(), role: "system", content: event.message, createdAt: new Date() },
          ]);
          continue;
        }

        const textChunk = event.content;

        if (!receivedFirstChunk) {
          receivedFirstChunk = true;
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

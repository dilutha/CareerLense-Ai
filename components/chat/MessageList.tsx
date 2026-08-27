"use client";

import type { ChatMessage } from "@/lib/ai/types";
import type { JobResultSummary } from "@/lib/jobs/summary";
import { AssistantMessage } from "./AssistantMessage";
import { JobPreviewMessage } from "./JobPreviewMessage";
import { JobResultsMessage } from "./JobResultsMessage";
import { ResumeAnalysisMessage } from "./ResumeAnalysisMessage";
import { SystemMessage } from "./SystemMessage";
import { ToolStatus } from "./ToolStatus";
import { TypingIndicator } from "./TypingIndicator";
import { UserMessage } from "./UserMessage";

export function MessageList({
  messages,
  isThinking,
}: {
  messages: ChatMessage[];
  isThinking: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {messages.map((message) => {
        if (message.role === "user") {
          return <UserMessage key={message.id} message={message} />;
        }
        if (message.role === "system") {
          return <SystemMessage key={message.id} message={message} />;
        }
        if (message.role === "tool" && message.toolStatus) {
          return (
            <ToolStatus key={message.id} toolStatus={message.toolStatus} />
          );
        }
        if (message.jobResults) {
          return (
            <JobResultsMessage
              key={message.id}
              jobs={message.jobResults as JobResultSummary[]}
            />
          );
        }
        if (message.jobPreview) {
          return (
            <JobPreviewMessage key={message.id} card={message.jobPreview} />
          );
        }
        if (message.resumeAnalysis) {
          return (
            <ResumeAnalysisMessage
              key={message.id}
              card={message.resumeAnalysis}
            />
          );
        }
        return <AssistantMessage key={message.id} message={message} />;
      })}
      {isThinking && <TypingIndicator />}
    </div>
  );
}

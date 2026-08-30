import { notFound } from "next/navigation";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { requireUser } from "@/lib/auth/require-user";
import { getConversationsForUser, getConversationWithMessages } from "@/lib/chat/get-conversations";
import { toChatMessage } from "@/lib/chat/to-chat-message";

export default async function ChatConversationPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/chat/${id}`);

  const [{ conversations, failed }, detail] = await Promise.all([
    getConversationsForUser(user.id),
    getConversationWithMessages(user.id, id),
  ]);

  // Doesn't exist, or belongs to someone else — treated identically
  // (never reveals which) per Part 20's "never allow one user to access
  // another user's chats".
  if (!detail) notFound();

  return (
    <ChatLayout
      conversations={conversations}
      conversationsFailed={failed}
      activeConversationId={id}
      initialMessages={detail.messages.map(toChatMessage)}
    />
  );
}

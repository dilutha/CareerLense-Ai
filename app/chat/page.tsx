import { ChatLayout } from "@/components/chat/ChatLayout";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getConversationsForUser } from "@/lib/chat/get-conversations";

export default async function ChatPage() {
  const user = await getOptionalUser();

  if (!user) {
    return <ChatLayout guest />;
  }

  const { conversations, failed } = await getConversationsForUser(user.id);

  return <ChatLayout conversations={conversations} conversationsFailed={failed} />;
}

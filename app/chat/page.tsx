import { ChatLayout } from "@/components/chat/ChatLayout";
import { requireUser } from "@/lib/auth/require-user";
import { getConversationsForUser } from "@/lib/chat/get-conversations";

export default async function ChatPage() {
  const user = await requireUser("/chat");
  const conversations = await getConversationsForUser(user.id);

  return <ChatLayout conversations={conversations} />;
}

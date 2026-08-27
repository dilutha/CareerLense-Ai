import { ChatLayout } from "@/components/chat/ChatLayout";
import { requireUser } from "@/lib/auth/require-user";

export default async function ChatPage() {
  await requireUser("/chat");
  return <ChatLayout />;
}

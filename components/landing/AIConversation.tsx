"use client";

import { motion } from "framer-motion";
import { Search, Target } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

type ConversationItem =
  | { type: "user" | "ai"; text: string }
  | { type: "status"; text: string; icon: "search" | "target" };

const CONVERSATION: ConversationItem[] = [
  {
    type: "user",
    text: "machan mata data analyst internship ekak oni Colombo wala 😭",
  },
  {
    type: "ai",
    text: "Ado ela 😎 CV eka thiyenawanam dapan. Portfolio link ekak thiyenawanam ekath dapan. Mama oyage profile eka balala match wena internships hoyannam.",
  },
  { type: "user", text: "CV eka danna one da?" },
  {
    type: "ai",
    text: "Thiyenawanam definitely dapan. Nethnam awulak na — mama questions tikak ahala profile eka hadagannam.",
  },
  {
    type: "status",
    text: "Looking for relevant opportunities...",
    icon: "search",
  },
  { type: "status", text: "Found 6 potential matches", icon: "target" },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.35 } },
};

const bubble = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function AIConversation() {
  return (
    <section className="bg-white py-24">
      <Container className="flex flex-col items-center gap-12">
        <SectionHeading
          eyebrow="Watch it work"
          title="Don't know where to start?"
        />

        <motion.ul
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="flex w-full max-w-xl flex-col gap-3"
        >
          {CONVERSATION.map((item, i) => (
            <motion.li
              key={i}
              variants={bubble}
              className={
                item.type === "status" ? "flex w-full justify-center" : "flex w-full"
              }
            >
              {item.type === "status" ? (
                <div className="flex items-center gap-2 rounded-full bg-foam px-4 py-2 text-sm font-medium text-ocean">
                  {item.icon === "search" ? (
                    <Search className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Target className="h-4 w-4" aria-hidden="true" />
                  )}
                  {item.text}
                </div>
              ) : (
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:text-base ${
                    item.type === "user"
                      ? "ml-auto bg-sea-gradient text-white"
                      : "mr-auto border border-navy/10 bg-foam text-navy"
                  }`}
                >
                  {item.text}
                </div>
              )}
            </motion.li>
          ))}
        </motion.ul>
      </Container>
    </section>
  );
}

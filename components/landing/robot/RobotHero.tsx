"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { useWebGLSupport } from "./use-webgl-support";
import { RobotChatInvite } from "./RobotChatInvite";
import { RobotFallback } from "./RobotFallback";
import { RobotSpeechBubble } from "./RobotSpeechBubble";

const RobotScene = dynamic(() => import("./RobotScene"), {
  ssr: false,
  loading: () => null,
});

/**
 * Top-level robot hero visual — decides between the real R3F scene and
 * the static fallback (Parts 16/17/18): `prefers-reduced-motion` disables
 * the 3D scene entirely; WebGL support is unknown during any
 * server-rendered pass (useWebGLSupport's getServerSnapshot is `false`)
 * so the static fallback doubles as the loading placeholder until
 * hydration resolves the real client-side value — never a flash of a
 * Canvas that immediately fails. The CTA/headline never depend on any of
 * this succeeding.
 */
export function RobotHero() {
  const reducedMotion = useReducedMotion();
  const webglSupported = useWebGLSupport();
  const [chatInviteOpen, setChatInviteOpen] = useState(false);

  const showScene = !reducedMotion && webglSupported;

  function openChatInvite() {
    setChatInviteOpen(true);
  }

  return (
    <div className="relative h-full w-full">
      {showScene ? (
        // The Canvas below is pointer-only — WebGL content isn't part of
        // the accessibility tree, so the group's onClick/aria-label inside
        // Robot.tsx reaches mouse users only. This wrapper is the keyboard
        // path onto the exact same trigger (Part 20: "must be keyboard
        // accessible... do not rely only on hover").
        <div
          role="button"
          tabIndex={0}
          aria-label="Open CareerLens AI career assistant"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openChatInvite();
            }
          }}
          className="h-full w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
        >
          <Suspense fallback={<RobotFallback />}>
            <RobotScene onOpenChat={openChatInvite} />
          </Suspense>
        </div>
      ) : (
        <button
          type="button"
          onClick={openChatInvite}
          aria-label="Open chat with CareerLens"
          className="h-full w-full cursor-pointer bg-transparent"
        >
          <RobotFallback animated={!reducedMotion} />
        </button>
      )}
      {!reducedMotion && !chatInviteOpen && <RobotSpeechBubble />}
      <RobotChatInvite open={chatInviteOpen} />
    </div>
  );
}

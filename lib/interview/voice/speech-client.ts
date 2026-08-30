"use client";

/**
 * Thin wrapper around the browser's native Web Speech API (SpeechRecognition
 * for STT, SpeechSynthesis for TTS) — zero new dependencies for the MVP
 * (Phase 3's own instruction). Deliberately narrow interface
 * (startListening/stopListening/speak/cancelSpeaking) so a production
 * STT/TTS provider (e.g. a server-side streaming transcription service)
 * could implement the same shape later without touching
 * VoiceInterviewView.tsx at all — see the header comment on that
 * component for exactly what would need to change.
 *
 * Client-only by construction — every browser API here (`window.*`) is
 * unavailable during SSR, so this file is never imported from a Server
 * Component and every export guards against `window` being undefined.
 */

export interface SpeechRecognitionResultHandlers {
  onInterimResult?: (text: string) => void;
  onFinalResult: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
}

// The Web Speech API has no official TS lib.dom typing yet in this
// project's TS target — minimal local shape covering only what's used.
interface MinimalSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * One listening session — captures speech until the user stops talking
 * (or stop() is called), reporting interim (live-updating) and final
 * transcripts. Mic permission is requested by the browser itself the
 * first time start() runs; a denial surfaces through onError.
 */
export function createSpeechRecognizer(handlers: SpeechRecognitionResultHandlers): {
  start: () => void;
  stop: () => void;
} | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  const recognizer = new Ctor();
  recognizer.continuous = false;
  recognizer.interimResults = true;
  recognizer.lang = "en-US";

  recognizer.onresult = (event: unknown) => {
    // SpeechRecognitionEvent shape: { results: SpeechRecognitionResultList }
    const results = (event as { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }).results;
    let finalText = "";
    let interimText = "";
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interimText += result[0].transcript;
    }
    if (interimText) handlers.onInterimResult?.(interimText.trim());
    if (finalText) handlers.onFinalResult(finalText.trim());
  };

  recognizer.onerror = (event: unknown) => {
    const error = (event as { error?: string })?.error ?? "unknown";
    const message =
      error === "not-allowed" || error === "permission-denied"
        ? "Microphone access was denied. You can switch to typing your answer instead."
        : error === "no-speech"
          ? "I didn't hear anything — try again, or switch to typing."
          : "Something went wrong with speech recognition. You can switch to typing your answer instead.";
    handlers.onError(message);
  };

  recognizer.onend = () => handlers.onEnd?.();

  return {
    start: () => recognizer.start(),
    stop: () => recognizer.stop(),
  };
}

/** Speaks text aloud via the browser's TTS voices. Resolves when speaking finishes (or immediately if unsupported). */
export function speak(text: string): Promise<void> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve();

  return new Promise((resolve) => {
    window.speechSynthesis.cancel(); // never overlap with a previous utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function cancelSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}

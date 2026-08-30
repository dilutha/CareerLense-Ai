"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Ear, Keyboard, Loader2, Mic, Sparkles, Volume2 } from "lucide-react";
import { completeInterviewSession, submitAdaptiveAnswer } from "@/lib/interview/actions";
import type { InterviewExchangeRow, InterviewSessionRow } from "@/lib/interview/types";
import {
  cancelSpeaking,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speak,
} from "@/lib/interview/voice/speech-client";
import { CATEGORY_LABELS, InterviewSummary } from "./InterviewSummary";

/**
 * The voice interview — one question at a time, spoken aloud and
 * answered by microphone (Phase 3). Reuses the exact same backend as
 * text mode (submitAdaptiveAnswer -> evaluateInterviewAnswer ->
 * computeAnswerQualityScore, the same interview_exchanges rows,
 * InterviewSummary for the final rollup) — only the interaction surface
 * is different. Speech is provided by the browser's native Web Speech
 * API (lib/interview/voice/speech-client.ts) for this MVP; swapping in a
 * production STT/TTS provider later means changing only that one file's
 * internals (start/stop/speak), not this component.
 */

type Phase = "ready" | "speaking" | "listening" | "processing" | "error" | "finished";

const PHASE_META: Record<Exclude<Phase, "ready" | "error" | "finished">, { icon: typeof Mic; label: string }> = {
  speaking: { icon: Volume2, label: "Speaking..." },
  listening: { icon: Ear, label: "Listening..." },
  processing: { icon: Sparkles, label: "Thinking..." },
};

export function VoiceInterviewView({
  session,
  initialExchanges,
}: {
  session: InterviewSessionRow;
  initialExchanges: InterviewExchangeRow[];
}) {
  const router = useRouter();
  const [exchanges, setExchanges] = useState(initialExchanges);
  const [phase, setPhase] = useState<Phase>(session.status === "completed" ? "finished" : "ready");
  const [transcript, setTranscript] = useState("");
  const [manualAnswer, setManualAnswer] = useState("");
  const [useTyping, setUseTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<ReturnType<typeof createSpeechRecognizer> | null>(null);
  // Guards against duplicate submission/duplicate Gemini calls for the
  // SAME exchange — holds the exchange id currently in flight, or null.
  // Necessary because a stale recognizer callback (one whose stop() was
  // requested but hasn't taken effect yet) could otherwise fire
  // onFinalResult a second time for a question already being processed.
  const submittingExchangeIdRef = useRef<string | null>(null);
  // Guards against starting a second recognizer while speaking/listening
  // is already in progress (e.g. a rapid double-click on "Start this
  // question" before React re-renders to hide the button).
  const startingRef = useRef(false);

  const speechSupported = isSpeechRecognitionSupported() && isSpeechSynthesisSupported();
  const current = exchanges.find((e) => e.answer_text === null) ?? null;

  useEffect(() => {
    // A window/mic reference shouldn't outlive this component.
    return () => {
      recognizerRef.current?.stop();
      cancelSpeaking();
    };
  }, []);

  async function askCurrentQuestion() {
    if (!current || startingRef.current) return;
    startingRef.current = true;
    setError(null);
    setTranscript("");

    try {
      if (speechSupported && !useTyping) {
        setPhase("speaking");
        await speak(current.question);
        startListening();
      }
      // If typing mode / unsupported, stay on "ready" — the textarea handles input.
    } finally {
      startingRef.current = false;
    }
  }

  function startListening() {
    if (!current) return;
    let gotResult = false;

    const recognizer = createSpeechRecognizer({
      onInterimResult: (text) => setTranscript(text),
      onFinalResult: (text) => {
        gotResult = true;
        setTranscript(text);
        recognizerRef.current?.stop();
        submitAnswer(text);
      },
      onError: (message) => {
        gotResult = true; // suppress the onEnd fallback below — this error already explains what happened
        setError(message);
        setPhase("error");
      },
      onEnd: () => {
        // The browser stopped listening on its own (silence timeout,
        // implementation-specific) with neither a result nor an error —
        // without this, the UI would be stuck on "Listening..."
        // indefinitely. Only acts if we're still actually mid-listen for
        // THIS recognizer (an already-submitted turn's late onEnd is a
        // stale event and must not reset a newer question's state).
        if (!gotResult && recognizerRef.current === controls) {
          setError("I didn't catch that — try again, or switch to typing.");
          setPhase("error");
        }
      },
    });
    if (!recognizer) {
      setError("Speech recognition isn't available in this browser. Switch to typing your answer.");
      setPhase("error");
      return;
    }
    const controls = recognizer;
    recognizerRef.current = recognizer;
    setPhase("listening");
    recognizer.start();
  }

  function submitAnswer(answerText: string) {
    if (!current || !answerText.trim()) return;
    if (submittingExchangeIdRef.current === current.id) return; // already in flight for this exact question
    submittingExchangeIdRef.current = current.id;
    setPhase("processing");
    setError(null);

    submitAdaptiveAnswer(session.id, current.id, answerText.trim())
      .then((result) => {
        submittingExchangeIdRef.current = null;
        if (!result.success) {
          setError(result.error ?? "Couldn't evaluate that.");
          setPhase("error");
          return;
        }

        // Reflect the just-answered exchange locally (mirrors the text-mode pattern).
        setExchanges((prev) =>
          prev.map((e) => (e.id === current.id ? { ...e, answer_text: answerText.trim() } : e))
        );

        if (result.finished) {
          setPhase("finished");
          router.refresh();
          return;
        }

        if (result.exchangeId && result.question && result.category) {
          setExchanges((prev) => [
            ...prev,
            {
              id: result.exchangeId!,
              session_id: session.id,
              profile_id: session.profile_id,
              category: result.category as InterviewExchangeRow["category"],
              question: result.question!,
              order_index: prev.length,
              answer_text: null,
              feedback: null,
              quality_score: null,
              score_breakdown: null,
              created_at: new Date().toISOString(),
              answered_at: null,
            },
          ]);
          setManualAnswer("");
          setTranscript("");
          setPhase("ready");
        }
      })
      .catch(() => {
        submittingExchangeIdRef.current = null;
        setError("Something went wrong. Try again.");
        setPhase("error");
      });
  }

  function handleFinishEarly() {
    setPhase("processing");
    completeInterviewSession(session.id).then(() => {
      setPhase("finished");
      router.refresh();
    });
  }

  // Auto-advance to the next spoken question once it's ready, unless the
  // user has switched to typing.
  useEffect(() => {
    if (phase !== "ready" || !current || !speechSupported || useTyping) return;
    // Deferred to a microtask so the state updates inside
    // askCurrentQuestion() never run synchronously within the effect body
    // itself (React's own guidance: an effect should only ever call
    // setState from within a callback reacting to an external event, not
    // directly in its body) — functionally instant, fires before the
    // next paint.
    Promise.resolve().then(() => askCurrentQuestion());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const answeredCount = exchanges.filter((e) => e.answer_text !== null).length;
  const phaseMeta = phase === "speaking" || phase === "listening" || phase === "processing" ? PHASE_META[phase] : null;

  if (phase === "finished" || session.status === "completed") {
    return (
      <div className="flex flex-col gap-6">
        <InterviewSummary exchanges={exchanges} />
        <div className="flex flex-col gap-3">
          {exchanges
            .filter((e) => e.answer_text !== null)
            .map((e) => (
              <div key={e.id} className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="rounded-full bg-foam px-2.5 py-1 text-xs font-semibold text-navy">
                    {CATEGORY_LABELS[e.category] ?? e.category}
                  </span>
                  {e.quality_score !== null && <span className="text-sm font-semibold text-ocean">{e.quality_score}%</span>}
                </div>
                <p className="text-sm font-medium text-navy">{e.question}</p>
                <p className="mt-2 text-sm text-navy-light/70">{e.answer_text}</p>
                {e.feedback && (
                  <p className="mt-3 whitespace-pre-line border-t border-navy/10 pt-3 text-sm text-navy-light/80">
                    {e.feedback}
                  </p>
                )}
              </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
        <p className="text-sm text-navy-light/70">
          Question {answeredCount + 1} of {answeredCount + (current ? 1 : 0) || "..."}
        </p>
        <button
          type="button"
          onClick={() => setUseTyping((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-navy-light/60 hover:text-navy"
        >
          <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
          {useTyping ? "Switch to voice" : "Type instead"}
        </button>
      </div>

      {!speechSupported && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Voice isn&apos;t supported in this browser (Chrome/Edge on desktop work best). Type your answers instead —
          everything else works the same.
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {current && (
        <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <span className="mb-2 inline-block rounded-full bg-foam px-2.5 py-1 text-xs font-semibold text-navy">
            {CATEGORY_LABELS[current.category] ?? current.category}
          </span>
          <p className="text-base font-medium text-navy">{current.question}</p>

          {phaseMeta && (
            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-ocean">
              <phaseMeta.icon
                className={`h-4 w-4 ${phase === "listening" ? "animate-pulse" : ""}`}
                aria-hidden="true"
              />
              {phaseMeta.label}
            </div>
          )}

          {transcript && phase === "listening" && (
            <p className="mt-3 rounded-xl bg-foam px-3.5 py-2.5 text-sm italic text-navy-light/70">{transcript}</p>
          )}

          {(useTyping || !speechSupported || phase === "error") && phase !== "processing" && (
            <>
              <textarea
                value={manualAnswer}
                onChange={(e) => setManualAnswer(e.target.value)}
                rows={5}
                placeholder="Type your answer..."
                className="mt-4 w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2.5 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => submitAnswer(manualAnswer)}
                disabled={!manualAnswer.trim()}
                className="mt-3 flex items-center gap-2 rounded-full bg-sea-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20 disabled:opacity-60"
              >
                Submit answer
              </button>
            </>
          )}

          {speechSupported && !useTyping && (phase === "ready" || phase === "error") && (
            <button
              type="button"
              onClick={askCurrentQuestion}
              className="mt-4 flex items-center gap-2 rounded-full bg-sea-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              {phase === "error" ? "Try again" : "Start this question"}
            </button>
          )}

          {phase === "processing" && (
            <div className="mt-4 flex items-center gap-2 text-sm text-navy-light/60">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Evaluating your answer and preparing the next question...
            </div>
          )}
        </div>
      )}

      {answeredCount > 0 && phase !== "processing" && (
        <button
          type="button"
          onClick={handleFinishEarly}
          className="flex w-fit items-center gap-2 text-xs font-medium text-navy-light/50 hover:text-navy"
        >
          End interview now &amp; see summary
        </button>
      )}
    </div>
  );
}

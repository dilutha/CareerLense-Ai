/**
 * Pure, framerate-independent animation math for CareerLensRobot — kept
 * separate from the R3F `useFrame` glue so it's directly unit-testable
 * without a WebGL/DOM environment (three/@react-three/fiber can't be
 * meaningfully unit-tested in this project's plain-Vitest setup, but
 * plain functions of "elapsed time → a pose" can be).
 */

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Idle — a slow, continuous bob + a subtle "breathing" scale pulse. Never
// fully static (Part 4), but deliberately gentle (Part 26's "keep the
// animation slow and natural").
// ---------------------------------------------------------------------------

const IDLE_BOB_SPEED = 0.9; // radians/sec
const IDLE_BOB_AMPLITUDE = 0.08;
const IDLE_BREATH_SPEED = 1.3;
const IDLE_BREATH_AMPLITUDE = 0.015;

export interface IdlePose {
  bobY: number;
  breathScale: number;
}

export function getIdlePose(elapsedSec: number): IdlePose {
  return {
    bobY: Math.sin(elapsedSec * IDLE_BOB_SPEED) * IDLE_BOB_AMPLITUDE,
    breathScale: 1 + Math.sin(elapsedSec * IDLE_BREATH_SPEED) * IDLE_BREATH_AMPLITUDE,
  };
}

// ---------------------------------------------------------------------------
// Wave-on-load gesture (Part 5): raise → wave 2-3 cycles → relax. A pure
// function of elapsed time since the gesture started; returns null once
// finished so the caller falls back to idle sway.
// ---------------------------------------------------------------------------

const WAVE_RAISE_MS = 400;
const WAVE_HOLD_MS = 1800;
const WAVE_LOWER_MS = 400;
const WAVE_CYCLES = 3;
const WAVE_MAX_RAISE = -2.1; // radians — arm raised up and out
const WAVE_MAX_AMPLITUDE = 0.4;

export const WAVE_TOTAL_DURATION_MS = WAVE_RAISE_MS + WAVE_HOLD_MS + WAVE_LOWER_MS;

export interface WavePose {
  shoulderRaise: number;
  wristWave: number;
}

export function getWavePose(elapsedMs: number): WavePose | null {
  if (elapsedMs < 0 || elapsedMs >= WAVE_TOTAL_DURATION_MS) return null;

  if (elapsedMs < WAVE_RAISE_MS) {
    const t = elapsedMs / WAVE_RAISE_MS;
    return { shoulderRaise: WAVE_MAX_RAISE * easeOutCubic(t), wristWave: 0 };
  }

  if (elapsedMs < WAVE_RAISE_MS + WAVE_HOLD_MS) {
    const t = (elapsedMs - WAVE_RAISE_MS) / WAVE_HOLD_MS;
    return {
      shoulderRaise: WAVE_MAX_RAISE,
      wristWave: Math.sin(t * Math.PI * 2 * WAVE_CYCLES) * WAVE_MAX_AMPLITUDE,
    };
  }

  const t = (elapsedMs - WAVE_RAISE_MS - WAVE_HOLD_MS) / WAVE_LOWER_MS;
  return { shoulderRaise: WAVE_MAX_RAISE * (1 - easeInCubic(t)), wristWave: 0 };
}

// ---------------------------------------------------------------------------
// Click reaction (Part 8): a single small damped bounce + head tilt.
// ---------------------------------------------------------------------------

const CLICK_DURATION_MS = 600;
const CLICK_BOUNCE_AMPLITUDE = 0.12;
const CLICK_TILT_AMPLITUDE = 0.18;

export interface ClickPose {
  bounceY: number;
  headTilt: number;
}

export function getClickPose(elapsedMs: number): ClickPose | null {
  if (elapsedMs < 0 || elapsedMs >= CLICK_DURATION_MS) return null;
  const t = elapsedMs / CLICK_DURATION_MS;
  const damped = 1 - t * 0.3;
  return {
    bounceY: Math.sin(t * Math.PI) * CLICK_BOUNCE_AMPLITUDE * damped,
    headTilt: Math.sin(t * Math.PI) * CLICK_TILT_AMPLITUDE,
  };
}

// ---------------------------------------------------------------------------
// Cursor tracking (Part 6): constrained head-look — never lets the head
// rotate more than a small, natural-looking range.
// ---------------------------------------------------------------------------

const LOOK_MAX_YAW = 0.35; // radians, left/right
const LOOK_MAX_PITCH = 0.2; // radians, up/down

export function clampLookAt(pointerX: number, pointerY: number): { yaw: number; pitch: number } {
  return {
    yaw: clamp(pointerX, -1, 1) * LOOK_MAX_YAW,
    pitch: clamp(pointerY, -1, 1) * LOOK_MAX_PITCH,
  };
}

// ---------------------------------------------------------------------------
// Blink (Part 4): eyelid scale — a quick close-and-open, not a slow fade.
// ---------------------------------------------------------------------------

const BLINK_DURATION_MS = 160;

/** Returns the vertical eye scale (1 = fully open, ~0.05 = closed) for a blink that started `elapsedMs` ago, or 1 (fully open) once finished. */
export function getBlinkScale(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= BLINK_DURATION_MS) return 1;
  const t = elapsedMs / BLINK_DURATION_MS;
  // Closes over the first half, reopens over the second.
  const closeAmount = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
  return 1 - closeAmount * 0.92;
}

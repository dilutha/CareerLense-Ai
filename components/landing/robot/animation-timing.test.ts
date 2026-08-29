import { describe, expect, it } from "vitest";
import {
  clamp,
  clampLookAt,
  getBlinkScale,
  getClickPose,
  getIdlePose,
  getWavePose,
  WAVE_TOTAL_DURATION_MS,
} from "./animation-timing";

describe("clamp", () => {
  it("passes values through unchanged when within range", () => {
    expect(clamp(0.5, -1, 1)).toBe(0.5);
  });
  it("clamps values above the max", () => {
    expect(clamp(5, -1, 1)).toBe(1);
  });
  it("clamps values below the min", () => {
    expect(clamp(-5, -1, 1)).toBe(-1);
  });
});

describe("getIdlePose", () => {
  it("never returns a fully static pose — bob amplitude is never zero-range", () => {
    const a = getIdlePose(0);
    const b = getIdlePose(1);
    expect(a.bobY).not.toBe(b.bobY);
  });

  it("stays within a small, natural-looking amplitude", () => {
    for (let t = 0; t < 20; t += 0.5) {
      const pose = getIdlePose(t);
      expect(Math.abs(pose.bobY)).toBeLessThan(0.2);
      expect(pose.breathScale).toBeGreaterThan(0.9);
      expect(pose.breathScale).toBeLessThan(1.1);
    }
  });
});

describe("getWavePose", () => {
  it("returns null before the gesture starts", () => {
    expect(getWavePose(-10)).toBeNull();
  });

  it("returns null once the gesture has fully finished", () => {
    expect(getWavePose(WAVE_TOTAL_DURATION_MS + 1)).toBeNull();
  });

  it("raises the arm from a relaxed pose at the very start", () => {
    const pose = getWavePose(0);
    expect(pose).not.toBeNull();
    expect(pose!.shoulderRaise).toBeCloseTo(0, 1);
  });

  it("oscillates the wrist during the hold phase — never a static wave", () => {
    const early = getWavePose(600);
    const later = getWavePose(900);
    expect(early!.wristWave).not.toBe(later!.wristWave);
  });

  it("returns the arm to relaxed by the very end of the gesture", () => {
    const pose = getWavePose(WAVE_TOTAL_DURATION_MS - 1);
    expect(pose).not.toBeNull();
    expect(Math.abs(pose!.shoulderRaise)).toBeLessThan(0.2);
  });
});

describe("getClickPose", () => {
  it("returns null outside the reaction window", () => {
    expect(getClickPose(-1)).toBeNull();
    expect(getClickPose(1000)).toBeNull();
  });

  it("returns to a near-zero bounce right at the end of the window", () => {
    const pose = getClickPose(599);
    expect(pose).not.toBeNull();
    expect(Math.abs(pose!.bounceY)).toBeLessThan(0.05);
  });

  it("is a genuine bounce, not a static offset — peaks mid-way", () => {
    const start = getClickPose(10)!.bounceY;
    const middle = getClickPose(300)!.bounceY;
    expect(middle).toBeGreaterThan(start);
  });
});

describe("clampLookAt", () => {
  it("keeps yaw/pitch within a small, constrained range even for extreme pointer input", () => {
    const { yaw, pitch } = clampLookAt(10, -10);
    expect(Math.abs(yaw)).toBeLessThanOrEqual(0.35);
    expect(Math.abs(pitch)).toBeLessThanOrEqual(0.2);
  });

  it("cursor moving left produces a negative yaw (head turns left)", () => {
    const { yaw } = clampLookAt(-1, 0);
    expect(yaw).toBeLessThan(0);
  });

  it("cursor moving right produces a positive yaw (head turns right)", () => {
    const { yaw } = clampLookAt(1, 0);
    expect(yaw).toBeGreaterThan(0);
  });
});

describe("getBlinkScale", () => {
  it("is fully open (1) before and after the blink window", () => {
    expect(getBlinkScale(-1)).toBe(1);
    expect(getBlinkScale(1000)).toBe(1);
  });

  it("closes significantly at the midpoint of the blink", () => {
    const scale = getBlinkScale(80);
    expect(scale).toBeLessThan(0.3);
  });
});

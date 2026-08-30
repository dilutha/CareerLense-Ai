"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { clampLookAt, getBlinkScale, getClickPose, getIdlePose, getWavePose } from "./animation-timing";

const COLOR = {
  body: "#f0f9ff", // foam
  bodyAccent: "#0369a1", // ocean
  visor: "#0b1e3a", // navy
  eye: "#38bdf8", // sky
  eyeHover: "#7dd3fc",
  antennaTip: "#0ea5e9", // ocean-light
  limb: "#dceefc", // a touch darker than foam, for depth
};

const EYE_COLOR_BASE = new THREE.Color(COLOR.eye);
const EYE_COLOR_HOVER = new THREE.Color(COLOR.eyeHover);

const INITIAL_WAVE_DELAY_MS = 500;
const HOVER_WAVE_COOLDOWN_MS = 2600;

function useRoundedBox(width: number, height: number, depth: number, radius: number, segments = 4) {
  return useMemo(() => new RoundedBoxGeometry(width, height, depth, segments, radius), [width, height, depth, radius, segments]);
}

/**
 * A friendly AI robot built entirely from Three.js primitives (no glTF
 * model, no @react-three/drei — neither is already a project dependency,
 * and a hand-built primitive robot is lighter and easier to animate/
 * customize per PROJECT_SPEC's own preference). `RoundedBoxGeometry` is
 * imported directly from the `three` package's own examples module —
 * ships with `three`, so this adds zero new dependencies.
 */
export function Robot({
  enablePointerTracking,
  reduceIntensity = false,
  onOpenChat,
}: {
  enablePointerTracking: boolean;
  /** Slightly calmer motion for the mobile canvas — smaller amplitude, not a different animation system. */
  reduceIntensity?: boolean;
  /** Part 22 — a click still plays the local bounce, but also reveals the chat invite beside the robot. */
  onOpenChat?: () => void;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const eyeLeftRef = useRef<THREE.Mesh>(null);
  const eyeRightRef = useRef<THREE.Mesh>(null);
  const antennaTipRef = useRef<THREE.Mesh>(null);

  const [hovered, setHovered] = useState(false);

  const waveStartRef = useRef<number | null>(null);
  const waveArmedAtRef = useRef(false);
  const lastWaveEndRef = useRef(-Infinity);
  const clickStartRef = useRef<number | null>(null);
  // Randomized lazily on the first useFrame tick (see below), never
  // during render — React Compiler's purity check forbids calling an
  // impure function like Math.random() in the render body, including
  // inside a useRef() initializer expression.
  const nextBlinkAtRef = useRef<number | null>(null);
  const blinkStartRef = useRef<number | null>(null);
  // Mirrors state.clock's elapsed-ms, updated every frame — onClick (a
  // plain React event, outside useFrame) needs this to timestamp the
  // click-bounce gesture on the SAME clock useFrame reads from. Using
  // performance.now()/Date.now() here would be a different time base
  // than state.clock.getElapsedTime(), silently breaking the gesture.
  const currentElapsedMsRef = useRef(0);

  const headGeo = useRoundedBox(0.92, 0.82, 0.82, 0.28);
  const bodyGeo = useRoundedBox(0.78, 0.9, 0.6, 0.22);
  const visorGeo = useRoundedBox(0.62, 0.26, 0.12, 0.1);
  const handGeo = useMemo(() => new THREE.SphereGeometry(0.12, 16, 16), []);
  const footGeo = useMemo(() => new THREE.CapsuleGeometry(0.14, 0.12, 4, 8), []);
  const armGeo = useMemo(() => new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), []);
  const legGeo = useMemo(() => new THREE.CapsuleGeometry(0.11, 0.42, 4, 8), []);
  const antennaGeo = useMemo(() => new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), []);

  const amp = reduceIntensity ? 0.6 : 1;

  useFrame((state, delta) => {
    const elapsedSec = state.clock.getElapsedTime();
    const elapsedMs = elapsedSec * 1000;
    currentElapsedMsRef.current = elapsedMs;

    // Arm the auto-wave once the initial delay has passed, exactly once.
    if (!waveArmedAtRef.current && elapsedMs >= INITIAL_WAVE_DELAY_MS) {
      waveArmedAtRef.current = true;
      waveStartRef.current = elapsedMs;
    }

    // Lazy, one-time randomized seed for the first blink — deferred to
    // here (a per-frame callback, not the render body) so Math.random()
    // never runs during render.
    if (nextBlinkAtRef.current === null) {
      nextBlinkAtRef.current = elapsedSec + 2 + Math.random() * 2;
    }

    // --- Idle (always running underneath everything else) ---
    const idle = getIdlePose(elapsedSec);
    if (rootRef.current) rootRef.current.position.y = idle.bobY * amp;
    if (bodyRef.current) bodyRef.current.scale.setScalar(1 + (idle.breathScale - 1) * amp);

    // --- Cursor tracking (head look), constrained ---
    if (headRef.current) {
      const { yaw, pitch } = enablePointerTracking
        ? clampLookAt(state.pointer.x, state.pointer.y)
        : { yaw: 0, pitch: 0 };
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, yaw, Math.min(1, delta * 6));
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, -pitch, Math.min(1, delta * 6));
    }

    // --- Wave gesture (initial load + occasional hover) ---
    let waving = false;
    if (waveStartRef.current !== null) {
      const wavePose = getWavePose(elapsedMs - waveStartRef.current);
      if (wavePose && rightArmRef.current) {
        waving = true;
        rightArmRef.current.rotation.z = wavePose.shoulderRaise;
        rightArmRef.current.rotation.x = wavePose.wristWave;
      } else if (rightArmRef.current) {
        lastWaveEndRef.current = elapsedMs;
        waveStartRef.current = null;
      }
    }
    if (!waving && rightArmRef.current) {
      // Gentle idle sway, phase-shifted from the left arm.
      rightArmRef.current.rotation.z = Math.sin(elapsedSec * 0.7) * 0.05 * amp;
      rightArmRef.current.rotation.x = 0;
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.z = -Math.sin(elapsedSec * 0.7 + Math.PI * 0.4) * 0.05 * amp;
    }

    // --- Hover: brighten eyes, small head tilt, occasional wave (cooldown-gated) ---
    // Each eye owns its own material (auto-created by its JSX
    // <meshStandardMaterial>); reached via the mesh ref and mutated
    // in-place, the same pattern already used for the antenna tip below —
    // this is a per-frame imperative update, not a render-time mutation.
    const targetIntensity = hovered ? 1.4 : 0.85;
    const targetColor = hovered ? EYE_COLOR_HOVER : EYE_COLOR_BASE;
    const lerpFactor = Math.min(1, delta * 5);
    for (const eyeRef of [eyeLeftRef, eyeRightRef]) {
      const mat = eyeRef.current?.material as THREE.MeshStandardMaterial | undefined;
      if (!mat) continue;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetIntensity, lerpFactor);
      mat.color.lerp(targetColor, lerpFactor);
      mat.emissive.lerp(targetColor, lerpFactor);
    }
    if (
      hovered &&
      waveStartRef.current === null &&
      elapsedMs - lastWaveEndRef.current > HOVER_WAVE_COOLDOWN_MS
    ) {
      waveStartRef.current = elapsedMs;
    }

    // --- Click bounce ---
    let clickTilt = 0;
    let clickBounceY = 0;
    if (clickStartRef.current !== null) {
      const clickPose = getClickPose(elapsedMs - clickStartRef.current);
      if (clickPose) {
        clickTilt = clickPose.headTilt;
        clickBounceY = clickPose.bounceY;
      } else {
        clickStartRef.current = null;
      }
    }
    if (headRef.current) headRef.current.rotation.z = clickTilt + (hovered ? 0.06 : 0);
    if (rootRef.current) rootRef.current.position.y += clickBounceY;

    // --- Blink ---
    if (blinkStartRef.current === null && elapsedSec >= nextBlinkAtRef.current) {
      blinkStartRef.current = elapsedMs;
    }
    let blinkScale = 1;
    if (blinkStartRef.current !== null) {
      blinkScale = getBlinkScale(elapsedMs - blinkStartRef.current);
      if (elapsedMs - blinkStartRef.current > 200) {
        blinkStartRef.current = null;
        nextBlinkAtRef.current = elapsedSec + 2.5 + Math.random() * 3;
      }
    }
    if (eyeLeftRef.current) eyeLeftRef.current.scale.y = blinkScale;
    if (eyeRightRef.current) eyeRightRef.current.scale.y = blinkScale;

    // --- Antenna: a slow independent glow pulse ---
    if (antennaTipRef.current) {
      const mat = antennaTipRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.9 + Math.sin(elapsedSec * 2) * 0.3;
    }
  });

  function triggerClick() {
    clickStartRef.current = currentElapsedMsRef.current;
  }

  return (
    <group
      ref={rootRef}
      dispose={null}
      aria-label="Animated CareerLens AI assistant"
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        triggerClick();
        onOpenChat?.();
      }}
    >
      {/* Head */}
      <group ref={headRef} position={[0, 0.78, 0]}>
        <mesh geometry={headGeo} castShadow>
          <meshStandardMaterial color={COLOR.body} roughness={0.35} metalness={0.05} />
        </mesh>
        <mesh geometry={visorGeo} position={[0, -0.02, 0.42]}>
          <meshStandardMaterial color={COLOR.visor} roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh ref={eyeLeftRef} position={[-0.15, -0.02, 0.49]}>
          <circleGeometry args={[0.075, 20]} />
          <meshStandardMaterial color={COLOR.eye} emissive={COLOR.eye} emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
        <mesh ref={eyeRightRef} position={[0.15, -0.02, 0.49]}>
          <circleGeometry args={[0.075, 20]} />
          <meshStandardMaterial color={COLOR.eye} emissive={COLOR.eye} emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
        {/* Antenna */}
        <mesh geometry={antennaGeo} position={[0, 0.52, 0]}>
          <meshStandardMaterial color={COLOR.limb} roughness={0.5} />
        </mesh>
        <mesh ref={antennaTipRef} position={[0, 0.68, 0]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color={COLOR.antennaTip} emissive={COLOR.antennaTip} emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
      </group>

      {/* Body */}
      <mesh ref={bodyRef} geometry={bodyGeo} position={[0, -0.02, 0]} castShadow>
        <meshStandardMaterial color={COLOR.body} roughness={0.4} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.02, 0.31]}>
        <circleGeometry args={[0.1, 24]} />
        <meshStandardMaterial color={COLOR.bodyAccent} roughness={0.3} metalness={0.3} />
      </mesh>

      {/* Right arm (waves) */}
      <group ref={rightArmRef} position={[0.46, 0.32, 0]}>
        <mesh geometry={armGeo} position={[0, -0.25, 0]} rotation={[0, 0, 0]}>
          <meshStandardMaterial color={COLOR.limb} roughness={0.45} />
        </mesh>
        <mesh geometry={handGeo} position={[0, -0.5, 0]}>
          <meshStandardMaterial color={COLOR.body} roughness={0.35} />
        </mesh>
      </group>

      {/* Left arm (idle sway only) */}
      <group ref={leftArmRef} position={[-0.46, 0.32, 0]}>
        <mesh geometry={armGeo} position={[0, -0.25, 0]}>
          <meshStandardMaterial color={COLOR.limb} roughness={0.45} />
        </mesh>
        <mesh geometry={handGeo} position={[0, -0.5, 0]}>
          <meshStandardMaterial color={COLOR.body} roughness={0.35} />
        </mesh>
      </group>

      {/* Legs */}
      <mesh geometry={legGeo} position={[-0.2, -0.72, 0]}>
        <meshStandardMaterial color={COLOR.limb} roughness={0.45} />
      </mesh>
      <mesh geometry={legGeo} position={[0.2, -0.72, 0]}>
        <meshStandardMaterial color={COLOR.limb} roughness={0.45} />
      </mesh>
      <mesh geometry={footGeo} position={[-0.2, -1.0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={COLOR.bodyAccent} roughness={0.4} />
      </mesh>
      <mesh geometry={footGeo} position={[0.2, -1.0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={COLOR.bodyAccent} roughness={0.4} />
      </mesh>
    </group>
  );
}

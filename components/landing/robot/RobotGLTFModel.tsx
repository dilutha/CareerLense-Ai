"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clampLookAt, getClickPose, getIdlePose } from "./animation-timing";

const MODEL_PATH = "/models/career-lens-robot.glb";

/**
 * The actual asset the user supplied: a Tripo-generated humanoid robot
 * (single mesh, single material, a standard 43-bone biped skeleton, one
 * baked animation clip). It ships authored ~0.96 units tall, feet at
 * y=0 — MODEL_SCALE/MODEL_Y_OFFSET below re-frame it to occupy roughly
 * the same visual footprint the procedural fallback robot (Robot.tsx)
 * used, computed from the GLB's own accessor bounding box, not guessed.
 */
const MODEL_SCALE = 2.4;
const MODEL_Y_OFFSET = -1.1;

/** The model's own bone name for its head — confirmed by inspecting the GLB's node list directly, never assumed. */
const HEAD_BONE_NAME = "Head";

/**
 * Drives the real GLB robot model (see RobotScene.tsx for the fallback
 * chain when it's missing). Two animation layers, composed in a
 * deliberate order within a single useFrame so they can never race:
 *   1. The model's own baked clip (whatever it actually contains — a
 *      single generic "NlaTrack", not assumed to be "wave" or anything
 *      specific) plays on loop via a manually-driven THREE.AnimationMixer
 *      (not drei's useAnimations, which registers its own useFrame at
 *      an order this component can't otherwise guarantee runs first).
 *   2. On top of that, a small additive rotation on the Head bone
 *      specifically follows the cursor — body/root stays stationary
 *      (Part 9's explicit "eyes/head track, body doesn't"), exactly the
 *      fix this turn's task called for versus the previous root-only
 *      version.
 * Root-level idle bob/breathing/click-bounce reuse the same pure
 * animation-timing math as the procedural robot, so both feel identical.
 */
export function RobotGLTFModel({
  enablePointerTracking,
  reduceIntensity = false,
  onOpenChat,
}: {
  enablePointerTracking: boolean;
  reduceIntensity?: boolean;
  onOpenChat?: () => void;
}) {
  // Throws (caught by RobotScene's ErrorBoundary) if the file is missing
  // or fails to parse — that's the intended signal to fall back to the
  // procedural robot, not a bug to swallow here.
  const { scene, nodes, animations } = useGLTF(MODEL_PATH);

  const rootRef = useRef<THREE.Group>(null);
  const clickStartRef = useRef<number | null>(null);
  const currentElapsedMsRef = useRef(0);
  const amp = reduceIntensity ? 0.6 : 1;

  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const headBone = nodes[HEAD_BONE_NAME] as THREE.Object3D | undefined;
  // The bone's own rest rotation — cursor-tracking adds a small OFFSET
  // from this, never overwrites it outright, so it still reads correctly
  // whatever pose the baked clip has it in at any given moment.
  const headRestQuaternion = useMemo(() => headBone?.quaternion.clone(), [headBone]);

  useEffect(() => {
    // Single clip, whatever it's actually named — never assumed to be
    // "idle"/"wave"/anything semantic (Part 12's explicit instruction).
    const clip = animations[0];
    if (!clip) return;
    const action = mixer.clipAction(clip, scene);
    action.reset().play();
    return () => {
      mixer.stopAllAction();
    };
  }, [animations, mixer, scene]);

  useFrame((state, delta) => {
    const elapsedSec = state.clock.getElapsedTime();
    currentElapsedMsRef.current = elapsedSec * 1000;

    // 1. Advance the model's own baked animation first — everything
    // below layers additively on top of whatever pose this leaves bones in.
    mixer.update(delta);

    const idle = getIdlePose(elapsedSec);
    if (rootRef.current) {
      rootRef.current.position.y = idle.bobY * amp;
      rootRef.current.scale.setScalar(1 + (idle.breathScale - 1) * amp);

      if (clickStartRef.current !== null) {
        const clickPose = getClickPose(currentElapsedMsRef.current - clickStartRef.current);
        if (clickPose) {
          rootRef.current.position.y += clickPose.bounceY;
          rootRef.current.rotation.z = clickPose.headTilt;
        } else {
          clickStartRef.current = null;
          rootRef.current.rotation.z = 0;
        }
      }
    }

    // 2. Head-only cursor tracking, additive on top of the baked clip's
    // current pose — the root/body never rotates toward the cursor.
    if (headBone && headRestQuaternion) {
      const { yaw, pitch } = enablePointerTracking
        ? clampLookAt(state.pointer.x, state.pointer.y)
        : { yaw: 0, pitch: 0 };
      const targetOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0));
      const target = headRestQuaternion.clone().multiply(targetOffset);
      headBone.quaternion.slerp(target, Math.min(1, delta * 6));
    }
  });

  return (
    <group
      ref={rootRef}
      dispose={null}
      onClick={(e) => {
        e.stopPropagation();
        clickStartRef.current = currentElapsedMsRef.current;
        onOpenChat?.();
      }}
    >
      <primitive object={scene} scale={MODEL_SCALE} position={[0, MODEL_Y_OFFSET, 0]} />
    </group>
  );
}

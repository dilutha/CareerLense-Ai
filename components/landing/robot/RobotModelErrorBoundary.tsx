"use client";

import { Component, type ReactNode } from "react";

/**
 * Catches a GLTF load failure (missing/malformed file at
 * public/models/career-lens-robot.glb) and renders `fallback` instead —
 * a real class-based error boundary because Suspense alone only handles
 * the loading state, not a genuine failure. Must be a class component;
 * React has no hook-based error boundary API.
 */
export class RobotModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.log(
      "[robot] GLTF model failed to load, falling back to the procedural robot:",
      error instanceof Error ? error.message : String(error)
    );
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

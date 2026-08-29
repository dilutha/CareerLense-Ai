/**
 * Static CSS/SVG robot silhouette — used both as the loading placeholder
 * (Part 17, before the R3F Canvas has mounted) and as the permanent
 * fallback when WebGL is unavailable or `prefers-reduced-motion` is set
 * (Parts 16/18). Deliberately mostly static: a couple of CSS keyframe
 * animations only, never Three.js.
 */
export function RobotFallback({ animated = false }: { animated?: boolean }) {
  return (
    <div
      role="img"
      aria-label="CareerLens AI assistant"
      className="flex h-full w-full items-center justify-center"
    >
      <svg viewBox="0 0 200 220" className="h-full w-full max-w-[260px]" aria-hidden="true">
        <defs>
          <linearGradient id="robot-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f0f9ff" />
          </linearGradient>
        </defs>

        <g className={animated ? "origin-center animate-[robot-bob_3.2s_ease-in-out_infinite]" : ""}>
          {/* legs */}
          <rect x="70" y="175" width="16" height="30" rx="8" fill="#dceefc" />
          <rect x="114" y="175" width="16" height="30" rx="8" fill="#dceefc" />
          <ellipse cx="78" cy="208" rx="12" ry="7" fill="#0369a1" />
          <ellipse cx="122" cy="208" rx="12" ry="7" fill="#0369a1" />

          {/* body */}
          <rect x="58" y="110" width="84" height="80" rx="22" fill="url(#robot-body)" stroke="#e0f2fe" />
          <circle cx="100" cy="145" r="9" fill="#0369a1" />

          {/* arms */}
          <rect x="34" y="120" width="16" height="48" rx="8" fill="#dceefc" />
          <circle cx="42" cy="172" r="10" fill="#ffffff" />
          <rect
            x="150"
            y="120"
            width="16"
            height="48"
            rx="8"
            fill="#dceefc"
            className={animated ? "origin-[158px_122px] animate-[robot-wave_2.6s_ease-in-out_1]" : ""}
          />
          <circle cx="158" cy="172" r="10" fill="#ffffff" />

          {/* head */}
          <rect x="62" y="34" width="76" height="70" rx="24" fill="url(#robot-body)" stroke="#e0f2fe" />
          <rect x="72" y="60" width="56" height="22" rx="8" fill="#0b1e3a" />
          <circle cx="88" cy="71" r="6" fill="#38bdf8" />
          <circle cx="112" cy="71" r="6" fill="#38bdf8" />
          {/* antenna */}
          <rect x="97" y="14" width="6" height="22" rx="3" fill="#dceefc" />
          <circle cx="100" cy="12" r="6" fill="#0ea5e9" />
        </g>
      </svg>

      <style>{`
        @keyframes robot-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes robot-wave {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-35deg); }
          35% { transform: rotate(-20deg); }
          50% { transform: rotate(-35deg); }
          65% { transform: rotate(-20deg); }
          80% { transform: rotate(-35deg); }
        }
      `}</style>
    </div>
  );
}

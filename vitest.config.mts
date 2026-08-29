import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolves the "server-only" package to its no-op react-server export
// (matching how Next.js's RSC bundler resolves it) instead of the default
// export that unconditionally throws — lets tests import server-only
// modules directly. Vitest runs tests through Vite's SSR pipeline, whose
// module resolution is configured separately from the client build's, so
// this needs to be set under both `resolve` and `ssr.resolve`.
const serverOnlyCondition = { conditions: ["react-server"] };

export default defineConfig({
  resolve: {
    alias: {
      "@": dirname,
    },
    ...serverOnlyCondition,
  },
  ssr: {
    resolve: serverOnlyCondition,
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    // Placeholder values only — let modules that construct a Supabase
    // client at import time (e.g. lib/supabase/server.ts) load under
    // vitest without throwing. No test actually issues a network call
    // through this client; it's never dereferenced for real credentials.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key-placeholder",
    },
  },
});

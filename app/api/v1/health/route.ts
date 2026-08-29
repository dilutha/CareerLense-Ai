import { apiHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";

/**
 * Public health check — no auth required at all (Part 3: "must not
 * require a user's career profile... safe for WSO2 connectivity
 * testing"). WSO2 itself is what gates whether an external caller can
 * reach this route in production; this backend endpoint carries no user
 * data and needs no independent auth check of its own.
 */
export const GET = apiHandler("GET /health", async () => {
  return apiSuccess({
    service: "CareerLens AI",
    api: "v1",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

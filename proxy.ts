import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/chat",
  "/profile",
  "/resume",
  "/jobs",
  "/application",
  "/portfolio",
  "/github",
  "/linkedin",
  "/interview",
  "/career",
  "/applications",
  "/analytics",
  "/notifications",
];
// /chat itself is guest-accessible (Part 7 — chat, CV upload, and job
// search all run through the conversational surface for guests). A real
// persisted conversation (/chat/[id]) and every other route stay behind
// auth, including the standalone /jobs browse page.
const GUEST_ACCESSIBLE_PATHS = ["/chat"];
const AUTH_ONLY_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSupabaseSession(request);
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(claims);

  const isGuestAccessible = GUEST_ACCESSIBLE_PATHS.includes(pathname);
  const isProtected =
    !isGuestAccessible &&
    PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_ONLY_PATHS.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets, image optimization files,
     * and common metadata files — auth checks don't need to touch these,
     * and matching them would just add latency.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Handles the redirect from a Supabase email confirmation link, exchanging
 * the one-time code for a real session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  // Chat-first: default to /chat, not the profile wizard — profile setup
  // is optional now, reachable from /profile or a chat prompt whenever
  // the user wants it.
  const next = rawNext && rawNext.startsWith("/") ? rawNext : "/chat";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

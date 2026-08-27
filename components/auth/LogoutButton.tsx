"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-navy-light/70 transition-colors hover:bg-foam hover:text-navy disabled:opacity-60"
      }
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Logout
    </button>
  );
}

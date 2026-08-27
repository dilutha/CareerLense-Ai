import Link from "next/link";
import { redirect } from "next/navigation";
import { Waves } from "lucide-react";
import { SignupForm } from "@/components/auth/SignupForm";
import { getOptionalUser } from "@/lib/auth/require-user";

export default async function SignupPage(props: PageProps<"/signup">) {
  const searchParams = await props.searchParams;
  const rawNext = searchParams.next;
  const next = typeof rawNext === "string" && rawNext.startsWith("/") ? rawNext : "/chat";

  const user = await getOptionalUser();
  if (user) {
    redirect(next);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-sea-gradient-soft px-6 py-16">
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-semibold text-navy"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sea-gradient text-white">
          <Waves className="h-4 w-4" aria-hidden="true" />
        </span>
        CareerLens
      </Link>

      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
          Let&apos;s get you career-ready. 🌊
        </h1>
        <p className="text-navy-light/75">
          Your career buddy needs to know who it&apos;s helping.
        </p>
      </div>

      <SignupForm next={next} />

      <Link
        href="/"
        className="text-sm font-medium text-navy-light/60 transition-colors hover:text-navy"
      >
        ← Back to CareerLens
      </Link>
    </main>
  );
}

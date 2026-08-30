import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The single "← Back" / "← Back to Chat" pattern (Part 12), previously
 * hand-duplicated with the same markup across ~10 pages. `href`/`label`
 * cover the "came from another page" case (each page keeps its own real
 * target — this doesn't change any existing navigation history); pass
 * `toChat` for the "always offer a way back to the main flow" case.
 */
export function BackLink({
  href,
  label,
  toChat = false,
  className = "",
}: {
  href?: string;
  label?: string;
  toChat?: boolean;
  className?: string;
}) {
  const resolvedHref = toChat ? "/chat" : href;
  const resolvedLabel = toChat ? "Back to Chat" : (label ?? "Back");

  if (!resolvedHref) return null;

  return (
    <Link
      href={resolvedHref}
      className={`flex w-fit items-center gap-1.5 text-sm font-medium text-navy-light/70 hover:text-navy ${className}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {resolvedLabel}
    </Link>
  );
}

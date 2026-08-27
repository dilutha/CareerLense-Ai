import Link from "next/link";
import { Waves } from "lucide-react";
import { Container } from "@/components/ui/Container";

const FOOTER_COLUMNS: {
  heading: string;
  links: { label: string; href?: string }[];
}[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
    ],
  },
  {
    heading: "Resources",
    links: [{ label: "CV Tips" }, { label: "Interview Prep" }],
  },
  {
    heading: "Project",
    links: [{ label: "GitHub" }, { label: "About" }],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-navy/10 bg-white py-14">
      <Container className="flex flex-col gap-12 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold text-navy"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sea-gradient text-white">
              <Waves className="h-4 w-4" aria-hidden="true" />
            </span>
            CareerLens
          </Link>
          <p className="max-w-xs text-sm text-navy-light/70">
            Your friendly AI career buddy.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading} className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-navy">
                {column.heading}
              </p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <a
                        href={link.href}
                        className="text-sm text-navy-light/70 transition-colors hover:text-navy"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span
                        className="text-sm text-navy-light/40"
                        aria-disabled="true"
                      >
                        {link.label}
                        <span className="ml-1 text-xs">(soon)</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>

      <Container className="mt-10 border-t border-navy/10 pt-6">
        <p className="text-xs text-navy-light/50">
          © {new Date().getFullYear()} CareerLens AI. Built for Sri Lankan
          job seekers.
        </p>
      </Container>
    </footer>
  );
}

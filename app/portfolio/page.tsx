import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PortfolioDashboard } from "@/components/portfolio/PortfolioDashboard";
import { requireUser } from "@/lib/auth/require-user";
import { getLatestPortfolioAnalysis, getPortfolioGeneratedContent } from "@/lib/portfolio/get-portfolio";

export default async function PortfolioPage() {
  const user = await requireUser("/portfolio");

  const [analysis, generatedContent] = await Promise.all([
    getLatestPortfolioAnalysis(user.id),
    getPortfolioGeneratedContent(user.id),
  ]);

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link
          href="/career"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-navy-light/70 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to career dashboard
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
            Portfolio Intelligence
          </h1>
          <p className="text-sm text-navy-light/70">
            First impression, project quality, SEO, and recruiter readability — scored and explained.
          </p>
        </div>

        <PortfolioDashboard analysis={analysis} generatedContent={generatedContent} />
      </div>
    </main>
  );
}

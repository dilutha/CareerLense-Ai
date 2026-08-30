import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { BackLink } from "@/components/ui/BackLink";
import { ApplicationDetailPanel } from "@/components/applications/ApplicationDetailPanel";
import { requireUser } from "@/lib/auth/require-user";
import { getApplicationDetail } from "@/lib/applications/get-applications";

export default async function ApplicationDetailPage(props: PageProps<"/applications/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/applications/${id}`);

  const detail = await getApplicationDetail(user.id, id);
  if (!detail) notFound();

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <BackLink href="/applications" label="Back to applications" />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">{detail.job.title}</h1>
            <p className="text-sm text-navy-light/70">{detail.job.company_name ?? "Company not specified"}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/jobs/${detail.job.id}`}
              className="flex items-center gap-1.5 rounded-full border border-navy/10 px-4 py-2 text-sm font-medium text-navy hover:bg-foam"
            >
              View job
            </Link>
            <a
              href={detail.job.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-sea-gradient px-4 py-2 text-sm font-semibold text-white"
            >
              Apply
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

        <ApplicationDetailPanel detail={detail} />
      </div>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Briefcase, Code2, Globe, Loader2, Pencil } from "lucide-react";
import { updateBasicProfile } from "@/lib/career-profile/actions";
import type { Profile } from "@/lib/career-profile/types";

const inputClass =
  "w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none";

export function ProfileHeader({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(profile.portfolio_url ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url ?? "");
  const [githubUrl, setGithubUrl] = useState(profile.github_url ?? "");

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateBasicProfile({
        full_name: fullName.trim(),
        headline: headline.trim() || undefined,
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        portfolio_url: portfolioUrl.trim() || undefined,
        linkedin_url: linkedinUrl.trim() || undefined,
        github_url: githubUrl.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error ?? "Couldn't save. Try again.");
        return;
      }
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
        {error && (
          <div role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </div>
        )}
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          className={inputClass}
        />
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Headline (e.g. Aspiring Data Analyst)"
          className={inputClass}
        />
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Short bio (optional)"
          rows={3}
          className={`${inputClass} resize-none`}
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          className={inputClass}
        />
        <input
          value={portfolioUrl}
          onChange={(e) => setPortfolioUrl(e.target.value)}
          placeholder="Portfolio URL"
          className={inputClass}
        />
        <input
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="LinkedIn URL"
          className={inputClass}
        />
        <input
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          placeholder="GitHub URL"
          className={inputClass}
        />
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="flex items-center gap-2 rounded-full bg-sea-gradient px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full px-5 py-2 text-sm font-medium text-navy-light/70 hover:bg-foam"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">
            {profile.full_name || "Unnamed"}
          </h1>
          {profile.headline && <p className="text-navy-light/80">{profile.headline}</p>}
          {profile.location && (
            <p className="mt-1 text-sm text-navy-light/60">{profile.location}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit profile"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-navy-light/60 hover:bg-foam hover:text-navy"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {profile.bio && <p className="text-sm text-navy-light/80">{profile.bio}</p>}

      {(profile.portfolio_url || profile.linkedin_url || profile.github_url) && (
        <div className="flex flex-wrap gap-3 pt-1">
          {profile.portfolio_url && (
            <a
              href={profile.portfolio_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-ocean hover:text-navy"
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
              Portfolio
            </a>
          )}
          {profile.linkedin_url && (
            <a
              href={profile.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-ocean hover:text-navy"
            >
              <Briefcase className="h-4 w-4" aria-hidden="true" />
              LinkedIn
            </a>
          )}
          {profile.github_url && (
            <a
              href={profile.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-ocean hover:text-navy"
            >
              <Code2 className="h-4 w-4" aria-hidden="true" />
              GitHub
            </a>
          )}
        </div>
      )}
    </div>
  );
}

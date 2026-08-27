"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { updateCareerPreferences } from "@/lib/career-profile/actions";
import type { CareerPreferences } from "@/lib/career-profile/types";
import type { CareerPreferenceEmploymentType, RemotePreference } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none";

function TagList({
  label,
  tags,
  onAdd,
  onRemove,
}: {
  label: string;
  tags: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-navy">{label}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 rounded-full bg-foam px-3 py-1 text-sm text-navy"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                aria-label={`Remove ${tag}`}
                className="text-navy-light/40 hover:text-navy"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (value.trim()) {
                onAdd(value.trim());
                setValue("");
              }
            }
          }}
          placeholder="Add and press Enter"
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => {
            if (value.trim()) {
              onAdd(value.trim());
              setValue("");
            }
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-navy hover:bg-navy/10"
          aria-label={`Add ${label.toLowerCase()}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function CareerPreferencesForm({
  preferences,
}: {
  preferences: CareerPreferences | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [targetRole, setTargetRole] = useState(preferences?.target_role ?? "");
  const [employmentType, setEmploymentType] = useState<CareerPreferenceEmploymentType | "">(
    preferences?.employment_type ?? ""
  );
  const [remotePreference, setRemotePreference] = useState<RemotePreference | "">(
    preferences?.remote_preference ?? ""
  );
  const [locations, setLocations] = useState<string[]>(preferences?.preferred_locations ?? []);
  const [industries, setIndustries] = useState<string[]>(
    preferences?.preferred_industries ?? []
  );

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateCareerPreferences({
        target_role: targetRole.trim() || undefined,
        employment_type: employmentType || undefined,
        remote_preference: remotePreference || undefined,
        preferred_locations: locations,
        preferred_industries: industries,
      });
      if (!result.success) {
        setError(result.error ?? "Couldn't save. Try again.");
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-navy">Career preferences</p>

      <input
        value={targetRole}
        onChange={(e) => setTargetRole(e.target.value)}
        placeholder="Target role"
        className={inputClass}
      />

      <select
        value={employmentType}
        onChange={(e) => setEmploymentType(e.target.value as CareerPreferenceEmploymentType | "")}
        className={inputClass}
      >
        <option value="">Employment type (any)</option>
        <option value="internship">Internship</option>
        <option value="part_time">Part-time</option>
        <option value="full_time">Full-time</option>
        <option value="contract">Contract</option>
        <option value="freelance">Freelance</option>
        <option value="any">Any</option>
      </select>

      <select
        value={remotePreference}
        onChange={(e) => setRemotePreference(e.target.value as RemotePreference | "")}
        className={inputClass}
      >
        <option value="">Remote preference (any)</option>
        <option value="remote">Remote</option>
        <option value="hybrid">Hybrid</option>
        <option value="on_site">On-site</option>
        <option value="any">Any</option>
      </select>

      <TagList
        label="Preferred locations"
        tags={locations}
        onAdd={(value) => setLocations((prev) => [...prev, value])}
        onRemove={(value) => setLocations((prev) => prev.filter((l) => l !== value))}
      />

      <TagList
        label="Preferred industries"
        tags={industries}
        onAdd={(value) => setIndustries((prev) => [...prev, value])}
        onRemove={(value) => setIndustries((prev) => prev.filter((i) => i !== value))}
      />

      {error && <p className="text-sm text-amber-700">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-700">Saved.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="flex w-fit items-center gap-2 rounded-full bg-sea-gradient px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Save preferences
      </button>
    </div>
  );
}

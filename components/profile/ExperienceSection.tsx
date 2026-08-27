"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { addExperience, deleteExperience, updateExperience } from "@/lib/career-profile/actions";
import type { Experience } from "@/lib/career-profile/types";
import type { EmploymentType } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none";

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  internship: "Internship",
  part_time: "Part-time",
  full_time: "Full-time",
  contract: "Contract",
  freelance: "Freelance",
  volunteer: "Volunteer",
  other: "Other",
};

interface FormState {
  company: string;
  role: string;
  employment_type: EmploymentType;
  location: string;
  is_current: boolean;
  description: string;
}

const emptyForm: FormState = {
  company: "",
  role: "",
  employment_type: "internship",
  location: "",
  is_current: false,
  description: "",
};

function ExperienceForm({
  initial,
  onSave,
  onCancel,
  pending,
}: {
  initial: FormState;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [form, setForm] = useState(initial);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-navy/10 bg-foam/60 p-4">
      <input
        value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
        placeholder="Role / title"
        className={inputClass}
      />
      <input
        value={form.company}
        onChange={(e) => setForm({ ...form, company: e.target.value })}
        placeholder="Company"
        className={inputClass}
      />
      <select
        value={form.employment_type}
        onChange={(e) => setForm({ ...form, employment_type: e.target.value as EmploymentType })}
        className={inputClass}
      >
        {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input
        value={form.location}
        onChange={(e) => setForm({ ...form, location: e.target.value })}
        placeholder="Location (optional)"
        className={inputClass}
      />
      <textarea
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Description (optional)"
        rows={2}
        className={`${inputClass} resize-none`}
      />
      <label className="flex items-center gap-2 text-sm text-navy-light/80">
        <input
          type="checkbox"
          checked={form.is_current}
          onChange={(e) => setForm({ ...form, is_current: e.target.checked })}
          className="h-4 w-4 rounded border-navy/20 text-ocean focus:ring-ocean"
        />
        I currently work here
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!form.company.trim() || !form.role.trim() || pending}
          onClick={() => onSave(form)}
          className="flex items-center gap-2 rounded-full bg-sea-gradient px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-1.5 text-sm font-medium text-navy-light/70 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ExperienceSection({ experience }: { experience: Experience[] }) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAdd(form: FormState) {
    setError(null);
    startTransition(async () => {
      const result = await addExperience({
        company: form.company.trim(),
        role: form.role.trim(),
        employment_type: form.employment_type,
        location: form.location.trim() || undefined,
        is_current: form.is_current,
        description: form.description.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error ?? "Couldn't add that.");
        return;
      }
      setAdding(false);
    });
  }

  function handleUpdate(id: string, form: FormState) {
    setError(null);
    startTransition(async () => {
      const result = await updateExperience(id, {
        company: form.company.trim(),
        role: form.role.trim(),
        employment_type: form.employment_type,
        location: form.location.trim() || undefined,
        is_current: form.is_current,
        description: form.description.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error ?? "Couldn't save changes.");
        return;
      }
      setEditingId(null);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteExperience(id);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy">Experience</p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-sm font-medium text-ocean hover:text-navy"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add experience
          </button>
        )}
      </div>

      {error && <p className="text-sm text-amber-700">{error}</p>}

      {experience.length === 0 && !adding && (
        <p className="text-sm text-navy-light/60">No experience yet — that&apos;s completely okay.</p>
      )}

      <div className="flex flex-col gap-3">
        {experience.map((exp) =>
          editingId === exp.id ? (
            <ExperienceForm
              key={exp.id}
              pending={pending}
              initial={{
                company: exp.company,
                role: exp.role,
                employment_type: exp.employment_type,
                location: exp.location ?? "",
                is_current: exp.is_current,
                description: exp.description ?? "",
              }}
              onSave={(form) => handleUpdate(exp.id, form)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={exp.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-navy/10 px-4 py-3"
            >
              <div>
                <p className="font-medium text-navy">{exp.role}</p>
                <p className="text-sm text-navy-light/70">
                  {exp.company} · {EMPLOYMENT_TYPE_LABELS[exp.employment_type]}
                </p>
                {exp.location && <p className="text-xs text-navy-light/50">{exp.location}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditingId(exp.id)}
                  aria-label="Edit"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-navy-light/50 hover:bg-foam hover:text-navy"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(exp.id)}
                  aria-label="Delete"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-navy-light/50 hover:bg-foam hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )
        )}

        {adding && (
          <ExperienceForm
            pending={pending}
            initial={emptyForm}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>
    </div>
  );
}

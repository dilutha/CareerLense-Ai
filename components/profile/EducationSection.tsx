"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { addEducation, deleteEducation, updateEducation } from "@/lib/career-profile/actions";
import type { Education } from "@/lib/career-profile/types";

const inputClass =
  "w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none";

interface FormState {
  institution: string;
  degree: string;
  field_of_study: string;
  is_current: boolean;
  description: string;
}

const emptyForm: FormState = {
  institution: "",
  degree: "",
  field_of_study: "",
  is_current: false,
  description: "",
};

function EducationForm({
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
        value={form.institution}
        onChange={(e) => setForm({ ...form, institution: e.target.value })}
        placeholder="University / institution"
        className={inputClass}
      />
      <input
        value={form.degree}
        onChange={(e) => setForm({ ...form, degree: e.target.value })}
        placeholder="Degree"
        className={inputClass}
      />
      <input
        value={form.field_of_study}
        onChange={(e) => setForm({ ...form, field_of_study: e.target.value })}
        placeholder="Field of study"
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
        Currently studying here
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!form.institution.trim() || pending}
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

export function EducationSection({ education }: { education: Education[] }) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAdd(form: FormState) {
    setError(null);
    startTransition(async () => {
      const result = await addEducation({
        institution: form.institution.trim(),
        degree: form.degree.trim() || undefined,
        field_of_study: form.field_of_study.trim() || undefined,
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
      const result = await updateEducation(id, {
        institution: form.institution.trim(),
        degree: form.degree.trim() || undefined,
        field_of_study: form.field_of_study.trim() || undefined,
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
      await deleteEducation(id);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy">Education</p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-sm font-medium text-ocean hover:text-navy"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add education
          </button>
        )}
      </div>

      {error && <p className="text-sm text-amber-700">{error}</p>}

      {education.length === 0 && !adding && (
        <p className="text-sm text-navy-light/60">No education added yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {education.map((edu) =>
          editingId === edu.id ? (
            <EducationForm
              key={edu.id}
              pending={pending}
              initial={{
                institution: edu.institution,
                degree: edu.degree ?? "",
                field_of_study: edu.field_of_study ?? "",
                is_current: edu.is_current,
                description: edu.description ?? "",
              }}
              onSave={(form) => handleUpdate(edu.id, form)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={edu.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-navy/10 px-4 py-3"
            >
              <div>
                <p className="font-medium text-navy">
                  {[edu.degree, edu.field_of_study].filter(Boolean).join(", ") || "Studies"}
                </p>
                <p className="text-sm text-navy-light/70">{edu.institution}</p>
                <p className="text-xs text-navy-light/50">
                  {edu.is_current ? "Current" : edu.end_date ?? ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditingId(edu.id)}
                  aria-label="Edit"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-navy-light/50 hover:bg-foam hover:text-navy"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(edu.id)}
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
          <EducationForm
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

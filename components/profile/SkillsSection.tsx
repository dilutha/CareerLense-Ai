"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { addProfileSkill, removeProfileSkill } from "@/lib/career-profile/actions";
import type { ProfileSkillWithSkill } from "@/lib/career-profile/types";
import type { SkillProficiency } from "@/lib/supabase/types";

export function SkillsSection({ skills }: { skills: ProfileSkillWithSkill[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [proficiency, setProficiency] = useState<SkillProficiency>("intermediate");

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await addProfileSkill({ skillName: trimmed, proficiency });
      if (!result.success) {
        setError(result.error ?? "Couldn't add that skill.");
        return;
      }
      setName("");
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeProfileSkill(id);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-navy">Skills</p>

      {skills.length === 0 ? (
        <p className="text-sm text-navy-light/60">Add the skills you&apos;re comfortable with.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <span
              key={s.id}
              className="flex items-center gap-1.5 rounded-full bg-foam px-3 py-1.5 text-sm text-navy"
            >
              {s.skill.name}
              <span className="text-xs text-navy-light/50">({s.proficiency})</span>
              <button
                type="button"
                onClick={() => handleRemove(s.id)}
                aria-label={`Remove ${s.skill.name}`}
                className="text-navy-light/40 hover:text-navy"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-amber-700">{error}</p>}

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add a skill"
          className="w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none"
        />
        <select
          value={proficiency}
          onChange={(e) => setProficiency(e.target.value as SkillProficiency)}
          className="rounded-xl border border-navy/10 bg-foam px-2 text-sm text-navy focus:border-ocean/40 focus:outline-none"
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!name.trim() || pending}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-navy hover:bg-navy/10 disabled:opacity-40"
          aria-label="Add skill"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

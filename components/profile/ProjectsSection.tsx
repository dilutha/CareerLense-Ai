"use client";

import { useState, useTransition } from "react";
import { Code2, ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { addProject, deleteProject, updateProject } from "@/lib/career-profile/actions";
import type { Project } from "@/lib/career-profile/types";

const inputClass =
  "w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none";

interface FormState {
  name: string;
  description: string;
  project_url: string;
  github_url: string;
}

const emptyForm: FormState = { name: "", description: "", project_url: "", github_url: "" };

function ProjectForm({
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
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="Project name"
        className={inputClass}
      />
      <textarea
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="What does it do? (optional)"
        rows={2}
        className={`${inputClass} resize-none`}
      />
      <input
        value={form.project_url}
        onChange={(e) => setForm({ ...form, project_url: e.target.value })}
        placeholder="Live URL (optional)"
        className={inputClass}
      />
      <input
        value={form.github_url}
        onChange={(e) => setForm({ ...form, github_url: e.target.value })}
        placeholder="GitHub URL (optional)"
        className={inputClass}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!form.name.trim() || pending}
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

export function ProjectsSection({ projects }: { projects: Project[] }) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAdd(form: FormState) {
    setError(null);
    startTransition(async () => {
      const result = await addProject({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        project_url: form.project_url.trim() || undefined,
        github_url: form.github_url.trim() || undefined,
        is_current: false,
      });
      if (!result.success) {
        setError(result.error ?? "Couldn't add that project.");
        return;
      }
      setAdding(false);
    });
  }

  function handleUpdate(id: string, form: FormState) {
    setError(null);
    startTransition(async () => {
      const result = await updateProject(id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        project_url: form.project_url.trim() || undefined,
        github_url: form.github_url.trim() || undefined,
        is_current: false,
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
      await deleteProject(id);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy">Projects</p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-sm font-medium text-ocean hover:text-navy"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add project
          </button>
        )}
      </div>

      {error && <p className="text-sm text-amber-700">{error}</p>}

      {projects.length === 0 && !adding && (
        <p className="text-sm text-navy-light/60">
          Projects are super useful when you&apos;re starting out. Add one when you&apos;re ready.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {projects.map((project) =>
          editingId === project.id ? (
            <ProjectForm
              key={project.id}
              pending={pending}
              initial={{
                name: project.name,
                description: project.description ?? "",
                project_url: project.project_url ?? "",
                github_url: project.github_url ?? "",
              }}
              onSave={(form) => handleUpdate(project.id, form)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={project.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-navy/10 px-4 py-3"
            >
              <div>
                <p className="font-medium text-navy">{project.name}</p>
                {project.description && (
                  <p className="text-sm text-navy-light/70">{project.description}</p>
                )}
                <div className="mt-1 flex gap-3">
                  {project.project_url && (
                    <a
                      href={project.project_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-ocean hover:text-navy"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      Live
                    </a>
                  )}
                  {project.github_url && (
                    <a
                      href={project.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-ocean hover:text-navy"
                    >
                      <Code2 className="h-3 w-3" aria-hidden="true" />
                      Code
                    </a>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditingId(project.id)}
                  aria-label="Edit"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-navy-light/50 hover:bg-foam hover:text-navy"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(project.id)}
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
          <ProjectForm
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

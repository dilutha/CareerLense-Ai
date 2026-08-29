import { describe, expect, it } from "vitest";
import { serializeResumeForApi } from "./serialize-resume";
import type { ResumeWithAnalysis } from "@/lib/resume/types";

function makeItem(): ResumeWithAnalysis {
  return {
    resume: {
      id: "r1",
      profile_id: "p1",
      name: "My CV",
      original_filename: "cv.pdf",
      storage_path: "p1/r1/cv.pdf",
      file_type: "pdf",
      file_size: 1234,
      status: "ready",
      error_message: null,
      is_default: true,
      created_at: "",
      updated_at: "",
    },
    version: {
      id: "v1",
      resume_id: "r1",
      version_number: 1,
      label: null,
      extracted_text: "John Doe, phone 077-1234567, full CV text here...",
      text_truncated: false,
      parsed_data: null,
      created_at: "",
      updated_at: "",
    },
    analysis: null,
  };
}

describe("serializeResumeForApi", () => {
  it("never includes the raw extracted CV text", () => {
    const result = serializeResumeForApi(makeItem());
    expect(JSON.stringify(result)).not.toContain("John Doe");
    expect(JSON.stringify(result)).not.toContain("077-1234567");
    expect(result.version).not.toHaveProperty("extracted_text");
  });

  it("never includes the private storage path", () => {
    const result = serializeResumeForApi(makeItem());
    expect(JSON.stringify(result)).not.toContain("p1/r1/cv.pdf");
    expect(result.resume).not.toHaveProperty("storage_path");
  });

  it("preserves everything else (id, status, filename, analysis)", () => {
    const result = serializeResumeForApi(makeItem());
    expect(result.resume.id).toBe("r1");
    expect(result.resume.status).toBe("ready");
    expect(result.resume.original_filename).toBe("cv.pdf");
  });

  it("handles a null version (no processed version yet) without crashing", () => {
    const item = { ...makeItem(), version: null };
    const result = serializeResumeForApi(item);
    expect(result.version).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { extractPortfolioContent } from "./extract";

const FULL_PAGE = `<!DOCTYPE html>
<html>
<head>
  <title>Jane Doe — Data Scientist</title>
  <meta name="description" content="Portfolio of Jane Doe, data science undergraduate." />
  <link rel="canonical" href="https://jane.dev/" />
  <meta name="robots" content="index,follow" />
  <meta property="og:title" content="Jane Doe" />
  <script type="application/ld+json">{"@type":"Person","name":"Jane Doe"}</script>
</head>
<body>
  <h1>Jane Doe</h1>
  <h2>Projects</h2>
  <p>I build data pipelines.</p>
  <img src="a.png" alt="dashboard screenshot" />
  <img src="b.png" />
  <a href="/projects">Projects</a>
  <a href="https://external.com">External</a>
</body>
</html>`;

describe("extractPortfolioContent", () => {
  it("extracts title, meta description, and heading structure", () => {
    const content = extractPortfolioContent(FULL_PAGE);
    expect(content.title).toBe("Jane Doe — Data Scientist");
    expect(content.metaDescription).toContain("data science undergraduate");
    expect(content.h1Count).toBe(1);
    expect(content.headingStructure).toEqual(["h1", "h2"]);
  });

  it("detects canonical, robots meta, OG, and structured data presence", () => {
    const content = extractPortfolioContent(FULL_PAGE);
    expect(content.canonicalPresent).toBe(true);
    expect(content.robotsMetaPresent).toBe(true);
    expect(content.ogPresent).toBe(true);
    expect(content.structuredDataPresent).toBe(true);
  });

  it("counts images and alt-text coverage accurately", () => {
    const content = extractPortfolioContent(FULL_PAGE);
    expect(content.imageCount).toBe(2);
    expect(content.imagesWithAlt).toBe(1);
  });

  it("counts internal links only", () => {
    const content = extractPortfolioContent(FULL_PAGE);
    expect(content.internalLinkCount).toBe(1);
  });

  it("extracts visible text and strips scripts/styles", () => {
    const content = extractPortfolioContent(FULL_PAGE);
    expect(content.visibleText).toContain("I build data pipelines");
    expect(content.visibleText).not.toContain("ld+json");
  });

  it("handles a minimal/empty page honestly — never invents missing signals", () => {
    const content = extractPortfolioContent("<html><body></body></html>");
    expect(content.title).toBeNull();
    expect(content.metaDescription).toBeNull();
    expect(content.h1Count).toBe(0);
    expect(content.canonicalPresent).toBe(false);
    expect(content.structuredDataPresent).toBe(false);
    expect(content.imageCount).toBe(0);
  });
});

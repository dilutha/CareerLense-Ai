import "server-only";
import crypto from "node:crypto";
import { htmlToPlainText } from "../jobs/html-strip";
import { assertSafeExternalUrl, isAllowedByRobotsTxt, safeFetchText } from "../jobs/url-safety";
import { PortfolioExtractedContentSchema, type PortfolioExtractedContent } from "./schemas";

const MAX_VISIBLE_TEXT_CHARS = 8000;

function extractTag(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

function countMatches(html: string, pattern: RegExp): number {
  return (html.match(pattern) ?? []).length;
}

/**
 * Pure, deterministic HTML parsing — no Gemini involved (see schemas.ts).
 * Regex-based rather than a DOM library: this project deliberately avoids
 * adding a new dependency (jsdom/cheerio) for what's a handful of simple,
 * well-defined structural checks, mirroring the project's existing
 * `htmlToPlainText` approach.
 */
export function extractPortfolioContent(html: string): PortfolioExtractedContent {
  const title = extractTag(html, /<title[^>]*>([^<]*)<\/title>/i);
  const metaDescription = extractTag(
    html,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
  );

  const headingStructure: string[] = [];
  const headingPattern = /<(h[1-6])[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(html)) !== null) {
    headingStructure.push(match[1].toLowerCase());
  }

  const h1Count = headingStructure.filter((h) => h === "h1").length;
  const canonicalPresent = /<link[^>]+rel=["']canonical["']/i.test(html);
  const robotsMetaPresent = /<meta[^>]+name=["']robots["']/i.test(html);
  const ogPresent = /<meta[^>]+property=["']og:/i.test(html);
  const structuredDataPresent = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);

  const imageCount = countMatches(html, /<img\b[^>]*>/gi);
  const imagesWithAlt = countMatches(html, /<img\b[^>]*\salt=["'][^"']+["'][^>]*>/gi);
  const internalLinkCount = countMatches(html, /<a\b[^>]+href=["']\/[^"']*["']/gi);

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  const visibleText = htmlToPlainText(
    bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
  ).slice(0, MAX_VISIBLE_TEXT_CHARS);

  const candidate = {
    title,
    metaDescription,
    h1Count,
    headingStructure,
    canonicalPresent,
    robotsMetaPresent,
    ogPresent,
    structuredDataPresent,
    imageCount,
    imagesWithAlt,
    internalLinkCount,
    visibleText,
  };

  return PortfolioExtractedContentSchema.parse(candidate);
}

export function computePortfolioContentHash(url: string, visibleText: string): string {
  return crypto.createHash("sha256").update(`${url}|${visibleText}`).digest("hex");
}

export type PortfolioFetchResult =
  | { success: true; content: PortfolioExtractedContent }
  | { success: false; reason: string };

/**
 * Fetches and extracts a portfolio page — reuses lib/jobs/url-safety.ts's
 * SSRF guard and robots.txt check rather than duplicating them (see
 * PROJECT_SPEC.md's Phase 10 "reuse existing SSRF utility" instruction).
 */
export async function fetchAndExtractPortfolio(rawUrl: string): Promise<PortfolioFetchResult> {
  let url: URL;
  try {
    url = assertSafeExternalUrl(rawUrl);
  } catch {
    return { success: false, reason: "That doesn't look like a valid https:// URL." };
  }

  const allowed = await isAllowedByRobotsTxt(url);
  if (!allowed) {
    return {
      success: false,
      reason: "This site's robots.txt doesn't allow automated access to that page.",
    };
  }

  try {
    const html = await safeFetchText(rawUrl);
    return { success: true, content: extractPortfolioContent(html) };
  } catch {
    return { success: false, reason: "Couldn't fetch that page right now." };
  }
}

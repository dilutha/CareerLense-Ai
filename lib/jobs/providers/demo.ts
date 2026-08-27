import "server-only";
import type { NormalizedJob } from "../schemas";
import type { JobSearchProvider, JobSearchQuery, ProviderSearchResult } from "./types";

/**
 * Fixture job listings for development/demo purposes. Used automatically
 * when no real search provider is configured (JOB_SEARCH_PROVIDER unset —
 * see providers/index.ts) — this is Phase 7's default, since no real
 * provider credentials exist yet. Every job here is clearly fictional
 * (demo.careerlens.lk companies, application URLs point at a placeholder
 * domain) and every job carries `source: "demo"` end to end so the UI can
 * label it "Demo Data" and it's never mistaken for a real listing.
 */
const DEMO_JOBS: NormalizedJob[] = [
  {
    source: "demo",
    sourceJobId: "demo-data-analyst-intern",
    title: "Data Analyst Intern",
    company: "Ceylon Insights (Demo)",
    location: "Colombo",
    country: "Sri Lanka",
    employmentType: "internship",
    workMode: "hybrid",
    description:
      "Support the analytics team in building dashboards and reports for retail clients. You'll work with real transaction data (anonymized) to identify trends and present findings to stakeholders.",
    responsibilities: [
      "Build and maintain Power BI dashboards for internal stakeholders",
      "Write SQL queries to extract and clean data from the data warehouse",
      "Assist senior analysts with ad-hoc reporting requests",
      "Document data sources and definitions",
    ],
    requirements: [
      "Currently pursuing a degree in Data Science, Statistics, Computer Science, or a related field",
      "Working knowledge of SQL",
      "Familiarity with Python for data analysis (pandas)",
      "Power BI or Tableau experience is a plus",
    ],
    salaryText: null,
    postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    applicationUrl: "https://demo.careerlens.lk/jobs/demo-data-analyst-intern",
    sourceUrl: "https://demo.careerlens.lk/jobs/demo-data-analyst-intern",
  },
  {
    source: "demo",
    sourceJobId: "demo-software-engineer-intern",
    title: "Software Engineer Intern",
    company: "Lanka Softworks (Demo)",
    location: "Colombo",
    country: "Sri Lanka",
    employmentType: "internship",
    workMode: "onsite",
    description:
      "Join our product engineering team to build features for our SaaS platform, used by SMEs across Sri Lanka. You'll pair with senior engineers on real production code.",
    responsibilities: [
      "Implement features across the frontend (React) and backend (Node.js)",
      "Write unit tests for new functionality",
      "Participate in code reviews and daily standups",
    ],
    requirements: [
      "Currently pursuing a degree in Computer Science, Software Engineering, or related field",
      "Proficiency in at least one of: JavaScript/TypeScript, Java, Python",
      "Understanding of REST APIs and Git",
      "Prior personal or academic projects on GitHub preferred",
    ],
    salaryText: null,
    postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    applicationUrl: "https://demo.careerlens.lk/jobs/demo-software-engineer-intern",
    sourceUrl: "https://demo.careerlens.lk/jobs/demo-software-engineer-intern",
  },
  {
    source: "demo",
    sourceJobId: "demo-cybersecurity-intern",
    title: "Cybersecurity Intern",
    company: "SecureIsland Networks (Demo)",
    location: "Colombo",
    country: "Sri Lanka",
    employmentType: "internship",
    workMode: "hybrid",
    description:
      "Support our SOC team with monitoring, incident triage, and vulnerability assessments for enterprise clients.",
    responsibilities: [
      "Monitor SIEM alerts and assist with triage",
      "Support vulnerability scanning and basic penetration testing under supervision",
      "Help maintain security documentation and runbooks",
    ],
    requirements: [
      "Currently pursuing a degree in Cybersecurity, IT, or Computer Science",
      "Basic understanding of networking (TCP/IP, firewalls)",
      "Familiarity with Linux is a plus",
      "Security certifications (e.g. CompTIA Security+) are a plus, not required",
    ],
    salaryText: null,
    postedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    applicationUrl: "https://demo.careerlens.lk/jobs/demo-cybersecurity-intern",
    sourceUrl: "https://demo.careerlens.lk/jobs/demo-cybersecurity-intern",
  },
  {
    source: "demo",
    sourceJobId: "demo-ml-intern",
    title: "Machine Learning Intern",
    company: "NeuralLanka Labs (Demo)",
    location: "Remote",
    country: "Sri Lanka",
    employmentType: "internship",
    workMode: "remote",
    description:
      "Work with our applied ML team on a computer vision project for agricultural monitoring. Strong Python and ML fundamentals expected; no professional experience required.",
    responsibilities: [
      "Prepare and clean datasets for model training",
      "Implement and evaluate baseline models under supervision",
      "Document experiment results",
    ],
    requirements: [
      "Currently pursuing a degree in Data Science, Computer Science, or related field",
      "Python proficiency, familiarity with a deep learning framework (PyTorch or TensorFlow)",
      "Coursework or personal projects involving machine learning",
      "Statistics fundamentals",
    ],
    salaryText: null,
    postedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    applicationUrl: "https://demo.careerlens.lk/jobs/demo-ml-intern",
    sourceUrl: "https://demo.careerlens.lk/jobs/demo-ml-intern",
  },
  {
    source: "demo",
    sourceJobId: "demo-junior-data-analyst",
    title: "Junior Data Analyst",
    company: "Ceylon Insights (Demo)",
    location: "Colombo",
    country: "Sri Lanka",
    employmentType: "full_time",
    workMode: "hybrid",
    description:
      "A graduate-level role for someone ready to take on full ownership of client reporting. Ideal for a recent graduate with strong project experience even without prior full-time employment.",
    responsibilities: [
      "Own end-to-end reporting for two client accounts",
      "Build dashboards in Power BI and Tableau",
      "Present findings directly to clients",
    ],
    requirements: [
      "Bachelor's degree in Data Science, Statistics, Business Analytics, or related field",
      "Strong SQL and Excel skills",
      "Power BI or Tableau required",
      "Excellent communication skills",
    ],
    salaryText: "Not disclosed",
    postedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    applicationUrl: "https://demo.careerlens.lk/jobs/demo-junior-data-analyst",
    sourceUrl: "https://demo.careerlens.lk/jobs/demo-junior-data-analyst",
  },
];

function matchesQuery(job: NormalizedJob, query: JobSearchQuery): boolean {
  const haystack = `${job.title} ${job.description ?? ""} ${job.requirements.join(" ")}`.toLowerCase();

  if (query.role) {
    const roleTokens = query.role.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const roleMatches = roleTokens.some((token) => haystack.includes(token));
    if (!roleMatches) return false;
  }

  if (query.keywords.length > 0) {
    const anyKeywordMatches = query.keywords.some((kw) => haystack.includes(kw.toLowerCase()));
    if (!anyKeywordMatches) return false;
  }

  if (query.location) {
    const loc = query.location.toLowerCase();
    const jobLoc = (job.location ?? "").toLowerCase();
    if (loc !== "remote" && jobLoc && !jobLoc.includes(loc) && jobLoc !== "remote") {
      return false;
    }
  }

  return true;
}

export const demoJobProvider: JobSearchProvider = {
  name: "demo",
  label: "Demo Data",
  isDemo: true,

  async search(query: JobSearchQuery): Promise<ProviderSearchResult> {
    const filtered = DEMO_JOBS.filter((job) => matchesQuery(job, query)).slice(0, query.limit);

    return {
      provider: "demo",
      status: "ok",
      jobs: filtered.length > 0 ? filtered : DEMO_JOBS.slice(0, Math.min(3, query.limit)),
    };
  },
};

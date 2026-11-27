/**
 * A17: artifact links inside task summaries / plans. Pure URL parsing — no network: Jira, Figma,
 * Asana and Drive are private, so labels come from the URL itself. Web renders chips, Slack renders
 * `<url|label>` and lets Slack unfurl.
 */
export type LinkProvider =
  | "jira"
  | "confluence"
  | "figma"
  | "asana"
  | "google-doc"
  | "google-sheet"
  | "google-slides"
  | "google-drive"
  | "github"
  | "linear"
  | "notion"
  | "loom"
  | "web";

export interface ArtifactLink {
  url: string;
  provider: LinkProvider;
  /** Short human label, e.g. "DOG-1364", "Map modal", "nerdylog#42", "Google Doc". */
  label: string;
  /** Jira/Linear issue key when present (also feeds ticket refs). */
  issueKey?: string;
}

export const PROVIDER_NAMES: Record<LinkProvider, string> = {
  jira: "Jira",
  confluence: "Confluence",
  figma: "Figma",
  asana: "Asana",
  "google-doc": "Google Docs",
  "google-sheet": "Google Sheets",
  "google-slides": "Google Slides",
  "google-drive": "Google Drive",
  github: "GitHub",
  linear: "Linear",
  notion: "Notion",
  loom: "Loom",
  web: "Link",
};

const URL_REGEX = /\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]}]/gi;
const ISSUE_KEY = /\b([A-Z][A-Z0-9]+-\d+)\b/;

/** "map-modal-v2" / "Map%20Modal" → "Map modal v2" (max 40 chars). */
function slugToTitle(slug: string): string {
  let text = slug;
  try {
    text = decodeURIComponent(slug);
  } catch {
    /* keep raw */
  }
  text = text.replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const title = text.charAt(0).toUpperCase() + text.slice(1);
  return title.length > 40 ? `${title.slice(0, 39)}…` : title;
}

export function parseArtifactLink(raw: string): ArtifactLink {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { url: raw, provider: "web", label: raw };
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  const url = u.toString();

  if (host.endsWith("atlassian.net") || host.includes("jira")) {
    if (parts[0] === "wiki") {
      const title = slugToTitle(parts.at(-1) ?? "");
      return { url, provider: "confluence", label: title || "Page" };
    }
    const key = (u.pathname + u.search).match(ISSUE_KEY)?.[1];
    if (key) return { url, provider: "jira", label: key, issueKey: key };
    return { url, provider: "jira", label: host.split(".")[0] };
  }
  if (host === "figma.com") {
    const title = slugToTitle(parts[2] ?? "");
    return { url, provider: "figma", label: title || "File" };
  }
  if (host === "app.asana.com" || host === "asana.com") {
    const id = [...parts].reverse().find((p) => /^\d{6,}$/.test(p));
    return { url, provider: "asana", label: id ? `Task ${id.slice(-6)}` : "Task" };
  }
  if (host === "docs.google.com") {
    if (parts[0] === "spreadsheets") return { url, provider: "google-sheet", label: "Sheet" };
    if (parts[0] === "presentation") return { url, provider: "google-slides", label: "Slides" };
    return { url, provider: "google-doc", label: "Doc" };
  }
  if (host === "drive.google.com") {
    return { url, provider: "google-drive", label: parts[1] === "folders" ? "Folder" : "File" };
  }
  if (host === "github.com" && parts.length >= 2) {
    const repo = parts[1];
    if ((parts[2] === "pull" || parts[2] === "issues") && parts[3]) {
      return { url, provider: "github", label: `${repo}#${parts[3]}` };
    }
    return { url, provider: "github", label: `${parts[0]}/${repo}` };
  }
  if (host === "linear.app") {
    const key = u.pathname.match(ISSUE_KEY)?.[1];
    return key ? { url, provider: "linear", label: key, issueKey: key } : { url, provider: "linear", label: "Issue" };
  }
  if (host.endsWith("notion.so") || host.endsWith("notion.site")) {
    const last = (parts.at(-1) ?? "").replace(/-?[0-9a-f]{32}$/i, "");
    return { url, provider: "notion", label: slugToTitle(last) || "Page" };
  }
  if (host === "loom.com") return { url, provider: "loom", label: "Video" };
  return { url, provider: "web", label: host };
}

/** All links in a text, in order, without duplicates. */
export function extractArtifactLinks(text: string): ArtifactLink[] {
  const seen = new Set<string>();
  const out: ArtifactLink[] = [];
  for (const match of text.match(URL_REGEX) ?? []) {
    const link = parseArtifactLink(match);
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    out.push(link);
  }
  return out;
}

/** Text split into plain segments and links, for rendering chips inline. */
export type TextSegment = { type: "text"; text: string } | { type: "link"; link: ArtifactLink };

export function segmentTextWithLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_REGEX)) {
    const start = m.index ?? 0;
    if (start > last) segments.push({ type: "text", text: text.slice(last, start) });
    segments.push({ type: "link", link: parseArtifactLink(m[0]) });
    last = start + m[0].length;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
  return segments;
}

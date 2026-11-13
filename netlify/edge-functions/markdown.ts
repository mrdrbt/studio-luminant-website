// Markdown for Agents: content negotiation on page URLs.
// A request whose Accept header prefers text/markdown (at least as much as text/html) gets the page's
// Markdown copy, <page>.htm.md, which tools/publish_site.py writes at build time; browsers keep getting HTML.
// Folder URLs (/ and /en/) map to index.md. A page with no Markdown copy falls through to the normal response.
// Every page response carries Vary: Accept so a cache never hands one form to the other kind of client.
import type { Config, Context } from "https://edge.netlify.com";

/** q-value a media range gets in an Accept header (0 when absent). */
export function quality(accept: string, type: string): number {
  let best = 0;
  for (const part of accept.split(",")) {
    const [range, ...params] = part.trim().toLowerCase().split(";");
    if (range.trim() !== type) continue;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    best = Math.max(best, q ? Number(q.slice(2)) || 0 : 1);
  }
  return best;
}

export function wantsMarkdown(accept: string): boolean {
  const md = quality(accept, "text/markdown");
  return md > 0 && md >= quality(accept, "text/html");
}

/** Path of the Markdown copy for a page path, or null when the path is not a page. */
export function markdownPath(pathname: string): string | null {
  if (pathname.endsWith("/")) return pathname + "index.md";
  if (pathname === "/en") return "/en/index.md";
  if (/\.html?$/i.test(pathname)) return pathname + ".md";
  return null;
}

function withVary(response: Response): Response {
  response.headers.append("Vary", "Accept");
  return response;
}

// Only the canonical host negotiates: the old-domain and www hosts must keep their 301 (edge runs before redirects).
const CANONICAL_HOST = "studioluminant.com.tr";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const mdPath = markdownPath(url.pathname);
  const canonical = url.hostname === CANONICAL_HOST || url.hostname.endsWith(".netlify.app");
  if (!mdPath || !canonical || !wantsMarkdown(request.headers.get("accept") ?? "")) {
    return withVary(await context.next());
  }
  const md = await fetch(new URL(mdPath, url), { redirect: "manual" });
  if (md.status !== 200) return withVary(await context.next());
  const text = await md.text();
  return new Response(request.method === "HEAD" ? null : text, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Vary": "Accept",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "x-markdown-tokens": String(Math.ceil(text.length / 4)), // estimate: ~4 characters per token
    },
  });
};

export const config: Config = {
  path: ["/", "/en", "/*/", "/*.htm", "/*.html"],
  onError: "bypass", // a crash here serves the normal page, never an error
};

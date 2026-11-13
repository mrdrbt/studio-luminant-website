#!/usr/bin/env python3
"""Copy the public site into _site/, the folder Netlify publishes (netlify.toml, build.command).

A Netlify redirect matches its path case-sensitively, but the file lookup behind it does not, so a 404
rule cannot hide a deployed file: /CLAUDE.md returned 404 while /claude.md served it. An internal file
is safe only if it is never deployed, so publishing is an allowlist.

A page behind a forced redirect is left out for the same reason: its normal URL redirects, but other
casings would serve the file.

Each published page also gets a Markdown copy, <page>.htm.md (tools/page_markdown.py), which the edge function
netlify/edge-functions/markdown.ts serves to requests sending Accept: text/markdown.

A file that fits no rule below stops the build and the previous deploy stays live: add its folder or
extension to the right list, then push again.

Usage: python tools/publish_site.py
"""
import shutil
import sys
import tomllib
from pathlib import Path

from page_markdown import page_markdown

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_site"

PUBLIC_DIRS = {"assets", "downloads", "en", "fonts", "images", "img", "pdf", "vendor", "video"}
INTERNAL_DIRS = {"_site", "docs", "netlify", "tools"}
PUBLIC_EXTS = {".avif", ".css", ".htm", ".html", ".ico", ".jpeg", ".jpg", ".js", ".mp4", ".pdf", ".png", ".svg",
               ".webp", ".woff2", ".xml"}
INTERNAL_EXTS = {".json", ".md", ".py", ".toml"}
# Named exceptions to the extension lists: relief-light.js fetches manifest.json at runtime.
PUBLIC_NAMES = {"llms.txt", "manifest.json", "robots.txt"}


def redirected_away():
    """Files shadowed by a forced redirect, except those a 200 rewrite serves (the two home pages)."""
    rules = tomllib.loads((ROOT / "netlify.toml").read_text(encoding="utf-8"))["redirects"]
    forced = {r["from"].lstrip("/") for r in rules if r.get("force") and r.get("status") != 200}
    rewritten = {r["to"].lstrip("/") for r in rules if r.get("status") == 200}
    return forced - rewritten


def write_markdown(rel, html):
    """Write <page>.md beside a published page for Markdown for Agents; False for pages with no <main>."""
    md = page_markdown(html)
    if md is None:
        return False
    (OUT / rel.with_name(rel.name + ".md")).write_text(md, encoding="utf-8")
    return True


def write_rewrite_markdown():
    """A folder URL rewritten to a page (/ and /en/) gets index.md, the path the edge function asks for."""
    rules = tomllib.loads((ROOT / "netlify.toml").read_text(encoding="utf-8"))["redirects"]
    for rule in rules:
        if rule.get("status") != 200:
            continue
        source = OUT / (rule["to"].lstrip("/") + ".md")
        if source.exists():
            shutil.copyfile(source, OUT / rule["from"].lstrip("/") / "index.md")


def is_public(rel):
    """True to publish, False to leave out. Raises ValueError on a file no rule covers."""
    parts = rel.parts
    if any(part.startswith(".") for part in parts) or parts[0] in INTERNAL_DIRS:
        return False
    if len(parts) > 1 and parts[0] not in PUBLIC_DIRS:
        raise ValueError(f"{rel}: folder {parts[0]}/ is in neither PUBLIC_DIRS nor INTERNAL_DIRS")
    ext = rel.suffix.lower()
    if rel.name in PUBLIC_NAMES or ext in PUBLIC_EXTS:
        return True
    if ext in INTERNAL_EXTS:
        return False
    raise ValueError(f"{rel}: extension is in neither PUBLIC_EXTS nor INTERNAL_EXTS")


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    published, left_out, markdown, unknown = 0, 0, 0, []
    shadowed = redirected_away()
    for path in sorted(p for p in ROOT.rglob("*") if p.is_file()):
        rel = path.relative_to(ROOT)
        try:
            public = is_public(rel)
        except ValueError as err:
            unknown.append(str(err))
            continue
        if not public or rel.as_posix() in shadowed:
            left_out += 1
            continue
        target = OUT / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        published += 1
        if rel.suffix.lower() in (".htm", ".html"):
            markdown += write_markdown(rel, path.read_text(encoding="utf-8"))
    if unknown:
        print("publish_site: build stopped, unclassified files:\n  " + "\n  ".join(unknown), file=sys.stderr)
        return 1
    write_rewrite_markdown()
    print(f"publish_site: {published} files in _site/, {left_out} left out, {markdown} Markdown pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())

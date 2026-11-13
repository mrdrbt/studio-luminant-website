#!/usr/bin/env python3
"""Turn a site page into clean Markdown for AI agents (Markdown for Agents, content negotiation).

publish_site.py calls page_markdown() for every published page and writes <page>.htm.md next to it in _site/;
the edge function netlify/edge-functions/markdown.ts serves that file when a request sends Accept: text/markdown.
Only the page's <main> is converted (nav and footer are JS-injected, so they are not in the HTML anyway); scripts,
styles, SVG, forms and hidden elements are dropped, links and images become absolute URLs.

Stdlib only: Netlify's build image runs this with plain python3, no pip install.

Usage: python tools/page_markdown.py <page.htm>   (prints the Markdown, for checking one page)
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

SKIP_TAGS = {"script", "style", "noscript", "svg", "template", "iframe", "form", "button", "select", "canvas",
             "video", "audio", "dialog"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
BLOCK_TAGS = {"p", "div", "section", "article", "header", "footer", "aside", "figure", "figcaption", "ul", "ol",
              "li", "blockquote", "table", "tr", "dl", "dt", "dd", "main", "nav", "details", "summary", "address",
              "h1", "h2", "h3", "h4", "h5", "h6", "hr", "br"}
INLINE_MARKS = {"strong": "**", "b": "**", "em": "*", "i": "*", "code": "`"}


def _is_hidden(attrs):
    return "hidden" in attrs or attrs.get("aria-hidden") == "true"


class _Converter(HTMLParser):
    """Collects head metadata and converts the <main> subtree to Markdown text."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta = {"title": "", "description": "", "canonical": "", "lang": ""}
        self.out = []
        self.in_title = False
        self.in_main = 0
        self.skip = []          # stack of tag names opened while skipping
        self.lists = []         # "ul" / "ol" counters
        self.link = None        # [href, text parts] while inside <a>
        self.in_pre = False
        self.in_heading = False

    # ── emit helpers ──
    def _emit(self, text):
        (self.link[1] if self.link else self.out).append(text)

    def _block(self, prefix=""):
        if self.link:
            self._emit(" ")
            return
        self.out.append("\n\n" + prefix)

    # ── parser callbacks ──
    def handle_starttag(self, tag, attrs_list):
        attrs = dict(attrs_list)
        if tag == "html":
            self.meta["lang"] = attrs.get("lang", "")
        if tag == "title":
            self.in_title = True
        if tag == "meta" and attrs.get("name") == "description":
            self.meta["description"] = attrs.get("content", "")
        if tag == "link" and attrs.get("rel") == "canonical":
            self.meta["canonical"] = attrs.get("href", "")
        if tag == "main":
            self.in_main += 1
        if not self.in_main:
            return
        if self.skip:
            if tag not in VOID_TAGS:
                self.skip.append(tag)
            return
        if tag in SKIP_TAGS or (_is_hidden(attrs) and tag not in VOID_TAGS):
            self.skip.append(tag)
            return
        self._open(tag, attrs)

    def _open(self, tag, attrs):
        if re.fullmatch(r"h[1-6]", tag):
            self.in_heading = True
            self._block("#" * int(tag[1]) + " ")
        elif tag in ("ul", "ol"):
            self.lists.append(0 if tag == "ol" else None)
            self._block()
        elif tag == "li":
            depth = "  " * max(len(self.lists) - 1, 0)
            if self.lists and self.lists[-1] is not None:
                self.lists[-1] += 1
                self._block(f"{depth}{self.lists[-1]}. ")
            else:
                self._block(f"{depth}- ")
        elif tag == "blockquote":
            self._block("> ")
        elif tag == "hr":
            self._block("---")
        elif tag == "br":
            self._emit(" " if self.link or self.in_heading else "  \n")
        elif tag in ("td", "th"):
            self._emit(" | ")
        elif tag == "pre":
            self.in_pre = True
            self._block("```\n")
        elif tag in BLOCK_TAGS:
            self._block()
        elif tag in INLINE_MARKS:
            self._emit(INLINE_MARKS[tag])
        elif tag == "a":
            href = attrs.get("href") or ""
            self.link = [href, []]
        elif tag == "img":
            alt = (attrs.get("alt") or "").strip()
            src = attrs.get("data-src") or attrs.get("src") or ""   # lazy images keep the real file in data-src
            if alt and src and not src.startswith("data:"):
                self._emit(f"![{alt}]({self._abs(src)})")

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if not self.in_main:
            return
        if self.skip:
            if self.skip[-1] == tag:
                self.skip.pop()
            return
        if tag == "main":
            self.in_main -= 1
            return
        if re.fullmatch(r"h[1-6]", tag):
            self.in_heading = False
        if tag in ("ul", "ol") and self.lists:
            self.lists.pop()
        if tag == "pre":
            self.in_pre = False
            self.out.append("\n```")
        if tag in INLINE_MARKS:
            self._emit(INLINE_MARKS[tag])
        if tag == "a" and self.link:
            href, parts = self.link
            self.link = None
            text = re.sub(r"\s+", " ", "".join(parts)).strip()
            if not text:
                return
            if href and not href.startswith(("#", "javascript:")):
                self.out.append(f"[{text}]({self._abs(href)})")
            else:
                self.out.append(text)
        elif tag in BLOCK_TAGS:
            self._block()

    def handle_data(self, data):
        if self.in_title:
            self.meta["title"] += data
        if not self.in_main or self.skip:
            return
        self._emit(data if self.in_pre else re.sub(r"\s+", " ", data))

    def _abs(self, url):
        return urljoin(self.meta["canonical"], url).replace(" ", "%20")


def _tidy(text):
    lines = [line.rstrip() if not line.endswith("  ") else line for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\*\*\s*\*\*|(?<!\*)\*\s*\*(?!\*)", "", text)   # empty bold/italic pairs
    text = re.sub(r"\n[ \t]*(#+|-|\d+\.|>)[ \t]*(?=\n)", "\n", text)  # prefixes left with no text
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"(?m)^[ \t]+(?!(-|\d+\.) )", "", text)            # stray indents, list nesting kept
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = "\n".join(re.sub(r"(?<=\S) {2,}(?=\S)", " ", line) for line in text.split("\n"))
    return text.strip()


def page_markdown(html):
    """Markdown for one page, or None if the page has no <main> (redirect stubs, fragments)."""
    conv = _Converter()
    conv.feed(html)
    conv.close()
    body = _tidy("".join(conv.out))
    if not body:
        return None
    head = ["---"]
    for key, value in (("title", conv.meta["title"]), ("description", conv.meta["description"]),
                       ("url", conv.meta["canonical"]), ("lang", conv.meta["lang"])):
        if value.strip():
            head.append(f"{key}: {json.dumps(value.strip(), ensure_ascii=False)}")   # JSON strings are valid YAML
    head.append("---")
    return "\n".join(head) + "\n\n" + body + "\n"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    md = page_markdown(Path(sys.argv[1]).read_text(encoding="utf-8"))
    sys.stdout.reconfigure(encoding="utf-8")
    print(md if md is not None else "(no <main>: no markdown)")

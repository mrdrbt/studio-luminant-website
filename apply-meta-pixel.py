#!/usr/bin/env python3
"""
apply-meta-pixel.py — Studio Luminant website

Inserts the Meta Pixel (ID 1437127258139677) into every page that already loads
GA4, mirroring the existing GA4 pattern (apply-internal-optout.py):

  1. Head snippet, placed right after the GA4 `gtag('config', ...)` block. It is
     gated by the same internal-traffic rules as GA4 (localhost + the
     `sl_internal` localStorage flag from apply-internal-optout.py) so dev/
     internal browsing never pollutes Meta ad-conversion data.
  2. The <noscript> pixel fallback, placed right after the opening <body> tag
     per Meta's own integration instructions. Left ungated (matches Meta's
     stock snippet) since it only fires with JS disabled.
  3. An `fbq('track', 'Lead')` call alongside the existing GA4 `generate_lead`
     event on the four lead-capturing forms (from apply-lead-event.py), so Meta
     lead-gen ads get the same conversion signal GA4 already has.

Idempotent: skips any file/insertion that already contains the corresponding
marker, so it is safe to re-run after adding new pages.
"""
import re
from pathlib import Path

SITE = Path(r"C:\Users\burak\Desktop\SL COWORK\VAULT\06 — Website\Studio Luminant Website")
GA_ID = "G-PZ0SGLKLH0"
PIXEL_ID = "1437127258139677"
HEAD_MARKER = "connect.facebook.net/en_US/fbevents.js"
LEAD_MARKER = "fbq('track', 'Lead')"

GA_CONFIG_RE = re.compile(
    r"^([ \t]*)(gtag\('config', '" + re.escape(GA_ID) + r"'\);\r?\n[ \t]*</script>)",
    re.MULTILINE,
)
BODY_RE = re.compile(r"^(<body[^>]*>)", re.MULTILINE)
GENERATE_LEAD_RE = re.compile(
    r"^([ \t]*)(if \(typeof gtag === 'function'\) \{ gtag\('event', 'generate_lead',.*\); \})",
    re.MULTILINE,
)

LEAD_FILES = {"iletisim.htm", "en/contact.htm", "mimarlar.htm", "en/architects.htm"}


def head_snippet(indent, nl):
    lines = [
        "<!-- Meta Pixel -->",
        "<script>",
        "(function(){",
        "  try{",
        "    var h=location.hostname;",
        "    if(h==='localhost'||h==='127.0.0.1'||h==='::1'||h===''){return;}",
        "    if(localStorage.getItem('sl_internal')==='1'){return;}",
        "  }catch(e){}",
        "  !function(f,b,e,v,n,t,s)",
        "  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?",
        "  n.callMethod.apply(n,arguments):n.queue.push(arguments)};",
        "  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';",
        "  n.queue=[];t=b.createElement(e);t.async=!0;",
        "  t.src=v;s=b.getElementsByTagName(e)[0];",
        "  s.parentNode.insertBefore(t,s)}(window, document,'script',",
        "  'https://connect.facebook.net/en_US/fbevents.js');",
        f"  fbq('init', '{PIXEL_ID}');",
        "  fbq('track', 'PageView');",
        "})();",
        "</script>",
        "<!-- End Meta Pixel -->",
    ]
    return nl.join(indent + line for line in lines) + nl


def noscript_snippet(nl):
    return nl.join([
        '<noscript><img height="1" width="1" style="display:none"',
        f'src="https://www.facebook.com/tr?id={PIXEL_ID}&ev=PageView&noscript=1"',
        "/></noscript>",
    ]) + nl


def insert_head(text, nl):
    def repl(m):
        indent, block = m.group(1), m.group(2)
        return indent + block + nl + head_snippet(indent, nl).rstrip(nl)

    return GA_CONFIG_RE.subn(repl, text, count=1)


def insert_noscript(text, nl):
    def repl(m):
        return m.group(1) + nl + noscript_snippet(nl).rstrip(nl)

    return BODY_RE.subn(repl, text, count=1)


def insert_lead_event(text, nl):
    def repl(m):
        indent, line = m.group(1), m.group(2)
        return indent + line + nl + indent + "if (typeof fbq === 'function') { fbq('track', 'Lead'); }"

    return GENERATE_LEAD_RE.subn(repl, text, count=1)


def main():
    changed, skipped, unmatched = [], [], []
    files = sorted(set(SITE.rglob("*.htm")) | set(SITE.rglob("*.html")))
    for path in files:
        with open(path, "r", encoding="utf-8", newline="") as f:
            text = f.read()
        if ("gtag/js?id=" + GA_ID) not in text:
            continue  # page doesn't load GA (e.g. redirect stub)
        rel = str(path.relative_to(SITE)).replace("\\", "/")
        nl = "\r\n" if "\r\n" in text else "\n"
        original = text
        notes = []

        if HEAD_MARKER not in text:
            text, n = insert_head(text, nl)
            if n == 0:
                unmatched.append(f"{rel}: GA4 config anchor not found")
            else:
                notes.append("head")
                text, n = insert_noscript(text, nl)
                if n == 0:
                    unmatched.append(f"{rel}: <body> anchor not found")
                else:
                    notes.append("noscript")

        if rel in LEAD_FILES and LEAD_MARKER not in text:
            text, n = insert_lead_event(text, nl)
            if n == 0:
                unmatched.append(f"{rel}: generate_lead anchor not found")
            else:
                notes.append("lead-event")

        if text == original:
            skipped.append(rel)
            continue
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(text)
        changed.append(f"{rel} ({', '.join(notes)})")

    print(f"changed: {len(changed)}")
    for c in changed:
        print("  +", c)
    print(f"skipped (already present): {len(skipped)}")
    print(f"issues: {len(unmatched)}")
    for u in unmatched:
        print("  ?", u)


if __name__ == "__main__":
    main()

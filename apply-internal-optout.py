#!/usr/bin/env python3
"""
apply-internal-optout.py — Studio Luminant website

Inserts an IP-independent GA4 internal-traffic kill-switch into every page that
loads gtag.js. Visiting any page once with ?internal=1 stores a localStorage flag
that disables GA4 (G-PZ0SGLKLH0) for THAT browser on all future visits, regardless
of IP. ?internal=0 clears the flag and re-enables tracking.

The guard sets window['ga-disable-G-PZ0SGLKLH0']=true BEFORE gtag.js loads, which is
Google's documented opt-out — it suppresses page_view and all events (file_download,
generate_lead, etc.) for that measurement ID.

Idempotent: skips any file that already contains the guard, so it is safe to re-run
after adding new pages.
"""
import re
from pathlib import Path

SITE = Path(r"C:\Users\burak\Desktop\SL COWORK\VAULT\06 — Website\Studio Luminant Website")
GA_ID = "G-PZ0SGLKLH0"
MARKER = "sl_internal"  # idempotency sentinel + localStorage key

# Match the gtag.js loader line, capturing its leading indentation so we can mirror it.
LOADER_RE = re.compile(
    r'^([ \t]*)(<script async src="https://www\.googletagmanager\.com/gtag/js\?id='
    + re.escape(GA_ID) + r'"></script>)',
    re.MULTILINE,
)


def guard_lines(indent, nl):
    comment = (indent +
               "<!-- SL internal-traffic opt-out: visit ?internal=1 once per browser to "
               "stop GA; ?internal=0 to re-enable -->")
    script = (indent +
              "<script>(function(){try{var v=new URLSearchParams(location.search).get('internal');"
              f"if(v==='1')localStorage.setItem('{MARKER}','1');"
              f"else if(v==='0')localStorage.removeItem('{MARKER}');"
              f"if(localStorage.getItem('{MARKER}')==='1')window['ga-disable-{GA_ID}']=true;"
              "}catch(e){}})();</script>")
    return comment + nl + script + nl


def main():
    changed, skipped, unmatched = [], [], []
    files = sorted(set(SITE.rglob("*.htm")) | set(SITE.rglob("*.html")))
    for path in files:
        with open(path, "r", encoding="utf-8", newline="") as f:
            text = f.read()
        if ("gtag/js?id=" + GA_ID) not in text:
            continue  # page doesn't load GA (e.g. redirect stub)
        if MARKER in text:
            skipped.append(path.name)
            continue
        nl = "\r\n" if "\r\n" in text else "\n"

        def repl(m):
            return guard_lines(m.group(1), nl) + m.group(1) + m.group(2)

        new_text, n = LOADER_RE.subn(repl, text, count=1)
        if n == 0:
            unmatched.append(path.name)  # loader present but not in expected form
            continue
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(new_text)
        changed.append(str(path.relative_to(SITE)))

    print(f"changed: {len(changed)}")
    for c in changed:
        print("  +", c)
    print(f"skipped (guard already present): {len(skipped)}")
    print(f"loader present but pattern unmatched: {len(unmatched)}")
    for u in unmatched:
        print("  ?", u)


if __name__ == "__main__":
    main()

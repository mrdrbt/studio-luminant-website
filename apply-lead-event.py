#!/usr/bin/env python3
"""
apply-lead-event.py — fire a GA4 `generate_lead` event on the contact and
sample-box forms that capture a CRM lead but emitted no conversion event.

The four lead-magnet forms (specifier-kit x2, compass-star-bim x2) already fire
`generate_lead` on a successful lead-intake POST. The two contact forms and the
two architect/sample-box forms POST to the same lead-intake function but fired
NO GA4 event, so real submissions never became conversions and the unreliable
auto `form_submit` (which misses fetch/preventDefault forms) was the only — and
incomplete — signal. That is the form_submit-vs-generate_lead mismatch.

This inserts the same guarded gtag call into each success branch, tagged with the
form's existing hidden `source` value so leads stay distinguishable in GA4.

Idempotent: skips any file that already fires generate_lead. Preserves CRLF.
Re-run after adding new lead-capturing forms.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Forms that POST to lead-intake but were missing the generate_lead event.
TARGETS = [
    "iletisim.htm",       # contact (TR)
    "en/contact.htm",     # contact (EN)
    "mimarlar.htm",       # sample box (TR)
    "en/architects.htm",  # sample box (EN)
]

ANCHOR = "if (res.ok) {"
EVENT_CALL = "if (typeof gtag === 'function') { gtag('event', 'generate_lead', { source: data.source || '' }); }"
MARKER = "generate_lead"  # idempotency guard


def patch(text):
    idx = text.find(ANCHOR)
    if idx == -1:
        return None, "anchor 'if (res.ok) {' not found"
    if text.count(ANCHOR) != 1:
        return None, "anchor is not unique"
    line_start = text.rfind("\n", 0, idx) + 1
    indent = text[line_start:idx]
    if indent.strip():
        return None, "anchor not at start of line"
    eol = text.find("\n", idx)
    if eol == -1:
        return None, "no line ending after anchor"
    newline = "\r\n" if text[eol - 1] == "\r" else "\n"
    body_indent = indent + "  "
    insertion = body_indent + EVENT_CALL + newline
    return text[: eol + 1] + insertion + text[eol + 1 :], None


def main():
    changed, skipped, errors = [], [], []
    for rel in TARGETS:
        p = HERE / rel
        if not p.exists():
            errors.append(f"{rel}: file missing")
            continue
        with open(p, "r", encoding="utf-8", newline="") as fh:
            text = fh.read()
        if MARKER in text:
            skipped.append(rel)
            continue
        new, err = patch(text)
        if err:
            errors.append(f"{rel}: {err}")
            continue
        with open(p, "w", encoding="utf-8", newline="") as fh:
            fh.write(new)
        changed.append(rel)
    print("CHANGED:", ", ".join(changed) if changed else "—")
    print("SKIPPED (already firing):", ", ".join(skipped) if skipped else "—")
    print("ERRORS:", "; ".join(errors) if errors else "—")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

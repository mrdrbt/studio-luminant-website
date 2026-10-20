"""hreflang + canonical check over the served pages, with netlify.toml redirects simulated (SEO-03).

For every page Netlify would serve (a forced redirect or a meta-refresh stub is not a page):
  - exactly one canonical, absolute on the live domain, resolving 200 with no redirect, pointing at the page itself
  - hreflang: the page's own language + x-default present (a twin adds the other one); every href resolves 200
    with no redirect; x-default = the tr URL;
    the page's own <html lang> entry = its canonical
  - reciprocity: the twin page's tr/en pair is the same pair
Pages with no hreflang at all are listed as info (TR-only or EN-only pages), not counted as mismatches.
Exit 1 on any mismatch.

Usage: python tools/hreflang_check.py [site-root]
"""
import re
import sys
import tomllib
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
ORIGIN = 'https://studioluminant.com.tr'
SKIP_DIRS = {'docs', 'tools', '.git', 'vendor', 'node_modules', '.githooks'}
CANON_RE = re.compile(r'<link[^>]+rel="canonical"[^>]*>', re.I)
HREF_RE = re.compile(r'href="([^"]+)"', re.I)
LANG_RE = re.compile(r'<html[^>]+lang="([a-z]{2})', re.I)
REFRESH_RE = re.compile(r'http-equiv="refresh"', re.I)

RULES = []
for r in tomllib.loads((ROOT / 'netlify.toml').read_text(encoding='utf-8')).get('redirects', []):
    if not r['from'].startswith('http'):
        RULES.append((r['from'], r['to'], int(r.get('status', 301)), bool(r.get('force'))))


def file_for(path):
    rel = unquote(path).lstrip('/')
    p = ROOT / rel
    if rel == '' or rel.endswith('/'):
        p = p / 'index.html'
    if any(part in SKIP_DIRS for part in Path(rel).parts):
        return None
    return p if p.is_file() else None


def match(path):
    for frm, to, status, force in RULES:
        if frm.endswith('/*'):
            if path.startswith(frm[:-1]):
                return to.replace(':splat', path[len(frm) - 1:]), status, force
        elif path == frm:
            return to, status, force
    return None


def serve(path):
    """-> (status, served file or None). 200 = served as-is (rewrites included), 3xx/4xx = not a page."""
    m = match(path)
    if m and m[1] == 200:
        return (200, file_for(m[0])) if file_for(m[0]) else (404, None)
    if m and (m[2] or file_for(path) is None):
        return m[1], None
    f = file_for(path)
    return (200, f) if f else (404, None)


def url_path(url):
    if not url.startswith(ORIGIN + '/'):
        return None
    return unquote(urlsplit(url).path)


def head_of(f):
    text = f.read_text(encoding='utf-8-sig', errors='replace')
    return text[:text.lower().find('</head>') if '</head>' in text.lower() else 20000]


def links(head):
    canon = [HREF_RE.search(t).group(1) for t in CANON_RE.findall(head) if HREF_RE.search(t)]
    alts = {}
    for tag in re.finditer(r'<link[^>]+rel="alternate"[^>]*>', head, re.I):
        lang = re.search(r'hreflang="([^"]+)"', tag.group(0), re.I)
        href = HREF_RE.search(tag.group(0))
        if lang and href:
            alts[lang.group(1).lower()] = href.group(1)
    return canon, alts


def served_pages():
    for f in sorted(ROOT.rglob('*')):
        if f.suffix not in ('.htm', '.html') or any(p in SKIP_DIRS for p in f.relative_to(ROOT).parts):
            continue
        path = '/' + f.relative_to(ROOT).as_posix()
        status, _ = serve(path)
        if status != 200 or REFRESH_RE.search(head_of(f)) or f.name == '404.html':
            continue
        yield f


def main():
    pages = list(served_pages())
    mismatches, info = [], []
    pairs = {}
    for f in pages:
        rel = f.relative_to(ROOT).as_posix()
        head = head_of(f)
        canon, alts = links(head)
        if len(canon) != 1:
            mismatches.append(f'{rel}: {len(canon)} canonical tags')
            continue
        cpath = url_path(canon[0])
        status, target = serve(cpath) if cpath else (None, None)
        if status != 200:
            mismatches.append(f'{rel}: canonical {canon[0]} -> {status}')
        elif target.resolve() != f.resolve():
            mismatches.append(f'{rel}: canonical {canon[0]} serves {target.relative_to(ROOT).as_posix()}')
        if not alts:
            info.append(f'{rel}: no hreflang')
            continue
        lang = (LANG_RE.search(head) or [None, None])[1]
        missing = {lang, 'x-default'} - alts.keys()   # a single-language page carries its own entry + x-default
        if missing:
            mismatches.append(f'{rel}: hreflang missing {sorted(missing)}')
            continue
        for code, href in alts.items():
            p = url_path(href)
            st, _ = serve(p) if p else (None, None)
            if st != 200:
                mismatches.append(f'{rel}: hreflang {code} {href} -> {st}')
        if 'tr' in alts and alts['x-default'] != alts['tr']:
            mismatches.append(f'{rel}: x-default {alts["x-default"]} != tr {alts["tr"]}')
        if alts[lang] != canon[0]:
            mismatches.append(f'{rel}: hreflang {lang} {alts[lang]} != canonical {canon[0]}')
        if 'tr' in alts and 'en' in alts:
            pairs[rel] = (alts['tr'], alts['en'])
    # reciprocity: the twin carries the same tr/en pair
    for rel, (tr, en) in pairs.items():
        for href in (tr, en):
            st, twin = serve(url_path(href))
            if st != 200 or twin is None:
                continue
            trel = twin.relative_to(ROOT).as_posix()
            if trel in pairs and pairs[trel] != (tr, en):
                mismatches.append(f'{rel}: pair {tr} / {en} not returned by {trel} ({pairs[trel][0]} / {pairs[trel][1]})')
    for line in info:
        print('info  ', line)
    for line in mismatches:
        print('MISMATCH', line)
    print(f'{len(pages)} pages checked, {len(pairs)} tr/en pairs, {len(mismatches)} mismatches')
    return 1 if mismatches else 0


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""
Studio Luminant - HTML Image Transform Script
Reads image-manifest.json and transforms all <img> tags in HTML pages
to use <picture> elements with WebP + responsive srcset.

Also adds width/height, decoding="async", and preserves existing attributes.
"""

import json
import re
import sys
from pathlib import Path

SITE_DIR = Path(__file__).parent
MANIFEST_FILE = SITE_DIR / "image-manifest.json"

# Load manifest
with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
    MANIFEST = json.load(f)


def get_manifest_entry(src_path):
    """Look up manifest entry from an img src like 'images/foo.jpg' or '../images/foo.jpg'."""
    filename = src_path.split("/")[-1]
    return MANIFEST.get(filename)


def build_picture(img_match, src_prefix="images/", sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw"):
    """
    Transform an <img ...> match into a <picture> element.
    Returns the replacement string, or original if no manifest entry found.
    """
    full_tag = img_match.group(0)

    # Extract src
    src_match = re.search(r'src="([^"]*)"', full_tag)
    if not src_match:
        return full_tag
    src = src_match.group(1)

    # Skip non-image-directory images (e.g. data URIs, external URLs)
    if not ("images/" in src):
        return full_tag

    # Get manifest entry
    entry = get_manifest_entry(src)
    if not entry or not entry.get("webp"):
        return full_tag

    # Determine the prefix (images/ or ../images/)
    prefix_match = re.match(r'(.*images/)', src)
    if not prefix_match:
        return full_tag
    prefix = prefix_match.group(1)

    orig = entry["original"]
    w = orig.get("w", "")
    h = orig.get("h", "")
    stem = entry["webp"].replace(".webp", "")

    # Build srcset entries
    srcset_parts = []
    for width_key in sorted(entry.get("variants", {}).keys(), key=int):
        v = entry["variants"][width_key]
        srcset_parts.append(f"{prefix}{v['file']} {width_key}w")
    # Add full-res webp
    srcset_parts.append(f"{prefix}{entry['webp']} {w}w")
    srcset = ",\n                  ".join(srcset_parts)

    # Extract existing attributes we want to preserve
    alt_match = re.search(r'alt="([^"]*)"', full_tag)
    alt = alt_match.group(1) if alt_match else ""

    class_match = re.search(r'class="([^"]*)"', full_tag)
    class_attr = f' class="{class_match.group(1)}"' if class_match else ""

    id_match = re.search(r'id="([^"]*)"', full_tag)
    id_attr = f' id="{id_match.group(1)}"' if id_match else ""

    # Check loading attribute
    loading_match = re.search(r'loading="([^"]*)"', full_tag)
    loading = loading_match.group(1) if loading_match else "lazy"

    # Check for fetchpriority
    prio_match = re.search(r'fetchpriority="([^"]*)"', full_tag)
    prio_attr = f' fetchpriority="{prio_match.group(1)}"' if prio_match else ""

    # Check for onerror
    onerror_match = re.search(r'onerror="([^"]*)"', full_tag)
    onerror_attr = f' onerror="{onerror_match.group(1)}"' if onerror_match else ""

    decoding = ' decoding="async"' if loading == "lazy" else ""

    wh_attr = ""
    if w and h:
        wh_attr = f' width="{w}" height="{h}"'

    picture = f'''<picture>
              <source type="image/webp"
                  srcset="{srcset}"
                  sizes="{sizes}">
              <img src="{src}"
                   alt="{alt}"{id_attr}{class_attr}{wh_attr}
                   loading="{loading}"{decoding}{prio_attr}{onerror_attr}>
            </picture>'''

    return picture


def transform_file(filepath, sizes_map=None):
    """
    Transform all <img> tags in an HTML file to <picture> elements.
    sizes_map: dict mapping CSS class or context to sizes attribute value.
    """
    default_sizes = "(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw"

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Match all <img ...> tags that reference images/ directory
    img_pattern = re.compile(r'<img\s[^>]*src="[^"]*images/[^"]*"[^>]*>', re.DOTALL)

    def replacer(match):
        tag = match.group(0)
        # Skip if already inside a <picture> element
        start = match.start()
        # Find the last <picture> or </picture> before this position
        last_open = content.rfind("<picture>", 0, start)
        last_close = content.rfind("</picture>", 0, start)
        if last_open > last_close:
            return tag  # We're inside an unclosed <picture>

        # Skip nav logo and footer logo (tiny files)
        if "logo-white-transparent" in tag:
            return tag

        # Determine sizes based on class
        if 'class="hero-image"' in tag or 'class="hero-img"' in tag:
            sizes = "50vw"
        elif 'class="strategy-img"' in tag:
            sizes = "(max-width: 1024px) 100vw, 50vw"
        elif 'class="step-image"' in tag:
            sizes = "(max-width: 1024px) 100vw, 33vw"
        elif 'class="material-img"' in tag:
            sizes = "(max-width: 1024px) 100vw, 50vw"
        elif 'class="uds-image"' in tag:
            sizes = "(max-width: 1024px) 100vw, 50vw"
        elif 'class="product-full-img"' in tag:
            sizes = "100vw"
        else:
            sizes = default_sizes

        return build_picture(match, sizes=sizes)

    new_content = img_pattern.sub(replacer, content)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)

    # Count changes
    orig_count = len(img_pattern.findall(content))
    new_pictures = new_content.count("<picture>")
    return orig_count, new_pictures


def main():
    # English pages
    en_pages = [
        "Studio Luminant — Bespoke Architectural Elements.htm",
        "gallery.htm",
        "lookbook.htm",
        "products.htm",
        "process.htm",
        "resources.htm",
        "resources-fire-ratings.htm",
        "resources-specification-guide.htm",
        "resources-weight-structural.htm",
    ]

    # Turkish pages
    tr_pages = [
        "tr/Studio Luminant \u2014 \u00d6zel Mimari Elemanlar.htm",
        "tr/galeri.htm",
        "tr/urunler.htm",
        "tr/surec.htm",
        "tr/koleksiyon.htm",
    ]

    all_pages = en_pages + tr_pages

    print("=" * 60)
    print("  Studio Luminant - HTML Image Transform")
    print("=" * 60)

    total_transformed = 0
    for page in all_pages:
        filepath = SITE_DIR / page
        if not filepath.exists():
            print(f"  SKIP (not found): {page}")
            continue

        orig, pics = transform_file(filepath)
        print(f"  {page}: {orig} img tags -> {pics} <picture> elements")
        total_transformed += pics

    print(f"\n  Total <picture> elements created: {total_transformed}")
    print("=" * 60)


if __name__ == "__main__":
    main()

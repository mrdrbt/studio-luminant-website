#!/usr/bin/env python3
"""
Studio Luminant — Image Optimization Script
Converts JPG/PNG to WebP, generates responsive size variants,
and outputs a manifest JSON for the website's <picture> elements.

Usage:
    python optimize-images.py              # process new/changed images
    python optimize-images.py --force      # reprocess all images
    python optimize-images.py --dry-run    # preview without writing files
    python optimize-images.py --quality 80 # set WebP quality (default: 80)
    python optimize-images.py --sizes 400,800,1600  # responsive widths
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

from PIL import Image, ImageFile

# Allow loading truncated images gracefully
ImageFile.LOAD_TRUNCATED_IMAGES = True

# ── Config ──────────────────────────────────────────────────────────────────

IMAGES_DIR = Path(__file__).parent / "images"
MANIFEST_FILE = Path(__file__).parent / "image-manifest.json"

DEFAULT_QUALITY = 80
RGBA_QUALITY = 85
LOSSLESS_THRESHOLD = 10 * 1024  # skip files under 10 KB
RESPONSIVE_WIDTHS = [400, 800, 1600]

# Files to skip (too small or special purpose)
SKIP_PATTERNS = {"favicon", "apple-touch-icon"}


def has_meaningful_alpha(img):
    """Check if a RGBA image actually uses transparency."""
    if img.mode != "RGBA":
        return False
    alpha = img.getchannel("A")
    extrema = alpha.getextrema()
    # If min alpha is 255, every pixel is fully opaque — no real transparency
    return extrema[0] < 255


def get_file_size(path):
    """Return file size in bytes."""
    return path.stat().st_size if path.exists() else 0


def format_size(size_bytes):
    """Human-readable file size."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def should_skip(filename):
    """Check if file should be excluded from processing."""
    name_lower = filename.lower()
    for pattern in SKIP_PATTERNS:
        if pattern in name_lower:
            return True
    return False


def needs_processing(src_path, webp_full_path, force=False):
    """Check if source needs (re)processing."""
    if force:
        return True
    if not webp_full_path.exists():
        return True
    # Reprocess if source is newer than WebP
    return src_path.stat().st_mtime > webp_full_path.stat().st_mtime


def process_image(src_path, quality, widths, dry_run=False):
    """
    Process a single image: generate WebP full-res + responsive variants.
    Returns dict with file info, or None if skipped.
    """
    filename = src_path.name
    stem = src_path.stem
    ext = src_path.suffix.lower()
    original_size = get_file_size(src_path)

    result = {
        "original": {
            "file": filename,
            "size": original_size,
        },
        "webp": None,
        "variants": {},
        "saved_bytes": 0,
    }

    try:
        img = Image.open(src_path)
    except Exception as e:
        print(f"  ERROR opening {filename}: {e}")
        return None

    w, h = img.size
    result["original"]["w"] = w
    result["original"]["h"] = h

    # Determine if image needs transparency
    is_rgba = img.mode == "RGBA" and has_meaningful_alpha(img)
    webp_quality = RGBA_QUALITY if is_rgba else quality
    webp_lossless = original_size < LOSSLESS_THRESHOLD

    # ── Full-resolution WebP ───────────────────────────────────────────
    webp_full = IMAGES_DIR / f"{stem}.webp"
    result["webp"] = f"{stem}.webp"

    if not dry_run:
        save_kwargs = {"format": "WEBP"}
        if webp_lossless:
            save_kwargs["lossless"] = True
        else:
            save_kwargs["quality"] = webp_quality
            save_kwargs["method"] = 4  # balanced speed/compression

        # Convert RGBA PNGs: WebP supports lossy+alpha natively
        img_to_save = img
        if img.mode == "RGBA" and not is_rgba:
            # No real alpha — flatten to RGB for smaller file
            img_to_save = img.convert("RGB")
        elif img.mode not in ("RGB", "RGBA"):
            img_to_save = img.convert("RGB")

        img_to_save.save(webp_full, **save_kwargs)

    webp_full_size = get_file_size(webp_full) if not dry_run else int(original_size * 0.4)
    result["saved_bytes"] += original_size - webp_full_size

    # ── Responsive variants ────────────────────────────────────────────
    for target_w in widths:
        if target_w >= w:
            # Source is smaller than target — skip this size
            continue

        ratio = target_w / w
        target_h = round(h * ratio)
        variant_name = f"{stem}-{target_w}w.webp"
        variant_path = IMAGES_DIR / variant_name

        result["variants"][str(target_w)] = {
            "file": variant_name,
            "w": target_w,
            "h": target_h,
        }

        if not dry_run:
            img_resized = img.resize((target_w, target_h), Image.LANCZOS)
            if img_resized.mode == "RGBA" and not is_rgba:
                img_resized = img_resized.convert("RGB")
            elif img_resized.mode not in ("RGB", "RGBA"):
                img_resized = img_resized.convert("RGB")

            save_kwargs_variant = {"format": "WEBP", "quality": webp_quality, "method": 4}
            img_resized.save(variant_path, **save_kwargs_variant)

    return result


def main():
    parser = argparse.ArgumentParser(description="Optimize images for Studio Luminant website")
    parser.add_argument("--force", action="store_true", help="Reprocess all images")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing files")
    parser.add_argument("--quality", type=int, default=DEFAULT_QUALITY, help=f"WebP quality (default: {DEFAULT_QUALITY})")
    parser.add_argument("--sizes", type=str, default=",".join(map(str, RESPONSIVE_WIDTHS)),
                        help=f"Responsive widths, comma-separated (default: {','.join(map(str, RESPONSIVE_WIDTHS))})")
    args = parser.parse_args()

    widths = sorted([int(s.strip()) for s in args.sizes.split(",")])

    if not IMAGES_DIR.is_dir():
        print(f"ERROR: Images directory not found: {IMAGES_DIR}")
        sys.exit(1)

    # Collect source images
    extensions = {".jpg", ".jpeg", ".png"}
    sources = sorted([
        f for f in IMAGES_DIR.iterdir()
        if f.suffix.lower() in extensions
        and not should_skip(f.name)
        and f.stat().st_size >= LOSSLESS_THRESHOLD
    ])

    # Also include small files in manifest (but don't generate variants)
    small_files = sorted([
        f for f in IMAGES_DIR.iterdir()
        if f.suffix.lower() in extensions
        and f.stat().st_size < LOSSLESS_THRESHOLD
        and not should_skip(f.name)
    ])

    print(f"\n{'=' * 60}")
    print(f"  Studio Luminant — Image Optimizer")
    print(f"{'=' * 60}")
    print(f"  Directory:  {IMAGES_DIR}")
    print(f"  Quality:    {args.quality}")
    print(f"  Sizes:      {widths}")
    print(f"  Force:      {args.force}")
    print(f"  Dry run:    {args.dry_run}")
    print(f"  Images:     {len(sources)} to process, {len(small_files)} small (skipped)")
    print(f"{'=' * 60}\n")

    manifest = {}
    total_original = 0
    total_saved = 0
    processed = 0
    skipped = 0

    start_time = time.time()

    for src in sources:
        filename = src.name
        stem = src.stem
        webp_full = IMAGES_DIR / f"{stem}.webp"

        if not needs_processing(src, webp_full, force=args.force):
            # Still add to manifest if webp exists
            try:
                img = Image.open(src)
                w, h = img.size
                manifest[filename] = {
                    "original": {"file": filename, "w": w, "h": h, "size": get_file_size(src)},
                    "webp": f"{stem}.webp",
                    "variants": {},
                }
                # Check for existing variants
                for tw in widths:
                    variant_path = IMAGES_DIR / f"{stem}-{tw}w.webp"
                    if variant_path.exists():
                        ratio = tw / w
                        manifest[filename]["variants"][str(tw)] = {
                            "file": f"{stem}-{tw}w.webp",
                            "w": tw,
                            "h": round(h * ratio),
                        }
                img.close()
            except Exception:
                pass
            skipped += 1
            continue

        original_size = get_file_size(src)
        total_original += original_size

        print(f"  Processing: {filename} ({format_size(original_size)})")
        result = process_image(src, args.quality, widths, dry_run=args.dry_run)

        if result:
            manifest[filename] = {
                "original": result["original"],
                "webp": result["webp"],
                "variants": result["variants"],
            }
            total_saved += result["saved_bytes"]
            processed += 1

            if not args.dry_run:
                webp_size = get_file_size(IMAGES_DIR / result["webp"])
                print(f"    > WebP: {format_size(webp_size)}")
                for tw, vinfo in sorted(result["variants"].items(), key=lambda x: int(x[0])):
                    vsize = get_file_size(IMAGES_DIR / vinfo["file"])
                    print(f"    > {tw}w:  {format_size(vsize)}")
            else:
                print(f"    → [dry run] would generate WebP + {len(result['variants'])} variants")

    # Add small files to manifest without processing
    for src in small_files:
        filename = src.name
        try:
            img = Image.open(src)
            w, h = img.size
            manifest[filename] = {
                "original": {"file": filename, "w": w, "h": h, "size": get_file_size(src)},
                "webp": None,
                "variants": {},
            }
            img.close()
        except Exception:
            pass

    elapsed = time.time() - start_time

    # Write manifest
    if not args.dry_run:
        with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        print(f"\n  Manifest written: {MANIFEST_FILE}")

    # ── Summary ─────────────────────────────────────────────────────────
    # Calculate total sizes
    total_original_all = sum(
        get_file_size(IMAGES_DIR / fname)
        for fname in manifest
        if (IMAGES_DIR / fname).exists()
    )
    total_webp_all = sum(
        get_file_size(IMAGES_DIR / m["webp"])
        for m in manifest.values()
        if m["webp"] and (IMAGES_DIR / m["webp"]).exists()
    ) if not args.dry_run else 0

    print(f"\n{'=' * 60}")
    print(f"  SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Processed:       {processed} images")
    print(f"  Skipped:         {skipped} (already up-to-date)")
    print(f"  Time:            {elapsed:.1f}s")
    if not args.dry_run:
        print(f"  Original total:  {format_size(total_original_all)}")
        print(f"  WebP total:      {format_size(total_webp_all)}")
        if total_original_all > 0:
            pct = (1 - total_webp_all / total_original_all) * 100
            print(f"  Reduction:       {pct:.0f}%")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()

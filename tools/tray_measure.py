"""Measure the relight tray in Chromium on this machine's real GPUs, at phone width and at laptop width.

Each run opens the page, reads what first paint cost (LCP, its element, CLS, bytes), waits for the shader to go live, then
calls RelightTray.bench(): a scripted light sweep at the display's rate, plus GPU milliseconds per frame for the headroom
under that cap. Vsync stays on: with it off, frame rate reads the rAF loop and not the GPU (software rendering "reached"
75 fps while taking 59 ms a frame). The governor run leaves the page to itself during its intro sweep and reports which
quality level it settled on. A phone GPU is not one of these, and this script cannot stand in for one: the page's own
"measure" button does that.

Usage: python tools/tray_measure.py --url http://localhost:3117/en/designs.htm --out <file.json>
Needs Playwright with its Chromium.
"""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

PHONE = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 3, "has_touch": True, "is_mobile": True}
LAPTOP = {"viewport": {"width": 1440, "height": 900}, "device_scale_factor": 1.5}
GPUS = {
    "rtx": ["--use-angle=d3d11", "--force_high_performance_gpu", "--ignore-gpu-blocklist"],
    "uhd": ["--use-angle=d3d11", "--force_low_power_gpu", "--ignore-gpu-blocklist"],
    "software": ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
}
SLOW_4G = {"offline": False, "latency": 150, "downloadThroughput": 1.6e6 / 8, "uploadThroughput": 750e3 / 8}
OBSERVE = """
window.__vitals = {lcp: 0, lcpEl: '', cls: 0, longTasks: []};
new PerformanceObserver(l => { for (const e of l.getEntries()) { __vitals.lcp = e.startTime;
  __vitals.lcpEl = (e.element && (e.element.currentSrc || e.element.tagName)) || ''; } })
  .observe({type: 'largest-contentful-paint', buffered: true});
new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) __vitals.cls += e.value; })
  .observe({type: 'layout-shift', buffered: true});
new PerformanceObserver(l => { for (const e of l.getEntries()) __vitals.longTasks.push(Math.round(e.duration)); })
  .observe({type: 'longtask', buffered: true});
"""


# A returning visitor: no consent banner, so the phone's dock sits at the screen's edge and the most samples show.
RETURNING = """
document.cookie = 'sl_cookie_consent=' + encodeURIComponent(JSON.stringify({v: 1, analytics: false, marketing: false})) + '; path=/';
"""


def live(page, timeout_ms):
    page.wait_for_function("window.RelightTray && (RelightTray.ready || RelightTray.mode === 'still')", timeout=timeout_ms)
    return page.evaluate("RelightTray.mode")


def bench_run(browser, url, ctx_opts, seconds):
    ctx = browser.new_context(**ctx_opts)
    page = ctx.new_page()
    page.add_init_script(OBSERVE + RETURNING)
    page.goto(url, wait_until="load")
    mode = live(page, 60000)
    vitals = page.evaluate("__vitals")
    result = page.evaluate(f"RelightTray.benchAtPeak({{seconds: {seconds}}})") if mode == "live" else None
    ctx.close()
    return {"mode": mode, "vitals": vitals, "bench": result}


def governor_run(browser, url, ctx_opts, seconds=10):
    """What an untouched page does during its intro sweep: real frames drawn, and the quality level it ends on."""
    ctx = browser.new_context(**ctx_opts)
    page = ctx.new_page()
    page.goto(url, wait_until="load")
    live(page, 60000)
    page.wait_for_timeout(1000)
    f0 = page.evaluate("RelightTray.frames")
    page.wait_for_timeout(seconds * 1000)
    out = page.evaluate("({frames: RelightTray.frames, level: RelightTray.level, dpr: RelightTray.dpr, canvas: RelightTray.canvas})")
    ctx.close()
    out["fps"] = round((out.pop("frames") - f0) / seconds, 1)
    return out


def load_run(browser, url):
    """Phone, Lighthouse's slow 4G with a 4x CPU slowdown, an empty cache: when does the page paint, and go live?"""
    ctx = browser.new_context(**PHONE)
    page = ctx.new_page()
    page.add_init_script(OBSERVE)
    cdp = ctx.new_cdp_session(page)
    cdp.send("Network.enable")
    cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
    cdp.send("Network.emulateNetworkConditions", SLOW_4G)
    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    sizes, urls = {}, {}
    cdp.on("Network.responseReceived", lambda e: urls.__setitem__(e["requestId"], e["response"]["url"]))
    cdp.on("Network.loadingFinished", lambda e: sizes.__setitem__(e["requestId"], e["encodedDataLength"]))
    page.goto(url, wait_until="load", timeout=180000)
    live(page, 180000)
    page.wait_for_timeout(1500)
    vitals = page.evaluate("__vitals")
    ready = page.evaluate("RelightTray.readyMs")
    ctx.close()
    groups = {"posters": 0, "textures": 0, "tray_code": 0, "site_chrome": 0}
    for rid, n in sizes.items():
        u = urls.get(rid, "")
        if "relief-tray" in u and "poster" in u:
            groups["posters"] += n
        elif "relief-tray" in u and ("normal-" in u or "height-" in u):
            groups["textures"] += n
        elif "relight-tray" in u or "relief-tray/manifest" in u:
            groups["tray_code"] += n
        else:
            groups["site_chrome"] += n
    return {"vitals": vitals, "readyMs": ready, "bytes": groups, "requests": len(sizes)}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--url", required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--seconds", type=int, default=6)
    ap.add_argument("--gpus", default="rtx,uhd,software")
    a = ap.parse_args()
    report = {"url": a.url}
    with sync_playwright() as p:
        for name in a.gpus.split(","):
            browser = p.chromium.launch(channel="chromium", headless=True, args=GPUS[name])
            report[name] = {"phone": bench_run(browser, a.url, PHONE, a.seconds),
                            "governor_phone": governor_run(browser, a.url, PHONE)}
            if name != "software":
                report[name]["laptop"] = bench_run(browser, a.url, LAPTOP, a.seconds)
            if name == a.gpus.split(",")[0]:
                report["load_phone_slow4g"] = load_run(browser, a.url)
            browser.close()
            print(name, "done", flush=True)
    a.out.write_text(json.dumps(report, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

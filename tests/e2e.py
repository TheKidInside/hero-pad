"""End-to-end test for Hero Pad, driven through the real pointer listeners.

Pen and finger strokes are dispatched as PointerEvents on the ink canvas, so the
same code path the iPad uses (palm rejection, densifying, trace checking) runs.

Usage:  py -3 tests\\e2e.py [base_url] [screenshot_dir]
        (serve the app first: py -3 -m http.server 8795)
        HERO_BROWSER=chromium runs it in Chromium instead of WebKit (Safari's engine).
"""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8795/"
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else None
sys.stdout.reconfigure(encoding="utf-8")
errors = []


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("ok -", msg)


# Dispatch one stroke (list of [x, y] client points) on the canvas.
STROKE_JS = """
([pts, type, id]) => {
  const c = document.querySelector('#ink');
  const ev = (name, [x, y]) => c.dispatchEvent(new PointerEvent(name, {
    pointerId: id, pointerType: type, clientX: x, clientY: y, pressure: type === 'pen' ? 0.6 : 0.5,
    width: type === 'pen' ? 1 : (globalThis.__touchSize || 20), height: type === 'pen' ? 1 : (globalThis.__touchSize || 20),
    isPrimary: true, bubbles: true, cancelable: true }));
  ev('pointerdown', pts[0]);
  for (const p of pts.slice(1)) ev('pointermove', p);
  ev('pointerup', pts[pts.length - 1]);
}
"""

# Same, but leave the pointer down (no pointerup) so another can interrupt it.
DOWN_JS = """
([pts, type, id]) => {
  const c = document.querySelector('#ink');
  const ev = (name, [x, y]) => c.dispatchEvent(new PointerEvent(name, {
    pointerId: id, pointerType: type, clientX: x, clientY: y, pressure: 0.5,
    width: 20, height: 20, isPrimary: true, bubbles: true, cancelable: true }));
  ev('pointerdown', pts[0]);
  for (const p of pts.slice(1)) ev('pointermove', p);
}
"""


PLAY_WEB = ".world .play >> nth=0"


def state(page):
    return page.evaluate("window.__heroPad.state()")


def solve_maze(page):
    m = page.evaluate("window.__heroPad.maze()")
    cols, rows, op = m["cols"], m["rows"], m["open"]
    dirs = [(1, 0, -1), (2, 1, 0), (4, 0, 1), (8, -1, 0)]
    prev, q = {(0, 0): None}, [(0, 0)]
    while q:
        c, r = q.pop(0)
        for bit, dc, dr in dirs:
            n = (c + dc, r + dr)
            if op[r * cols + c] & bit and n not in prev:
                prev[n] = (c, r)
                q.append(n)
    path, k = [], (cols - 1, rows - 1)
    while k:
        path.insert(0, list(k))
        k = prev[k]
    return page.evaluate("cells => window.__heroPad.route(cells)", path)


def wait_next(page, at):
    page.wait_for_function(f"window.__heroPad.state().at > {at} || window.__heroPad.state().screen === 'done'", timeout=5000)


def shot(page, name):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / f"{name}.png"))


with sync_playwright() as p:
    engine = os.environ.get("HERO_BROWSER", "webkit")
    browser = getattr(p, engine).launch()
    print("browser:", engine)
    ipad = dict(p.devices["iPad Pro 11 landscape"])
    ipad.pop("default_browser_type", None)
    ctx = browser.new_context(**ipad, service_workers="block")
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.goto(BASE + "?seed=7")
    page.wait_for_selector(".world")

    vp = page.evaluate("document.querySelector('meta[name=viewport]').content")
    check("user-scalable=no" in vp and "maximum-scale=1" in vp, "viewport meta blocks zoom")
    check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "home: no sideways overflow")
    pinch = page.evaluate("""() => {
      try { new Touch({ identifier: 0, target: document.body }); } catch { return 'no-touch'; }
      const t = (id, x) => new Touch({ identifier: id, target: document.body, clientX: x, clientY: 300 });
      const two = new TouchEvent('touchmove', { touches: [t(1, 100), t(2, 300)], cancelable: true, bubbles: true });
      const one = new TouchEvent('touchmove', { touches: [t(1, 100)], cancelable: true, bubbles: true });
      document.body.dispatchEvent(two); document.body.dispatchEvent(one);
      return [two.defaultPrevented, one.defaultPrevented];
    }""")
    if pinch == "no-touch":
        print("skip - pinch check: this browser build can't construct Touch (run HERO_BROWSER=chromium)")
    else:
        check(pinch == [True, False], "two-finger touchmove is cancelled, one-finger is not")

    check(page.locator(".world").count() == 3, "map: three worlds")
    check(page.locator(".world .levels > li").count() == 18, "map: 18 levels in all")
    check(page.locator(".world .play.locked").count() == 2, "map: Hero HQ and Jump Land start locked")
    check(page.locator('.levels button').count() == 1, "map: only level 1 is playable at the start")
    shot(page, "1-home")
    page.click(PLAY_WEB)
    page.wait_for_function("window.__heroPad.state().screen === 'play'")

    # ---- item 1: maze ----
    s = state(page)
    check(s["kind"] == "maze", "mission opens with a maze")
    shot(page, "2-maze")
    check(page.locator("#aside").is_visible() and len(page.locator("#puzzle").inner_text()) > 10, "level screen: puzzle panel shows beside the stage")
    check(page.locator("#where").inner_text().startswith("WEB CITY · LEVEL 1 · 1 OF 5"), "level header: world, level and item count")
    box = page.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return [r.left, r.top, r.width]; })()")
    l, t, w = box
    page.evaluate(STROKE_JS, [[[l + w * 0.2, t + w * 0.2], [l + w * 0.8, t + w * 0.8]], "pen", 11])
    s = state(page)
    check(s["at"] == 0 and not s["busy"], "maze: a straight line through the walls does not finish it")
    check(s["inkStrokes"] == 1, "maze: the scribble still shows as ink")
    page.evaluate(STROKE_JS, [solve_maze(page), "pen", 12])
    check(state(page)["busy"], "maze: following the corridors to the star finishes it")
    check(page.locator("#stars i.on").count() == 1, "a star lights up in the top bar")
    wait_next(page, 0)

    # ---- trace items ----
    first_trace = True
    for _ in range(3):
        s = state(page)
        check(s["kind"] == "trace", f"item {s['at'] + 1} is a trace item ({s['id']})")
        if s["id"] == "letter-L":
            shot(page, "3-letter-L")
            sl, st, sw = page.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return [r.left, r.top, r.width]; })()")
            scribble = [[sl + sw * (0.2 + 0.6 * ((k * 37) % 100) / 100), st + sw * (0.2 + 0.6 * ((k * 61) % 100) / 100)] for k in range(80)]
            page.evaluate(STROKE_JS, [scribble, "pen", 25])
            s2 = state(page)
            check(not s2["busy"] and s2["trace"]["s"] == 0, "letter-L: a scribble over the letter does not earn a star")
        route = page.evaluate("window.__heroPad.route()")
        if first_trace:
            first_trace = False
            page.evaluate(STROKE_JS, [route[0][::-1], "pen", 20])
            s2 = state(page)
            check(s2["trace"]["s"] == 0 and not s2["busy"], f"{s['id']}: tracing backwards does not finish the stroke")
            # palm rejection: finger is ignored right after the pen was used
            before = state(page)["inkStrokes"]
            page.evaluate(STROKE_JS, [route[0], "touch", 21])
            s3 = state(page)
            check(s3["inkStrokes"] == before and s3["trace"]["s"] == 0, f"{s['id']}: finger right after the pen is treated as a palm")
        for k, stroke in enumerate(route):
            page.evaluate(STROKE_JS, [stroke, "pen", 30 + k])
        check(state(page)["busy"], f"{s['id']}: tracing every stroke in order finishes it")
        wait_next(page, s["at"])

    # ---- item 5: maze, plus: a finger stroke that a pen interrupts is taken back ----
    s = state(page)
    check(s["kind"] == "maze", "mission closes with a maze")
    page.wait_for_timeout(4200)          # let the pen-hold window lapse so the finger counts
    sol = solve_maze(page)
    page.evaluate(DOWN_JS, [sol[:3], "touch", 40])
    moved = state(page)["cell"]
    check(moved != [0, 0], "finger works again once the pen has been idle")
    page.evaluate(STROKE_JS, [[sol[0], sol[0]], "pen", 41])
    s = state(page)
    check(s["cell"] == [0, 0], "pen touching down mid finger-stroke takes the finger stroke back")
    page.evaluate(STROKE_JS, [sol, "pen", 42])
    page.wait_for_function("window.__heroPad.state().screen === 'done'", timeout=5000)
    check(page.locator("#done-stars i.on").count() == 5, "level complete screen shows 5 stars")
    check(page.locator("#next").is_visible(), "level complete: a Next level button appears")
    page.wait_for_timeout(700)
    shot(page, "4-done")
    saved = page.evaluate("JSON.parse(localStorage.getItem('heropad.v1'))")
    check(saved["missions"] == 1 and saved["items"]["letter-L"]["stars"] == 1, "progress saved to this browser")
    check(saved["levels"]["web-1"]["stars"] == 5, "the level remembers its 5 stars")

    # leaving during the pause after an item must not advance the next mission
    page.click("#home-btn")
    page.wait_for_function("window.__heroPad.state().screen === 'home'")
    check(page.locator(".levels button").count() == 2, "map: finishing level 1 opens level 2")
    check(page.locator(".levels button.done").count() == 1, "map: level 1 shows as done")
    check(page.locator("#star-count").inner_text() == "5", "map: the star total counts the 5 stars")
    shot(page, "1b-map-progress")
    page.click(PLAY_WEB)
    page.wait_for_function("window.__heroPad.state().screen === 'play'")
    check(state(page)["level"]["n"] == 2, "Play goes to the current level (2)")
    check("LEVEL 2 " in page.locator("#where").inner_text(), "level header names the world and level")
    page.evaluate(STROKE_JS, [solve_maze(page), "pen", 50])
    check(state(page)["busy"], "race setup: first maze finished")
    page.evaluate("""() => document.querySelector('#exit').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 60, bubbles: true, cancelable: true }))""")
    page.wait_for_function("window.__heroPad.state().screen === 'home'", timeout=3000)
    page.click(PLAY_WEB)
    page.wait_for_timeout(1800)
    s = state(page)
    check(s["screen"] == "play" and s["at"] == 0 and s["kind"] == "maze", "exiting during the pause: the new mission still starts at its maze")

    # finger mode: a finger draws straight after the Pencil, no palm wait
    page.evaluate("""() => document.querySelector('#exit').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 61, bubbles: true, cancelable: true }))""")
    page.wait_for_function("window.__heroPad.state().screen === 'home'", timeout=3000)
    page.click('[data-input="finger"]')
    check(state(page)["data"]["input"] == "finger", "finger mode is picked and saved")
    check(page.locator('[data-input="finger"]').get_attribute("aria-checked") == "true", "finger button shows as picked")
    shot(page, "6-home-finger")
    page.click(PLAY_WEB)
    page.wait_for_function("window.__heroPad.state().screen === 'play'")
    sol = solve_maze(page)
    page.evaluate(STROKE_JS, [[sol[0], sol[0]], "pen", 70])        # Pencil just used
    page.evaluate("globalThis.__touchSize = 90")                  # iPadOS reports fingertips this wide
    page.evaluate(STROKE_JS, [sol, "touch", 71])                  # finger right away
    page.evaluate("globalThis.__touchSize = 0")
    check(state(page)["busy"], "finger mode: a wide fingertip right after the Pencil still solves the maze")
    page.reload()
    page.wait_for_selector(".world")
    check(page.locator('[data-input="finger"]').get_attribute("aria-checked") == "true", "finger mode survives a reload")
    page.click('[data-input="pencil"]')
    page.click(PLAY_WEB)
    page.wait_for_function("window.__heroPad.state().screen === 'play'")

    # portrait sanity
    page.set_viewport_size({"width": 834, "height": 1194})
    page.wait_for_timeout(300)
    check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "portrait play: no sideways overflow")
    shot(page, "5-portrait")

    check(not errors, f"no console errors {errors}")
    browser.close()
print("\nall passed")

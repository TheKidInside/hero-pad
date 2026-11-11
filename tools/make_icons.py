r"""Render the home-screen icons from the Zip hero art. Serve the app first.
Usage: py -3 tools\make_icons.py [base_url]"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8795/"
OUT = Path(__file__).resolve().parent.parent / "icons"

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 512, "height": 512})
    page.goto(BASE)
    svg = page.evaluate("import('./js/art.js').then(m => m.heroSVG('zip'))")
    page.set_content(f"""<body style="margin:0"><svg width="512" height="512" viewBox="-60 -60 120 120">
      <rect x="-60" y="-60" width="120" height="120" fill="#ffd23f"/>
      <circle cx="0" cy="0" r="50" fill="#fff6d6"/>
      <g transform="translate(0 4) scale(0.95)">{svg}</g></svg></body>""")
    for size in (180, 192, 512):
        page.set_viewport_size({"width": 512, "height": 512})
        page.screenshot(path=str(OUT / f"icon-{size}.png"), clip={"x": 0, "y": 0, "width": 512, "height": 512}, scale="css")
    b.close()

# downscale with Pillow if present, else keep 512 copies
try:
    from PIL import Image
    for size in (180, 192):
        im = Image.open(OUT / f"icon-{size}.png").resize((size, size), Image.LANCZOS)
        im.save(OUT / f"icon-{size}.png")
except ImportError:
    print("Pillow missing: 180/192 icons left at 512px")
print("icons written to", OUT)

# Hero Pad

Handwriting practice for a young child on an iPad, using the Apple Pencil or a finger. Short missions mix mazes, pre-writing strokes and letters. Original heroes ride along the line as the child traces.

Live: https://thekidinside.github.io/hero-pad/

## On the iPad
1. Open the link in Safari, then tap **Share > Add to Home Screen**. It now opens full screen like an app.
2. Optional: **Settings > Accessibility > Guided Access** keeps the child inside the app (triple-click the side button to start).
3. To go home during a mission, **hold** the house button for about a second.

## Develop
```
py -3 -m http.server 8795
node tests\unit.mjs
py -3 tests\e2e.py http://localhost:8795/ tests\shots
```
Push to `main` = deploy (GitHub Pages). See [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md).

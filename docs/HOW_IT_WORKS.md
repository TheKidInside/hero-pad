# Hero Pad: How It Works (a learning walkthrough)

Hero Pad is a handwriting practice app for Judah's iPad. It is a plain website (HTML, CSS and JavaScript, with no build step) hosted on GitHub Pages. When it's added to the home screen it runs full screen like an app. He traces roads with the Apple Pencil or a finger, and a hero rides along the line. Mazes, strokes and letters are mixed into short missions.

This document covers **Phase 1, the feel test**: mazes, three stroke drills (down lines, across lines, a circle) and the letter L. Phases 2 and 3 are in `C:\Artificial\plans\hero-pad-handwriting-app.md`.

---

## Part 0: Run it

```
cd C:\Artificial\projects\hero-pad
py -3 -m http.server 8795          # then open http://localhost:8795/
node tests\unit.mjs                # trace + maze + mission rules
py -3 tests\e2e.py http://localhost:8795/ tests\shots   # full mission through the real pointer listeners
```

- `?seed=7` on the URL makes the mission the same every time. The e2e test uses this.
- The mouse also draws on a desktop, and counts as a finger.

---

## Part 1: The big picture

### 1.1 Three layers stacked on the play area

```
  canvas #ink       <- on top. Takes every pen/finger event and draws the ink.
  svg #stage        <- the road, arrows, start dot, goal star, maze walls, the hero.
  #play background  <- the world colour.
```

The **SVG stage** always uses a 1000 x 1000 coordinate box (`viewBox="0 0 1000 1000"`), however big the iPad screen is. Every rule (where the road is, how wide the corridor is, which maze cell the pen is in) works in those stage units. Only the ink layer converts between stage units and screen pixels.

Analogy: the stage is a sheet of graph paper. The iPad only decides how big to print it.

### 1.2 One pen point, end to end

1. `ink.js` gets a `pointermove`. It reads `getCoalescedEvents()`, which gives every Pencil sample since the last frame (up to 240 per second), not just one per frame.
2. Each sample is converted to stage units (`map`) and handed to `app.js` (`point`).
3. `app.js` **densifies** the jump from the last point into 4-unit steps. A fast finger flick still passes through every part of the road and every maze cell.
4. Each step goes to the rules: `trace.feed()` for roads, `maze.walk()` for mazes. They report `onPath`, `advanced`, `done`, and `bonk` (the pen crossed a maze wall).
5. `app.js` moves the hero, grows the coloured fill along the road, plays a chime when a stroke finishes, and returns the ink colour: the hero's colour on the road, grey off it.
6. `ink.js` draws the new piece of ink in that colour. The width follows Pencil pressure.

### 1.3 Why a web page and not a native app

A web page with Pointer Events gets the Apple Pencil's pressure and its high-rate samples. That is enough for tracing practice. Procreate is native and has lower latency, but Judah doesn't need art-grade ink. In exchange, Hero Pad needs no App Store and no Mac, and an update ships with a `git push`.

---

## Part 2: The techniques that repeat

### 2.1 Ordered progress with a look-ahead (trace.js)

Each stroke is resampled into points 6 units apart, and `cum[i]` stores the distance along the road to point `i`. Progress is a single number, `idx`: the furthest point reached **in order**.

Each pen point:
- Search the road from `idx` forward, a little past the look-ahead (`LOOK_AHEAD + tol`), for the point nearest the pen that is within the corridor (`tol`).
- Accept it only if it lies within `LOOK_AHEAD` (90 units) of where progress already is.

This gives the behaviour a 3-year-old needs:
- **Start in the middle or at the far end:** nothing happens, because those points are beyond the look-ahead.
- **Trace backwards:** at most the first 90 units count, and the stroke never completes.
- **Wander off the road:** progress pauses. Come back near where you left and it resumes; nothing is failed.
- **Finish:** a stroke completes when the remaining road is shorter than `min(0.8 x tol, 10% of the stroke)`.

**Why search past the look-ahead?** If only the look-ahead window were searched, a pen coming backwards along the road would sit just outside the window but still within `tol` of its edge. It would be pulled forward one step after another (the "creep" bug the unit test caught). Searching wider and rejecting a nearest point that lies beyond the look-ahead stops that.

### 2.2 The corridor is the road

`tol` is the corridor half-width: wide 80, medium 60, tight 45. The visible road is drawn at `1.6 x tol` wide, so the real tolerance is a little more forgiving than the painted edge. Narrowing `tol` later is how the app gets stricter as his control improves.

### 2.3 Perfect mazes (maze.js)

Missions use a 5x5 maze, then a 6x6. `curriculum.js` keeps only seeds whose route passes through at least half the cells (`MIN_ROUTE`), so the path winds and the dead ends are real. Raise `MIN_ROUTE` or the grid sizes to make mazes harder.

- **Recursive backtracker:** walk randomly, knock down the wall to each new cell, and back up at dead ends. Every cell is reachable and there's exactly one route between any two cells. Each cell stores its open sides as bits (`N=1, E=2, S=4, W=8`).
- **Seeded RNG** (mulberry32): the same seed always builds the same maze, so tests are repeatable.
- **The hero follows the pen one cell at a time and only through openings.** A pen in an adjacent cell behind a wall returns `bonk`, so the hero wobbles. Moving back to the previous cell pops the trail.

### 2.4 Palm rejection (ink.js)

- Only one pointer draws at a time.
- **Pen wins:** if the Pencil touches down while a finger or palm stroke is running, that stroke is erased and the rules are rewound to a snapshot taken when it began (`begin` -> `cancel`).
- **Pencil mode:** for 4 s after the Pencil was last used (`PEN_HOLD_MS`), finger touches are ignored. A palm resting between strokes doesn't draw.
- There is **no touch-size palm check**. iPadOS reports an ordinary fingertip as 60+ px wide, so a size cut-off threw away real fingers (bug found on the iPad, fixed in v3). iPadOS cancels true palm touches itself (`pointercancel`), and `cancelled()` takes those strokes back.
- **Finger mode** (the Pencil / Finger switch on the home screen, saved as `data.input`) sets `ink.fingers = true`. That turns off the 4 s Pencil-mode wait, so a finger always draws. The Pencil still works.

### 2.5 Locking the iPad page down

- **Viewport:** `user-scalable=no`. iOS ignores it, so the `gesturestart` and 2-finger `touchmove` handlers in `<head>` cancel pinch zoom.
- **Body:** `position: fixed` with `overscroll-behavior: none`, so the page never scrolls, bounces or slides.
- **Canvas:** `touch-action: none` plus cancelled `touchstart`/`touchmove`. A Pencil drag never becomes a scroll, text selection or magnifier.
- **Guided Access** (Settings > Accessibility) keeps Judah inside the app.

---

## Part 3: File by file

| File | Job |
|---|---|
| [index.html](../index.html) | The three screens (home, play, done) and the zoom lock |
| [css/app.css](../css/app.css) | Layout, road/maze styles, hero animations (bob, wobble, cheer) |
| [js/app.js](../js/app.js) | Screens, mission loop, rendering the stage, wiring pen points to the rules; `window.__heroPad` test hooks |
| [js/ink.js](../js/ink.js) | Pointer input, coalesced samples, palm rejection, pressure ink, redraw on rotate |
| [js/trace.js](../js/trace.js) | Pure trace rules: `makeStroke`, `arc`, `feed` |
| [js/maze.js](../js/maze.js) | Pure maze rules: `makeMaze`, `walk`, `solution`, `wallPath` |
| [js/letters.js](../js/letters.js) | The items: stroke drills and letters, as polylines in stroke order |
| [js/curriculum.js](../js/curriculum.js) | `buildMission(seed)`: maze, stroke, letter, stroke, maze |
| [js/art.js](../js/art.js) | Original heroes (Zip, Bolt, Hop) and the world backdrops, as SVG |
| [js/audio.js](../js/audio.js) | Web Audio chimes and spoken prompts (`speechSynthesis`) |
| [js/storage.js](../js/storage.js) | Progress saved in this browser (`heropad.v1`), guarded by try/catch |
| [tests/unit.mjs](../tests/unit.mjs) | Node checks of the pure rules |
| [tests/e2e.py](../tests/e2e.py) | Playwright, iPad Pro 11: a full mission driven by synthetic pen/finger PointerEvents |
| [tools/make_icons.py](../tools/make_icons.py) | Renders the home-screen icons from the hero art |

---

## Part 4: Recipes

- **Add a letter:**
  1. Add an entry to `ITEMS` in `letters.js`, with strokes in stroke order, each drawn in the pen's direction, inside 150-850 tall.
  2. Add its id to `LETTERS` in `curriculum.js`.
  3. `node tests\unit.mjs` checks automatically that tracing it exactly completes it.
- **Make tracing stricter:** change `data.tol` (`wide`/`medium`/`tight`). A Parent Corner setting is planned for Phase 3.
- **A curve that goes clockwise:** use `arc(cx, cy, r, from, to)` with `to < from`.
- **Palm rejection too strict or too loose:** change `PEN_HOLD_MS` in `ink.js`.

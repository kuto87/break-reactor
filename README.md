# Break Reactor

Break Reactor is a compact endless brick-breaker for the browser. It runs as static files: no build step, no dependencies, and it can be hosted directly on GitHub Pages.

## Play

Open `index.html`, or serve the folder with any static server.

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`.

## Controls

- Mouse / touch: move the paddle
- Click / tap / Space: launch the ball
- `P` or `Esc`: pause
- `R`: restart
- `Shift+W`: jump to a wave for development
- `Shift+C`: add 100 coins for development

## Current Design

- Waves scale up to wave 10000, with speed and HUD formatting capped so the display stays readable.
- Blue blocks are glass-like one-hit blocks.
- Wood, stone, and metal blocks appear gradually as wave difficulty rises.
- Boss waves appear every 5 waves. Later bosses move horizontally and fire rockets.
- Missions give short optional goals, such as breaking blocks, collecting coins, reaching combo counts, or defeating a boss.
- The background reacts to fever, boss warning, boss hits, and mission completion.

## Debug Helpers

URL parameters:

```text
?debug=1&wave=50&coins=200
#debug=1&wave=50&coins=200
```

Console API:

```js
BreakReactorDebug.jumpToWave(100);
BreakReactorDebug.giveCoins(500);
BreakReactorDebug.clearStage();
BreakReactorDebug.state;
```

## Files

```text
index.html
style.css
main.js
README.md
SPEC.md
```

# Coreline

Hold the line. A lone core against a rogue AI fleet. Space idle tower defence.

Space idle tower defence. Design record in `docs/DESIGN.md`.

## Run

ES modules need a local server:

```
python3 serve.py
```

Then open http://localhost:8765/

## Deploy

Static site, no build. Any static host works.

**GitHub Pages**
1. Push this folder to a GitHub repo.
2. Settings → Pages → Source: Deploy from a branch → `main`, folder `/ (root)`.
3. Open `https://<user>.github.io/<repo>/`. The `.nojekyll` file is already here so `_`-prefixed paths and the `src/` folder are served as-is.

**itch.io**: zip the folder contents (with `index.html` at the zip root), upload as an HTML game, tick "This file will be played in the browser", set a viewport of at least 1280×720 or fullscreen.

**Netlify / Cloudflare Pages / Vercel**: point at the repo or drag the folder in, publish directory `/`, no build command.

Saves live in the player's localStorage per domain. Moving hosts later means players should use Export in Settings first.

## Notes

- Phaser 3.80 from CDN, no build step.
- Game keeps ticking with `disableVisibilityChange`, but browsers still throttle hidden tabs. Offline scrap (phase 3) covers the gap.
- Balance numbers live in `src/config.js`. Skill tree nodes in `src/tree.js`, combos in `src/combos.js`.
- After editing modules, hard reload (Cmd+Shift+R) since the browser caches ES modules.

## Credits

- Sound samples: [Sci-fi Sounds by Kenney](https://kenney.nl/assets/sci-fi-sounds), CC0. Files in `assets/sfx/kenney/`.

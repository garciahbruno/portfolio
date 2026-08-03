# Cash App Design Landing Rebuild (Climbing Holds Edition)

This project recreates the `design.cash.app` landing page structure and motion style with:

Visit my site @ www.brunohg.dev

- Scroll-driven infinite grid motion with inertia and wraparound tiling
- Touch/drag fallback physics
- Transparent-background climbing-hold artwork replacing the original grid imagery
- High-contrast, keyboard-focus, and reduced-motion accessibility support

## Hold artwork

Tiles render at most 228 CSS pixels wide, so each hold in `assets/holds` is capped
at 512px on its long edge and shipped as an AVIF with a same-named PNG fallback.
Add new holds at that size: full-resolution source images cost far more decoded
memory than they can ever show, and that is what makes the grid stutter.

## Run locally

```bash
npm run dev
```

Then open `http://localhost:5173`.

## Deploy

This is a static site. Deploy the project root directly on platforms such as Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

- Build command: none
- Output directory: `.`

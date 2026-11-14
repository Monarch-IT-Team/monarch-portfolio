# Monexarch: portfolio

Portfolio of Muhammadamin G'ulomov (Monexarch, Monarch-IT). Static site, no build step.

- `index.html`: main page; `modots.html`: MoDOTS case study
- `js/space.js`: WebGL background and ray-traced Schwarzschild black hole
- `js/loader.js`: intro (gravitational collapse)
- `js/fx.js`: dust particles and click cracks
- `js/i18n.js`: UZ / EN / RU texts
- `js/main.js`: page logic (GSAP, Lenis, cursor, navigation)

## Run locally

```
python -m http.server 8080
```

## Deploy

Every push to `main` deploys to GitHub Pages (`.github/workflows/pages.yml`).

Firebase Hosting (monarch-resume.web.app) also works: `npx firebase-tools deploy --only hosting`.

Résumé: put the PDF at `assets/resume.pdf` and the download button appears on its own.

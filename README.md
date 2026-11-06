# Advent Calendar

A single-page, responsive Advent calendar in plain HTML, CSS and TypeScript. It has no framework and no runtime dependencies.

## Files

```
advent-calendar/
├── index.html       Page shell: header, grid, image viewer, toast
├── styles.css       Responsive grid (4 columns on phones, 6 on wider screens) and the 3D door swing
├── doors.txt        Configuration: day → image URL, plus title/year/superuser
├── serve.mjs        Local dev server (routes /root to index.html)
├── _redirects       /root rewrite for Netlify / Cloudflare Pages
├── src/
│   ├── config.ts    Fetches and parses doors.txt
│   ├── state.ts     Reads and writes opened doors in a cookie
│   └── main.ts      Date rules, rendering and event handling
├── dist/            Compiled JS (output of `npm run build`)
├── tsconfig.json
└── package.json
```

## How it works

**Date rule.** Door *N* unlocks at **00:00 UTC on December *N*** of the configured `year`, according to the device's system clock. The check runs again whenever a door is clicked, at the moment each door unlocks while the page is open, and when the tab becomes visible again. Clicking a locked door shakes it and shows when it opens, in UTC and in the visitor's local time.

**State.** Opened doors are stored in a cookie named after the year, for example `advent_2026=1.3.4`. The cookie has `Max-Age` set to one year, `SameSite=Lax`, and `Secure` when the page is served over HTTPS. Because the year is part of the name, each December starts with every door closed. The **Close all doors** link clears the cookie.

**Config (`doors.txt`).**
```
title=Advent Calendar 2026
year=2026
1=https://example.com/day1.jpg
2=https://example.com/day2.jpg
...
```
Lines starting with `#` are comments. Both `=` and `:` work as separators. Invalid lines are skipped, and a warning is logged in the browser console.

**Layout.** The door numbers are shuffled into the same order on every visit, the way a printed calendar scatters them. An image is attached only when its door is opened. Clicking an opened door shows the image full size.

**Accessibility.** Doors are real `<button>`s with descriptive labels. The page works with the keyboard, and it respects `prefers-reduced-motion`.

## Build and run

```bash
npm install        # installs TypeScript
npm run build      # compiles src/ → dist/
npm run serve      # http://localhost:8080  and  http://localhost:8080/root
```

Serve the folder over HTTP. Opening `index.html` directly from disk won't work, because browsers block `fetch("doors.txt")` on `file://` pages.

## Superuser mode (debugging)

Go to `<site>/root` (or `<site>/#/root`, which works on any host with no setup). A yellow banner appears, and every door can be opened regardless of the date. Doors opened here are saved in a separate cookie (`advent_2026_root`), so debugging never changes the normal view on that device. Click **Exit** in the banner to go back.

The `/root` path needs the server to send `index.html` for it:
- **Local:** `npm run serve` (`serve.mjs`) does this.
- **Netlify / Cloudflare Pages:** the included `_redirects` file does this.
- **GitHub Pages:** `npm run build` copies `index.html` to `404.html`, which GitHub serves for `/root`.

**Before going live, set `superuser=false` in `doors.txt`.** This is a client-side switch, so anyone who knows the URL could otherwise use it.

> Note: this is client-side only, so a determined visitor can read `doors.txt` and see every URL ahead of time. That's normal for a fun calendar. To prevent it, you'd need a small server that hands out each URL only after its date.

## Hosting the app (free)

These hosts serve static files over HTTPS: GitHub Pages, Netlify, and Cloudflare Pages. Upload `index.html`, `404.html`, `styles.css`, `doors.txt`, `_redirects` and `dist/`.
# advent

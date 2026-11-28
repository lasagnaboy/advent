# Advent Calendar

A single-page, responsive Advent calendar in plain HTML, CSS and TypeScript. It has no framework and no runtime dependencies.

## Files

```
advent-calendar/
├── index.html       Page shell: header, grid, lightbox, toast
├── styles.css       Responsive grid (4 columns on phones, 6 on wider screens) and the 3D door swing
├── doors.txt        Configuration: day → YouTube link or image URL, plus title/year/superuser
├── serve.mjs        Local dev server (routes /root to index.html)
├── _redirects       /root rewrite for Netlify / Cloudflare Pages
├── src/
│   ├── config.ts    Fetches and parses doors.txt
│   ├── state.ts     Reads and writes opened doors in a cookie
│   ├── route.ts     Works out which calendar and mode the URL asks for
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
1=https://www.youtube.com/watch?v=VIDEO_ID
2=https://youtu.be/VIDEO_ID?t=45
3=https://www.youtube.com/shorts/VIDEO_ID
4=https://example.com/day4.jpg
...
```
Each day can be a YouTube link or an image URL, and you can mix the two. YouTube links can be `watch?v=`, `youtu.be/`, `shorts/`, `embed/` or `live/` links. A `t=` or `start=` in the link sets where playback begins, and Shorts open in a portrait player.
Lines starting with `#` are comments. Both `=` and `:` work as separators. Invalid lines are skipped, and a warning is logged in the browser console.

**Layout.** The door numbers are shuffled into the same order on every visit, the way a printed calendar scatters them. Content is attached only when its door is opened. Clicking an opened door shows the image full size.

**Videos.** When a video door is opened, it swings back to show the video's thumbnail with a play badge, and the video starts in a lightbox. Clicking the thumbnail later opens the lightbox again. The player is a `youtube-nocookie.com` embed, so YouTube sets no cookies until the visitor presses play. Closing the lightbox (×, Esc or clicking outside it) removes the player, which stops playback. If a video's owner has turned off embedding, the player shows an error, and the caption's **Watch on YouTube** link opens it on YouTube instead. Embeds need the page to be served over http(s), as they refuse to play without a Referer.

**Accessibility.** Doors are real `<button>`s with descriptive labels. The page works with the keyboard, and it respects `prefers-reduced-motion`.

## Multiple calendars

The part of the URL after `#/` picks the config file. Without it, `doors.txt` is used:

| URL | Config file | Mode |
|---|---|---|
| `/` | `doors.txt` | normal |
| `/#/salim` | `salim.txt` | normal |
| `/#/root` or `/root` | `doors.txt` | superuser |
| `/#/salim/root` or `/root#/salim` | `salim.txt` | superuser |

To add a calendar, put a new `.txt` file next to `doors.txt` (for example `grandma.txt`) and share `/#/grandma`. It uses the same format as `doors.txt`.

- **File names:** use lower-case letters, numbers, `-` or `_`. The URL is matched case-insensitively, so `/#/Salim` also loads `salim.txt`. Other characters are rejected, so a URL can't point the app at files outside the folder or at other sites.
- **`root`** is reserved for superuser mode and can't be used as a calendar name.
- **Separate progress:** each calendar keeps its own cookie (e.g. `advent_salim_2026`, plus `advent_salim_2026_root` in superuser mode).
- **Separate settings:** each calendar has its own door layout. Its own `superuser=false` setting turns off superuser mode for that calendar only.
- **Missing calendars:** if the file doesn't exist, the page says so and links back to the main calendar.

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

These hosts serve static files over HTTPS: GitHub Pages, Netlify, and Cloudflare Pages. Upload `index.html`, `404.html`, `styles.css`, `doors.txt` (plus any named calendar `.txt` files), `_redirects` and `dist/`.

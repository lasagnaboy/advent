import { ConfigNotFoundError, DAYS, loadConfig } from "./config.js";
import { normalHref, parseRoute, routeKey } from "./route.js";
import { DoorState } from "./state.js";
/* ---------- Dates ---------- */
/** The moment door `day` unlocks: 00:00 UTC on December <day>. */
function unlockTime(day, year) {
    return Date.UTC(year, 11, day);
}
/** Uses the device's system clock. */
function isUnlocked(day, year) {
    return Date.now() >= unlockTime(day, year);
}
/** e.g. "Dec 2, 00:00 UTC (Dec 1, 7:00 PM your time)" */
function describeUnlock(day, year) {
    const t = new Date(unlockTime(day, year));
    const local = t.toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    return `December ${day}, 00:00 UTC (${local} your time)`;
}
/* ---------- Layout ---------- */
/** Turns a calendar name into a number so each calendar gets its own door layout. */
function nameSeed(name) {
    if (!name)
        return 0;
    let h = 0;
    for (const ch of name)
        h = (h * 31 + ch.charCodeAt(0)) % 100000;
    return h;
}
/** Stable shuffled order (same every visit) so numbers look scattered like a real calendar. */
function shuffledDays(seed) {
    const days = Array.from({ length: DAYS }, (_, i) => i + 1);
    let s = seed;
    const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = days.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [days[i], days[j]] = [days[j], days[i]];
    }
    return days;
}
/* ---------- UI helpers ---------- */
const $ = (id) => document.getElementById(id);
let toastTimer;
function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove("show"), 3000);
}
/* ---------- Lightbox ---------- */
function youTubeEmbedUrl(id, start) {
    // youtube-nocookie: no YouTube cookies are set until the visitor presses play.
    const params = new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1" });
    if (start)
        params.set("start", String(start));
    return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}
function youTubeWatchUrl(id, start) {
    return `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ""}`;
}
/** Small still shown behind an opened video door. hqdefault exists for every video. */
function youTubeThumb(id) {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
/** URL to show as the tile background behind an opened door. */
function tileImage(content) {
    return content.kind === "video" ? youTubeThumb(content.id) : content.url;
}
function openViewer(day, content) {
    const dialog = $("viewer");
    const stage = $("viewer-stage");
    const caption = $("viewer-caption");
    stage.replaceChildren();
    caption.replaceChildren(`December ${day}`);
    if (content.kind === "image") {
        dialog.classList.remove("is-video", "is-vertical");
        const img = document.createElement("img");
        img.src = content.url;
        img.alt = `Picture for December ${day}`;
        stage.append(img);
    }
    else {
        dialog.classList.add("is-video");
        dialog.classList.toggle("is-vertical", content.vertical);
        const frame = document.createElement("iframe");
        frame.src = youTubeEmbedUrl(content.id, content.start);
        frame.title = `Video for December ${day}`;
        frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        frame.allowFullscreen = true;
        // YouTube refuses to play embeds that arrive with no Referer (error 153).
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        stage.append(frame);
        // Fallback for videos whose owner has turned off embedding.
        const link = document.createElement("a");
        link.href = youTubeWatchUrl(content.id, content.start);
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Watch on YouTube";
        caption.append(" · ", link);
    }
    dialog.showModal();
}
function preload(url) {
    const img = new Image();
    img.src = url;
}
class Calendar {
    constructor(config, state, superuser, layoutSeed) {
        this.config = config;
        this.state = state;
        this.superuser = superuser;
        this.layoutSeed = layoutSeed;
        this.views = [];
    }
    canOpen(day) {
        return this.superuser || isUnlocked(day, this.config.year);
    }
    render() {
        const list = $("calendar");
        list.innerHTML = "";
        this.views = [];
        document.title = this.config.title + (this.superuser ? " (superuser)" : "");
        $("title").textContent = this.config.title;
        for (const day of shuffledDays(this.config.year + this.layoutSeed)) {
            const view = this.buildDoor(day);
            this.views.push(view);
            list.append(view.cell);
        }
        this.refresh();
    }
    /** Re-evaluate locks against the clock, e.g. when midnight UTC passes with the page open. */
    refresh() {
        for (const v of this.views) {
            const open = this.canOpen(v.day);
            v.cell.classList.toggle("locked", !open);
            v.door.setAttribute("aria-label", open ? `Open door ${v.day}` : `Door ${v.day}, opens ${describeUnlock(v.day, this.config.year)}`);
            if (open && this.state.isOpen(v.day))
                this.reveal(v);
            else if (open && v.content)
                preload(tileImage(v.content));
        }
        this.updateStatus();
        this.scheduleNextUnlock();
    }
    scheduleNextUnlock() {
        window.clearTimeout(this.unlockTimer);
        if (this.superuser)
            return;
        const now = Date.now();
        const next = this.views
            .map((v) => unlockTime(v.day, this.config.year))
            .filter((t) => t > now)
            .sort((a, b) => a - b)[0];
        if (next === undefined)
            return;
        // Cap the wait at 1 hour so sleep/clock changes are picked up too.
        const wait = Math.min(next - now + 500, 60 * 60 * 1000);
        this.unlockTimer = window.setTimeout(() => this.refresh(), wait);
    }
    updateStatus() {
        if (this.superuser) {
            $("status").textContent = `${this.state.count} of ${DAYS} doors opened (superuser)`;
            return;
        }
        const available = this.views.filter((v) => isUnlocked(v.day, this.config.year)).length;
        $("status").textContent =
            available === 0
                ? `The first door opens ${describeUnlock(1, this.config.year)}.`
                : `${this.state.count} of ${available} available doors opened`;
    }
    reveal(v) {
        // Content is only attached once the door is opened, so it can't be peeked via the DOM.
        if (v.content) {
            const url = tileImage(v.content);
            v.behind.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`;
            v.behind.classList.toggle("video", v.content.kind === "video");
            v.behind.setAttribute("aria-label", `${v.content.kind === "video" ? "Play video" : "View picture"} for December ${v.day}`);
        }
        v.cell.classList.add("open");
        v.behind.tabIndex = 0;
    }
    buildDoor(day) {
        const cell = document.createElement("li");
        cell.className = "cell";
        const behind = document.createElement("div");
        behind.className = "behind";
        behind.setAttribute("role", "button");
        behind.tabIndex = -1;
        const door = document.createElement("button");
        door.className = "door";
        door.type = "button";
        door.textContent = String(day);
        const view = { day, content: this.config.doors.get(day), cell, door, behind };
        door.addEventListener("click", () => {
            // Check the clock at click time, not just at page load.
            if (!this.canOpen(day)) {
                door.classList.remove("shake");
                void door.offsetWidth; // restart animation
                door.classList.add("shake");
                toast(`Patience! Door ${day} opens ${describeUnlock(day, this.config.year)}.`);
                return;
            }
            if (!view.content)
                toast(`Nothing configured for day ${day}.`);
            const firstOpen = !this.state.isOpen(day);
            this.state.open(day);
            this.reveal(view);
            this.updateStatus();
            // A video starts in the lightbox as soon as the door has swung open.
            if (firstOpen && view.content?.kind === "video") {
                const content = view.content;
                const swing = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700;
                window.setTimeout(() => openViewer(day, content), swing);
            }
        });
        const show = () => view.content && cell.classList.contains("open") && openViewer(day, view.content);
        behind.addEventListener("click", show);
        behind.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                show();
            }
        });
        cell.append(behind, door);
        return view;
    }
}
/* ---------- Boot ---------- */
function showError(message, linkHome = true) {
    $("status").textContent = message;
    if (linkHome) {
        const a = document.createElement("a");
        a.href = "./";
        a.textContent = "Go to the main calendar";
        $("status").append(" ", a);
    }
}
async function main() {
    const route = parseRoute();
    // Changing the calendar name or #/root in the address bar reloads the app.
    window.addEventListener("hashchange", () => {
        if (routeKey(parseRoute()) !== routeKey(route))
            location.reload();
    });
    if (route.error) {
        showError(route.error);
        return;
    }
    try {
        const config = await loadConfig(route.configFile);
        const superuser = route.superuser && config.superuser;
        if (route.superuser && !config.superuser) {
            toast("Superuser mode is turned off for this calendar.");
        }
        $("su-banner").hidden = !superuser;
        $("su-exit").href = normalHref(route);
        const state = new DoorState(config.year, superuser, route.name);
        const calendar = new Calendar(config, state, superuser, nameSeed(route.name));
        calendar.render();
        // Re-check locks when the tab comes back (e.g. after the device slept past midnight UTC).
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible")
                calendar.refresh();
        });
        $("reset").addEventListener("click", () => {
            if (confirm("Close all doors on this device?")) {
                state.reset();
                calendar.render();
            }
        });
        // Close the viewer when clicking the backdrop
        const dialog = $("viewer");
        dialog.addEventListener("click", (e) => { if (e.target === dialog)
            dialog.close(); });
        // Removing the iframe on close (button, Esc or backdrop) is what stops the video.
        dialog.addEventListener("close", () => $("viewer-stage").replaceChildren());
    }
    catch (err) {
        console.error(err);
        if (err instanceof ConfigNotFoundError && route.name) {
            showError(`There's no calendar called "${route.name}" (${route.configFile} wasn't found).`);
        }
        else {
            showError(`Couldn't load ${route.configFile}. Serve this folder over http(s) rather than opening the file directly.`, false);
        }
    }
}
main();

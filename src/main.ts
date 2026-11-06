import { DAYS, loadConfig, type CalendarConfig } from "./config.js";
import { DoorState } from "./state.js";

/* ---------- Routing ---------- */

/**
 * Superuser mode is reached at <app>/root (needs a server rewrite to index.html)
 * or at <app>/#/root (works on any static host with no setup).
 */
function isRootRoute(): boolean {
  return /\/root\/?$/.test(location.pathname) || location.hash === "#/root";
}

/* ---------- Dates ---------- */

/** The moment door `day` unlocks: 00:00 UTC on December <day>. */
function unlockTime(day: number, year: number): number {
  return Date.UTC(year, 11, day);
}

/** Uses the device's system clock. */
function isUnlocked(day: number, year: number): boolean {
  return Date.now() >= unlockTime(day, year);
}

/** e.g. "Dec 2, 00:00 UTC (Dec 1, 7:00 PM your time)" */
function describeUnlock(day: number, year: number): string {
  const t = new Date(unlockTime(day, year));
  const local = t.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  return `December ${day}, 00:00 UTC (${local} your time)`;
}

/* ---------- Layout ---------- */

/** Stable shuffled order (same every visit) so numbers look scattered like a real calendar. */
function shuffledDays(seed: number): number[] {
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

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let toastTimer: number | undefined;
function toast(message: string): void {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 3000);
}

function showImage(day: number, url: string): void {
  const dialog = $<HTMLDialogElement>("viewer");
  const img = $<HTMLImageElement>("viewer-img");
  img.src = url;
  img.alt = `Picture for December ${day}`;
  $("viewer-caption").textContent = `December ${day}`;
  dialog.showModal();
}

function preload(url: string): void {
  const img = new Image();
  img.src = url;
}

/* ---------- Calendar ---------- */

interface DoorView {
  day: number;
  url?: string;
  cell: HTMLLIElement;
  door: HTMLButtonElement;
  behind: HTMLDivElement;
}

class Calendar {
  private views: DoorView[] = [];
  private unlockTimer: number | undefined;

  constructor(
    private readonly config: CalendarConfig,
    private readonly state: DoorState,
    private readonly superuser: boolean,
  ) {}

  private canOpen(day: number): boolean {
    return this.superuser || isUnlocked(day, this.config.year);
  }

  render(): void {
    const list = $("calendar");
    list.innerHTML = "";
    this.views = [];

    document.title = this.config.title + (this.superuser ? " (superuser)" : "");
    $("title").textContent = this.config.title;

    for (const day of shuffledDays(this.config.year)) {
      const view = this.buildDoor(day);
      this.views.push(view);
      list.append(view.cell);
    }

    this.refresh();
  }

  /** Re-evaluate locks against the clock, e.g. when midnight UTC passes with the page open. */
  refresh(): void {
    for (const v of this.views) {
      const open = this.canOpen(v.day);
      v.cell.classList.toggle("locked", !open);
      v.door.setAttribute(
        "aria-label",
        open ? `Open door ${v.day}` : `Door ${v.day}, opens ${describeUnlock(v.day, this.config.year)}`,
      );
      if (open && this.state.isOpen(v.day)) this.reveal(v);
      else if (open && v.url) preload(v.url);
    }
    this.updateStatus();
    this.scheduleNextUnlock();
  }

  private scheduleNextUnlock(): void {
    window.clearTimeout(this.unlockTimer);
    if (this.superuser) return;
    const now = Date.now();
    const next = this.views
      .map((v) => unlockTime(v.day, this.config.year))
      .filter((t) => t > now)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    // Cap the wait at 1 hour so sleep/clock changes are picked up too.
    const wait = Math.min(next - now + 500, 60 * 60 * 1000);
    this.unlockTimer = window.setTimeout(() => this.refresh(), wait);
  }

  private updateStatus(): void {
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

  private reveal(v: DoorView): void {
    // Image is only attached once the door is opened, so it can't be peeked via the DOM.
    if (v.url) v.behind.style.backgroundImage = `url("${v.url.replace(/"/g, "%22")}")`;
    v.cell.classList.add("open");
    v.behind.tabIndex = 0;
  }

  private buildDoor(day: number): DoorView {
    const cell = document.createElement("li");
    cell.className = "cell";

    const behind = document.createElement("div");
    behind.className = "behind";
    behind.setAttribute("role", "button");
    behind.tabIndex = -1;
    behind.setAttribute("aria-label", `View picture for December ${day}`);

    const door = document.createElement("button");
    door.className = "door";
    door.type = "button";
    door.textContent = String(day);

    const view: DoorView = { day, url: this.config.images.get(day), cell, door, behind };

    door.addEventListener("click", () => {
      // Check the clock at click time, not just at page load.
      if (!this.canOpen(day)) {
        door.classList.remove("shake");
        void door.offsetWidth; // restart animation
        door.classList.add("shake");
        toast(`Patience! Door ${day} opens ${describeUnlock(day, this.config.year)}.`);
        return;
      }
      if (!view.url) toast(`No picture configured for day ${day}.`);
      this.state.open(day);
      this.reveal(view);
      this.updateStatus();
    });

    const show = () => view.url && cell.classList.contains("open") && showImage(day, view.url);
    behind.addEventListener("click", show);
    behind.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(); }
    });

    cell.append(behind, door);
    return view;
  }
}

/* ---------- Boot ---------- */

async function main(): Promise<void> {
  try {
    const config = await loadConfig();

    const wantsRoot = isRootRoute();
    const superuser = wantsRoot && config.superuser;
    if (wantsRoot && !config.superuser) {
      toast("Superuser mode is turned off for this calendar.");
    }
    $("su-banner").hidden = !superuser;

    const state = new DoorState(config.year, superuser);
    const calendar = new Calendar(config, state, superuser);
    calendar.render();

    // Switching between #/root and the normal view in the address bar reloads the app.
    window.addEventListener("hashchange", () => {
      if (isRootRoute() !== wantsRoot) location.reload();
    });

    // Re-check locks when the tab comes back (e.g. after the device slept past midnight UTC).
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") calendar.refresh();
    });

    $("reset").addEventListener("click", () => {
      if (confirm("Close all doors on this device?")) {
        state.reset();
        calendar.render();
      }
    });

    // Close the viewer when clicking the backdrop
    const dialog = $<HTMLDialogElement>("viewer");
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  } catch (err) {
    console.error(err);
    $("status").textContent =
      "Couldn't load doors.txt. Serve this folder over http(s) rather than opening the file directly.";
  }
}

main();

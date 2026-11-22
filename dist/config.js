export const DAYS = 24;
/**
 * Parse the plain-text config.
 *   - blank lines and lines starting with # are ignored
 *   - "key=value" (also accepts "key: value")
 *   - numeric keys 1–24 are a YouTube link or an image URL; "title", "year", "superuser" are settings
 */
export function parseConfig(text) {
    const config = {
        title: "Advent Calendar",
        year: new Date().getUTCFullYear(),
        superuser: true,
        doors: new Map(),
    };
    text.split(/\r?\n/).forEach((raw, i) => {
        const line = raw.trim();
        if (!line || line.startsWith("#"))
            return;
        // Split on the first "=" or ":" — URLs contain ":" too, so the key must come first.
        const match = line.match(/^([^=:]+?)\s*[=:]\s*(.+)$/);
        if (!match) {
            console.warn(`doors.txt line ${i + 1} ignored: "${line}"`);
            return;
        }
        const key = match[1].trim().toLowerCase();
        const value = match[2].trim();
        if (key === "title") {
            config.title = value;
        }
        else if (key === "year") {
            const y = Number(value);
            if (Number.isInteger(y))
                config.year = y;
        }
        else if (key === "superuser") {
            config.superuser = !/^(false|off|no|0)$/i.test(value);
        }
        else if (/^\d+$/.test(key)) {
            const day = Number(key);
            const content = parseDoorValue(value);
            if (day >= 1 && day <= DAYS && content) {
                config.doors.set(day, content);
            }
            else {
                console.warn(`doors.txt line ${i + 1}: invalid day, YouTube link or URL`);
            }
        }
    });
    return config;
}
function parseDoorValue(value) {
    const video = parseYouTube(value);
    if (video)
        return video;
    return isHttpUrl(value) ? { kind: "image", url: value } : null;
}
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
/**
 * Accepts the usual YouTube link shapes:
 *   https://www.youtube.com/watch?v=ID[&t=90s]
 *   https://youtu.be/ID[?t=90]
 *   https://www.youtube.com/shorts/ID
 *   https://www.youtube.com/embed/ID[?start=90]
 *   https://www.youtube.com/live/ID
 *   https://m.youtube.com/..., https://music.youtube.com/..., youtube-nocookie.com/embed/ID
 */
export function parseYouTube(value) {
    let u;
    try {
        u = new URL(value);
    }
    catch {
        return null;
    }
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    const parts = u.pathname.split("/").filter(Boolean);
    let id = null;
    let vertical = false;
    if (host === "youtu.be") {
        id = parts[0] ?? null;
    }
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
        if (parts[0] === "watch")
            id = u.searchParams.get("v");
        else if (["embed", "shorts", "live", "v"].includes(parts[0])) {
            id = parts[1] ?? null;
            vertical = parts[0] === "shorts";
        }
    }
    else {
        return null;
    }
    if (!id || !YT_ID.test(id))
        return null;
    const start = parseStart(u.searchParams.get("t") ?? u.searchParams.get("start"));
    return { kind: "video", id, start, vertical };
}
/** "90", "90s", "1m30s", "1h2m3s" -> seconds */
function parseStart(t) {
    if (!t)
        return undefined;
    if (/^\d+s?$/.test(t))
        return parseInt(t, 10);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!m || !t)
        return undefined;
    const secs = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
    return secs > 0 ? secs : undefined;
}
function isHttpUrl(value) {
    try {
        const u = new URL(value, window.location.href);
        return u.protocol === "https:" || u.protocol === "http:";
    }
    catch {
        return false;
    }
}
export async function loadConfig(path = "doors.txt") {
    // no-cache so edits to doors.txt show up without a hard refresh
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok)
        throw new Error(`Could not load ${path} (${res.status})`);
    return parseConfig(await res.text());
}

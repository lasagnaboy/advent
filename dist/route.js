export const DEFAULT_CONFIG = "doors.txt";
const ROOT = "root";
/** Letters, digits, - and _ only, so the URL can't point at other files or sites. */
const VALID_NAME = /^[A-Za-z0-9_-]{1,64}$/;
export function parseRoute(loc = location) {
    const pathRoot = /\/root\/?$/.test(loc.pathname);
    const segments = decodeURIComponent(loc.hash.replace(/^#\/?/, ""))
        .split("/")
        .filter(Boolean);
    let superuser = pathRoot;
    if (segments[segments.length - 1]?.toLowerCase() === ROOT) {
        superuser = true;
        segments.pop();
    }
    if (segments.length === 0) {
        return { name: null, configFile: DEFAULT_CONFIG, superuser };
    }
    const name = segments[0];
    if (segments.length > 1 || !VALID_NAME.test(name)) {
        return {
            name,
            configFile: DEFAULT_CONFIG,
            superuser,
            error: `"${segments.join("/")}" isn't a valid calendar name. Use letters, numbers, - or _.`,
        };
    }
    // Lower-case file names so #/Salim and #/salim both load salim.txt
    // (GitHub Pages file names are case-sensitive).
    return { name: name.toLowerCase(), configFile: `${name.toLowerCase()}.txt`, superuser };
}
/** A key that changes whenever the URL points at a different calendar or mode. */
export function routeKey(r) {
    return `${r.configFile}|${r.superuser}`;
}
/** Link back to the normal (non-superuser) view of the same calendar. */
export function normalHref(r) {
    return r.name && !r.error ? `./#/${r.name}` : "./";
}

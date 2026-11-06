/**
 * Opened-door state, persisted in a cookie.
 * Cookie name includes the year so each December starts fresh:
 *   advent_2026=1.2.5.7
 * Superuser mode uses its own cookie (advent_2026_root) so debugging
 * never changes what a normal visitor on this device sees.
 */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
export class DoorState {
    constructor(year, superuser = false) {
        this.name = `advent_${year}${superuser ? "_root" : ""}`;
        this.opened = this.read();
    }
    isOpen(day) {
        return this.opened.has(day);
    }
    open(day) {
        this.opened.add(day);
        this.write();
    }
    reset() {
        this.opened.clear();
        document.cookie = `${this.name}=; Max-Age=0; Path=/; SameSite=Lax`;
    }
    get count() {
        return this.opened.size;
    }
    read() {
        const entry = document.cookie
            .split("; ")
            .find((c) => c.startsWith(`${this.name}=`));
        if (!entry)
            return new Set();
        const value = decodeURIComponent(entry.slice(this.name.length + 1));
        return new Set(value
            .split(".")
            .map(Number)
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 24));
    }
    write() {
        const value = [...this.opened].sort((a, b) => a - b).join(".");
        const secure = location.protocol === "https:" ? "; Secure" : "";
        document.cookie =
            `${this.name}=${encodeURIComponent(value)}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`;
    }
}

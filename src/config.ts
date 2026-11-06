/** Parsed contents of doors.txt */
export interface CalendarConfig {
  title: string;
  year: number;
  /** Whether the /root superuser route is allowed (default true). */
  superuser: boolean;
  /** day (1–24) -> image URL */
  images: Map<number, string>;
}

export const DAYS = 24;

/**
 * Parse the plain-text config.
 *   - blank lines and lines starting with # are ignored
 *   - "key=value" (also accepts "key: value")
 *   - numeric keys 1–24 are image URLs; "title", "year", "superuser" are settings
 */
export function parseConfig(text: string): CalendarConfig {
  const config: CalendarConfig = {
    title: "Advent Calendar",
    year: new Date().getUTCFullYear(),
    superuser: true,
    images: new Map(),
  };

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;

    const match = line.match(/^([^=:]+?)\s*[=:]\s*(.+)$/);
    if (!match) {
      console.warn(`doors.txt line ${i + 1} ignored: "${line}"`);
      return;
    }
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (key === "title") {
      config.title = value;
    } else if (key === "year") {
      const y = Number(value);
      if (Number.isInteger(y)) config.year = y;
    } else if (key === "superuser") {
      config.superuser = !/^(false|off|no|0)$/i.test(value);
    } else if (/^\d+$/.test(key)) {
      const day = Number(key);
      if (day >= 1 && day <= DAYS && isHttpUrl(value)) {
        config.images.set(day, value);
      } else {
        console.warn(`doors.txt line ${i + 1}: invalid day or URL`);
      }
    }
  });

  return config;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value, window.location.href);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export async function loadConfig(path = "doors.txt"): Promise<CalendarConfig> {
  // no-cache so edits to doors.txt show up without a hard refresh
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return parseConfig(await res.text());
}

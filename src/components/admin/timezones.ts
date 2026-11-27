import { canonicalTimezone } from "@/contracts";

/** A29: never offered. Russian zones, plus Simferopol, whose zone data follows Moscow time. */
const HIDDEN = new Set(
  [
    "Europe/Kaliningrad", "Europe/Moscow", "Europe/Simferopol", "Europe/Kirov", "Europe/Volgograd", "Europe/Astrakhan",
    "Europe/Saratov", "Europe/Ulyanovsk", "Europe/Samara", "Asia/Yekaterinburg", "Asia/Omsk", "Asia/Novosibirsk",
    "Asia/Barnaul", "Asia/Tomsk", "Asia/Novokuznetsk", "Asia/Krasnoyarsk", "Asia/Irkutsk", "Asia/Chita", "Asia/Yakutsk",
    "Asia/Khandyga", "Asia/Vladivostok", "Asia/Ust-Nera", "Asia/Magadan", "Asia/Sakhalin", "Asia/Srednekolymsk",
    "Asia/Kamchatka", "Asia/Anadyr",
  ],
);

/** Best-known zones, in the order they should name and represent their group. */
const PREFERRED = [
  "Europe/Kyiv", "Europe/Warsaw", "Europe/London", "UTC", "America/New_York", "Europe/Berlin", "Europe/Paris",
  "Europe/Madrid", "Europe/Rome", "Europe/Lisbon", "Europe/Athens", "Europe/Helsinki", "Europe/Bucharest",
  "Europe/Istanbul", "Asia/Dubai", "Asia/Tbilisi", "Asia/Kolkata", "Asia/Bangkok", "Asia/Shanghai", "Asia/Hong_Kong",
  "Asia/Singapore", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "Pacific/Auckland", "Pacific/Honolulu",
  "America/Anchorage", "America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago",
  "America/Toronto", "America/Mexico_City", "America/Sao_Paulo", "America/Argentina/Buenos_Aires", "Africa/Cairo",
  "Asia/Jerusalem", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi",
];

const SHOWN_CITIES = 4;

export interface TimezoneOption {
  value: string; // IANA zone saved when picked
  offset: string; // "UTC+02:00" today
  cities: string; // "Kyiv, Athens, Helsinki, Bucharest +8"
  search: string; // every city and zone id in the group, lower case
}

export function cityName(zone: string): string {
  return canonicalTimezone(zone).split("/").at(-1)!.replaceAll("_", " ");
}

function offsetReader(zone: string): (at: number) => string {
  const format = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" });
  return (at) => {
    const name = format.formatToParts(at).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
    return name === "GMT" ? "UTC+00:00" : name.replace("GMT", "UTC");
  };
}

export function offsetLabel(zone: string, now = new Date()): string {
  return offsetReader(zone)(now.getTime());
}

const rank = (zone: string) => {
  const index = PREFERRED.indexOf(zone);
  return index === -1 ? PREFERRED.length : index;
};

function minutes(offset: string): number {
  const [, sign, hours, mins] = /UTC([+-])(\d\d):(\d\d)/.exec(offset)!;
  return (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(mins));
}

/**
 * One entry per distinct clock: zones are merged only when their offset matches on every Saturday
 * of the year, so daylight-saving differences keep them apart. `current` stays the value of its
 * group, so opening the picker never changes a saved zone.
 */
export function timezoneOptions(current?: string | null, now = new Date()): TimezoneOption[] {
  const all = new Set([...Intl.supportedValuesOf("timeZone").map(canonicalTimezone), "UTC"]);
  const keep = current ? canonicalTimezone(current) : null;
  if (keep) all.add(keep);
  const firstSaturday = Date.UTC(now.getUTCFullYear(), 0, 1, 12) + ((6 - new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).getUTCDay()) * 86_400_000);
  const samples = Array.from({ length: 52 }, (_, week) => firstSaturday + week * 7 * 86_400_000);

  const groups = new Map<string, string[]>();
  for (const zone of all) {
    if (HIDDEN.has(zone) && zone !== keep) continue;
    const read = offsetReader(zone);
    const key = samples.map(read).join();
    groups.set(key, [...(groups.get(key) ?? []), zone]);
  }

  return [...groups.values()]
    .map((zones) => {
      zones.sort((a, b) => rank(a) - rank(b) || cityName(a).localeCompare(cityName(b)));
      const value = keep && zones.includes(keep) ? keep : zones[0];
      const named = [value, ...zones.filter((zone) => zone !== value)].filter((zone) => !HIDDEN.has(zone));
      const rest = named.length - SHOWN_CITIES;
      return {
        value,
        offset: offsetLabel(value, now),
        cities: named.slice(0, SHOWN_CITIES).map(cityName).join(", ") + (rest > 0 ? ` +${rest}` : ""),
        search: named.map((zone) => `${cityName(zone)} ${zone}`).join(" ").toLowerCase(),
      };
    })
    .sort((a, b) => minutes(a.offset) - minutes(b.offset) || rank(a.value) - rank(b.value));
}

export function filterTimezones(options: readonly TimezoneOption[], query: string): TimezoneOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...options];
  return options.filter((o) => o.search.includes(needle) || o.offset.toLowerCase().includes(needle));
}

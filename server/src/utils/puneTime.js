// Pune is UTC+05:30 all year (no DST), so a fixed offset is exact.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

// 'YYYY-MM-DD' -> Date at 00:00 Pune time that day, or null if not a real date.
function puneStartOfDay(ymd) {
  const match = DATE_ONLY.exec(ymd);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const utcMidnight = new Date(Date.UTC(y, m - 1, d));
  // Rejects things like 2026-02-30, which Date.UTC would roll over.
  if (utcMidnight.getUTCFullYear() !== y || utcMidnight.getUTCMonth() !== m - 1 || utcMidnight.getUTCDate() !== d) {
    return null;
  }
  return new Date(utcMidnight.getTime() - IST_OFFSET_MS);
}

module.exports = { DATE_ONLY, DAY_MS, puneStartOfDay };

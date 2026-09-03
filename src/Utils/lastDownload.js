export function toDownloadDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const seconds = Number(value.seconds ?? value._seconds);
  if (Number.isFinite(seconds)) {
    const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
    const date = new Date(seconds * 1000 + nanoseconds / 1_000_000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLastDownload(value) {
  const date = toDownloadDate(value);
  if (!date) return "Never";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

const LOCALE_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const LOCALE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

const LOCALE_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

const TIME_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

export function formatDate(date) {
  return LOCALE_DATE.format(date);
}

export function formatTime(date) {
  return LOCALE_TIME.format(date);
}

export function formatDateTime(date) {
  return LOCALE_DATE_TIME.format(date);
}

export function formatTimeAgo(isoDate) {
  const deltaSec = Math.max(0, Math.floor((Date.now() - Date.parse(isoDate)) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
  return `${Math.floor(deltaSec / 86400)}d ago`;
}

export function oslotime(date) {
  const parts = TIME_PARTS.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = Number(part.value);
    }
    return acc;
  }, {});

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second
  };
}

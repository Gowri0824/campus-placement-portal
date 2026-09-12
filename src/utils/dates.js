const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const timestampFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium", timeStyle: "medium", timeZone: "UTC",
});

export function formatDateTime(value, fallback = "Not available") {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? timestampFormatter.format(parsed) : fallback;
}

const displayDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const dateOnlyFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function normalizeDateOnly(value) {
  const dateValue = String(value || "");

  if (!DATE_ONLY_PATTERN.test(dateValue)) {
    return null;
  }

  const parsedDate = new Date(`${dateValue}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== dateValue
  ) {
    return null;
  }

  return dateValue;
}

export function getCurrentUtcDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function isDeadlineOpen(deadline, now = new Date()) {
  const normalizedDeadline = normalizeDateOnly(deadline);

  return Boolean(
    normalizedDeadline && getCurrentUtcDate(now) <= normalizedDeadline
  );
}

export function getDeadlineClosedMessage(deadline) {
  return normalizeDateOnly(deadline)
    ? "Application deadline closed"
    : "Application deadline is not configured";
}

export function formatDeadline(deadline, fallback = "Not configured") {
  const normalizedDeadline = normalizeDateOnly(deadline);

  if (!normalizedDeadline) {
    return fallback;
  }

  return dateOnlyFormatter.format(
    new Date(`${normalizedDeadline}T00:00:00.000Z`)
  );
}

export function formatDate(value, fallback = "Not available") {
  if (!value) {
    return fallback;
  }

  const dateOnly = normalizeDateOnly(value);
  const parsedDate = dateOnly
    ? new Date(`${dateOnly}T00:00:00.000Z`)
    : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return fallback;
  }

  return dateOnly
    ? dateOnlyFormatter.format(parsedDate)
    : displayDateFormatter.format(parsedDate);
}

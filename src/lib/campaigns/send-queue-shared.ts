const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type AllowedSendDay = (typeof weekdayNames)[number];

export const DEFAULT_ALLOWED_SEND_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const satisfies readonly AllowedSendDay[];

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type ComputeScheduledSendInput = {
  baseSentAt: string;
  waitDays: number;
  timezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  allowedSendDays?: readonly string[] | null;
};

type ComputeWindowStartInput = {
  baseAt: string;
  timezone: string;
  sendWindowStart: string;
  allowedSendDays?: readonly string[] | null;
  includeToday?: boolean;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string) {
  const cached = formatterCache.get(timezone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  formatterCache.set(timezone, formatter);
  return formatter;
}

function getWeekdayName(year: number, month: number, day: number) {
  const weekday = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  return weekdayNames[weekday] ?? "Mon";
}

function getAllowedSendDays(days?: readonly string[] | null) {
  const normalized = (days ?? [])
    .map((day) => day.trim().slice(0, 3))
    .filter((day): day is AllowedSendDay => weekdayNames.includes(day as AllowedSendDay));

  return normalized.length ? normalized : [...DEFAULT_ALLOWED_SEND_DAYS];
}

function getZonedDateTimeParts(date: Date, timezone: string): ZonedDateTimeParts {
  const parts = getFormatter(timezone)
    .formatToParts(date)
    .reduce<Record<string, string>>((accumulator, part) => {
      if (part.type !== "literal") {
        accumulator[part.type] = part.value;
      }

      return accumulator;
    }, {});

  const rawHour = Number(parts.hour ?? "0");

  return {
    year: Number(parts.year ?? "0"),
    month: Number(parts.month ?? "1"),
    day: Number(parts.day ?? "1"),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number(parts.minute ?? "0"),
    second: Number(parts.second ?? "0"),
  };
}

function getTimeZoneOffsetMilliseconds(timezone: string, date: Date) {
  const zoned = getZonedDateTimeParts(date, timezone);
  const utcTime = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
    0,
  );

  return utcTime - date.getTime();
}

function zonedDateTimeToUtc(parts: ZonedDateTimeParts, timezone: string) {
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
  const firstOffset = getTimeZoneOffsetMilliseconds(timezone, new Date(guess));
  const firstPass = guess - firstOffset;
  const secondOffset = getTimeZoneOffsetMilliseconds(timezone, new Date(firstPass));
  return new Date(guess - secondOffset);
}

function shiftCivilDate(parts: ZonedDateTimeParts, days: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return {
    ...parts,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function parseTimeParts(value: string) {
  const [hour, minute] = value.split(":").map((part) => Number(part));
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function getMinutes(parts: Pick<ZonedDateTimeParts, "hour" | "minute">) {
  return parts.hour * 60 + parts.minute;
}

function setTime(parts: ZonedDateTimeParts, hour: number, minute: number) {
  return {
    ...parts,
    hour,
    minute,
    second: 0,
  };
}

function moveToNextAllowedDayStart(
  parts: ZonedDateTimeParts,
  allowedSendDays: readonly AllowedSendDay[],
  sendWindowStart: string,
) {
  const startParts = parseTimeParts(sendWindowStart);
  let candidate = setTime(shiftCivilDate(parts, 1), startParts.hour, startParts.minute);

  while (!allowedSendDays.includes(getWeekdayName(candidate.year, candidate.month, candidate.day))) {
    candidate = setTime(shiftCivilDate(candidate, 1), startParts.hour, startParts.minute);
  }

  return candidate;
}

export function isWithinAllowedSendDay(date: Date, timezone: string, allowedSendDays?: readonly string[] | null) {
  const allowed = getAllowedSendDays(allowedSendDays);
  const parts = getZonedDateTimeParts(date, timezone);
  return allowed.includes(getWeekdayName(parts.year, parts.month, parts.day));
}

export function computeNextScheduledSendAt(input: ComputeScheduledSendInput) {
  const allowedSendDays = getAllowedSendDays(input.allowedSendDays);
  const startTime = parseTimeParts(input.sendWindowStart);
  const endTime = parseTimeParts(input.sendWindowEnd);
  const baseDate = new Date(input.baseSentAt);
  let candidate = shiftCivilDate(getZonedDateTimeParts(baseDate, input.timezone), Math.max(0, input.waitDays));
  const candidateMinutes = getMinutes(candidate);
  const startMinutes = getMinutes(startTime);
  const endMinutes = getMinutes(endTime);
  const weekday = getWeekdayName(candidate.year, candidate.month, candidate.day);

  if (!allowedSendDays.includes(weekday)) {
    candidate = moveToNextAllowedDayStart(candidate, allowedSendDays, input.sendWindowStart);
  } else if (candidateMinutes < startMinutes) {
    candidate = setTime(candidate, startTime.hour, startTime.minute);
  } else if (candidateMinutes > endMinutes) {
    candidate = moveToNextAllowedDayStart(candidate, allowedSendDays, input.sendWindowStart);
  }

  return zonedDateTimeToUtc(candidate, input.timezone).toISOString();
}

export function computeNextWindowStartAt(input: ComputeWindowStartInput) {
  const allowedSendDays = getAllowedSendDays(input.allowedSendDays);
  const startTime = parseTimeParts(input.sendWindowStart);
  const baseDate = new Date(input.baseAt);
  const baseParts = getZonedDateTimeParts(baseDate, input.timezone);
  let candidate = setTime(baseParts, startTime.hour, startTime.minute);
  const includeToday = Boolean(input.includeToday);
  const isAllowedToday = allowedSendDays.includes(
    getWeekdayName(candidate.year, candidate.month, candidate.day),
  );
  const isBeforeStart = getMinutes(baseParts) < getMinutes(startTime);

  if (!includeToday || !isAllowedToday || !isBeforeStart) {
    candidate = moveToNextAllowedDayStart(candidate, allowedSendDays, input.sendWindowStart);
  }

  return zonedDateTimeToUtc(candidate, input.timezone).toISOString();
}

export function computeRetryScheduledAt(input: {
  baseAt: string;
  retryDelayMinutes: number;
  timezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  allowedSendDays?: readonly string[] | null;
}) {
  const baseDate = new Date(new Date(input.baseAt).getTime() + Math.max(1, input.retryDelayMinutes) * 60 * 1000);
  return computeNextScheduledSendAt({
    baseSentAt: baseDate.toISOString(),
    waitDays: 0,
    timezone: input.timezone,
    sendWindowStart: input.sendWindowStart,
    sendWindowEnd: input.sendWindowEnd,
    allowedSendDays: input.allowedSendDays,
  });
}

export function getDayBoundsInTimeZone(baseAt: string, timezone: string) {
  const parts = getZonedDateTimeParts(new Date(baseAt), timezone);
  const start = zonedDateTimeToUtc(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timezone,
  );
  const nextDay = shiftCivilDate(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: 0,
      minute: 0,
      second: 0,
    },
    1,
  );
  const end = zonedDateTimeToUtc(nextDay, timezone);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function getDateKeyInTimeZone(baseAt: string, timezone: string) {
  const parts = getZonedDateTimeParts(new Date(baseAt), timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export const terminalCampaignContactStatuses = [
  "replied",
  "unsubscribed",
  "meeting_booked",
  "followup_sent",
  "skipped",
] as const;

export function isTerminalCampaignContactStatus(status: string | null | undefined) {
  return terminalCampaignContactStatuses.includes(
    (status ?? "") as (typeof terminalCampaignContactStatuses)[number],
  );
}

// lib/jitter.ts

export interface JitterJob {
  id: string;
  accountId: string;
  /** Optional per-job timezone override, for per-lead-timezone segmentation. */
  timezone?: string;
}

export interface JitterOptions {
  now?: Date;
  accountRemainingToday: Record<string, number>;
  accountDailyLimit?: Record<string, number>;
  minGapMinutes?: number; // default 3
  gapMinMinutes?: number; // default 8
  gapMaxMinutes?: number; // default 20
  longGapChance?: number; // default 0.15
  longGapMinMinutes?: number; // default 30
  longGapMaxMinutes?: number; // default 90
  maxDaysToSearch?: number; // default 30
  rng?: () => number; // injectable for deterministic tests
}

export interface ScheduledJob {
  jobId: string;
  accountId: string;
  scheduledFor: Date;
}

function getTimezoneOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const hour = map.hour === "24" ? "00" : map.hour;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asUTC - instant.getTime()) / 60000;
}

function zonedWallTimeToUtc(
  year: number,
  monthIndex0: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, monthIndex0, day, hour, minute, 0);
  const offsetMinutes = getTimezoneOffsetMinutes(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offsetMinutes * 60000);
}

function zonedYMD(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year: Number(map.year),
    monthIndex0: Number(map.month) - 1,
    day: Number(map.day),
  };
}

function addDays(y: number, m0: number, d: number, days: number) {
  const dt = new Date(Date.UTC(y, m0, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return {
    year: dt.getUTCFullYear(),
    monthIndex0: dt.getUTCMonth(),
    day: dt.getUTCDate(),
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function drawGapMinutes(
  opts: {
    gapMinMinutes: number;
    gapMaxMinutes: number;
    longGapChance: number;
    longGapMinMinutes: number;
    longGapMaxMinutes: number;
    minGapMinutes: number;
  },
  rng: () => number,
): number {
  const isLong = rng() < opts.longGapChance;
  const [lo, hi] = isLong
    ? [opts.longGapMinMinutes, opts.longGapMaxMinutes]
    : [opts.gapMinMinutes, opts.gapMaxMinutes];
  const gap = lo + rng() * (hi - lo);
  return Math.max(opts.minGapMinutes, gap);
}

export function scheduleWithJitter(
  jobs: JitterJob[],
  date: Date,
  windowTimezone: string,
  windowStartHour: number,
  windowEndHour: number,
  options: JitterOptions,
): ScheduledJob[] {
  if (
    windowStartHour < 0 ||
    windowStartHour > 23 ||
    windowEndHour < 1 ||
    windowEndHour > 24
  ) {
    throw new Error("windowStartHour/windowEndHour must be within 0-24");
  }
  if (windowStartHour >= windowEndHour) {
    throw new Error("windowStartHour must be before windowEndHour");
  }

  const rng = options.rng ?? Math.random;
  const now = options.now ?? new Date();
  const gapOpts = {
    minGapMinutes: options.minGapMinutes ?? 3,
    gapMinMinutes: options.gapMinMinutes ?? 8,
    gapMaxMinutes: options.gapMaxMinutes ?? 20,
    longGapChance: options.longGapChance ?? 0.15,
    longGapMinMinutes: options.longGapMinMinutes ?? 30,
    longGapMaxMinutes: options.longGapMaxMinutes ?? 90,
  };
  const maxDaysToSearch = options.maxDaysToSearch ?? 30;

  // Group by (accountId, effective timezone) — jobs in different timezone
  // buckets are in different windows entirely, so their gap sequencing is
  // independent even for the same account.
  const buckets = new Map<
    string,
    { accountId: string; timezone: string; jobs: JitterJob[] }
  >();
  for (const job of jobs) {
    const tz = job.timezone || windowTimezone;
    const key = `${job.accountId}::${tz}`;
    if (!buckets.has(key))
      buckets.set(key, { accountId: job.accountId, timezone: tz, jobs: [] });
    buckets.get(key)!.jobs.push(job);
  }

  // Capacity is shared per accountId across buckets.
  const remainingToday = new Map<string, number>();
  const dailyLimit = new Map<string, number>();
  for (const [acctId, remaining] of Object.entries(
    options.accountRemainingToday,
  )) {
    remainingToday.set(acctId, remaining);
    dailyLimit.set(acctId, options.accountDailyLimit?.[acctId] ?? remaining);
  }
  const usedByDayOffset = new Map<string, Map<number, number>>();

  function capacityRemaining(accountId: string, dayOffset: number): number {
    const full =
      dayOffset === 0
        ? (remainingToday.get(accountId) ?? 0)
        : (dailyLimit.get(accountId) ?? 0);
    const used = usedByDayOffset.get(accountId)?.get(dayOffset) ?? 0;
    return full - used;
  }
  function consumeCapacity(accountId: string, dayOffset: number) {
    if (!usedByDayOffset.has(accountId))
      usedByDayOffset.set(accountId, new Map());
    const m = usedByDayOffset.get(accountId)!;
    m.set(dayOffset, (m.get(dayOffset) ?? 0) + 1);
  }

  const results: ScheduledJob[] = [];
  const baseYMD = zonedYMD(date, windowTimezone);

  for (const bucket of buckets.values()) {
    const shuffled = shuffle(bucket.jobs, rng);
    let dayOffset = 0;
    let cursor: Date | null = null;
    let idx = 0;

    while (idx < shuffled.length) {
      if (dayOffset > maxDaysToSearch) {
        throw new Error(
          `scheduleWithJitter: could not place all jobs for account ${bucket.accountId} within ${maxDaysToSearch} days`,
        );
      }

      const ymd = addDays(
        baseYMD.year,
        baseYMD.monthIndex0,
        baseYMD.day,
        dayOffset,
      );
      const windowStart = zonedWallTimeToUtc(
        ymd.year,
        ymd.monthIndex0,
        ymd.day,
        windowStartHour,
        0,
        bucket.timezone,
      );
      const windowEnd = zonedWallTimeToUtc(
        ymd.year,
        ymd.monthIndex0,
        ymd.day,
        windowEndHour,
        0,
        bucket.timezone,
      );

      let dayStart = windowStart;
      if (dayOffset === 0 && now.getTime() > windowStart.getTime()) {
        dayStart = now.getTime() > windowEnd.getTime() ? windowEnd : now;
      }

      if (
        dayStart.getTime() >= windowEnd.getTime() ||
        capacityRemaining(bucket.accountId, dayOffset) <= 0
      ) {
        dayOffset += 1;
        cursor = null;
        continue;
      }

      if (cursor === null) {
        const initialOffset = drawGapMinutes(gapOpts, rng);
        cursor = new Date(
          Math.min(
            dayStart.getTime() + initialOffset * 60000,
            windowEnd.getTime() - 1,
          ),
        );
      } else {
        const gap = drawGapMinutes(gapOpts, rng);
        cursor = new Date(cursor.getTime() + gap * 60000);
      }

      if (cursor.getTime() >= windowEnd.getTime()) {
        dayOffset += 1;
        cursor = null;
        continue;
      }

      const job = shuffled[idx];
      results.push({
        jobId: job.id,
        accountId: job.accountId,
        scheduledFor: cursor,
      });
      consumeCapacity(bucket.accountId, dayOffset);
      idx += 1;
    }
  }

  return results;
}

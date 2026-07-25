// import { scheduleWithJitter, JitterJob } from "../lib/jitter";

import { JitterJob, scheduleWithJitter } from "@/lib/jitter";



function seededRng(seed: number) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REF_DATE = new Date("2026-08-03T00:00:00.000Z");

describe("scheduleWithJitter", () => {
  test("respects window boundaries", () => {
    const jobs: JitterJob[] = Array.from({ length: 5 }, (_, i) => ({ id: `j${i}`, accountId: "acct1" }));
    const result = scheduleWithJitter(jobs, REF_DATE, "America/New_York", 9, 18, {
      accountRemainingToday: { acct1: 50 },
      now: new Date("2026-08-03T08:00:00.000Z"),
      rng: seededRng(1),
    });
    for (const r of result) {
      const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(r.scheduledFor));
      expect(h).toBeGreaterThanOrEqual(9);
      expect(h).toBeLessThan(18);
    }
  });

  test("enforces the minimum gap floor", () => {
    const jobs: JitterJob[] = Array.from({ length: 20 }, (_, i) => ({ id: `j${i}`, accountId: "acct1" }));
    const result = scheduleWithJitter(jobs, REF_DATE, "America/New_York", 0, 24, {
      accountRemainingToday: { acct1: 50 }, minGapMinutes: 3, rng: seededRng(42),
    });
    const sorted = [...result].sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const gap = (sorted[i].scheduledFor.getTime() - sorted[i - 1].scheduledFor.getTime()) / 60000;
      expect(gap).toBeGreaterThanOrEqual(3 - 1e-6);
    }
  });

  test("never exceeds daily capacity", () => {
    const jobs: JitterJob[] = Array.from({ length: 10 }, (_, i) => ({ id: `j${i}`, accountId: "acct1" }));
    const result = scheduleWithJitter(jobs, REF_DATE, "America/New_York", 9, 18, {
      accountRemainingToday: { acct1: 3 }, accountDailyLimit: { acct1: 3 }, rng: seededRng(3),
    });
    const byDay = new Map<string, number>();
    for (const r of result) {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(r.scheduledFor);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    for (const count of byDay.values()) expect(count).toBeLessThanOrEqual(3);
    expect(result).toHaveLength(10);
  });

  test("overflow rolls to the next day", () => {
    const jobs: JitterJob[] = Array.from({ length: 4 }, (_, i) => ({ id: `j${i}`, accountId: "acct1" }));
    const result = scheduleWithJitter(jobs, REF_DATE, "America/New_York", 9, 18, {
      accountRemainingToday: { acct1: 1 }, accountDailyLimit: { acct1: 1 }, rng: seededRng(9),
    });
    const days = new Set(result.map((r) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(r.scheduledFor)));
    expect(days.size).toBe(4);
  });

  test("segmentByLeadTimezone buckets leads into their own local window", () => {
    const jobs: JitterJob[] = [
      { id: "ny1", accountId: "acct1", timezone: "America/New_York" },
      { id: "la1", accountId: "acct1", timezone: "America/Los_Angeles" },
    ];
    const result = scheduleWithJitter(jobs, REF_DATE, "America/New_York", 9, 18, {
      accountRemainingToday: { acct1: 10 }, accountDailyLimit: { acct1: 10 }, rng: seededRng(5),
    });
    const byId = new Map(result.map((r) => [r.jobId, r]));
    const nyHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(byId.get("ny1")!.scheduledFor));
    const laHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", hourCycle: "h23" }).format(byId.get("la1")!.scheduledFor));
    expect(nyHour).toBeGreaterThanOrEqual(9);
    expect(laHour).toBeGreaterThanOrEqual(9);
  });
});
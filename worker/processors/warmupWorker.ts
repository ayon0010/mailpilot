/* eslint-disable @typescript-eslint/no-explicit-any */
// worker/processors/warmupWorker.ts — part 1

import { generateWarmupContent } from "@/lib/contentGenerator";
import { getGmailClient, sendEmail, withGmailRetry } from "@/lib/gmailClient";
import { scheduleWithJitter } from "@/lib/jitter";
import { prisma } from "@/lib/prisma";
import { warmupSendQueue } from "@/lib/queues";

// [dayRangeStart, dayRangeEnd, minPerDay, maxPerDay]
const RAMP_SCHEDULE: Array<[number, number, number, number]> = [
  [1, 3, 2, 3],
  [4, 7, 5, 8],
  [8, 14, 10, 15],
  [15, 21, 15, 25],
];
const GRADUATION_DAY = 22;
const GRADUATED_DAILY_LIMIT = 25;
const MIN_POOL_SIZE = 10;
const PAIR_COOLDOWN_DAYS = 3;

function targetForDay(day: number): number {
  const bucket = RAMP_SCHEDULE.find(
    ([start, end]) => day >= start && day <= end,
  );
  if (!bucket) return 0;
  const [, , min, max] = bucket;
  return min + Math.floor(Math.random() * (max - min + 1));
}

export async function runWarmupDailyPlan(): Promise<void> {
  const pool = await prisma.gmailAccount.findMany({
    where: { warmupEnabled: true, status: { in: ["warming_up", "active"] } },
  });

  if (pool.length < MIN_POOL_SIZE) {
    console.warn(
      `Warmup pool is only ${pool.length} accounts (recommended: ${MIN_POOL_SIZE}+) — pairing variety will suffer`,
    );
  }
  if (pool.length < 2) {
    console.warn("Fewer than 2 warmup accounts — nothing to pair, skipping");
    return;
  }

  // Step 1: advance each account's day, graduate or set today's target.
  for (const account of pool) {
    const nextDay = account.warmupDay + 1;
    if (nextDay >= GRADUATION_DAY) {
      await prisma.gmailAccount.update({
        where: { id: account.id },
        data: {
          warmupEnabled: false,
          warmupGraduatedAt: new Date(),
          status: "active",
          dailyLimit: Math.max(account.dailyLimit, GRADUATED_DAILY_LIMIT),
          warmupDay: nextDay,
          warmupSendsToday: 0,
          warmupTargetToday: 0,
        },
      });
      console.log(`Account ${account.email} graduated from warmup`);
      continue;
    }
    const target = targetForDay(nextDay);
    await prisma.gmailAccount.update({
      where: { id: account.id },
      data: {
        warmupDay: nextDay,
        warmupSendsToday: 0,
        warmupTargetToday: target,
      },
    });
  }

  // Step 2: pair + schedule today's sends for anyone with a nonzero target.
  const activePool = await prisma.gmailAccount.findMany({
    where: {
      warmupEnabled: true,
      status: { in: ["warming_up", "active"] },
      warmupTargetToday: { gt: 0 },
    },
  });
  if (activePool.length < 2) return;

  const jitterJobs: { id: string; accountId: string }[] = [];
  for (const sender of activePool) {
    for (let i = 0; i < sender.warmupTargetToday; i++) {
      const recipient = await pickEligibleRecipient(sender.id, activePool);
      if (!recipient) {
        console.warn(
          `No eligible warmup recipient for ${sender.email} (pair cooldown exhausted)`,
        );
        continue;
      }
      const warmupJob = await prisma.warmupJob.create({
        data: {
          senderAccountId: sender.id,
          recipientAccountId: recipient.id,
          status: "queued",
          scheduledFor: new Date(),
        },
      });
      jitterJobs.push({ id: warmupJob.id, accountId: sender.id });
    }
  }
  if (jitterJobs.length === 0) return;

  const warmupTimezone = process.env.WARMUP_TIMEZONE || "America/New_York";
  const windowStart = Number(process.env.WARMUP_WINDOW_START ?? 9);
  const windowEnd = Number(process.env.WARMUP_WINDOW_END ?? 18);

  const remainingByAccount: Record<string, number> = {};
  for (const acct of activePool)
    remainingByAccount[acct.id] = acct.warmupTargetToday;

  const scheduled = scheduleWithJitter(
    jitterJobs,
    new Date(),
    warmupTimezone,
    windowStart,
    windowEnd,
    {
      accountRemainingToday: remainingByAccount,
      accountDailyLimit: remainingByAccount,
    },
  );

  for (const s of scheduled) {
    await prisma.warmupJob.update({
      where: { id: s.jobId },
      data: { scheduledFor: s.scheduledFor },
    });
    await warmupSendQueue().add(
      "warmup-send",
      { warmupJobId: s.jobId, kind: "initial" },
      {
        delay: Math.max(0, s.scheduledFor.getTime() - Date.now()),
        jobId: `warmup-${s.jobId}`,
      },
    );
  }
  console.log(`Warmup day planned: ${scheduled.length} sends scheduled`);
}

async function pickEligibleRecipient(
  senderId: string,
  pool: { id: string }[],
): Promise<{ id: string } | null> {
  const candidates = pool.filter((p) => p.id !== senderId);
  if (candidates.length === 0) return null;

  const cooldownSince = new Date(
    Date.now() - PAIR_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  );
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);

  for (const candidate of shuffled) {
    const recentPairSend = await prisma.warmupJob.findFirst({
      where: {
        OR: [
          { senderAccountId: senderId, recipientAccountId: candidate.id },
          { senderAccountId: candidate.id, recipientAccountId: senderId },
        ],
        createdAt: { gte: cooldownSince },
      },
    });
    if (!recentPairSend) return candidate;
  }
  return null;
}

// worker/processors/warmupWorker.ts — part 2, append to the same file

const SIMILARITY_HISTORY_SIZE = 20;

export interface WarmupSendJobPayload {
  warmupJobId: string;
  kind: "initial" | "reply" | "read_receipt" | "spam_rescue" | "engagement";
}

async function recentWarmupBodies(accountId: string): Promise<string[]> {
  const recent = await prisma.message.findMany({
    where: { accountId, label: "SENT" },
    orderBy: { internalDate: "desc" },
    take: SIMILARITY_HISTORY_SIZE,
    select: { snippet: true },
  });
  return recent.map((m) => m.snippet || "").filter(Boolean);
}
async function rescueFromSpam(warmupJob: any): Promise<void> {
  if (!warmupJob.gmailThreadId) return;
  try {
    const gmail = await getGmailClient(warmupJob.recipientAccountId);
    const thread = await withGmailRetry(() =>
      gmail.users.threads.get({
        userId: "me",
        id: warmupJob.gmailThreadId,
        format: "minimal",
      }),
    );
    const inSpam = (thread.data.messages || []).some((m: any) =>
      (m.labelIds || []).includes("SPAM"),
    );
    if (!inSpam) {
      console.log(
        `Thread ${warmupJob.gmailThreadId} not in spam, nothing to rescue`,
      );
      return;
    }
    const messageIds = (thread.data.messages || [])
      .map((m: any) => m.id)
      .filter(Boolean);
    await withGmailRetry(() =>
      gmail.users.messages.batchModify({
        userId: "me",
        requestBody: {
          ids: messageIds,
          removeLabelIds: ["SPAM"],
          addLabelIds: ["INBOX"],
        },
      }),
    );
    console.log(`Rescued thread ${warmupJob.gmailThreadId} from spam`);
  } catch (err: any) {
    console.error(`Spam rescue failed for ${warmupJob.id}:`, err?.message);
  }
}

// worker/processors/warmupWorker.ts — add this function

async function addEngagementSignal(warmupJob: any): Promise<void> {
  if (!warmupJob.gmailThreadId) return;
  try {
    const gmail = await getGmailClient(warmupJob.recipientAccountId);
    const thread = await withGmailRetry(() =>
      gmail.users.threads.get({
        userId: "me",
        id: warmupJob.gmailThreadId,
        format: "minimal",
      }),
    );
    const messageIds = (thread.data.messages || [])
      .map((m: any) => m.id)
      .filter(Boolean);
    if (messageIds.length > 0) {
      await withGmailRetry(() =>
        gmail.users.messages.batchModify({
          userId: "me",
          requestBody: { ids: messageIds, addLabelIds: ["STARRED"] },
        }),
      );
      console.log(`Starred thread ${warmupJob.gmailThreadId}`);
    }
  } catch (err: any) {
    console.error(
      `Engagement signal failed for ${warmupJob.id}:`,
      err?.message,
    );
  }
}

export async function processWarmupSend(job: {
  data: WarmupSendJobPayload;
}): Promise<void> {
  const warmupJob = await prisma.warmupJob.findUnique({
    where: { id: job.data.warmupJobId },
  });
  if (!warmupJob) return;

  const [sender, recipient] = await Promise.all([
    prisma.gmailAccount.findUniqueOrThrow({
      where: { id: warmupJob.senderAccountId },
    }),
    prisma.gmailAccount.findUniqueOrThrow({
      where: { id: warmupJob.recipientAccountId },
    }),
  ]);

  if (job.data.kind === "initial") {
    if (warmupJob.status !== "queued") return;
    try {
      const recentBodies = await recentWarmupBodies(warmupJob.senderAccountId);
      const content = await generateWarmupContent(recentBodies, {});

      const gmail = await getGmailClient(warmupJob.senderAccountId);
      const result = await sendEmail(gmail, {
        fromEmail: sender.email,
        toEmail: recipient.email,
        subject: content.subject,
        bodyText: content.body,
      });

      await prisma.$transaction([
        prisma.warmupJob.update({
          where: { id: warmupJob.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            gmailThreadId: result.threadId,
          },
        }),
        prisma.gmailAccount.update({
          where: { id: warmupJob.senderAccountId },
          data: { warmupSendsToday: { increment: 1 } },
        }),
      ]);
      console.log(`Warmup initial sent: ${sender.email} → ${recipient.email}`);

      // Chain: reply 30min-6hr later.
      const replyDelayMs = (30 + Math.random() * (360 - 30)) * 60 * 1000;
      await warmupSendQueue().add(
        "warmup-send",
        { warmupJobId: warmupJob.id, kind: "reply" },
        { delay: replyDelayMs, jobId: `warmup-reply-${warmupJob.id}` },
      );
    } catch (err: any) {
      console.error(
        `Warmup initial send failed for ${warmupJob.id}:`,
        err?.message,
      );
      await prisma.warmupJob.update({
        where: { id: warmupJob.id },
        data: { status: "failed" },
      });
    }
  } else if (job.data.kind === "reply") {
    if (!warmupJob.gmailThreadId) return;
    try {
      const recentBodies = await recentWarmupBodies(
        warmupJob.recipientAccountId,
      );
      const content = await generateWarmupContent(recentBodies, {});

      const gmail = await getGmailClient(warmupJob.recipientAccountId);
      await sendEmail(gmail, {
        fromEmail: recipient.email,
        toEmail: sender.email,
        subject: `Re: ${content.subject}`,
        bodyText: content.body,
        threadId: warmupJob.gmailThreadId,
      });

      await prisma.$transaction([
        prisma.warmupJob.update({
          where: { id: warmupJob.id },
          data: { repliedAt: new Date() },
        }),
        prisma.gmailAccount.update({
          where: { id: warmupJob.recipientAccountId },
          data: { warmupSendsToday: { increment: 1 } },
        }),
      ]);
      console.log(`Warmup reply sent: ${recipient.email} → ${sender.email}`);

      await warmupSendQueue().add(
        "warmup-send",
        { warmupJobId: warmupJob.id, kind: "read_receipt" },
        {
          delay: (2 + Math.random() * 8) * 60 * 1000,
          jobId: `warmup-read-${warmupJob.id}`,
        },
      );

      if (Math.random() < 0.075) {
        await warmupSendQueue().add(
          "warmup-send",
          { warmupJobId: warmupJob.id, kind: "spam_rescue" },
          { delay: 15 * 60 * 1000, jobId: `warmup-spamrescue-${warmupJob.id}` },
        );
      }
      if (Math.random() < 0.1) {
        await warmupSendQueue().add(
          "warmup-send",
          { warmupJobId: warmupJob.id, kind: "engagement" },
          { delay: 20 * 60 * 1000, jobId: `warmup-engage-${warmupJob.id}` },
        );
      }
    } catch (err: any) {
      console.error(`Warmup reply failed for ${warmupJob.id}:`, err?.message);
    }
  } else if (job.data.kind === "read_receipt") {
    if (!warmupJob.gmailThreadId) return;
    try {
      const gmail = await getGmailClient(warmupJob.senderAccountId);
      const thread = await withGmailRetry(() =>
        gmail.users.threads.get({
          userId: "me",
          id: warmupJob.gmailThreadId!,
          format: "minimal",
        }),
      );
      const messageIds = (thread.data.messages || [])
        .map((m) => m.id!)
        .filter(Boolean);
      if (messageIds.length > 0) {
        await withGmailRetry(() =>
          gmail.users.messages.batchModify({
            userId: "me",
            requestBody: { ids: messageIds, removeLabelIds: ["UNREAD"] },
          }),
        );
      }
      console.log(`Warmup thread marked read for ${sender.email}`);
    } catch (err: any) {
      console.error(
        `Warmup read-receipt failed for ${warmupJob.id}:`,
        err?.message,
      );
    }
  } else if (job.data.kind === "spam_rescue") {
    await rescueFromSpam(warmupJob);
  } else if (job.data.kind === "engagement") {
    await addEngagementSignal(warmupJob);
  }
}

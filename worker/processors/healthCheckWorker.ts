/* eslint-disable @typescript-eslint/no-explicit-any */
// worker/processors/healthCheckWorker.ts

import { prisma } from "@/lib/prisma";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const BOUNCE_RATE_THRESHOLD = Number(
  process.env.AUTO_PAUSE_BOUNCE_RATE ?? 0.03,
); // 3%
const BOUNCE_RATE_MIN_SENDS = Number(
  process.env.AUTO_PAUSE_BOUNCE_MIN_SENDS ?? 20,
);
const REPLY_RATE_FLOOR = Number(
  process.env.AUTO_PAUSE_REPLY_RATE_FLOOR ?? 0.01,
); // 1%
const REPLY_RATE_MIN_SENDS = Number(
  process.env.AUTO_PAUSE_REPLY_MIN_SENDS ?? 30,
);

/**
 * Best-effort: only catches hard bounces that land back in the sending
 * account's own inbox from a mail-delivery-subsystem address. Recipient-side
 * spam-foldering isn't detectable via the Gmail API from the sender's side.
 */
async function detectNewBounces(accountId: string): Promise<number> {
  const bounceMessages = await prisma.message.findMany({
    where: {
      accountId,
      label: "INBOX",
      internalDate: { gte: new Date(Date.now() - SEVEN_DAYS_MS) },
      OR: [
        { fromEmail: { contains: "mailer-daemon", mode: "insensitive" } },
        { fromEmail: { contains: "postmaster", mode: "insensitive" } },
      ],
    },
  });
  if (bounceMessages.length === 0) return 0;

  const candidateSendJobs = await prisma.sendJob.findMany({
    where: {
      accountId,
      status: "sent",
      sentAt: { gte: new Date(Date.now() - SEVEN_DAYS_MS) },
    },
    include: { lead: true },
  });

  let newBounces = 0;
  for (const msg of bounceMessages) {
    const snippet = msg.snippet?.toLowerCase() || "";
    if (!snippet) continue;
    // Bounce notifications typically quote the original recipient address.
    const match = candidateSendJobs.find(
      (sj) =>
        sj.lead.status !== "bounced" &&
        snippet.includes(sj.lead.email.toLowerCase()),
    );
    if (match) {
      await prisma.lead.update({
        where: { id: match.leadId },
        data: { status: "bounced" },
      });
      match.lead.status = "bounced"; // avoid double-counting within this run
      newBounces += 1;
    }
  }
  if (newBounces > 0) {
    await prisma.gmailAccount.update({
      where: { id: accountId },
      data: { bounceCount: { increment: newBounces } },
    });
  }
  return newBounces;
}

async function computeRolling7d(
  accountId: string,
): Promise<{ sent: number; replied: number; bounced: number }> {
  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const [sent, replied, bounced] = await Promise.all([
    prisma.sendJob.count({
      where: { accountId, status: "sent", sentAt: { gte: since } },
    }),
    prisma.lead.count({
      where: {
        status: "replied",
        sendJobs: { some: { accountId, sentAt: { gte: since } } },
      },
    }),
    prisma.lead.count({
      where: {
        status: "bounced",
        sendJobs: { some: { accountId, sentAt: { gte: since } } },
      },
    }),
  ]);
  return { sent, replied, bounced };
}

async function pauseAccount(
  accountId: string,
  reason: string,
  metrics: Record<string, unknown>,
): Promise<void> {
  const account = await prisma.gmailAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  if (account.status === "paused") return;

  await prisma.$transaction([
    prisma.gmailAccount.update({
      where: { id: accountId },
      data: { status: "paused", pausedReason: reason, pausedAt: new Date() },
    }),
    prisma.accountStatusLog.create({
      data: {
        accountId,
        fromStatus: account.status,
        toStatus: "paused",
        reason,
        metricsSnapshot: JSON.stringify(metrics),
      },
    }),
  ]);
  console.warn(`Account ${accountId} auto-paused: ${reason}`, metrics);
  await reassignQueuedJobs(accountId);
}

/** Reassign a newly-paused account's queued jobs to another active account
 * with spare capacity; leave 'queued' with a console alert if none available. */
async function reassignQueuedJobs(pausedAccountId: string): Promise<void> {
  const queuedJobs = await prisma.sendJob.findMany({
    where: { accountId: pausedAccountId, status: "queued" },
  });

  for (const sendJob of queuedJobs) {
    const candidates = await prisma.gmailAccount.findMany({
      where: { status: "active", id: { not: pausedAccountId } },
    });
    const withCapacity = candidates.filter((c) => c.sentToday < c.dailyLimit);
    const replacement = withCapacity[0]; // simplest viable pick; refine later if you want per-campaign allocation awareness

    if (replacement) {
      await prisma.sendJob.update({
        where: { id: sendJob.id },
        data: { accountId: replacement.id },
      });
      console.log(
        `Reassigned SendJob ${sendJob.id} from ${pausedAccountId} to ${replacement.id}`,
      );
    } else {
      console.warn(
        `SendJob ${sendJob.id} has no replacement account with capacity — left queued, needs manual attention`,
      );
    }
  }
}

export async function runHealthCheck(): Promise<void> {
  const accounts = await prisma.gmailAccount.findMany({
    where: { status: { in: ["active", "warming_up"] } },
  });

  for (const account of accounts) {
    try {
      await detectNewBounces(account.id);
      const { sent, replied, bounced } = await computeRolling7d(account.id);
      await prisma.gmailAccount.update({
        where: { id: account.id },
        data: { sentCount7d: sent, replyCount7d: replied },
      });

      if (sent === 0) continue;
      const bounceRate = bounced / sent;
      const replyRate = replied / sent;

      if (account.complaintCount > 0) {
        await pauseAccount(account.id, "spam_complaint", {
          sent,
          replied,
          bounced,
          complaintCount: account.complaintCount,
        });
        continue;
      }
      if (sent >= BOUNCE_RATE_MIN_SENDS && bounceRate > BOUNCE_RATE_THRESHOLD) {
        await pauseAccount(account.id, "high_bounce_rate", {
          sent,
          bounced,
          bounceRate,
        });
        continue;
      }
      if (sent >= REPLY_RATE_MIN_SENDS && replyRate < REPLY_RATE_FLOOR) {
        await pauseAccount(account.id, "low_engagement", {
          sent,
          replied,
          replyRate,
        });
        continue;
      }
    } catch (err: any) {
      console.error(
        `Health check failed for account ${account.id}:`,
        err?.message,
      );
    }
  }
}

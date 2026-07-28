// lib/scheduleNewLeads.ts

import { scheduleWithJitter } from "./jitter";
import { prisma } from "./prisma";
import { sendQueue } from "./queues";



export async function scheduleNewLeads(
  campaignId: string,
): Promise<{ scheduled: number; skipped: string | null }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new Error("Campaign not found");
  if (!campaign.subjectTemplate || !campaign.bodyTemplate) {
    return { scheduled: 0, skipped: "Subject/body templates not set" };
  }

  // Leads that exist but have never had an initial SendJob created for them.
  const unscheduledLeads = await prisma.lead.findMany({
    where: {
      campaignId,
      status: "pending",
      sendJobs: { none: { step: "initial" } },
    },
  });
  if (unscheduledLeads.length === 0)
    return { scheduled: 0, skipped: "No new pending leads" };

  const activeAccounts = await prisma.gmailAccount.findMany({
    where: { status: "active" },
  });
  if (activeAccounts.length === 0)
    return { scheduled: 0, skipped: "No active accounts available" };

  // Round-robin the new leads across active accounts, evenly.
  const leadsByAccount = new Map<string, typeof unscheduledLeads>();
  activeAccounts.forEach((a) => leadsByAccount.set(a.id, []));
  unscheduledLeads.forEach((lead, i) => {
    const account = activeAccounts[i % activeAccounts.length];
    leadsByAccount.get(account.id)!.push(lead);
  });

  const jitterJobs: { id: string; accountId: string; timezone?: string }[] = [];
  const accountRemainingToday: Record<string, number> = {};
  const accountDailyLimit: Record<string, number> = {};

  for (const account of activeAccounts) {
    accountRemainingToday[account.id] = Math.max(
      0,
      account.dailyLimit - account.sentToday,
    );
    accountDailyLimit[account.id] = account.dailyLimit;

    const leadsForThisAccount = leadsByAccount.get(account.id)!;
    for (const lead of leadsForThisAccount) {
      const sendJob = await prisma.sendJob.create({
        data: {
          leadId: lead.id,
          accountId: account.id,
          campaignId,
          step: "initial",
          status: "queued",
          scheduledFor: new Date(), // placeholder, overwritten below
        },
      });
      jitterJobs.push({
        id: sendJob.id,
        accountId: account.id,
        timezone: campaign.segmentByLeadTimezone
          ? lead.timezone || undefined
          : undefined,
      });
    }
  }

  const scheduled = scheduleWithJitter(
    jitterJobs,
    new Date(),
    campaign.targetTimezone,
    campaign.sendWindowStart,
    campaign.sendWindowEnd,
    { now: new Date(), accountRemainingToday, accountDailyLimit },
  );

  const queue = sendQueue();
  for (const s of scheduled) {
    await prisma.sendJob.update({
      where: { id: s.jobId },
      data: { scheduledFor: s.scheduledFor },
    });
    await queue.add(
      "send",
      { sendJobId: s.jobId },
      {
        delay: Math.max(0, s.scheduledFor.getTime() - Date.now()),
        jobId: `send-${s.jobId}`,
      },
    );
  }

  if (campaign.status === "draft") {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "active" },
    });
  }

  return { scheduled: scheduled.length, skipped: null };
}

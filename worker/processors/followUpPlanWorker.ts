/* eslint-disable @typescript-eslint/no-explicit-any */
// worker/processors/followUpPlanWorker.ts
import { getGmailClient, threadHasReplyFrom } from "@/lib/gmailClient";
import { scheduleWithJitter } from "@/lib/jitter";
import { prisma } from "@/lib/prisma";
import { sendQueue } from "@/lib/queues";
import { Job } from "bullmq";
export interface FollowUpPlanPayload {
  initialSendJobId: string;
}

export async function processFollowUpPlan(
  job: Job<FollowUpPlanPayload>,
): Promise<void> {
  const initial = await prisma.sendJob.findUnique({
    where: { id: job.data.initialSendJobId },
  });
  if (!initial || initial.status !== "sent" || !initial.gmailThreadId) {
    console.warn(
      `Initial send ${job.data.initialSendJobId} not found/not sent, skipping follow-up plan`,
    );
    return;
  }

  const lead = await prisma.lead.findUnique({ where: { id: initial.leadId } });
  if (!lead || lead.status === "replied" || lead.status === "bounced") {
    console.log(
      `Lead ${lead?.email} already replied/bounced, skipping follow-up`,
    );
    return;
  }

  // First reply check (the second happens in sendWorker right before send).
  try {
    const gmail = await getGmailClient(initial.accountId);
    const replied = await threadHasReplyFrom(
      gmail,
      initial.gmailThreadId,
      lead.email,
    );
    if (replied) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "replied" },
      });
      console.log(
        `Lead ${lead.email} replied before follow-up planning, skipping`,
      );
      return;
    }
  } catch (err: any) {
    console.warn(
      `Reply check failed during follow-up planning: ${err?.message} — proceeding anyway`,
    );
  }

  const account = await prisma.gmailAccount.findUniqueOrThrow({
    where: { id: initial.accountId },
  });
  if (account.status !== "active" && account.status !== "warming_up") {
    console.warn(
      `Account ${account.id} no longer active — follow-up left unscheduled`,
    );
    return;
  }

  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: initial.campaignId },
  });
  const remainingToday = Math.max(0, account.dailyLimit - account.sentToday);

  const [scheduled] = scheduleWithJitter(
    [{ id: lead.id, accountId: account.id }],
    new Date(),
    campaign.targetTimezone,
    campaign.sendWindowStart,
    campaign.sendWindowEnd,
    {
      now: new Date(),
      accountRemainingToday: { [account.id]: remainingToday },
      accountDailyLimit: { [account.id]: account.dailyLimit },
    },
  );

  const followUpJob = await prisma.sendJob.create({
    data: {
      leadId: lead.id,
      accountId: account.id,
      campaignId: initial.campaignId,
      step: "follow_up",
      status: "queued",
      scheduledFor: scheduled.scheduledFor,
    },
  });

  await sendQueue().add(
    "send",
    { sendJobId: followUpJob.id },
    {
      delay: Math.max(0, scheduled.scheduledFor.getTime() - Date.now()),
      jobId: `send-${followUpJob.id}`,
    },
  );

  console.log(
    `Follow-up scheduled: SendJob ${followUpJob.id} for ${scheduled.scheduledFor.toISOString()}`,
  );
}

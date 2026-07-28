/* eslint-disable @typescript-eslint/no-explicit-any */
// worker/processors/sendWorker.ts — full replacement
import {
  getGmailClient,
  sendEmail,
  threadHasReplyFrom,
  withGmailRetry,
} from "@/lib/gmailClient";
import { prisma } from "@/lib/prisma";
import { followUpQueue, SendJobPayload } from "@/lib/queues";
import { Job } from "bullmq";

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, "");
}

function renderTemplate(template: string, fields: Record<string, any>): string {
  const normalizedFields = new Map<string, any>();
  for (const [k, v] of Object.entries(fields || {})) {
    normalizedFields.set(normalizeKey(k), v);
  }
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key) => {
    const value = normalizedFields.get(normalizeKey(key));
    return value === undefined || value === null || value === ""
      ? ""
      : String(value);
  });
}

async function getRfcMessageId(
  gmail: any,
  messageId: string,
  accountId: string,
): Promise<string | undefined> {
  const res = await withGmailRetry(
    () =>
      gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: ["Message-Id"],
      }),
    { accountId },
  );
  // Match case-insensitively too, since header casing can vary by client/relay.
  return res.data.payload?.headers?.find(
    (h: any) => h.name?.toLowerCase() === "message-id",
  )?.value;
}

export async function processSendJob(job: Job<SendJobPayload>): Promise<void> {
  const sendJob = await prisma.sendJob.findUnique({
    where: { id: job.data.sendJobId },
  });
  if (!sendJob) {
    console.warn(`SendJob ${job.data.sendJobId} not found, skipping`);
    return;
  }
  if (sendJob.status !== "queued") {
    console.log(`SendJob ${sendJob.id} is ${sendJob.status}, skipping`);
    return;
  }

  const [lead, account, campaign] = await Promise.all([
    prisma.lead.findUniqueOrThrow({ where: { id: sendJob.leadId } }),
    prisma.gmailAccount.findUniqueOrThrow({ where: { id: sendJob.accountId } }),
    prisma.campaign.findUniqueOrThrow({ where: { id: sendJob.campaignId } }),
  ]);

  if (account.status !== "active" && account.status !== "warming_up") {
    console.log(
      `Account ${account.id} is ${account.status}, leaving job queued`,
    );
    return;
  }
  if (account.sentToday >= account.dailyLimit) {
    console.warn(`Account ${account.id} hit its daily limit, deferring 24h`);
    await job.moveToDelayed(Date.now() + 24 * 60 * 60 * 1000);
    return;
  }

  const isFollowUp = sendJob.step === "follow_up";

  // Find the initial send for this lead — used for threading, and for the
  // reply re-check right before sending (the second of the two reply checks).
  let priorSend: {
    gmailThreadId: string | null;
    gmailMessageId: string | null;
    rfcMessageId?: string | null;
  } | null = null;
  if (isFollowUp) {
    priorSend = await prisma.sendJob.findFirst({
      where: { leadId: sendJob.leadId, step: "initial", status: "sent" },
    });
    if (priorSend?.gmailThreadId) {
      const gmail = await getGmailClient(account.id);
      const replied = await threadHasReplyFrom(
        gmail,
        priorSend.gmailThreadId,
        lead.email,
      );
      if (replied) {
        await prisma.$transaction([
          prisma.sendJob.update({
            where: { id: sendJob.id },
            data: { status: "skipped" },
          }),
          prisma.lead.update({
            where: { id: lead.id },
            data: { status: "replied" },
          }),
        ]);
        console.log(
          `Lead ${lead.email} replied before follow-up fired, skipped`,
        );
        return;
      }
    }
  }

  const fields = {
    ...(lead.fields as Record<string, any>),
    "sender name": account.displayName || account.email, // available as {{sender name}}
  };
  const subject = isFollowUp
    ? renderTemplate(
        campaign.followUpSubjectTemplate || campaign.subjectTemplate,
        fields,
      )
    : renderTemplate(campaign.subjectTemplate, fields);
  const body = isFollowUp
    ? renderTemplate(
        campaign.followUpBodyTemplate || campaign.bodyTemplate,
        fields,
      )
    : renderTemplate(campaign.bodyTemplate, fields);

  try {
    const gmail = await getGmailClient(account.id);

    // For a follow-up, fetch the RFC Message-ID off the original send so we
    // can thread correctly via In-Reply-To/References.
    let inReplyToMessageId: string | undefined;
    if (isFollowUp && priorSend?.gmailMessageId) {
      inReplyToMessageId = await getRfcMessageId(
        gmail,
        priorSend.gmailMessageId,
        account.id,
      );
      if (!inReplyToMessageId) {
        console.warn(
          `Could not resolve Message-Id for prior send ${priorSend.gmailMessageId} — follow-up will send without proper threading headers`,
        );
      }
    }

    const result = await sendEmail(gmail, {
      fromEmail: account.displayName
        ? `"${account.displayName}" <${account.email}>`
        : account.email,
      toEmail: lead.email,
      subject:
        isFollowUp && !subject.startsWith("Re:") ? `Re: ${subject}` : subject,
      bodyText: body,
      threadId: priorSend?.gmailThreadId || undefined,
      inReplyToMessageId,
    });

    await prisma.$transaction([
      prisma.sendJob.update({
        where: { id: sendJob.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          gmailThreadId: result.threadId,
          gmailMessageId: result.id,
        },
      }),
      prisma.gmailAccount.update({
        where: { id: account.id },
        data: { sentToday: { increment: 1 } },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: { status: isFollowUp ? "followed_up" : "sent" },
      }),
    ]);

    console.log(
      `Sent (${sendJob.step}): SendJob ${sendJob.id} → ${lead.email}`,
    );

    if (!isFollowUp) {
      // Enqueue the follow-up PLAN for followUpDays later. This does NOT
      // pick the exact send time yet — that happens in followUpPlanWorker,
      // using scheduleWithJitter, once the delay elapses.
      const delayMs = campaign.followUpDays * 24 * 60 * 60 * 1000;
      await followUpQueue().add(
        "plan-follow-up",
        { initialSendJobId: sendJob.id },
        { delay: delayMs, jobId: `followup-plan-${sendJob.id}` },
      );
    }
  } catch (err: any) {
    console.error(`Send failed for SendJob ${sendJob.id}:`, err?.message);
    await prisma.sendJob.update({
      where: { id: sendJob.id },
      data: { status: "failed", error: String(err?.message || err) },
    });
    throw err;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// worker/processors/sendWorker.ts
import { getGmailClient, withGmailRetry } from "@/lib/gmailClient";
import { prisma } from "@/lib/prisma";
import { SendJobPayload } from "@/lib/queues";
import { Job } from "bullmq";


function renderTemplate(template: string, fields: Record<string, any>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = fields?.[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
    console.log(
      `SendJob ${sendJob.id} is ${sendJob.status}, not queued — skipping`,
    );
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

  const fields = lead.fields as Record<string, any>;
  const subject = renderTemplate(campaign.subjectTemplate, fields);
  const body = renderTemplate(campaign.bodyTemplate, fields);

  try {
    const gmail = await getGmailClient(account.id);

    const headers = [
      `From: ${account.email}`,
      `To: ${lead.email}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
    ];
    const raw = base64UrlEncode(`${headers.join("\r\n")}\r\n\r\n${body}`);

    const res = await withGmailRetry(
      () => gmail.users.messages.send({ userId: "me", requestBody: { raw } }),
      { accountId: account.id },
    );

    await prisma.$transaction([
      prisma.sendJob.update({
        where: { id: sendJob.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          gmailThreadId: res.data.threadId || undefined,
          gmailMessageId: res.data.id || undefined,
        },
      }),
      prisma.gmailAccount.update({
        where: { id: account.id },
        data: { sentToday: { increment: 1 } },
      }),
      prisma.lead.update({ where: { id: lead.id }, data: { status: "sent" } }),
    ]);

    console.log(`Sent: SendJob ${sendJob.id} → ${lead.email}`);

    // NOTE: follow-up scheduling isn't wired in yet — that's Phase 5.
    // For now, a successful initial send just ends here.
  } catch (err: any) {
    console.error(`Send failed for SendJob ${sendJob.id}:`, err?.message);
    await prisma.sendJob.update({
      where: { id: sendJob.id },
      data: { status: "failed", error: String(err?.message || err) },
    });
    throw err; // lets BullMQ's retry/backoff kick in
  }
}

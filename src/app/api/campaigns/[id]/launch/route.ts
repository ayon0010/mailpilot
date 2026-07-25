// app/api/campaigns/[id]/launch/route.ts
import { scheduleWithJitter } from "@/lib/jitter";
import { prisma } from "@/lib/prisma";
import { sendQueue } from "@/lib/queues";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const launchSchema = z.object({
  accountAllocations: z.array(
    z.object({ accountId: z.string(), allocated: z.number().int().positive() }),
  ),
  startAt: z.string().datetime().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = launchSchema.safeParse(await req.json());
  const { id } = await params;
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const campaign = await prisma.campaign.findUnique({
    where: { id: id },
    include: { leads: { where: { status: "pending" } } },
  });
  if (!campaign)
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: `Campaign is already ${campaign.status}` },
      { status: 400 },
    );
  }
  if (!campaign.subjectTemplate || !campaign.bodyTemplate) {
    return NextResponse.json(
      { error: "Subject and body templates must be set before launch" },
      { status: 400 },
    );
  }
  if (campaign.leads.length === 0) {
    return NextResponse.json(
      { error: "No pending leads — upload leads first" },
      { status: 400 },
    );
  }

  const accountIds = parsed.data.accountAllocations.map((a) => a.accountId);
  const accounts = await prisma.gmailAccount.findMany({
    where: { id: { in: accountIds } },
  });

  const inactive = accounts.filter((a) => a.status !== "active");
  if (inactive.length > 0) {
    return NextResponse.json(
      {
        error: "Some selected accounts are not active",
        accounts: inactive.map((a) => ({ id: a.id, status: a.status })),
      },
      { status: 400 },
    );
  }

  const totalAllocated = parsed.data.accountAllocations.reduce(
    (sum, a) => sum + a.allocated,
    0,
  );
  if (totalAllocated > campaign.leads.length) {
    return NextResponse.json(
      {
        error: `Allocated send count (${totalAllocated}) exceeds available leads (${campaign.leads.length})`,
      },
      { status: 400 },
    );
  }

  const startAt = parsed.data.startAt
    ? new Date(parsed.data.startAt)
    : new Date();

  // Persist the allocation for the record (also lets the dashboard show
  // "used X of Y" per account later).
  await prisma.campaignAccountAllocation.createMany({
    data: parsed.data.accountAllocations.map((a) => ({
      campaignId: campaign.id,
      accountId: a.accountId,
      allocated: a.allocated,
    })),
  });

  // Distribute leads across accounts per their allocation, in order.
  let leadCursor = 0;
  const jitterJobs: { id: string; accountId: string }[] = [];
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  for (const alloc of parsed.data.accountAllocations) {
    const leadsForAccount = campaign.leads.slice(
      leadCursor,
      leadCursor + alloc.allocated,
    );
    leadCursor += alloc.allocated;

    for (const lead of leadsForAccount) {
      const sendJob = await prisma.sendJob.create({
        data: {
          leadId: lead.id,
          accountId: alloc.accountId,
          campaignId: campaign.id,
          step: "initial",
          status: "queued",
          scheduledFor: startAt, // placeholder, overwritten below
        },
      });
      jitterJobs.push({ id: sendJob.id, accountId: alloc.accountId });
    }
  }

  const accountRemainingToday: Record<string, number> = {};
  const accountDailyLimit: Record<string, number> = {};
  for (const alloc of parsed.data.accountAllocations) {
    const account = accountMap.get(alloc.accountId)!;
    accountRemainingToday[alloc.accountId] = Math.max(
      0,
      Math.min(alloc.allocated, account.dailyLimit - account.sentToday),
    );
    accountDailyLimit[alloc.accountId] = account.dailyLimit;
  }

  const scheduled = scheduleWithJitter(
    jitterJobs,
    startAt,
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

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "active", startAt },
  });

  return NextResponse.json({ scheduledJobs: scheduled.length });
}

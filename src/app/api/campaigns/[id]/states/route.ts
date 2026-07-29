// app/api/campaigns/[id]/stats/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [recipientCount, statusCounts, stepCounts] = await Promise.all([
    // Distinct leads = actual recipients targeted by this campaign
    prisma.lead.count({ where: { campaignId: id } }),

    // Counts grouped by SendJob status
    prisma.sendJob.groupBy({
      by: ["status"],
      where: { campaignId: id },
      _count: { _all: true },
    }),

    // Counts grouped by step (initial vs follow-up), useful to see how many
    // follow-ups have gone out vs how many are still pending
    prisma.sendJob.groupBy({
      by: ["step", "status"],
      where: { campaignId: id },
      _count: { _all: true },
    }),
  ]);

  const byStatus: Record<string, number> = {
    queued: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    cancelled: 0,
  };
  for (const row of statusCounts) {
    byStatus[row.status] = row._count._all;
  }

  return NextResponse.json({
    recipientCount,
    sent: byStatus.sent,
    queued: byStatus.queued,
    failed: byStatus.failed,
    skipped: byStatus.skipped,
    cancelled: byStatus.cancelled,
    byStep: stepCounts, // [{ step: "initial", status: "sent", _count: { _all: 340 } }, ...]
  });
}

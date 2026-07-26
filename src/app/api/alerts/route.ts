// app/api/alerts/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const pausedAccounts = await prisma.gmailAccount.findMany({
    where: { status: { in: ["paused", "suspended_by_provider"] } },
    orderBy: { pausedAt: "desc" },
  });
  const orphanedJobs = await prisma.sendJob.findMany({
    where: {
      status: "queued",
      account: { status: { notIn: ["active", "warming_up"] } },
    },
    include: {
      account: { select: { email: true, status: true } },
      lead: { select: { email: true } },
    },
  });
  return NextResponse.json({ pausedAccounts, orphanedJobs });
}

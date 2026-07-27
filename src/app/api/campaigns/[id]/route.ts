import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { _count: { select: { leads: true, sendJobs: true } } },
  });
  if (!campaign)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

// app/api/campaigns/route.ts
import { prisma } from "@/lib/prisma";
import { createSchema } from "@/schemas/campaign";
import { NextRequest, NextResponse } from "next/server";




// app/api/campaigns/route.ts — add a GET alongside your existing POST
export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true, sendJobs: true } } },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const data = parsed.data;
  
  if (data.sendWindowStart >= data.sendWindowEnd) {
    return NextResponse.json(
      { error: "sendWindowStart must be before sendWindowEnd" },
      { status: 400 },
    );
  }

  const campaign = await prisma.campaign.create({
    data: { ...data, status: "draft" },
  });
  return NextResponse.json({ campaign }, { status: 201 });
}

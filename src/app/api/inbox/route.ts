// app/api/inbox/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";


export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId"); // omit for unified view
  const label = (
    req.nextUrl.searchParams.get("label") || "INBOX"
  ).toUpperCase();

  const messages = await prisma.message.findMany({
    where: { label, ...(accountId ? { accountId } : {}) },
    orderBy: { internalDate: "desc" },
    take: 50,
    include: { account: { select: { email: true } } },
  });
  return NextResponse.json({ messages });
}

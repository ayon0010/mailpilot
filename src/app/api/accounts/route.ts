// app/api/accounts/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";


export async function GET() {
  const accounts = await prisma.gmailAccount.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      status: true,
      dailyLimit: true,
      sentToday: true,
      warmupEnabled: true,
      warmupDay: true,
      warmupTargetToday: true,
      bounceCount: true,
      sentCount7d: true,
      replyCount7d: true,
      pausedReason: true,
      pausedAt: true,
      // refreshToken/accessToken deliberately excluded
    },
  });
  return NextResponse.json({ accounts });
}

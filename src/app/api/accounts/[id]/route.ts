// app/api/accounts/[id]/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// app/api/accounts/[id]/route.ts
const patchSchema = z.object({
  dailyLimit: z.number().int().positive().optional(),
  status: z.enum(["active", "paused"]).optional(),
  displayName: z.string().optional(), // ← add this
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const account = await prisma.gmailAccount.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ account });
}

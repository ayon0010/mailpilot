// app/api/auth/gmail/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/gmailClient";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const state = crypto.randomBytes(16).toString("hex");
  return NextResponse.redirect(buildAuthUrl(state));
}

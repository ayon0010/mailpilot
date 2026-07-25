/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/auth/gmail/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  storeEncryptedRefreshToken,
} from "@/lib/gmailClient";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  if (error) return NextResponse.redirect(new URL(`/?error=${error}`, req.url));
  if (!code)
    return NextResponse.redirect(new URL("/?error=missing_code", req.url));

  try {
    const { tokens, email } = await exchangeCodeForTokens(code);
    const encryptedRefreshToken = storeEncryptedRefreshToken(
      tokens.refresh_token!,
    );

    await prisma.gmailAccount.upsert({
      where: { email },
      update: {
        refreshToken: encryptedRefreshToken,
        accessToken: tokens.access_token || undefined,
        tokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
      },
      create: {
        email,
        refreshToken: encryptedRefreshToken,
        accessToken: tokens.access_token || undefined,
        tokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
        status: "warming_up",
        warmupEnabled: true,
      },
    });

    return NextResponse.redirect(new URL("/?connected=1", req.url));
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(
        `/?error=${encodeURIComponent(err?.message || "oauth_failed")}`,
        req.url,
      ),
    );
  }
}

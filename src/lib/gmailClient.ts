/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/gmailClient.ts
import { google, gmail_v1 } from "googleapis";
import { encrypt, decrypt } from "./encryption";
import { prisma } from "./prisma";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function buildAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token even on re-connect
    scope: GMAIL_SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh_token returned. If you've connected this account before, revoke access at https://myaccount.google.com/permissions and retry.",
    );
  }
  client.setCredentials(tokens);

  // Use Gmail's own profile endpoint instead of the separate userinfo API —
  // it's covered by the gmail.readonly scope we already request, so there's
  // no extra scope to add or consent screen line item to worry about.
  const gmail = google.gmail({ version: "v1", auth: client });
  const { data: profile } = await gmail.users.getProfile({ userId: "me" });
  if (!profile.emailAddress)
    throw new Error("Gmail API did not return an email address");

  return { tokens, email: profile.emailAddress };
}

// export async function exchangeCodeForTokens(code: string) {
//   const client = getOAuthClient();
//   const { tokens } = await client.getToken(code);

//   // TEMP diagnostic — remove once working
//   console.log("=== Token exchange result ===");
//   console.log("has access_token:", !!tokens.access_token);
//   console.log("has refresh_token:", !!tokens.refresh_token);
//   console.log("scope:", tokens.scope);

//   if (!tokens.refresh_token) {
//     throw new Error("No refresh_token returned...");
//   }
//   client.setCredentials(tokens);

//   const gmail = google.gmail({ version: "v1", auth: client });
//   const { data: profile } = await gmail.users.getProfile({ userId: "me" });
//   if (!profile.emailAddress)
//     throw new Error("Gmail API did not return an email address");

//   return { tokens, email: profile.emailAddress };
// }

/**
 * THE single entry point for authenticated Gmail access. Every Gmail call
 * anywhere in the codebase goes through this.
 */
export async function getGmailClient(
  accountId: string,
): Promise<gmail_v1.Gmail> {
  const account = await prisma.gmailAccount.findUniqueOrThrow({
    where: { id: accountId },
  });

  const client = getOAuthClient();
  const refreshToken = decrypt(account.refreshToken);
  client.setCredentials({
    refresh_token: refreshToken,
    access_token: account.accessToken || undefined,
    expiry_date: account.tokenExpiry
      ? account.tokenExpiry.getTime()
      : undefined,
  });

  const needsRefresh =
    !account.accessToken ||
    !account.tokenExpiry ||
    account.tokenExpiry.getTime() < Date.now() + 60_000;

  if (needsRefresh) {
    try {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);
      await prisma.gmailAccount.update({
        where: { id: accountId },
        data: {
          accessToken: credentials.access_token || undefined,
          tokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : undefined,
        },
      });
    } catch (err: any) {
      if (isPermanentAuthError(err))
        await flagPermanentAuthFailure(accountId, err?.message);
      throw err;
    }
  }

  return google.gmail({ version: "v1", auth: client });
}

// lib/gmailClient.ts — add these

export async function threadHasReplyFrom(
  gmail: gmail_v1.Gmail,
  threadId: string,
  leadEmail: string,
): Promise<boolean> {
  const res = await withGmailRetry(() =>
    gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: ["From"],
    }),
  );
  const messages = res.data.messages || [];
  return messages.some((m) =>
    (m.payload?.headers || []).some(
      (h) =>
        h.name === "From" &&
        h.value?.toLowerCase().includes(leadEmail.toLowerCase()),
    ),
  );
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface SendEmailParams {
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  inReplyToMessageId?: string; // RFC Message-ID header, e.g. "<abc@mail.gmail.com>"
  threadId?: string;
}

export async function sendEmail(
  gmail: gmail_v1.Gmail,
  params: SendEmailParams,
): Promise<{ id: string; threadId: string }> {
  const headers = [
    `From: ${params.fromEmail}`,
    `To: ${params.toEmail}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
  ];
  if (params.inReplyToMessageId) {
    headers.push(`In-Reply-To: ${params.inReplyToMessageId}`);
    headers.push(`References: ${params.inReplyToMessageId}`);
  }
  const raw = base64UrlEncode(
    `${headers.join("\r\n")}\r\n\r\n${params.bodyText}`,
  );

  const res = await withGmailRetry(() =>
    gmail.users.messages.send({
      userId: "me",
      requestBody: { raw, threadId: params.threadId },
    }),
  );
  if (!res.data.id || !res.data.threadId)
    throw new Error("Gmail send did not return id/threadId");
  return { id: res.data.id, threadId: res.data.threadId };
}
export function isPermanentAuthError(err: any): boolean {
  const code = err?.code || err?.response?.status;
  const reason = err?.response?.data?.error || err?.message || "";
  return code === 401 || /invalid_grant/i.test(String(reason));
}

export async function flagPermanentAuthFailure(
  accountId: string,
  reason?: string,
): Promise<void> {
  await prisma.gmailAccount.update({
    where: { id: accountId },
    data: {
      status: "suspended_by_provider",
      pausedReason: reason || "auth_failure",
      pausedAt: new Date(),
    },
  });
}

/** Exponential backoff for 401/403/429/5xx Gmail responses. */
export async function withGmailRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; accountId?: string } = {},
): Promise<T> {
  const retries = opts.retries ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.code || err?.response?.status;
      const retryable =
        status === 429 || status === 403 || (status >= 500 && status < 600);
      if (opts.accountId && isPermanentAuthError(err)) {
        await flagPermanentAuthFailure(opts.accountId, err?.message);
        throw err;
      }
      if (!retryable || attempt === retries) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastErr;
}

export function storeEncryptedRefreshToken(refreshToken: string): string {
  return encrypt(refreshToken);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// worker/processors/inboxSyncWorker.ts

import { getGmailClient, withGmailRetry } from "@/lib/gmailClient";
import { prisma } from "@/lib/prisma";

const LABELS_TO_SYNC = [
  { gmailLabel: "INBOX", dbLabel: "INBOX" },
  { gmailLabel: "SENT", dbLabel: "SENT" },
  { gmailLabel: "SPAM", dbLabel: "SPAM" },
];
const SYNC_PAGE_SIZE = 25;

function headerValue(headers: any[] | undefined, name: string): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
    ""
  );
}

export async function syncAccountInbox(accountId: string): Promise<void> {
  const account = await prisma.gmailAccount.findUnique({
    where: { id: accountId },
  });
  if (
    !account ||
    (account.status !== "active" && account.status !== "warming_up")
  )
    return;

  const gmail = await getGmailClient(account.id);

  for (const { gmailLabel, dbLabel } of LABELS_TO_SYNC) {
    try {
      const list = await withGmailRetry(
        () =>
          gmail.users.messages.list({
            userId: "me",
            labelIds: [gmailLabel],
            maxResults: SYNC_PAGE_SIZE,
          }),
        { accountId: account.id },
      );
      const messages = list.data.messages || [];

      for (const m of messages) {
        if (!m.id) continue;
        const existing = await prisma.message.findUnique({
          where: { gmailMessageId: m.id },
        });
        if (existing && existing.label === dbLabel) continue; // already synced, skip re-fetch

        const full = await withGmailRetry(
          () =>
            gmail.users.messages.get({
              userId: "me",
              id: m.id!,
              format: "metadata",
              metadataHeaders: ["From", "To", "Subject"],
            }),
          { accountId: account.id },
        );
        const headers = full.data.payload?.headers;
        const isUnread = (full.data.labelIds || []).includes("UNREAD");
        const internalDate = full.data.internalDate
          ? new Date(Number(full.data.internalDate))
          : new Date();

        await prisma.message.upsert({
          where: { gmailMessageId: m.id },
          update: {
            label: dbLabel,
            isRead: !isUnread,
            snippet: full.data.snippet || undefined,
            syncedAt: new Date(),
          },
          create: {
            accountId: account.id,
            gmailMessageId: m.id,
            gmailThreadId: full.data.threadId || m.id,
            label: dbLabel,
            fromEmail: headerValue(headers, "From"),
            toEmail: headerValue(headers, "To"),
            subject: headerValue(headers, "Subject"),
            snippet: full.data.snippet || undefined,
            isRead: !isUnread,
            internalDate,
          },
        });
      }
    } catch (err: any) {
      console.error(
        `Inbox sync failed for ${account.email}, label ${gmailLabel}:`,
        err?.message,
      );
    }
  }
}

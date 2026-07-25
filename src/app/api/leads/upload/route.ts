// app/api/leads/upload/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const campaignId = formData.get("campaignId") as string | null;
  const requestedEmailColumn = (formData.get("emailColumn") as string | null) || "email";

  if (!file || !campaignId) {
    return NextResponse.json({ error: "file and campaignId are required" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "Leads can only be uploaded to a draft campaign" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

  if (rows.length === 0) return NextResponse.json({ error: "No rows found" }, { status: 400 });

  const columns = Object.keys(rows[0]);

  // Case-insensitive match: "email" matches "Email", "EMAIL", " Email ", etc.
  const emailColumn = columns.find(
    (c) => c.trim().toLowerCase() === requestedEmailColumn.trim().toLowerCase()
  );
  if (!emailColumn) {
    return NextResponse.json(
      { error: `Email column "${requestedEmailColumn}" not found. Columns: ${columns.join(", ")}` },
      { status: 400 }
    );
  }

  let created = 0;
  let skipped = 0;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const row of rows) {
    const email = String(row[emailColumn] || "").trim();
    if (!email || !EMAIL_REGEX.test(email)) {
      skipped += 1;
      continue;
    }
    try {
      await prisma.lead.create({ data: { campaignId, email, fields: row } });
      created += 1;
    } catch {
      skipped += 1; // duplicate email in this campaign
    }
  }

  return NextResponse.json({ columns, totalRows: rows.length, created, skipped });
}
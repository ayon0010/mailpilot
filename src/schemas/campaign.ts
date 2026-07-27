import { z } from "zod";

export const createSchema = z.object({
  name: z.string().min(1),
  subjectTemplate: z.string().default(""),
  bodyTemplate: z.string().default(""),
  followUpSubjectTemplate: z.string().default(""),
  followUpBodyTemplate: z.string().default(""),
  followUpDays: z.number().int().min(2).max(5).default(4),
  targetTimezone: z.string().default("America/New_York"),
  sendWindowStart: z.number().int().min(0).max(23).default(9),
  sendWindowEnd: z.number().int().min(1).max(24).default(18),
  segmentByLeadTimezone: z.boolean().default(false),
});

export type CampaignFormValues = z.input<typeof createSchema>;

// worker/index.ts
import {
  healthCheckQueue,
  inboxSyncQueue,
  QUEUE_NAMES,
  warmupDailyPlanQueue,
} from "@/lib/queues";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processSendJob } from "./processors/sendWorker";
import { processFollowUpPlan } from "./processors/followUpPlanWorker";
import { runHealthCheck } from "./processors/healthCheckWorker";
import {
  processWarmupSend,
  runWarmupDailyPlan,
} from "./processors/warmupWorker";
import { syncAccountInbox } from "./processors/inboxSyncWorker";
import { prisma } from "@/lib/prisma";

const healthCheckWorker = new Worker(
  QUEUE_NAMES.healthCheck,
  async () => {
    await runHealthCheck();
  },
  { connection: redisConnection(), concurrency: 1 },
);
healthCheckWorker.on("completed", () =>
  console.log("[health-check] tick completed"),
);
healthCheckWorker.on("failed", (job, err) =>
  console.error("[health-check] failed:", err.message),
);

// Register the recurring schedule (idempotent — same jobId won't duplicate)
healthCheckQueue().add(
  "health-check",
  {},
  { repeat: { pattern: "*/30 * * * *" }, jobId: "health-check-tick" },
);

function redisConnection() {
  return new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
}

const sendWorker = new Worker(QUEUE_NAMES.send, processSendJob, {
  connection: redisConnection(),
  concurrency: 5,
});

const followUpWorker = new Worker(QUEUE_NAMES.followUp, processFollowUpPlan, {
  connection: redisConnection(),
  concurrency: 5,
});
followUpWorker.on("completed", (job) =>
  console.log(`[follow-up-plan] job ${job.id} completed`),
);
followUpWorker.on("failed", (job, err) =>
  console.error(`[follow-up-plan] job ${job?.id} failed:`, err.message),
);

sendWorker.on("completed", (job) =>
  console.log(`[send] job ${job.id} completed`),
);
sendWorker.on("failed", (job, err) =>
  console.error(`[send] job ${job?.id} failed:`, err.message),
);

const warmupSendWorker = new Worker(QUEUE_NAMES.warmupSend, processWarmupSend, {
  connection: redisConnection(),
  concurrency: 5,
});
warmupSendWorker.on("completed", (job) =>
  console.log(`[warmup-send] job ${job.id} completed`),
);
warmupSendWorker.on("failed", (job, err) =>
  console.error(`[warmup-send] job ${job?.id} failed:`, err.message),
);

const warmupDailyPlanWorker = new Worker(
  QUEUE_NAMES.warmupDailyPlan,
  async () => {
    await runWarmupDailyPlan();
  },
  { connection: redisConnection(), concurrency: 1 },
);
warmupDailyPlanWorker.on("completed", () =>
  console.log("[warmup-daily-plan] tick completed"),
);
warmupDailyPlanWorker.on("failed", (job, err) =>
  console.error("[warmup-daily-plan] failed:", err.message),
);

warmupDailyPlanQueue().add(
  "daily-plan",
  {},
  { repeat: { pattern: "0 6 * * *" }, jobId: "warmup-daily-plan" },
);

const inboxSyncWorker = new Worker(
  QUEUE_NAMES.inboxSync,
  async (job) => {
    await syncAccountInbox(job.data.accountId);
  },
  { connection: redisConnection(), concurrency: 3 },
);
inboxSyncWorker.on("failed", (job, err) =>
  console.error("[inbox-sync] failed:", err.message),
);

async function scheduleStaggeredInboxSync() {
  const accounts = await prisma.gmailAccount.findMany({
    where: { status: { in: ["active", "warming_up"] } },
  });
  const queue = inboxSyncQueue();
  for (let i = 0; i < accounts.length; i++) {
    const intervalMinutes = 3 + (i % 3); // 3-5 min stagger
    await queue.add(
      "inbox-sync",
      { accountId: accounts[i].id },
      {
        repeat: { every: intervalMinutes * 60 * 1000 },
        jobId: `inbox-sync-${accounts[i].id}`,
      },
    );
  }
  console.log(`Staggered inbox sync scheduled for ${accounts.length} accounts`);
}
scheduleStaggeredInboxSync();

console.log("Worker process started, listening on queue:", QUEUE_NAMES.send);

// worker/index.ts
import { QUEUE_NAMES } from "@/lib/queues";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processSendJob } from "./processors/sendWorker";
import { processFollowUpPlan } from "./processors/followUpPlanWorker";

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

console.log("Worker process started, listening on queue:", QUEUE_NAMES.send);

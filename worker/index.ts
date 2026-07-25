// worker/index.ts
import { QUEUE_NAMES } from "@/lib/queues";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processSendJob } from "./processors/sendWorker";

function redisConnection() {
  return new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
}

const sendWorker = new Worker(QUEUE_NAMES.send, processSendJob, {
  connection: redisConnection(),
  concurrency: 5,
});

sendWorker.on("completed", (job) =>
  console.log(`[send] job ${job.id} completed`),
);
sendWorker.on("failed", (job, err) =>
  console.error(`[send] job ${job?.id} failed:`, err.message),
);

console.log("Worker process started, listening on queue:", QUEUE_NAMES.send);

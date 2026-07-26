// lib/queues.ts
import { Queue, QueueOptions } from "bullmq";
import IORedis from "ioredis";

function getConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  return new IORedis(url, { maxRetriesPerRequest: null });
}

let _connection: IORedis | null = null;
function connection() {
  if (!_connection) _connection = getConnection();
  return _connection;
}

const defaultQueueOpts: Partial<QueueOptions> = {
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 60 * 60 * 24 * 7, count: 5000 },
    removeOnFail: { age: 60 * 60 * 24 * 30 },
  },
};

// export const QUEUE_NAMES = { send: "send-email" } as const;

export const QUEUE_NAMES = {
  send: "send-email",
  followUp: "follow-up-plan",
  healthCheck: "health-check",
  warmupSend: "warmup-send", // ← add this
  warmupDailyPlan: "warmup-daily-plan",
  inboxSync: "inbox-sync",
} as const;

export function warmupSendQueue() {
  return new Queue(QUEUE_NAMES.warmupSend, {
    connection: connection(),
    ...defaultQueueOpts,
  });
}

export function inboxSyncQueue() {
  return new Queue(QUEUE_NAMES.inboxSync, {
    connection: connection(),
    ...defaultQueueOpts,
  });
}

export function warmupDailyPlanQueue() {
  return new Queue(QUEUE_NAMES.warmupDailyPlan, {
    connection: connection(),
    ...defaultQueueOpts,
  });
}

export function healthCheckQueue() {
  return new Queue(QUEUE_NAMES.healthCheck, {
    connection: connection(),
    ...defaultQueueOpts,
  });
}

export function followUpQueue() {
  return new Queue(QUEUE_NAMES.followUp, {
    connection: connection(),
    ...defaultQueueOpts,
  });
}

export function sendQueue() {
  return new Queue(QUEUE_NAMES.send, {
    connection: connection(),
    ...defaultQueueOpts,
  });
}

export interface SendJobPayload {
  sendJobId: string;
}

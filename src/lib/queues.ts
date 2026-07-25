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

export const QUEUE_NAMES = { send: "send-email" } as const;

export function sendQueue() {
  return new Queue(QUEUE_NAMES.send, {
    connection: connection(),
    ...defaultQueueOpts,
  });
}

export interface SendJobPayload {
  sendJobId: string;
}

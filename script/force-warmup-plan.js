// scripts/force-warmup-plan.js
require("dotenv").config();
const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const queue = new Queue("warmup-daily-plan", { connection });
queue.add("daily-plan", {}, { delay: 0 }).then((job) => {
  console.log("Enqueued:", job.id);
  process.exit(0);
});

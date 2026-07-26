// scripts/force-warmup-rescue.js
require("dotenv").config();
const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const warmupJobId = process.argv[2];
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const queue = new Queue("warmup-send", { connection });
queue
  .add("warmup-send", { warmupJobId, kind: "spam_rescue" }, { delay: 0 })
  .then(() => {
    console.log("Enqueued");
    process.exit(0);
  });

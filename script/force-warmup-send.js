// scripts/force-warmup-send.js
require("dotenv").config();
const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const warmupJobId = process.argv[2];
if (!warmupJobId) {
  console.error("Usage: node script/force-warmup-send.js 6a65cd157765db2a4565bd48");
  process.exit(1);
}
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const queue = new Queue("warmup-send", { connection });
queue
  .add("warmup-send", { warmupJobId, kind: "initial" }, { delay: 0 })
  .then(() => {
    console.log("Enqueued");
    process.exit(0);
  });

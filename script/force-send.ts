// scripts/force-send.js
require("dotenv").config();
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const sendJobId = process.argv[2];
if (!sendJobId) {
  console.error("Usage: node scripts/force-send.js <sendJobId>");
  process.exit(1);
}

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const queue = new Queue("send-email", { connection });

queue.add("send", { sendJobId }, { delay: 0 }).then(() => {
  console.log("Enqueued for immediate processing");
  process.exit(0);
});

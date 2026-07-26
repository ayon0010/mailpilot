// scripts/force-followup-plan.js
require("dotenv").config();
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const initialSendJobId = process.argv[2];
if (!initialSendJobId) {
  console.error(
    "Usage: node scripts/force-followup-plan.js <initialSendJobId>",
  );
  process.exit(1);
}

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const queue = new Queue("follow-up-plan", { connection });

queue.add("plan-follow-up", { initialSendJobId }, { delay: 0 }).then(() => {
  console.log("Enqueued for immediate processing");
  process.exit(0);
});

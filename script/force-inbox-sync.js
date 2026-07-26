// scripts/force-inbox-sync.js
require("dotenv").config();
const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const accountId = process.argv[2];
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue("inbox-sync", { connection });
queue.add("inbox-sync", { accountId }, { delay: 0 }).then(() => { console.log("Enqueued"); process.exit(0); });
// scripts/force-health-check.js
require("dotenv").config();
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

console.log("REDIS_URL loaded:", !!process.env.REDIS_URL);

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  connectTimeout: 10_000,
});

connection.on("connect", () => console.log("[redis] TCP connected"));
connection.on("ready", () => console.log("[redis] ready"));
connection.on("error", (err) => console.error("[redis] error:", err.message));

const queue = new Queue("health-check", { connection });

const timeout = setTimeout(() => {
  console.error("Timed out after 10s waiting for queue.add() to resolve");
  process.exit(1);
}, 10_000);

queue
  .add("health-check", {}, { delay: 0 })
  .then((job) => {
    clearTimeout(timeout);
    console.log("Enqueued job id:", job.id);
    process.exit(0);
  })
  .catch((err) => {
    clearTimeout(timeout);
    console.error("queue.add() failed:", err.message);
    process.exit(1);
  });

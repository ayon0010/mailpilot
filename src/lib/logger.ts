// pino is a high-performance logger for Node.js.
// Instead of using console.log(),
//  you use a logger that produces structured
// logs with timestamps, levels, and metadata.

import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
});

import { Logger, pino } from "pino";

let logger: Logger;

if (process.env.LOG_FILENAME) {
  // Create a logger that writes to the specified file
  logger = pino(
    {
      level: process.env.LOG_LEVEL || "info",
    },
    pino.destination({
      dest: process.env.LOG_FILENAME,
      sync: false,
    }),
  );
} else {
  // Create a "silent" logger that doesn't output anywhere
  logger = pino({
    enabled: false,
  });
}

export { logger };

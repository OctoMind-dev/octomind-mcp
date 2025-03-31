import { Logger, pino } from "pino";

const buildLogger = (): Logger => {
  if (process.env.LOG_FILENAME) {
    // Create a logger that writes to the specified file
    return pino(
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
    return pino({
      enabled: false,
    });
  }
};

const logger = buildLogger();

export { logger };

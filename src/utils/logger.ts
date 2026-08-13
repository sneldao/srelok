const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

const currentLevel: Level = (process.env.LOG_LEVEL as Level) || "info";

function shouldLog(level: Level): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(currentLevel);
}

function timestamp(): string {
  return new Date().toISOString();
}

export const log = {
  debug(msg: string, data?: unknown) {
    if (shouldLog("debug")) {
      console.log(`[${timestamp()}] DEBUG: ${msg}`, data ?? "");
    }
  },
  info(msg: string, data?: unknown) {
    if (shouldLog("info")) {
      console.log(`[${timestamp()}] INFO: ${msg}`, data ?? "");
    }
  },
  warn(msg: string, data?: unknown) {
    if (shouldLog("warn")) {
      console.warn(`[${timestamp()}] WARN: ${msg}`, data ?? "");
    }
  },
  error(msg: string, data?: unknown) {
    if (shouldLog("error")) {
      console.error(`[${timestamp()}] ERROR: ${msg}`, data ?? "");
    }
  },
};

/**
 * Simple logging utilities with level filtering and timestamped output.
 *
 * Set the desired log level via the `LOG_LEVEL` environment variable on the
 * server or `VITE_LOG_LEVEL` in the client build. Available levels are
 * `debug`, `info`, `warn`, and `error` with `info` as the default.
 *
 * Each exported function mirrors the native `console` API and prefixes
 * messages with an ISO timestamp and level tag:
 *
 * ```js
 * import { logInfo } from "./logger";
 * logInfo("Server started", { port: 8080 });
 * ```
 */

const LOG_LEVEL = (
  (typeof process !== "undefined" && process.env && process.env.LOG_LEVEL) ||
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_LOG_LEVEL || import.meta.env.LOG_LEVEL)) ||
  "info"
);

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function shouldLog(level) {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

function format(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export function logDebug(message, ...optionalParams) {
  if (shouldLog("debug")) {
    console.debug(format("debug", message), ...optionalParams);
  }
}

export function logInfo(message, ...optionalParams) {
  if (shouldLog("info")) {
    console.info(format("info", message), ...optionalParams);
  }
}

export function logWarn(message, ...optionalParams) {
  if (shouldLog("warn")) {
    console.warn(format("warn", message), ...optionalParams);
  }
}

export function logError(message, ...optionalParams) {
  if (shouldLog("error")) {
    console.error(format("error", message), ...optionalParams);
  }
}

export { LOG_LEVEL };

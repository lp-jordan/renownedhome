const prefix = '[Supabase API]';

export function logRequest(message, info) {
  console.info(`${prefix} ${message}`, info);
}

export function logSuccess(message, info) {
  console.info(`${prefix} Success: ${message}`, info);
}

export function logError(message, error) {
  console.error(`${prefix} Error: ${message}`, error);
}

export function logRequest(message, info) {
  console.info(message, info);
}

export function logSuccess(message, info) {
  console.info(`Success: ${message}`, info);
}

export function logError(message, error) {
  console.error(`Error: ${message}`, error);
}

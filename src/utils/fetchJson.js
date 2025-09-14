import { logDebug, logError, logInfo } from "./logger";

export async function fetchJson(path) {
  try {
    logDebug("Fetching JSON", { path });
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }
    const data = await response.json();
    logInfo("Fetched JSON", { path });
    return data;
  } catch (error) {
    logError(`fetchJson ${path}`, error);
    return null;
  }
}

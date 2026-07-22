const SESSION_KEY = "renowned_read_session_id";
const FLUSH_INTERVAL_MS = 4000;
const ENDPOINT = "/api/analytics/event";

function createFallbackId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSessionId() {
  if (typeof window === "undefined") {
    return "server";
  }
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = window.crypto?.randomUUID?.() || createFallbackId();
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return createFallbackId();
  }
}

/**
 * A small, dependency-free event queue for first-party funnel analytics.
 * Events are batched and flushed periodically via fetch, and can be flushed
 * immediately (via sendBeacon) when the page is closing/backgrounding so
 * drop-off is actually captured instead of lost.
 */
export function createFunnelTracker(funnel = "read-issue-1") {
  const sessionId = getSessionId();
  let queue = [];
  let flushTimer = null;

  function send(useBeacon) {
    if (!queue.length) {
      return;
    }
    const events = queue;
    queue = [];
    const payload = JSON.stringify({ events });

    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon(ENDPOINT, blob);
      if (sent) {
        return;
      }
    }

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }

  function scheduleFlush() {
    if (flushTimer) {
      return;
    }
    flushTimer = setTimeout(() => {
      flushTimer = null;
      send(false);
    }, FLUSH_INTERVAL_MS);
  }

  function track(eventType, eventData = {}) {
    queue.push({ sessionId, funnel, eventType, eventData });
    scheduleFlush();
  }

  function flush(useBeacon = false) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    send(useBeacon);
  }

  return { sessionId, track, flush };
}

import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const MAX_LOCAL_EVENTS = 20000;
const SECTION_KEYS = ["intro", "team", "reader", "cta"];
const CTA_KEYS = ["buy", "tip", "mailing"];
const EVENT_TYPES = new Set([
  "section_view",
  "reader_page",
  "reader_ready",
  "cta_click",
  "time_on_page",
]);

function createId() {
  return crypto.randomUUID();
}

function sanitizeEvent(raw) {
  const sessionId = String(raw?.sessionId || "").slice(0, 120);
  const funnel = String(raw?.funnel || "read-issue-1").slice(0, 60);
  const eventType = String(raw?.eventType || "");
  if (!sessionId || !EVENT_TYPES.has(eventType)) {
    return null;
  }
  const eventData = raw?.eventData && typeof raw.eventData === "object" ? raw.eventData : {};
  return { sessionId, funnel, eventType, eventData };
}

function aggregateEvents(events) {
  const sessions = new Set();
  const sectionSessions = Object.fromEntries(SECTION_KEYS.map((key) => [key, new Set()]));
  const ctaClickSessions = Object.fromEntries(CTA_KEYS.map((key) => [key, new Set()]));
  const pageSessions = new Map();
  let timeOnPageTotal = 0;
  let timeOnPageCount = 0;

  for (const event of events) {
    sessions.add(event.sessionId);
    const data = event.eventData || {};

    if (event.eventType === "section_view" && sectionSessions[data.section]) {
      sectionSessions[data.section].add(event.sessionId);
    }

    if (event.eventType === "cta_click" && ctaClickSessions[data.target]) {
      ctaClickSessions[data.target].add(event.sessionId);
    }

    if (event.eventType === "reader_page" && Number.isFinite(Number(data.page))) {
      const page = Number(data.page);
      const set = pageSessions.get(page) || new Set();
      set.add(event.sessionId);
      pageSessions.set(page, set);
    }

    if (event.eventType === "time_on_page" && Number.isFinite(Number(data.seconds))) {
      timeOnPageTotal += Number(data.seconds);
      timeOnPageCount += 1;
    }
  }

  const maxPage = pageSessions.size ? Math.max(...pageSessions.keys()) : 0;
  const pageDropoff = [];
  for (let page = 1; page <= maxPage; page += 1) {
    pageDropoff.push({ page, sessions: pageSessions.get(page)?.size || 0 });
  }

  return {
    totalSessions: sessions.size,
    sections: Object.fromEntries(SECTION_KEYS.map((key) => [key, sectionSessions[key].size])),
    ctaClicks: Object.fromEntries(CTA_KEYS.map((key) => [key, ctaClickSessions[key].size])),
    avgTimeOnPageSeconds: timeOnPageCount ? Math.round(timeOnPageTotal / timeOnPageCount) : 0,
    pageDropoff,
  };
}

export class FunnelFileStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.write({ events: [] });
    }
  }

  async read() {
    const raw = await fs.readFile(this.filePath, "utf8");
    return JSON.parse(raw);
  }

  async write(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async logEvents(rawEvents) {
    const events = (rawEvents || []).map(sanitizeEvent).filter(Boolean);
    if (!events.length) {
      return;
    }
    const data = await this.read();
    const now = new Date().toISOString();
    for (const event of events) {
      data.events.push({ id: createId(), ...event, createdAt: now });
    }
    if (data.events.length > MAX_LOCAL_EVENTS) {
      data.events = data.events.slice(-MAX_LOCAL_EVENTS);
    }
    await this.write(data);
  }

  async getAnalytics(funnel = "read-issue-1") {
    const data = await this.read();
    return aggregateEvents(data.events.filter((event) => event.funnel === funnel));
  }
}

export class FunnelPgStore {
  constructor(connectionString) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS funnel_events (
        id UUID PRIMARY KEY,
        session_id TEXT NOT NULL,
        funnel TEXT NOT NULL DEFAULT 'read-issue-1',
        event_type TEXT NOT NULL,
        event_data JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS funnel_events_funnel_idx ON funnel_events (funnel);
    `);
  }

  async logEvents(rawEvents) {
    const events = (rawEvents || []).map(sanitizeEvent).filter(Boolean);
    if (!events.length) {
      return;
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const event of events) {
        await client.query(
          `INSERT INTO funnel_events (id, session_id, funnel, event_type, event_data) VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [createId(), event.sessionId, event.funnel, event.eventType, JSON.stringify(event.eventData)]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getAnalytics(funnel = "read-issue-1") {
    const result = await this.pool.query(
      `
        SELECT session_id AS "sessionId", event_type AS "eventType", event_data AS "eventData"
        FROM funnel_events
        WHERE funnel = $1
        ORDER BY created_at ASC
        LIMIT 50000
      `,
      [funnel]
    );
    return aggregateEvents(result.rows);
  }
}

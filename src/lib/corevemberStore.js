import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

// Corevember — a two-person daily core-challenge tracker (plank seconds +
// crunch sets per person per day). Mirrors funnelStore: a JSON file store for
// local dev and a Postgres store for production, chosen in server.js by
// DATABASE_URL. Public, unauthenticated, personal tool — the roster is fixed
// to these two people and writes only ever touch their own rows.

export const COREVEMBER_USERS = [
  { slug: "jordan", name: "Jordan" },
  { slug: "mckenzie", name: "McKenzie" },
];

const USER_SLUGS = new Set(COREVEMBER_USERS.map((user) => user.slug));

// Guard rails so a bad/hostile POST can't write junk: a plank session longer
// than a day or an absurd set count is clamped rather than stored.
const MAX_PLANK_SECONDS = 86400;
const MAX_CRUNCH_SETS = 10000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidUser(slug) {
  return typeof slug === "string" && USER_SLUGS.has(slug);
}

function isValidDate(value) {
  return typeof value === "string" && DATE_RE.test(value);
}

function clampNumber(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.min(Math.round(n), max);
}

// Normalize an upsert payload, or return null if it can't be trusted.
export function sanitizeEntry(raw) {
  if (!isValidUser(raw?.user) || !isValidDate(raw?.date)) {
    return null;
  }
  return {
    user: raw.user,
    date: raw.date,
    plankSeconds: clampNumber(raw.plankSeconds, MAX_PLANK_SECONDS),
    crunchSets: clampNumber(raw.crunchSets, MAX_CRUNCH_SETS),
  };
}

export class CorevemberFileStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.write({ entries: {} });
    }
  }

  async read() {
    const raw = await fs.readFile(this.filePath, "utf8");
    const data = JSON.parse(raw);
    if (!data.entries) {
      data.entries = {};
    }
    return data;
  }

  async write(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  // All days → { [date]: { [slug]: { plankSeconds, crunchSets } } }.
  async getDays() {
    const data = await this.read();
    return data.entries;
  }

  async upsert(entry) {
    const clean = sanitizeEntry(entry);
    if (!clean) {
      return null;
    }
    const data = await this.read();
    const day = data.entries[clean.date] || {};
    day[clean.user] = {
      plankSeconds: clean.plankSeconds,
      crunchSets: clean.crunchSets,
      updatedAt: new Date().toISOString(),
    };
    data.entries[clean.date] = day;
    await this.write(data);
    return { date: clean.date, user: clean.user, ...day[clean.user] };
  }
}

export class CorevemberPgStore {
  constructor(connectionString) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS corevember_logs (
        user_slug TEXT NOT NULL,
        log_date DATE NOT NULL,
        plank_seconds INTEGER NOT NULL DEFAULT 0,
        crunch_sets INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_slug, log_date)
      );
    `);
  }

  async getDays() {
    const result = await this.pool.query(`
      SELECT user_slug AS "userSlug",
             to_char(log_date, 'YYYY-MM-DD') AS "date",
             plank_seconds AS "plankSeconds",
             crunch_sets AS "crunchSets",
             updated_at AS "updatedAt"
      FROM corevember_logs
      ORDER BY log_date ASC
    `);
    const days = {};
    for (const row of result.rows) {
      const day = days[row.date] || (days[row.date] = {});
      day[row.userSlug] = {
        plankSeconds: row.plankSeconds,
        crunchSets: row.crunchSets,
        updatedAt: row.updatedAt,
      };
    }
    return days;
  }

  async upsert(entry) {
    const clean = sanitizeEntry(entry);
    if (!clean) {
      return null;
    }
    const result = await this.pool.query(
      `
        INSERT INTO corevember_logs (user_slug, log_date, plank_seconds, crunch_sets, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_slug, log_date)
        DO UPDATE SET plank_seconds = EXCLUDED.plank_seconds,
                      crunch_sets = EXCLUDED.crunch_sets,
                      updated_at = NOW()
        RETURNING plank_seconds AS "plankSeconds", crunch_sets AS "crunchSets", updated_at AS "updatedAt"
      `,
      [clean.user, clean.date, clean.plankSeconds, clean.crunchSets]
    );
    const row = result.rows[0];
    return { date: clean.date, user: clean.user, ...row };
  }
}

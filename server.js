import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import express from "express";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";
import pg from "pg";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  cloneDefaultSiteData,
} from "./src/content/defaultSiteData.js";
import {
  DeliveryFileStore,
  DeliveryPgStore,
  parseBackerCsv,
} from "./src/lib/deliveryStore.js";
import {
  buildDeliveryEmail,
  resendIsConfigured,
  sendResendEmail,
} from "./src/lib/resendEmail.js";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadLocalEnvFile() {
  const envPath = path.join(__dirname, ".env.local");
  try {
    const raw = await fs.readFile(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Local env file is optional in deployed environments.
  }

  if (!process.env.S3_SECRET_ACCESS_KEY && process.env.S3_ACCESS_SECREY_KEY) {
    process.env.S3_SECRET_ACCESS_KEY = process.env.S3_ACCESS_SECREY_KEY;
  }
}

await loadLocalEnvFile();

const runtimeDir = path.join(__dirname, "runtime");
const runtimeFile = path.join(runtimeDir, "content-store.json");
const deliveryRuntimeFile = path.join(runtimeDir, "delivery-store.json");
const uploadTempDir = path.join(runtimeDir, "uploads");
const distDir = path.join(__dirname, "dist");
const distIndexFile = path.join(distDir, "index.html");
const uploadFileSizeLimitBytes =
  (parsePositiveInteger(process.env.UPLOAD_MAX_FILE_SIZE_MB || "300") || 300) *
  1024 *
  1024;
const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, callback) => {
      try {
        await fs.mkdir(uploadTempDir, { recursive: true });
        callback(null, uploadTempDir);
      } catch (error) {
        callback(error, uploadTempDir);
      }
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname) || "";
      const baseName = path
        .basename(file.originalname, extension)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      callback(
        null,
        `${Date.now()}-${crypto.randomUUID()}-${baseName || "upload"}${extension}`
      );
    },
  }),
  limits: {
    fileSize: uploadFileSizeLimitBytes,
  },
});
const app = express();
const sessions = new Map();
const rateLimits = new Map();
const isProduction = process.env.NODE_ENV === "production";
const defaultPublicSiteOrigin = "https://renownedcomic.com";
const allowedUploadMimeTypes = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

app.disable("x-powered-by");
app.set("trust proxy", isProduction ? 1 : false);

app.use(express.json({ limit: "3mb" }));
app.use(cookieParser());

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function getPublicSiteOrigin() {
  const configuredOrigin = String(
    process.env.PUBLIC_SITE_ORIGIN || defaultPublicSiteOrigin
  ).trim();

  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return defaultPublicSiteOrigin;
  }
}

function getAllowedRequestOrigins() {
  const origins = new Set([getPublicSiteOrigin()]);

  if (!isProduction) {
    origins.add("http://localhost:3001");
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1:3001");
    origins.add("http://127.0.0.1:5173");
  }

  return origins;
}

function buildContentSecurityPolicy() {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' https://fonts.gstatic.com data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' https: data: blob:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  ];

  if (isProduction) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

function setSecurityHeaders(req, res, next) {
  res.setHeader("Content-Security-Policy", buildContentSecurityPolicy());
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), geolocation=(), microphone=()"
  );
  if (isProduction) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  next();
}

function setCacheHeaders(req, res, next) {
  if (req.path === "/api/bootstrap") {
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  } else if (req.path.startsWith("/api/assets/")) {
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  } else if (req.path.startsWith("/api/auth") || req.path.startsWith("/api/admin")) {
    res.setHeader("Cache-Control", "no-store, private");
  } else if (req.path === "/api/health") {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
}

function getClientIp(req) {
  return (
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown"
  );
}

function createRateLimiter({ keyPrefix, windowMs, maxRequests, message }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientIp(req)}`;
    const existing =
      rateLimits.get(key) || {
        count: 0,
        resetAt: now + windowMs,
      };

    if (existing.resetAt <= now) {
      existing.count = 0;
      existing.resetAt = now + windowMs;
    }

    existing.count += 1;
    rateLimits.set(key, existing);

    res.setHeader(
      "RateLimit",
      `limit=${maxRequests}, remaining=${Math.max(
        maxRequests - existing.count,
        0
      )}, reset=${Math.ceil((existing.resetAt - now) / 1000)}`
    );

    if (existing.count > maxRequests) {
      res.setHeader("Retry-After", Math.ceil((existing.resetAt - now) / 1000));
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}

function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    if (entry.resetAt <= now) {
      rateLimits.delete(key);
    }
  }
}

function requireTrustedOrigin(req, res, next) {
  const allowedOrigins = getAllowedRequestOrigins();
  const origin = req.get("origin");
  const referer = req.get("referer");

  if (origin) {
    if (allowedOrigins.has(origin)) {
      next();
      return;
    }

    res.status(403).json({ error: "Untrusted request origin." });
    return;
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.has(refererOrigin)) {
        next();
        return;
      }
    } catch {
      res.status(403).json({ error: "Untrusted request origin." });
      return;
    }
  }

  res.status(403).json({ error: "Origin header is required." });
}

async function removeTempUpload(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("Failed to remove temp upload", error);
    }
  }
}

async function buildBootstrapAdminUser() {
  const username = String(process.env.ADMIN_USERNAME || "").trim();
  const password = String(process.env.ADMIN_PASSWORD || "");
  const passwordHash = String(process.env.ADMIN_PASSWORD_HASH || "").trim();

  if (password && passwordHash) {
    throw new Error(
      "Set either ADMIN_PASSWORD or ADMIN_PASSWORD_HASH, not both."
    );
  }

  if (!username && !password && !passwordHash) {
    if (isProduction) {
      return null;
    }

    return {
      id: "user-admin",
      username: "admin",
      role: "admin",
      passwordHash: await bcrypt.hash("renownedhome-dev", 10),
    };
  }

  if (!username) {
    throw new Error(
      "ADMIN_USERNAME is required when bootstrapping an admin account."
    );
  }

  if (!password && !passwordHash) {
    throw new Error(
      "Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH when bootstrapping an admin account."
    );
  }

  return {
    id: `user-${username.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "admin"}`,
    username,
    role: "admin",
    passwordHash: passwordHash || (await bcrypt.hash(password, 10)),
  };
}

function validateRuntimeConfig() {
  if (isProduction && !process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required in production. Railway deployments should use Postgres instead of the local runtime JSON file."
    );
  }
}

class FileRepository {
  constructor(filePath, bootstrapAdminUser) {
    this.filePath = filePath;
    this.bootstrapAdminUser = bootstrapAdminUser;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.writeAllData(cloneDefaultSiteData());
    }

    const data = await this.getAllData();
    if (!data.users?.length) {
      data.users = this.bootstrapAdminUser ? [this.bootstrapAdminUser] : [];
      await this.writeAllData(data);
    }
  }

  async getAllData() {
    const raw = await fs.readFile(this.filePath, "utf8");
    return JSON.parse(raw);
  }

  async writeAllData(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }
}

class PgRepository {
  constructor(connectionString, bootstrapAdminUser) {
    this.pool = new Pool({ connectionString });
    this.bootstrapAdminUser = bootstrapAdminUser;
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS content_store (
        store_key TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        role TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);

    const seed = cloneDefaultSiteData();
    const keys = [
      "siteSettings",
      "pages",
      "issues",
      "teamMembers",
      "socialLinks",
      "redirects",
      "lettersSubmissions",
      "assets",
    ];

    for (const key of keys) {
      await this.pool.query(
        `
          INSERT INTO content_store (store_key, data)
          VALUES ($1, $2::jsonb)
          ON CONFLICT (store_key) DO NOTHING
        `,
        [key, JSON.stringify(seed[key])]
      );
    }

    const existingUsers = await this.pool.query(
      "SELECT COUNT(*)::int AS count FROM users"
    );
    if (existingUsers.rows[0]?.count === 0) {
      if (!this.bootstrapAdminUser && isProduction) {
        throw new Error(
          "No admin user exists in Postgres. Set ADMIN_USERNAME with ADMIN_PASSWORD or ADMIN_PASSWORD_HASH for the first production boot."
        );
      }

      if (this.bootstrapAdminUser) {
        await this.pool.query(
          `
            INSERT INTO users (id, username, role, password_hash)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) DO NOTHING
          `,
          [
            this.bootstrapAdminUser.id,
            this.bootstrapAdminUser.username,
            this.bootstrapAdminUser.role,
            this.bootstrapAdminUser.passwordHash,
          ]
        );
      }
    }
  }

  async getAllData() {
    const storeRows = await this.pool.query(
      "SELECT store_key, data FROM content_store"
    );
    const usersRows = await this.pool.query(
      "SELECT id, username, role, password_hash FROM users"
    );

    const data = {};
    for (const row of storeRows.rows) {
      data[row.store_key] = row.data;
    }

    data.users = usersRows.rows.map((row) => ({
      id: row.id,
      username: row.username,
      role: row.role,
      passwordHash: row.password_hash,
    }));

    return data;
  }

  async writeAllData(data) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const keys = [
        "siteSettings",
        "pages",
        "issues",
        "teamMembers",
        "socialLinks",
        "redirects",
        "lettersSubmissions",
        "assets",
      ];

      for (const key of keys) {
        await client.query(
          `
            INSERT INTO content_store (store_key, data)
            VALUES ($1, $2::jsonb)
            ON CONFLICT (store_key) DO UPDATE SET data = EXCLUDED.data
          `,
          [key, JSON.stringify(data[key])]
        );
      }

      await client.query("DELETE FROM users");
      for (const user of data.users) {
        await client.query(
          `
            INSERT INTO users (id, username, role, password_hash)
            VALUES ($1, $2, $3, $4)
          `,
          [user.id, user.username, user.role, user.passwordHash]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createSession(user, ttlMs) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.pool.query(
      `
        INSERT INTO sessions (token, user_id, username, role, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [token, user.id, user.username, user.role, expiresAt.toISOString()]
    );
    return { token, expiresAt: expiresAt.getTime() };
  }

  async readSession(token) {
    const result = await this.pool.query(
      `
        SELECT token, user_id, username, role, expires_at
        FROM sessions
        WHERE token = $1
      `,
      [token]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const expiresAt = new Date(row.expires_at).getTime();
    if (expiresAt < Date.now()) {
      await this.deleteSession(token);
      return null;
    }

    return {
      user: {
        id: row.user_id,
        username: row.username,
        role: row.role,
      },
      expiresAt,
    };
  }

  async deleteSession(token) {
    await this.pool.query("DELETE FROM sessions WHERE token = $1", [token]);
  }

  async cleanupExpiredSessions() {
    await this.pool.query("DELETE FROM sessions WHERE expires_at < NOW()");
  }
}

const bootstrapAdminUser = await buildBootstrapAdminUser();
validateRuntimeConfig();

const repository = process.env.DATABASE_URL
  ? new PgRepository(process.env.DATABASE_URL, bootstrapAdminUser)
  : new FileRepository(runtimeFile, bootstrapAdminUser);
const deliveryStore = process.env.DATABASE_URL
  ? new DeliveryPgStore(process.env.DATABASE_URL)
  : new DeliveryFileStore(deliveryRuntimeFile);

app.use(setSecurityHeaders);
app.use(setCacheHeaders);

const loginRateLimiter = createRateLimiter({
  keyPrefix: "login",
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many login attempts. Please try again later.",
});
const publicFormRateLimiter = createRateLimiter({
  keyPrefix: "public-form",
  windowMs: 10 * 60 * 1000,
  maxRequests: 25,
  message: "Too many submissions. Please wait and try again.",
});

setInterval(cleanupRateLimits, 5 * 60 * 1000).unref();

function sanitizePublicData(data) {
  return {
    siteSettings: data.siteSettings,
    pages: data.pages.filter((page) => page.status === "published"),
    issues: data.issues.filter((issue) => issue.status === "published"),
    teamMembers: [...data.teamMembers].sort((a, b) => a.sortOrder - b.sortOrder),
    socialLinks: [...data.socialLinks].sort((a, b) => a.sortOrder - b.sortOrder),
    redirects: data.redirects.filter((redirect) => redirect.active),
    lettersSubmissions: data.lettersSubmissions
      .filter((letter) => letter.status === "approved")
      .map((letter) => {
        const { email, ...rest } = letter;
        void email;
        return rest;
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)),
    assets: data.assets,
  };
}

function sanitizeAdminData(data) {
  return {
    ...data,
    users: data.users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
    })),
    storage: getRuntimeDiagnostics(),
  };
}

function getRuntimeDiagnostics() {
  const bucketVars = {
    S3_BUCKET: Boolean(process.env.S3_BUCKET),
    S3_REGION: Boolean(process.env.S3_REGION),
    S3_ACCESS_KEY_ID: Boolean(process.env.S3_ACCESS_KEY_ID),
    S3_SECRET_ACCESS_KEY: Boolean(process.env.S3_SECRET_ACCESS_KEY),
    S3_ENDPOINT: Boolean(process.env.S3_ENDPOINT),
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === "true",
  };

  const resendVars = {
    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
    RESEND_FROM_EMAIL: Boolean(process.env.RESEND_FROM_EMAIL),
    RESEND_REPLY_TO: Boolean(process.env.RESEND_REPLY_TO),
  };

  return {
    database: process.env.DATABASE_URL ? "postgres" : "runtime-json",
    bucketConfigured: storageIsConfigured(),
    assetDeliveryMode: storageIsConfigured() ? "signed-app-route" : "external-url",
    publicSiteOrigin: getPublicSiteOrigin(),
    resendConfigured: resendIsConfigured(),
    bucketVars,
    resendVars,
  };
}

function storageIsConfigured() {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_REGION &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
  );
}

function createStorageClient() {
  return new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

async function deleteStorageKeys(keys) {
  const uniqueKeys = [...new Set((keys || []).filter(Boolean))];
  if (!uniqueKeys.length || !storageIsConfigured()) {
    return;
  }

  const client = createStorageClient();
  const chunkSize = 1000;
  for (let index = 0; index < uniqueKeys.length; index += chunkSize) {
    const batch = uniqueKeys.slice(index, index + chunkSize);
    if (batch.length === 1) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: batch[0],
        })
      );
      continue;
    }

    await client.send(
      new DeleteObjectsCommand({
        Bucket: process.env.S3_BUCKET,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
  }
}

async function listStorageKeysByPrefix(prefix) {
  if (!prefix || !storageIsConfigured()) {
    return [];
  }

  const client = createStorageClient();
  const keys = [];
  let continuationToken = undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    keys.push(...(response.Contents || []).map((entry) => entry.Key).filter(Boolean));
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

async function deleteStoragePrefix(prefix) {
  const keys = await listStorageKeysByPrefix(prefix);
  await deleteStorageKeys(keys);
  return keys;
}

function getAssetUrl(assetId) {
  return `/api/assets/${encodeURIComponent(assetId)}`;
}

function getAssetUrlTtlSeconds() {
  const configured = Number(process.env.ASSET_URL_SIGN_TTL_SECONDS || 900);
  if (!Number.isFinite(configured) || configured <= 0) {
    return 900;
  }

  return Math.min(Math.floor(configured), 60 * 60 * 24);
}

async function createSignedStorageUrl({
  key,
  contentType,
  disposition,
  filename,
}) {
  const client = createStorageClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ResponseContentType: contentType || undefined,
      ResponseContentDisposition:
        disposition && filename
          ? `${disposition}; filename="${filename.replace(/"/g, "")}"`
          : undefined,
    }),
    { expiresIn: getAssetUrlTtlSeconds() }
  );
}

function getSessionTtlMs() {
  const configuredSeconds = parsePositiveInteger(
    process.env.SESSION_TTL_SECONDS || "604800"
  );
  const ttlSeconds = configuredSeconds || 604800;
  return ttlSeconds * 1000;
}

async function createSession(user) {
  const ttlMs = getSessionTtlMs();
  if (repository instanceof PgRepository) {
    await repository.cleanupExpiredSessions();
    return repository.createSession(user, ttlMs);
  }

  const token = crypto.randomUUID();
  const expiresAt = Date.now() + ttlMs;
  sessions.set(token, {
    user,
    expiresAt,
  });
  return { token, expiresAt };
}

async function readSession(req) {
  const token = req.cookies.rh_session;
  if (!token) {
    return null;
  }

  if (repository instanceof PgRepository) {
    return repository.readSession(token);
  }

  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

async function destroySession(token) {
  if (!token) {
    return;
  }

  if (repository instanceof PgRepository) {
    await repository.deleteSession(token);
    return;
  }

  sessions.delete(token);
}

async function requireAdmin(req, res, next) {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (session.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  req.session = session;
  next();
}

function upsertById(list, item) {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) {
    return [...list, item];
  }

  return list.map((entry) => (entry.id === item.id ? item : entry));
}

function updateByMatch(list, matcher, updater) {
  return list.map((entry) => (matcher(entry) ? updater(entry) : entry));
}

function getIssueLabel(issueSlug, issues) {
  const issue = issues.find((entry) => entry.slug === issueSlug);
  return issue?.title || issueSlug;
}

function isEqualDataSnapshot(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function withData(mutator) {
  const data = await repository.getAllData();
  const nextData = await mutator(data);
  if (nextData && !isEqualDataSnapshot(nextData, data)) {
    await repository.writeAllData(nextData);
  }
  return nextData || data;
}

async function getRedirectForPath(pathname) {
  const data = await repository.getAllData();
  return data.redirects.find(
    (redirect) => redirect.active && redirect.sourcePath === pathname
  );
}

app.get("/api/bootstrap", async (_req, res) => {
  const data = await repository.getAllData();
  res.json(sanitizePublicData(data));
});

app.get("/api/auth/session", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.json({ authenticated: false });
    return;
  }

  res.json({
    authenticated: true,
    user: session.user,
  });
});

app.post("/api/auth/login", requireTrustedOrigin, loginRateLimiter, async (req, res) => {
  const { username, password } = req.body ?? {};
  const data = await repository.getAllData();
  const user = data.users.find((entry) => entry.username === username);

  if (!user || !password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const safeUser = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  const session = await createSession(safeUser);
  res.cookie("rh_session", session.token, {
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction,
    maxAge: getSessionTtlMs(),
    path: "/",
  });
  res.json({ ok: true, user: safeUser });
});

app.post("/api/auth/logout", requireTrustedOrigin, async (req, res) => {
  const token = req.cookies.rh_session;
  await destroySession(token);
  res.clearCookie("rh_session", {
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction,
    path: "/",
  });
  res.json({ ok: true });
});

app.get("/api/health", async (_req, res) => {
  if (repository instanceof PgRepository) {
    await repository.pool.query("SELECT 1");
  }

  res.json({
    ok: true,
    storage: process.env.DATABASE_URL ? "postgres" : "runtime-json",
    bucketConfigured: storageIsConfigured(),
  });
});

app.post("/api/public/letters", publicFormRateLimiter, async (req, res) => {
  const { name, email, issueSlug, message } = req.body ?? {};

  if (!name || !issueSlug || !message) {
    res.status(400).json({ error: "Name, issue, and message are required." });
    return;
  }

  const trimmed = {
    name: String(name).trim(),
    email: String(email || "").trim(),
    issueSlug: String(issueSlug).trim(),
    message: String(message).trim(),
  };

  if (!trimmed.name || !trimmed.issueSlug || !trimmed.message) {
    res.status(400).json({ error: "Name, issue, and message are required." });
    return;
  }

  await withData((data) => ({
    ...data,
    lettersSubmissions: [
      {
        id: crypto.randomUUID(),
        ...trimmed,
        status: "pending",
        featured: false,
        editorReply: "",
        publishedAt: null,
        createdAt: new Date().toISOString(),
      },
      ...data.lettersSubmissions,
    ],
  }));

  res.json({ ok: true });
});

app.get("/api/admin/data", requireAdmin, async (_req, res) => {
  const data = await repository.getAllData();
  res.json(sanitizeAdminData(data));
});

app.put("/api/admin/site-settings", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const payload = req.body?.siteSettings;
  if (!payload) {
    res.status(400).json({ error: "siteSettings payload is required" });
    return;
  }

  const next = await withData((data) => ({
    ...data,
    siteSettings: payload,
  }));
  res.json(sanitizeAdminData(next));
});

app.put("/api/admin/pages/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const payload = req.body?.page;
  if (!payload) {
    res.status(400).json({ error: "page payload is required" });
    return;
  }

  const next = await withData((data) => ({
    ...data,
    pages: updateByMatch(
      data.pages,
      (page) => page.id === req.params.id || page.slug === req.params.id,
      () => payload
    ),
  }));
  res.json(sanitizeAdminData(next));
});

app.put("/api/admin/issues/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const payload = req.body?.issue;
  if (!payload) {
    res.status(400).json({ error: "issue payload is required" });
    return;
  }

  const next = await withData((data) => ({
    ...data,
    issues: updateByMatch(
      data.issues,
      (issue) => issue.id === req.params.id || issue.slug === req.params.id,
      () => payload
    ),
  }));
  res.json(sanitizeAdminData(next));
});

app.put("/api/admin/team-members/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const payload = req.body?.teamMember;
  if (!payload) {
    res.status(400).json({ error: "teamMember payload is required" });
    return;
  }

  const next = await withData((data) => ({
    ...data,
    teamMembers: upsertById(data.teamMembers, payload),
  }));
  res.json(sanitizeAdminData(next));
});

app.put("/api/admin/social-links/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const payload = req.body?.socialLink;
  if (!payload) {
    res.status(400).json({ error: "socialLink payload is required" });
    return;
  }

  const next = await withData((data) => ({
    ...data,
    socialLinks: upsertById(data.socialLinks, payload),
  }));
  res.json(sanitizeAdminData(next));
});

app.put("/api/admin/redirects/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const payload = req.body?.redirect;
  if (!payload) {
    res.status(400).json({ error: "redirect payload is required" });
    return;
  }

  const next = await withData((data) => ({
    ...data,
    redirects: upsertById(data.redirects, payload),
  }));
  res.json(sanitizeAdminData(next));
});

app.put("/api/admin/letters/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const payload = req.body?.letter;
  if (!payload) {
    res.status(400).json({ error: "letter payload is required" });
    return;
  }

  const next = await withData((data) => ({
    ...data,
    lettersSubmissions: upsertById(data.lettersSubmissions, payload),
  }));
  res.json(sanitizeAdminData(next));
});

app.put("/api/admin/assets/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const payload = req.body?.asset;
  if (!payload) {
    res.status(400).json({ error: "asset payload is required" });
    return;
  }

  const next = await withData((data) => ({
    ...data,
    assets: upsertById(data.assets, payload),
  }));
  res.json(sanitizeAdminData(next));
});

app.post("/api/admin/assets/url", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const { label, url, category } = req.body ?? {};
  if (!label || !url) {
    res.status(400).json({ error: "label and url are required" });
    return;
  }

  const asset = {
    id: crypto.randomUUID(),
    label: String(label).trim(),
    url: String(url).trim(),
    storageType: "external-url",
    metadata: { category: String(category || "general").trim() },
  };

  const next = await withData((data) => ({
    ...data,
    assets: [asset, ...data.assets],
  }));
  res.json(sanitizeAdminData(next));
});

app.post(
  "/api/admin/assets/upload",
  requireTrustedOrigin,
  requireAdmin,
  upload.array("files"),
  async (req, res) => {
    if (!storageIsConfigured()) {
      res.status(501).json({
        error:
          "Bucket storage is not configured. Set the required S3_* variables before using uploads.",
      });
      return;
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      res.status(400).json({ error: "At least one file is required" });
      return;
    }

    const invalidFile = files.find((file) => !allowedUploadMimeTypes.has(file.mimetype));
    if (invalidFile) {
      await Promise.allSettled(
        files.map((file) => removeTempUpload(file.path))
      );
      res.status(400).json({
        error: "Unsupported file type. Upload a PDF, PNG, JPG, WEBP, GIF, or SVG.",
      });
      return;
    }

    const client = createStorageClient();

    try {
      const assets = [];

      for (const file of files) {
        const extension = path.extname(file.originalname) || "";
        const safeBase = path
          .basename(file.originalname, extension)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const key = `uploads/${Date.now()}-${safeBase || "asset"}${extension}`;
        const assetId = crypto.randomUUID();

        await client.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Body: createReadStream(file.path),
            ContentType: file.mimetype,
          })
        );

        assets.push({
          id: assetId,
          label:
            files.length === 1 && req.body.label
              ? req.body.label
              : file.originalname,
          url: getAssetUrl(assetId),
          storageType: "s3-bucket",
          metadata: {
            category: req.body.category || "upload",
            objectKey: key,
            contentType: file.mimetype,
            fileName: file.originalname,
            size: file.size,
          },
        });
      }

      const next = await withData((data) => ({
        ...data,
        assets: [...assets.reverse(), ...data.assets],
      }));
      res.json(sanitizeAdminData(next));
    } finally {
      await Promise.allSettled(files.map((file) => removeTempUpload(file.path)));
    }
  }
);

app.get("/api/assets/:id", async (req, res) => {
  const data = await repository.getAllData();
  const asset = data.assets.find((entry) => entry.id === req.params.id);

  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }

  if (asset.storageType === "external-url") {
    res.redirect(302, asset.url);
    return;
  }

  const objectKey = asset.metadata?.objectKey;
  if (!storageIsConfigured() || !objectKey) {
    res.status(404).json({ error: "Asset file is unavailable." });
    return;
  }

  const client = createStorageClient();
  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: objectKey,
      ResponseContentType: asset.metadata?.contentType || undefined,
    }),
    { expiresIn: getAssetUrlTtlSeconds() }
  );

  res.redirect(302, signedUrl);
});

app.get("/api/admin/letters", requireAdmin, async (_req, res) => {
  const data = await repository.getAllData();
  const enriched = data.lettersSubmissions
    .map((letter) => ({
      ...letter,
      issueLabel: getIssueLabel(letter.issueSlug, data.issues),
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ letters: enriched });
});

app.get("/api/admin/delivery/summary", requireAdmin, async (req, res) => {
  const summary = await deliveryStore.getSummary(req.session.user.id);
  res.json({
    summary,
    storage: {
      ...getRuntimeDiagnostics(),
      uploadsConfigured: storageIsConfigured(),
      deliveryMode: "app-owned-links",
    },
  });
});

app.get("/api/admin/delivery/projects", requireAdmin, async (req, res) => {
  const projects = await deliveryStore.listProjects(req.session.user.id);
  res.json({ projects });
});

app.get("/api/admin/delivery/projects/:id", requireAdmin, async (req, res) => {
  const detail = await deliveryStore.getProject(req.session.user.id, req.params.id);
  if (!detail) {
    res.status(404).json({ error: "Delivery project not found." });
    return;
  }

  res.json(detail);
});

app.delete(
  "/api/admin/delivery/projects/:id",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    const detail = await deliveryStore.getProject(req.session.user.id, req.params.id);
    if (!detail) {
      res.status(404).json({ error: "Delivery project not found." });
      return;
    }

    const knownKeys = detail.files.map((file) => file.storageKey).filter(Boolean);
    const prefix = `delivery/projects/${req.params.id}/`;

    try {
      await deleteStorageKeys(knownKeys);
      await deleteStoragePrefix(prefix);
      const result = await deliveryStore.deleteProject(req.session.user.id, req.params.id);
      res.json({
        deleted: true,
        projectId: req.params.id,
        deletedFiles: knownKeys.length,
        project: result,
      });
    } catch (error) {
      console.error("Project deletion failed", error);
      res.status(500).json({ error: "Project deletion failed. Bucket cleanup was not completed." });
    }
  }
);

app.delete(
  "/api/admin/delivery/projects/:id/files/:fileId",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    const detail = await deliveryStore.getProject(req.session.user.id, req.params.id);
    if (!detail) {
      res.status(404).json({ error: "Delivery project not found." });
      return;
    }

    const file = detail.files.find((entry) => entry.id === req.params.fileId);
    if (!file) {
      res.status(404).json({ error: "Delivery file not found." });
      return;
    }

    try {
      await deleteStorageKeys([file.storageKey]);
      const result = await deliveryStore.deleteFile(
        req.session.user.id,
        req.params.id,
        req.params.fileId
      );
      res.json({ deleted: true, file: result?.deletedFile || file, projectId: req.params.id });
    } catch (error) {
      console.error("Delivery file deletion failed", error);
      res.status(500).json({ error: "File deletion failed. Bucket cleanup was not completed." });
    }
  }
);

app.post("/api/admin/delivery/projects", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const { title, creatorName, description, shortMessage, slug } = req.body ?? {};

  if (!String(title || "").trim() || !String(creatorName || "").trim()) {
    res.status(400).json({ error: "title and creatorName are required." });
    return;
  }

  const project = await deliveryStore.createProject(req.session.user.id, {
    title,
    creatorName,
    description,
    shortMessage,
    slug,
  });

  res.status(201).json({ project });
});

app.post("/api/admin/delivery/import-preview", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const { csvText } = req.body ?? {};
  const preview = parseBackerCsv(csvText);
  res.json(preview);
});

app.post(
  "/api/admin/delivery/projects/:id/upload-cover",
  requireTrustedOrigin,
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    let tempFilePath = null;
    let previousCover = null;
    if (!storageIsConfigured()) {
      res.status(501).json({
        error:
          "Bucket storage is not configured. Set the required S3_* variables before using uploads.",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }

    tempFilePath = req.file.path;
    previousCover = (await deliveryStore.getProject(req.session.user.id, req.params.id))?.currentCover || null;
    const extension = path.extname(req.file.originalname) || "";
    const objectId = crypto.randomUUID();
    const key = `delivery/projects/${req.params.id}/covers/${objectId}${extension}`;
    const client = createStorageClient();

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: createReadStream(tempFilePath),
          ContentType: req.file.mimetype,
        })
      );

      const file = await deliveryStore.attachFile(req.session.user.id, req.params.id, {
        kind: "cover",
        storageKey: key,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSizeBytes: req.file.size,
      });

      if (!file) {
        res.status(404).json({ error: "Delivery project not found." });
        return;
      }

      if (previousCover?.id) {
        try {
          await deleteStorageKeys([previousCover.storageKey]);
          await deliveryStore.deleteFile(req.session.user.id, req.params.id, previousCover.id);
        } catch (cleanupError) {
          console.error("Previous cover cleanup failed", cleanupError);
        }
      }

      res.status(201).json({ file });
    } finally {
      await removeTempUpload(tempFilePath);
    }
  }
);

app.post(
  "/api/admin/delivery/projects/:id/upload-pdf",
  requireTrustedOrigin,
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    let tempFilePath = null;
    if (!storageIsConfigured()) {
      res.status(501).json({
        error:
          "Bucket storage is not configured. Set the required S3_* variables before using uploads.",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }

    const looksLikePdf =
      req.file.mimetype === "application/pdf" ||
      path.extname(req.file.originalname).toLowerCase() === ".pdf";

    if (!looksLikePdf) {
      res.status(400).json({ error: "Only PDF files are allowed here." });
      return;
    }

    tempFilePath = req.file.path;
    const objectId = crypto.randomUUID();
    const key = `delivery/projects/${req.params.id}/pdfs/${objectId}.pdf`;
    const client = createStorageClient();

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: createReadStream(tempFilePath),
          ContentType: "application/pdf",
          ContentLength: req.file.size,
        })
      );

      const file = await deliveryStore.attachFile(req.session.user.id, req.params.id, {
        kind: "pdf",
        storageKey: key,
        originalFilename: req.file.originalname,
        mimeType: "application/pdf",
        fileSizeBytes: req.file.size,
      });

      if (!file) {
        res.status(404).json({ error: "Delivery project not found." });
        return;
      }

      res.status(201).json({ file });
    } catch (error) {
      console.error("Delivery PDF upload failed", error);
      res.status(500).json({ error: "PDF upload failed. Check the server log for details." });
    } finally {
      await removeTempUpload(tempFilePath);
    }
  }
);

app.post(
  "/api/admin/delivery/projects/:id/import-backers",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    const { csvText } = req.body ?? {};
    const result = await deliveryStore.importBackers(
      req.session.user.id,
      req.params.id,
      csvText
    );

    if (!result) {
      res.status(404).json({ error: "Delivery project not found." });
      return;
    }

    res.json(result);
  }
);

app.post(
  "/api/admin/delivery/projects/:id/send-emails",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    if (!resendIsConfigured()) {
      res.status(501).json({
        error:
          "Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL before sending emails.",
      });
      return;
    }

    const detail = await deliveryStore.getProject(req.session.user.id, req.params.id);
    if (!detail) {
      res.status(404).json({ error: "Delivery project not found." });
      return;
    }

    if (!detail.currentPdf) {
      res.status(400).json({ error: "Upload a PDF before sending delivery emails." });
      return;
    }

    if (!detail.backers.length) {
      res.status(400).json({ error: "Import at least one backer before sending emails." });
      return;
    }

    const siteOrigin = getPublicSiteOrigin();
    const coverImageUrl = detail.currentCover
      ? `${siteOrigin}/api/delivery/files/${encodeURIComponent(detail.currentCover.id)}`
      : "";
    const sentBackerIds = [];
    const failures = [];

    for (const backer of detail.backers) {
      const accessUrl = `${siteOrigin}/a/${backer.accessToken}`;
      const email = buildDeliveryEmail({
        projectTitle: detail.project.title,
        creatorName: detail.project.creatorName,
        shortMessage: detail.project.shortMessage,
        accessUrl,
        coverImageUrl,
      });

      try {
        await sendResendEmail({
          to: backer.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
        sentBackerIds.push(backer.id);
      } catch (error) {
        failures.push({
          email: backer.email,
          message: error.message || "Send failed",
        });
      }
    }

    if (sentBackerIds.length) {
      await deliveryStore.markBackersEmailed(
        req.session.user.id,
        req.params.id,
        sentBackerIds
      );
    }

    res.json({
      ok: failures.length === 0,
      sentCount: sentBackerIds.length,
      failedCount: failures.length,
      failures,
    });
  }
);

app.get("/api/delivery/files/:id", async (req, res) => {
  const file = await deliveryStore.getFile(req.params.id);
  if (!file) {
    res.status(404).json({ error: "File not found." });
    return;
  }

  if (!storageIsConfigured() || !file.storageKey) {
    res.status(404).json({ error: "File is unavailable." });
    return;
  }

  const signedUrl = await createSignedStorageUrl({
    key: file.storageKey,
    contentType: file.mimeType,
    disposition: "inline",
    filename: file.originalFilename,
  });
  res.redirect(302, signedUrl);
});

app.get("/api/delivery/access/:token", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  if (!access) {
    res.status(404).json({ error: "This delivery link is invalid or unavailable." });
    return;
  }

  await deliveryStore.logAccessEvent(access.project.id, access.backer.id, "access_page_view");
  res.json({
    project: access.project,
    backer: {
      email: access.backer.email,
    },
    assets: {
      coverUrl: access.currentCover
        ? `/api/delivery/files/${encodeURIComponent(access.currentCover.id)}`
        : "",
    },
    file: access.currentPdf
      ? {
          id: access.currentPdf.id,
          originalFilename: access.currentPdf.originalFilename,
          versionNumber: access.currentPdf.versionNumber,
          fileSizeBytes: access.currentPdf.fileSizeBytes,
        }
      : null,
    actions: {
      downloadUrl: `/api/delivery/access/${encodeURIComponent(req.params.token)}/download`,
      readUrl: `/api/delivery/access/${encodeURIComponent(req.params.token)}/read`,
    },
  });
});

app.get("/api/delivery/access/:token/download", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  if (!access?.currentPdf) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!storageIsConfigured() || !access.currentPdf.storageKey) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  await deliveryStore.logAccessEvent(access.project.id, access.backer.id, "file_download");
  const signedUrl = await createSignedStorageUrl({
    key: access.currentPdf.storageKey,
    contentType: access.currentPdf.mimeType,
    disposition: "attachment",
    filename: access.currentPdf.originalFilename,
  });
  res.redirect(302, signedUrl);
});

app.get("/api/delivery/access/:token/read", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  if (!access?.currentPdf) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!storageIsConfigured() || !access.currentPdf.storageKey) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  await deliveryStore.logAccessEvent(access.project.id, access.backer.id, "read_inline");
  const signedUrl = await createSignedStorageUrl({
    key: access.currentPdf.storageKey,
    contentType: access.currentPdf.mimeType,
    disposition: "inline",
    filename: access.currentPdf.originalFilename,
  });
  res.redirect(302, signedUrl);
});

app.use(async (req, res, next) => {
  if (
    req.path.startsWith("/api") ||
    req.path.startsWith("/src") ||
    req.path.startsWith("/node_modules")
  ) {
    next();
    return;
  }

  const redirect = await getRedirectForPath(req.path);
  if (!redirect) {
    next();
    return;
  }

  res.redirect(Number(redirect.type) || 302, redirect.destination);
});

let hasBuildOutput = false;
try {
  await fs.access(distIndexFile);
  hasBuildOutput = true;
} catch {
  hasBuildOutput = false;
}

if (hasBuildOutput) {
  app.use(
    express.static(distDir, {
      setHeaders(res, filePath) {
        const relativePath = path.relative(distDir, filePath).replace(/\\/g, "/");
        if (relativePath === "index.html") {
          res.setHeader("Cache-Control", "no-cache");
          return;
        }

        if (/^assets\/.+-[A-Za-z0-9_-]+\.(css|js|mjs)$/.test(relativePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }

        res.setHeader("Cache-Control", "public, max-age=3600");
      },
    })
  );

  app.get("/{*path}", async (req, res) => {
    try {
      await fs.access(distIndexFile);
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(distIndexFile);
    } catch {
      res.status(500).send("Build output not found. Run npm run build first.");
    }
  });
}

app.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({
      error: `Upload is too large. Max file size is ${Math.round(
        uploadFileSizeLimitBytes / (1024 * 1024)
      )} MB.`,
    });
    return;
  }

  next(error);
});

await repository.init();
await deliveryStore.init();

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(
    `Renowned Home API listening on http://localhost:${port} using ${
      process.env.DATABASE_URL ? "Postgres" : "runtime JSON"
    } storage`
  );
  if (!process.env.DATABASE_URL) {
    console.log(
      `Local content persists in ${runtimeFile}. Default admin login: admin / renownedhome-dev`
    );
  }
  if (!hasBuildOutput) {
    console.log(
      "No dist build found. Frontend static files will not be served until npm run build has been run."
    );
  }
});

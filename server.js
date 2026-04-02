import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";
import pg from "pg";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  cloneDefaultSiteData,
} from "./src/content/defaultSiteData.js";
import {
  DeliveryFileStore,
  DeliveryPgStore,
  parseBackerCsv,
} from "./src/lib/deliveryStore.js";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runtimeDir = path.join(__dirname, "runtime");
const runtimeFile = path.join(runtimeDir, "content-store.json");
const deliveryRuntimeFile = path.join(runtimeDir, "delivery-store.json");
const distDir = path.join(__dirname, "dist");
const distIndexFile = path.join(distDir, "index.html");
const upload = multer({ storage: multer.memoryStorage() });
const app = express();
const sessions = new Map();
const isProduction = process.env.NODE_ENV === "production";

app.use(express.json({ limit: "3mb" }));
app.use(cookieParser());

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
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
    storage: {
      database: process.env.DATABASE_URL ? "postgres" : "runtime-json",
      bucketConfigured: storageIsConfigured(),
      assetDeliveryMode: storageIsConfigured() ? "signed-app-route" : "external-url",
    },
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

async function withData(mutator) {
  const data = await repository.getAllData();
  const nextData = await mutator(data);
  if (nextData) {
    await repository.writeAllData(nextData);
  }
  return nextData;
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

app.post("/api/auth/login", async (req, res) => {
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

  const safeUser = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  const session = await createSession(safeUser);
  res.cookie("rh_session", session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: getSessionTtlMs(),
  });
  res.json({ ok: true, user: safeUser });
});

app.post("/api/auth/logout", async (req, res) => {
  const token = req.cookies.rh_session;
  await destroySession(token);
  res.clearCookie("rh_session");
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

app.post("/api/public/letters", async (req, res) => {
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

app.put("/api/admin/site-settings", requireAdmin, async (req, res) => {
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

app.put("/api/admin/pages/:id", requireAdmin, async (req, res) => {
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

app.put("/api/admin/issues/:id", requireAdmin, async (req, res) => {
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

app.put("/api/admin/team-members/:id", requireAdmin, async (req, res) => {
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

app.put("/api/admin/social-links/:id", requireAdmin, async (req, res) => {
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

app.put("/api/admin/redirects/:id", requireAdmin, async (req, res) => {
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

app.put("/api/admin/letters/:id", requireAdmin, async (req, res) => {
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

app.put("/api/admin/assets/:id", requireAdmin, async (req, res) => {
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

app.post("/api/admin/assets/url", requireAdmin, async (req, res) => {
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
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
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

    const extension = path.extname(req.file.originalname) || "";
    const safeBase = path
      .basename(req.file.originalname, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const key = `uploads/${Date.now()}-${safeBase || "asset"}${extension}`;
    const client = createStorageClient();
    const assetId = crypto.randomUUID();

    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const asset = {
      id: assetId,
      label: req.body.label || req.file.originalname,
      url: getAssetUrl(assetId),
      storageType: "s3-bucket",
      metadata: {
        category: req.body.category || "upload",
        objectKey: key,
        contentType: req.file.mimetype,
        fileName: req.file.originalname,
        size: req.file.size,
      },
    };

    const next = await withData((data) => ({
      ...data,
      assets: [asset, ...data.assets],
    }));
    res.json(sanitizeAdminData(next));
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
      database: process.env.DATABASE_URL ? "postgres" : "runtime-json",
      uploadsConfigured: storageIsConfigured(),
      deliveryMode: "app-owned-links",
    },
  });
});

app.get("/api/admin/delivery/projects", requireAdmin, async (req, res) => {
  const projects = await deliveryStore.listProjects(req.session.user.id);
  res.json({ projects });
});

app.post("/api/admin/delivery/projects", requireAdmin, async (req, res) => {
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

app.post("/api/admin/delivery/import-preview", requireAdmin, async (req, res) => {
  const { csvText } = req.body ?? {};
  const preview = parseBackerCsv(csvText);
  res.json(preview);
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
  app.use(express.static(distDir));

  app.get("/{*path}", async (req, res) => {
    try {
      await fs.access(distIndexFile);
      res.sendFile(distIndexFile);
    } catch {
      res.status(500).send("Build output not found. Run npm run build first.");
    }
  });
}

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

import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isEmailLike(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildProjectStatus(project) {
  if (project.archivedAt) {
    return "archived";
  }

  if (project.lastDeliveredAt) {
    return "delivered";
  }

  if (project.backerCount > 0) {
    return "ready";
  }

  return "draft";
}

export function parseBackerCsv(csvText) {
  const input = String(csvText || "").replace(/^\uFEFF/, "");
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return {
      rows: [],
      validRows: [],
      invalidRows: [],
      duplicateRows: [],
      summary: {
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
      },
    };
  }

  const firstColumns = lines[0].split(",").map((cell) => cell.trim().toLowerCase());
  const emailIndex = firstColumns.findIndex((cell) => cell === "email");
  const hasHeader = emailIndex >= 0;
  const rows = [];
  const validRows = [];
  const invalidRows = [];
  const duplicateRows = [];
  const seenEmails = new Set();

  for (let index = hasHeader ? 1 : 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const columns = raw.split(",").map((cell) => cell.trim());
    const email = normalizeEmail(hasHeader ? columns[emailIndex] : columns[0]);
    const row = {
      rowNumber: index + 1,
      raw,
      email,
      status: "valid",
    };

    if (!email || !isEmailLike(email)) {
      row.status = "invalid";
      invalidRows.push(row);
      rows.push(row);
      continue;
    }

    if (seenEmails.has(email)) {
      row.status = "duplicate";
      duplicateRows.push(row);
      rows.push(row);
      continue;
    }

    seenEmails.add(email);
    validRows.push(row);
    rows.push(row);
  }

  return {
    rows,
    validRows,
    invalidRows,
    duplicateRows,
    summary: {
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      duplicateCount: duplicateRows.length,
    },
  };
}

export class DeliveryFileStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.write({
        projects: [],
        backers: [],
        deliveries: [],
        accessEvents: [],
      });
    }
  }

  async read() {
    const raw = await fs.readFile(this.filePath, "utf8");
    return JSON.parse(raw);
  }

  async write(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async listProjects(userId) {
    const data = await this.read();
    return data.projects
      .filter((project) => project.userId === userId)
      .map((project) => {
        const backers = data.backers.filter((backer) => backer.projectId === project.id);
        const downloadCount = data.accessEvents.filter(
          (event) => event.projectId === project.id && event.eventType === "file_download"
        ).length;

        return {
          ...project,
          backerCount: backers.length,
          emailedCount: backers.filter((backer) => backer.lastEmailedAt).length,
          downloadCount,
          status: buildProjectStatus({
            ...project,
            backerCount: backers.length,
          }),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async createProject(userId, payload) {
    const data = await this.read();
    const now = new Date().toISOString();
    const project = {
      id: crypto.randomUUID(),
      userId,
      title: String(payload.title || "").trim(),
      slug: slugify(payload.slug || payload.title),
      creatorName: String(payload.creatorName || "").trim(),
      description: String(payload.description || "").trim(),
      shortMessage: String(payload.shortMessage || "").trim(),
      status: "draft",
      coverAssetId: null,
      activePdfFileId: null,
      lastDeliveredAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    data.projects.unshift(project);
    await this.write(data);
    return {
      ...project,
      backerCount: 0,
      emailedCount: 0,
      downloadCount: 0,
      status: "draft",
    };
  }

  async getSummary(userId) {
    const projects = await this.listProjects(userId);
    return {
      totalProjects: projects.length,
      readyProjects: projects.filter((project) => project.status === "ready").length,
      deliveredProjects: projects.filter((project) => project.status === "delivered").length,
      totalBackers: projects.reduce((sum, project) => sum + project.backerCount, 0),
      totalDownloads: projects.reduce((sum, project) => sum + project.downloadCount, 0),
    };
  }
}

export class DeliveryPgStore {
  constructor(connectionString) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_projects (
        id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        creator_name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        short_message TEXT NOT NULL DEFAULT '',
        cover_asset_id TEXT NULL,
        active_pdf_file_id UUID NULL,
        last_delivered_at TIMESTAMPTZ NULL,
        archived_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_backers (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES delivery_projects(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        normalized_email TEXT NOT NULL,
        access_token_hash TEXT NULL,
        last_emailed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (project_id, normalized_email)
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_access_events (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES delivery_projects(id) ON DELETE CASCADE,
        backer_id UUID NULL REFERENCES delivery_backers(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async listProjects(userId) {
    const result = await this.pool.query(
      `
        SELECT
          p.id,
          p.user_id AS "userId",
          p.title,
          p.slug,
          p.creator_name AS "creatorName",
          p.description,
          p.short_message AS "shortMessage",
          p.cover_asset_id AS "coverAssetId",
          p.active_pdf_file_id AS "activePdfFileId",
          p.last_delivered_at AS "lastDeliveredAt",
          p.archived_at AS "archivedAt",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          COUNT(DISTINCT b.id)::INT AS "backerCount",
          COUNT(DISTINCT b.id) FILTER (WHERE b.last_emailed_at IS NOT NULL)::INT AS "emailedCount",
          COUNT(ae.id) FILTER (WHERE ae.event_type = 'file_download')::INT AS "downloadCount"
        FROM delivery_projects p
        LEFT JOIN delivery_backers b ON b.project_id = p.id
        LEFT JOIN delivery_access_events ae ON ae.project_id = p.id
        WHERE p.user_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `,
      [userId]
    );

    return result.rows.map((row) => ({
      ...row,
      status: buildProjectStatus(row),
    }));
  }

  async createProject(userId, payload) {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `
        INSERT INTO delivery_projects (
          id,
          user_id,
          title,
          slug,
          creator_name,
          description,
          short_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          user_id AS "userId",
          title,
          slug,
          creator_name AS "creatorName",
          description,
          short_message AS "shortMessage",
          cover_asset_id AS "coverAssetId",
          active_pdf_file_id AS "activePdfFileId",
          last_delivered_at AS "lastDeliveredAt",
          archived_at AS "archivedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        id,
        userId,
        String(payload.title || "").trim(),
        slugify(payload.slug || payload.title),
        String(payload.creatorName || "").trim(),
        String(payload.description || "").trim(),
        String(payload.shortMessage || "").trim(),
      ]
    );

    return {
      ...result.rows[0],
      backerCount: 0,
      emailedCount: 0,
      downloadCount: 0,
      status: "draft",
    };
  }

  async getSummary(userId) {
    const projects = await this.listProjects(userId);
    return {
      totalProjects: projects.length,
      readyProjects: projects.filter((project) => project.status === "ready").length,
      deliveredProjects: projects.filter((project) => project.status === "delivered").length,
      totalBackers: projects.reduce((sum, project) => sum + project.backerCount, 0),
      totalDownloads: projects.reduce((sum, project) => sum + project.downloadCount, 0),
    };
  }
}

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

function createToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function buildProjectStatus(project) {
  if (project.archivedAt) {
    return "archived";
  }

  if (project.lastDeliveredAt) {
    return "delivered";
  }

  if (project.backerCount > 0 && project.activePdfFileId) {
    return "ready";
  }

  return "draft";
}

function summarizeProject(project, backers, accessEvents) {
  const downloadCount = accessEvents.filter(
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
}

function createImportSummary(preview, importedCount, skippedExistingCount) {
  return {
    totalRows: preview.summary.totalRows,
    validCount: preview.summary.validCount,
    invalidCount: preview.summary.invalidCount,
    duplicateCount: preview.summary.duplicateCount,
    importedCount,
    skippedExistingCount,
  };
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
        files: [],
        backers: [],
        deliveries: [],
        accessEvents: [],
      });
      return;
    }

    const data = await this.read();
    const nextData = {
      projects: Array.isArray(data.projects) ? data.projects : [],
      files: Array.isArray(data.files) ? data.files : [],
      backers: Array.isArray(data.backers) ? data.backers : [],
      deliveries: Array.isArray(data.deliveries) ? data.deliveries : [],
      accessEvents: Array.isArray(data.accessEvents) ? data.accessEvents : [],
    };

    await this.write(nextData);
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
      .map((project) =>
        summarizeProject(
          project,
          data.backers.filter((backer) => backer.projectId === project.id),
          data.accessEvents
        )
      )
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
      coverFileId: null,
      activePdfFileId: null,
      lastDeliveredAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    data.projects.unshift(project);
    await this.write(data);
    return summarizeProject(project, [], []);
  }

  async getProject(userId, projectId) {
    const data = await this.read();
    const project = data.projects.find(
      (entry) => entry.id === projectId && entry.userId === userId
    );

    if (!project) {
      return null;
    }

    const backers = data.backers.filter((backer) => backer.projectId === project.id);
    const files = data.files.filter((file) => file.projectId === project.id);
    return {
      project: summarizeProject(project, backers, data.accessEvents),
      currentCover: files.find((file) => file.id === project.coverFileId) || null,
      currentPdf: files.find((file) => file.id === project.activePdfFileId) || null,
      files: files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      backers: backers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    };
  }

  async attachFile(userId, projectId, payload) {
    const data = await this.read();
    const projectIndex = data.projects.findIndex(
      (entry) => entry.id === projectId && entry.userId === userId
    );

    if (projectIndex === -1) {
      return null;
    }

    const project = data.projects[projectIndex];
    const previousFiles = data.files.filter(
      (file) => file.projectId === projectId && file.kind === payload.kind
    );
    const nextVersion = payload.kind === "pdf" ? previousFiles.length + 1 : 1;
    const now = new Date().toISOString();
    const file = {
      id: crypto.randomUUID(),
      projectId,
      kind: payload.kind,
      storageKey: payload.storageKey,
      originalFilename: payload.originalFilename,
      mimeType: payload.mimeType,
      fileSizeBytes: payload.fileSizeBytes,
      versionNumber: nextVersion,
      isActive: true,
      createdAt: now,
    };

    data.files = data.files.map((entry) =>
      entry.projectId === projectId && entry.kind === payload.kind
        ? { ...entry, isActive: false }
        : entry
    );
    data.files.unshift(file);

    data.projects[projectIndex] = {
      ...project,
      coverFileId: payload.kind === "cover" ? file.id : project.coverFileId,
      activePdfFileId: payload.kind === "pdf" ? file.id : project.activePdfFileId,
      updatedAt: now,
    };

    await this.write(data);
    return file;
  }

  async deleteProject(userId, projectId) {
    const data = await this.read();
    const project = data.projects.find(
      (entry) => entry.id === projectId && entry.userId === userId
    );

    if (!project) {
      return null;
    }

    const files = data.files.filter((file) => file.projectId === projectId);
    data.projects = data.projects.filter((entry) => entry.id !== projectId);
    data.files = data.files.filter((file) => file.projectId !== projectId);
    data.backers = data.backers.filter((backer) => backer.projectId !== projectId);
    data.accessEvents = data.accessEvents.filter((event) => event.projectId !== projectId);
    await this.write(data);

    return {
      projectId,
      deletedFileKeys: files.map((file) => file.storageKey).filter(Boolean),
      projectPrefix: `delivery/projects/${projectId}/`,
    };
  }

  async deleteFile(userId, projectId, fileId) {
    const data = await this.read();
    const projectIndex = data.projects.findIndex(
      (entry) => entry.id === projectId && entry.userId === userId
    );

    if (projectIndex === -1) {
      return null;
    }

    const file = data.files.find((entry) => entry.id === fileId && entry.projectId === projectId);
    if (!file) {
      return null;
    }

    const project = data.projects[projectIndex];
    const remainingFiles = data.files.filter((entry) => entry.id !== fileId);
    const nextProject = { ...project, updatedAt: new Date().toISOString() };

    if (file.kind === "cover" && project.coverFileId === fileId) {
      nextProject.coverFileId = null;
    } else if (file.kind === "pdf" && project.activePdfFileId === fileId) {
      const nextPdf = remainingFiles
        .filter((entry) => entry.projectId === projectId && entry.kind === "pdf")
        .sort((a, b) => {
          if (b.versionNumber !== a.versionNumber) {
            return b.versionNumber - a.versionNumber;
          }
          return new Date(b.createdAt) - new Date(a.createdAt);
        })[0] || null;

      nextProject.activePdfFileId = nextPdf?.id || null;
      data.files = remainingFiles.map((entry) =>
        entry.projectId === projectId && entry.kind === "pdf"
          ? { ...entry, isActive: entry.id === nextProject.activePdfFileId }
          : entry
      );
    } else {
      data.files = remainingFiles;
    }

    if (file.kind === "cover") {
      data.files = remainingFiles;
    }

    data.projects[projectIndex] = nextProject;
    await this.write(data);

    return {
      deletedFile: file,
      nextActivePdfFileId: nextProject.activePdfFileId,
      nextCoverFileId: nextProject.coverFileId,
    };
  }

  async importBackers(userId, projectId, csvText) {
    const data = await this.read();
    const project = data.projects.find(
      (entry) => entry.id === projectId && entry.userId === userId
    );

    if (!project) {
      return null;
    }

    const preview = parseBackerCsv(csvText);
    const existingEmails = new Set(
      data.backers
        .filter((backer) => backer.projectId === projectId)
        .map((backer) => backer.normalizedEmail)
    );
    const now = new Date().toISOString();
    let importedCount = 0;
    let skippedExistingCount = 0;

    for (const row of preview.validRows) {
      if (existingEmails.has(row.email)) {
        skippedExistingCount += 1;
        continue;
      }

      existingEmails.add(row.email);
      importedCount += 1;
      data.backers.unshift({
        id: crypto.randomUUID(),
        projectId,
        email: row.email,
        normalizedEmail: row.email,
        accessToken: createToken(),
        lastEmailedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    data.projects = data.projects.map((entry) =>
      entry.id === projectId ? { ...entry, updatedAt: now } : entry
    );
    await this.write(data);

    return {
      summary: createImportSummary(preview, importedCount, skippedExistingCount),
    };
  }

  async getFile(fileId) {
    const data = await this.read();
    return data.files.find((file) => file.id === fileId) || null;
  }

  async getAccessByToken(token) {
    const data = await this.read();
    const backer = data.backers.find((entry) => entry.accessToken === token);
    if (!backer) {
      return null;
    }

    const project = data.projects.find((entry) => entry.id === backer.projectId);
    if (!project || !project.activePdfFileId) {
      return null;
    }

    const currentPdf = data.files.find((file) => file.id === project.activePdfFileId) || null;
    const currentCover = data.files.find((file) => file.id === project.coverFileId) || null;

    return {
      project,
      backer,
      currentPdf,
      currentCover,
    };
  }

  async logAccessEvent(projectId, backerId, eventType) {
    const data = await this.read();
    data.accessEvents.unshift({
      id: crypto.randomUUID(),
      projectId,
      backerId,
      eventType,
      createdAt: new Date().toISOString(),
    });
    await this.write(data);
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

  async markBackersEmailed(userId, projectId, backerIds) {
    const data = await this.read();
    const project = data.projects.find(
      (entry) => entry.id === projectId && entry.userId === userId
    );

    if (!project) {
      return null;
    }

    const emailedIds = new Set(backerIds);
    const now = new Date().toISOString();
    data.backers = data.backers.map((backer) =>
      backer.projectId === projectId && emailedIds.has(backer.id)
        ? { ...backer, lastEmailedAt: now, updatedAt: now }
        : backer
    );
    data.projects = data.projects.map((entry) =>
      entry.id === projectId
        ? { ...entry, lastDeliveredAt: now, updatedAt: now }
        : entry
    );
    await this.write(data);
    return { sentCount: emailedIds.size, lastDeliveredAt: now };
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
        cover_file_id UUID NULL,
        active_pdf_file_id UUID NULL,
        last_delivered_at TIMESTAMPTZ NULL,
        archived_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(
      `ALTER TABLE delivery_projects ADD COLUMN IF NOT EXISTS cover_file_id UUID NULL`
    );
    await this.pool.query(
      `ALTER TABLE delivery_projects ADD COLUMN IF NOT EXISTS active_pdf_file_id UUID NULL`
    );
    await this.pool.query(
      `ALTER TABLE delivery_projects ADD COLUMN IF NOT EXISTS last_delivered_at TIMESTAMPTZ NULL`
    );
    await this.pool.query(
      `ALTER TABLE delivery_projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL`
    );
    await this.pool.query(
      `ALTER TABLE delivery_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    );

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_files (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES delivery_projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size_bytes BIGINT NOT NULL,
        version_number INT NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_backers (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES delivery_projects(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        normalized_email TEXT NOT NULL,
        access_token TEXT NOT NULL,
        last_emailed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (project_id, normalized_email)
      );
    `);
    await this.pool.query(
      `ALTER TABLE delivery_backers ADD COLUMN IF NOT EXISTS access_token TEXT NULL`
    );
    await this.pool.query(
      `ALTER TABLE delivery_backers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    );
    await this.pool.query(`
      UPDATE delivery_backers
      SET access_token = access_token_hash
      WHERE access_token IS NULL
        AND access_token_hash IS NOT NULL
        AND access_token_hash <> ''
    `).catch(() => {});
    const missingTokenRows = await this.pool
      .query(`SELECT id FROM delivery_backers WHERE access_token IS NULL OR access_token = ''`)
      .catch(() => ({ rows: [] }));
    for (const row of missingTokenRows.rows) {
      await this.pool.query(
        `UPDATE delivery_backers SET access_token = $2 WHERE id = $1`,
        [row.id, createToken()]
      );
    }

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
          p.cover_file_id AS "coverFileId",
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
          cover_file_id AS "coverFileId",
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

  async getProject(userId, projectId) {
    const projectResult = await this.pool.query(
      `
        SELECT
          p.id,
          p.user_id AS "userId",
          p.title,
          p.slug,
          p.creator_name AS "creatorName",
          p.description,
          p.short_message AS "shortMessage",
          p.cover_file_id AS "coverFileId",
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
        WHERE p.user_id = $1 AND p.id = $2
        GROUP BY p.id
      `,
      [userId, projectId]
    );

    const project = projectResult.rows[0];
    if (!project) {
      return null;
    }

    const [filesResult, backersResult] = await Promise.all([
      this.pool.query(
        `
          SELECT
            id,
            project_id AS "projectId",
            kind,
            storage_key AS "storageKey",
            original_filename AS "originalFilename",
            mime_type AS "mimeType",
            file_size_bytes::INT AS "fileSizeBytes",
            version_number AS "versionNumber",
            is_active AS "isActive",
            created_at AS "createdAt"
          FROM delivery_files
          WHERE project_id = $1
          ORDER BY created_at DESC
        `,
        [projectId]
      ),
      this.pool.query(
        `
          SELECT
            id,
            project_id AS "projectId",
            email,
            normalized_email AS "normalizedEmail",
            access_token AS "accessToken",
            last_emailed_at AS "lastEmailedAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM delivery_backers
          WHERE project_id = $1
          ORDER BY created_at DESC
        `,
        [projectId]
      ),
    ]);

    const files = filesResult.rows;
    return {
      project: {
        ...project,
        status: buildProjectStatus(project),
      },
      currentCover: files.find((file) => file.id === project.coverFileId) || null,
      currentPdf: files.find((file) => file.id === project.activePdfFileId) || null,
      files,
      backers: backersResult.rows,
    };
  }

  async attachFile(userId, projectId, payload) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const projectResult = await client.query(
        `SELECT id, cover_file_id AS "coverFileId" FROM delivery_projects WHERE id = $1 AND user_id = $2`,
        [projectId, userId]
      );
      if (!projectResult.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }

      const versionResult = await client.query(
        `SELECT COUNT(*)::INT AS count FROM delivery_files WHERE project_id = $1 AND kind = $2`,
        [projectId, payload.kind]
      );
      const versionNumber = payload.kind === "pdf" ? versionResult.rows[0].count + 1 : 1;
      const fileId = crypto.randomUUID();

      await client.query(
        `UPDATE delivery_files SET is_active = FALSE WHERE project_id = $1 AND kind = $2`,
        [projectId, payload.kind]
      );
      await client.query(
        `
          INSERT INTO delivery_files (
            id,
            project_id,
            kind,
            storage_key,
            original_filename,
            mime_type,
            file_size_bytes,
            version_number,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
        `,
        [
          fileId,
          projectId,
          payload.kind,
          payload.storageKey,
          payload.originalFilename,
          payload.mimeType,
          payload.fileSizeBytes,
          versionNumber,
        ]
      );
      await client.query(
        `
          UPDATE delivery_projects
          SET
            cover_file_id = CASE WHEN $3 = 'cover' THEN $4 ELSE cover_file_id END,
            active_pdf_file_id = CASE WHEN $3 = 'pdf' THEN $4 ELSE active_pdf_file_id END,
            updated_at = NOW()
          WHERE id = $1 AND user_id = $2
        `,
        [projectId, userId, payload.kind, fileId]
      );
      await client.query("COMMIT");

      return {
        id: fileId,
        projectId,
        kind: payload.kind,
        storageKey: payload.storageKey,
        originalFilename: payload.originalFilename,
        mimeType: payload.mimeType,
        fileSizeBytes: payload.fileSizeBytes,
        versionNumber,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProject(userId, projectId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const projectResult = await client.query(
        `SELECT id FROM delivery_projects WHERE id = $1 AND user_id = $2`,
        [projectId, userId]
      );
      if (!projectResult.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }

      const filesResult = await client.query(
        `SELECT storage_key AS "storageKey" FROM delivery_files WHERE project_id = $1`,
        [projectId]
      );
      await client.query(`DELETE FROM delivery_projects WHERE id = $1 AND user_id = $2`, [
        projectId,
        userId,
      ]);
      await client.query("COMMIT");

      return {
        projectId,
        deletedFileKeys: filesResult.rows.map((row) => row.storageKey).filter(Boolean),
        projectPrefix: `delivery/projects/${projectId}/`,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteFile(userId, projectId, fileId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const projectResult = await client.query(
        `
          SELECT
            id,
            cover_file_id AS "coverFileId",
            active_pdf_file_id AS "activePdfFileId"
          FROM delivery_projects
          WHERE id = $1 AND user_id = $2
        `,
        [projectId, userId]
      );
      const project = projectResult.rows[0];
      if (!project) {
        await client.query("ROLLBACK");
        return null;
      }

      const fileResult = await client.query(
        `
          SELECT
            id,
            project_id AS "projectId",
            kind,
            storage_key AS "storageKey",
            original_filename AS "originalFilename",
            mime_type AS "mimeType",
            file_size_bytes::INT AS "fileSizeBytes",
            version_number AS "versionNumber",
            is_active AS "isActive",
            created_at AS "createdAt"
          FROM delivery_files
          WHERE id = $1 AND project_id = $2
        `,
        [fileId, projectId]
      );
      const file = fileResult.rows[0];
      if (!file) {
        await client.query("ROLLBACK");
        return null;
      }

      let nextActivePdfFileId = project.activePdfFileId;
      let nextCoverFileId = project.coverFileId;

      if (file.kind === "cover" && project.coverFileId === fileId) {
        nextCoverFileId = null;
      } else if (file.kind === "pdf" && project.activePdfFileId === fileId) {
        const nextPdfResult = await client.query(
          `
            SELECT id
            FROM delivery_files
            WHERE project_id = $1 AND kind = 'pdf' AND id <> $2
            ORDER BY version_number DESC, created_at DESC
            LIMIT 1
          `,
          [projectId, fileId]
        );
        nextActivePdfFileId = nextPdfResult.rows[0]?.id || null;
      }

      await client.query(`DELETE FROM delivery_files WHERE id = $1 AND project_id = $2`, [
        fileId,
        projectId,
      ]);

      if (file.kind === "pdf") {
        await client.query(`UPDATE delivery_files SET is_active = FALSE WHERE project_id = $1 AND kind = 'pdf'`, [
          projectId,
        ]);
        if (nextActivePdfFileId) {
          await client.query(`UPDATE delivery_files SET is_active = TRUE WHERE id = $1`, [
            nextActivePdfFileId,
          ]);
        }
      }

      await client.query(
        `
          UPDATE delivery_projects
          SET
            cover_file_id = $3,
            active_pdf_file_id = $4,
            updated_at = NOW()
          WHERE id = $1 AND user_id = $2
        `,
        [projectId, userId, nextCoverFileId, nextActivePdfFileId]
      );

      await client.query("COMMIT");

      return {
        deletedFile: file,
        nextActivePdfFileId,
        nextCoverFileId,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async importBackers(userId, projectId, csvText) {
    const preview = parseBackerCsv(csvText);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const projectResult = await client.query(
        `SELECT id FROM delivery_projects WHERE id = $1 AND user_id = $2`,
        [projectId, userId]
      );
      if (!projectResult.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }

      const existingResult = await client.query(
        `SELECT normalized_email AS "normalizedEmail" FROM delivery_backers WHERE project_id = $1`,
        [projectId]
      );
      const existingEmails = new Set(
        existingResult.rows.map((row) => row.normalizedEmail)
      );
      let importedCount = 0;
      let skippedExistingCount = 0;

      for (const row of preview.validRows) {
        if (existingEmails.has(row.email)) {
          skippedExistingCount += 1;
          continue;
        }

        existingEmails.add(row.email);
        importedCount += 1;
        await client.query(
          `
            INSERT INTO delivery_backers (
              id,
              project_id,
              email,
              normalized_email,
              access_token
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
          [crypto.randomUUID(), projectId, row.email, row.email, createToken()]
        );
      }

      await client.query(
        `UPDATE delivery_projects SET updated_at = NOW() WHERE id = $1`,
        [projectId]
      );
      await client.query("COMMIT");

      return {
        summary: createImportSummary(preview, importedCount, skippedExistingCount),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getFile(fileId) {
    const result = await this.pool.query(
      `
        SELECT
          id,
          project_id AS "projectId",
          kind,
          storage_key AS "storageKey",
          original_filename AS "originalFilename",
          mime_type AS "mimeType",
          file_size_bytes::INT AS "fileSizeBytes",
          version_number AS "versionNumber",
          is_active AS "isActive",
          created_at AS "createdAt"
        FROM delivery_files
        WHERE id = $1
      `,
      [fileId]
    );
    return result.rows[0] || null;
  }

  async getAccessByToken(token) {
    const result = await this.pool.query(
      `
        SELECT
          p.id AS "projectId",
          p.title,
          p.creator_name AS "creatorName",
          p.description,
          p.short_message AS "shortMessage",
          p.cover_file_id AS "coverFileId",
          p.active_pdf_file_id AS "activePdfFileId",
          b.id AS "backerId",
          b.email,
          b.access_token AS "accessToken"
        FROM delivery_backers b
        INNER JOIN delivery_projects p ON p.id = b.project_id
        WHERE b.access_token = $1
      `,
      [token]
    );

    const row = result.rows[0];
    if (!row || !row.activePdfFileId) {
      return null;
    }

    const [coverResult, pdfResult] = await Promise.all([
      row.coverFileId
        ? this.pool.query(
            `
              SELECT
                id,
                project_id AS "projectId",
                kind,
                storage_key AS "storageKey",
                original_filename AS "originalFilename",
                mime_type AS "mimeType",
                file_size_bytes::INT AS "fileSizeBytes",
                version_number AS "versionNumber",
                is_active AS "isActive",
                created_at AS "createdAt"
              FROM delivery_files
              WHERE id = $1
            `,
            [row.coverFileId]
          )
        : Promise.resolve({ rows: [] }),
      this.pool.query(
        `
          SELECT
            id,
            project_id AS "projectId",
            kind,
            storage_key AS "storageKey",
            original_filename AS "originalFilename",
            mime_type AS "mimeType",
            file_size_bytes::INT AS "fileSizeBytes",
            version_number AS "versionNumber",
            is_active AS "isActive",
            created_at AS "createdAt"
          FROM delivery_files
          WHERE id = $1
        `,
        [row.activePdfFileId]
      ),
    ]);

    return {
      project: {
        id: row.projectId,
        title: row.title,
        creatorName: row.creatorName,
        description: row.description,
        shortMessage: row.shortMessage,
        coverFileId: row.coverFileId,
        activePdfFileId: row.activePdfFileId,
      },
      backer: {
        id: row.backerId,
        email: row.email,
        accessToken: row.accessToken,
      },
      currentCover: coverResult.rows[0] || null,
      currentPdf: pdfResult.rows[0] || null,
    };
  }

  async logAccessEvent(projectId, backerId, eventType) {
    await this.pool.query(
      `
        INSERT INTO delivery_access_events (
          id,
          project_id,
          backer_id,
          event_type
        )
        VALUES ($1, $2, $3, $4)
      `,
      [crypto.randomUUID(), projectId, backerId, eventType]
    );
  }

  async markBackersEmailed(userId, projectId, backerIds) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const projectResult = await client.query(
        `SELECT id FROM delivery_projects WHERE id = $1 AND user_id = $2`,
        [projectId, userId]
      );
      if (!projectResult.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }

      const now = new Date().toISOString();
      await client.query(
        `
          UPDATE delivery_backers
          SET last_emailed_at = $3, updated_at = $3
          WHERE project_id = $1 AND id = ANY($2::uuid[])
        `,
        [projectId, backerIds, now]
      );
      await client.query(
        `
          UPDATE delivery_projects
          SET last_delivered_at = $3, updated_at = $3
          WHERE id = $1 AND user_id = $2
        `,
        [projectId, userId, now]
      );
      await client.query("COMMIT");
      return { sentCount: backerIds.length, lastDeliveredAt: now };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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

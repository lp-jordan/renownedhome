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

function createId() {
  return crypto.randomUUID();
}

function createDefaultTier(projectId, sortOrder = 0) {
  const now = new Date().toISOString();
  return {
    id: createId(),
    projectId,
    name: "General Access",
    slug: "general-access",
    messageOverride: "",
    additionalLinkLabel: "",
    additionalLinkUrl: "",
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

function buildProjectStatus(project) {
  if (project.archivedAt) {
    return "archived";
  }
  if (project.lastDeliveredAt) {
    return "delivered";
  }
  if (project.backerCount > 0 && project.fileCount > 0) {
    return "ready";
  }
  return "draft";
}

function summarizeProject(project, backers, files, tiers, accessEvents) {
  const downloadCount = accessEvents.filter(
    (event) => event.projectId === project.id && event.eventType === "file_download"
  ).length;

  return {
    ...project,
    backerCount: backers.length,
    emailedCount: backers.filter((backer) => backer.lastEmailedAt).length,
    fileCount: files.filter((file) => file.kind === "pdf").length,
    tierCount: tiers.length,
    downloadCount,
    status: buildProjectStatus({
      ...project,
      backerCount: backers.length,
      fileCount: files.filter((file) => file.kind === "pdf").length,
    }),
  };
}

function normalizeReaderPages(readerPages) {
  if (!Array.isArray(readerPages)) {
    return [];
  }

  return readerPages
    .map((page, index) => ({
      pageNumber: Number(page?.pageNumber || index + 1),
      storageKey: String(page?.storageKey || "").trim(),
      mimeType: String(page?.mimeType || "image/webp").trim() || "image/webp",
      width: Number(page?.width || 0) || null,
      height: Number(page?.height || 0) || null,
    }))
    .filter((page) => page.pageNumber > 0 && page.storageKey);
}

function normalizeDeliveryFile(file) {
  if (!file) {
    return null;
  }

  return {
    ...file,
    readerPages: normalizeReaderPages(file.readerPages),
  };
}

function normalizeTier(tier) {
  if (!tier) {
    return null;
  }

  return {
    ...tier,
    name: String(tier.name || "").trim(),
    slug: slugify(tier.slug || tier.name),
    messageOverride: String(tier.messageOverride || "").trim(),
    additionalLinkLabel: String(tier.additionalLinkLabel || "").trim(),
    additionalLinkUrl: String(tier.additionalLinkUrl || "").trim(),
    sortOrder: Number(tier.sortOrder || 0),
  };
}

function createImportSummary(preview, importedCount, skippedExistingCount, skippedUnknownTierCount) {
  return {
    totalRows: preview.summary.totalRows,
    validCount: preview.summary.validCount,
    invalidCount: preview.summary.invalidCount,
    duplicateCount: preview.summary.duplicateCount,
    importedCount,
    skippedExistingCount,
    skippedUnknownTierCount,
  };
}

function sortByCreatedDesc(items) {
  return [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function sortTiers(tiers) {
  return [...tiers].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.name.localeCompare(b.name);
  });
}

function getProjectFiles(files, projectId) {
  return files
    .filter((file) => file.projectId === projectId)
    .map((file) => normalizeDeliveryFile(file));
}

function getProjectTiers(tiers, projectId) {
  return sortTiers(
    tiers
      .filter((tier) => tier.projectId === projectId)
      .map((tier) => normalizeTier(tier))
  );
}

function getTierFileIds(tierFiles, tierId) {
  return tierFiles
    .filter((entry) => entry.tierId === tierId)
    .map((entry) => entry.fileId);
}

function getUniqueFileIds(fileIds, existingFiles) {
  const allowedFileIds = new Set(existingFiles.map((file) => file.id));
  return [...new Set(Array.isArray(fileIds) ? fileIds.filter(Boolean) : [])].filter((fileId) =>
    allowedFileIds.has(fileId)
  );
}

function buildProjectDetail(data, project) {
  const files = getProjectFiles(data.files, project.id);
  const pdfFiles = sortByCreatedDesc(files.filter((file) => file.kind === "pdf"));
  const coverFiles = sortByCreatedDesc(files.filter((file) => file.kind === "cover"));
  const currentCover = coverFiles.find((file) => file.id === project.coverFileId) || null;
  const tiers = getProjectTiers(data.tiers, project.id).map((tier) => {
    const fileIds = getTierFileIds(data.tierFiles, tier.id);
    return {
      ...tier,
      fileIds,
      backerCount: data.backers.filter((backer) => backer.tierId === tier.id).length,
    };
  });
  const backers = sortByCreatedDesc(
    data.backers
      .filter((backer) => backer.projectId === project.id)
      .map((backer) => {
        const tier = tiers.find((entry) => entry.id === backer.tierId) || null;
        return {
          ...backer,
          tierName: tier?.name || "",
          tierSlug: tier?.slug || "",
        };
      })
  );

  return {
    project: summarizeProject(project, backers, pdfFiles, tiers, data.accessEvents),
    currentCover,
    files: pdfFiles,
    tiers,
    backers,
  };
}

function getIsoDateKey(dateString) {
  const value = new Date(dateString);
  if (Number.isNaN(value.getTime())) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

function buildDeliveryTimeline(events, days = 14) {
  const safeDays = Math.max(1, Number(days) || 14);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  const today = new Date();
  const series = [];
  const countsByDate = new Map();

  for (const event of events) {
    const dateKey = getIsoDateKey(event.createdAt);
    if (!dateKey) {
      continue;
    }

    const current = countsByDate.get(dateKey) || { pageViews: 0, downloads: 0 };
    if (event.eventType === "access_page_view") {
      current.pageViews += 1;
    }
    if (event.eventType === "file_download") {
      current.downloads += 1;
    }
    countsByDate.set(dateKey, current);
  }

  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const dateKey = date.toISOString().slice(0, 10);
    const counts = countsByDate.get(dateKey) || { pageViews: 0, downloads: 0 };
    series.push({
      date: dateKey,
      label: formatter.format(date),
      pageViews: counts.pageViews,
      downloads: counts.downloads,
    });
  }

  return series;
}

function buildProjectAnalytics(project, backers, accessEvents, days = 14) {
  const projectEvents = accessEvents.filter((event) => event.projectId === project.id);
  const analyticsBackers = backers.map((backer) => {
    const backerEvents = projectEvents.filter((event) => event.backerId === backer.id);
    const pageViewEvents = backerEvents.filter((event) => event.eventType === "access_page_view");
    const downloadEvents = backerEvents.filter((event) => event.eventType === "file_download");
    const lastOpenedAt = pageViewEvents[0]?.createdAt || null;
    const lastDownloadedAt = downloadEvents[0]?.createdAt || null;
    const lastActivityAt = backerEvents[0]?.createdAt || null;

    return {
      id: backer.id,
      email: backer.email,
      tierId: backer.tierId || "",
      tierName: backer.tierName || "",
      lastEmailedAt: backer.lastEmailedAt || null,
      pageViewCount: pageViewEvents.length,
      downloadCount: downloadEvents.length,
      hasOpened: pageViewEvents.length > 0,
      hasDownloaded: downloadEvents.length > 0,
      lastOpenedAt,
      lastDownloadedAt,
      lastActivityAt,
    };
  });

  analyticsBackers.sort((left, right) => {
    if (right.pageViewCount !== left.pageViewCount) {
      return right.pageViewCount - left.pageViewCount;
    }
    if (right.downloadCount !== left.downloadCount) {
      return right.downloadCount - left.downloadCount;
    }
    return left.email.localeCompare(right.email);
  });

  const uniqueOpeners = analyticsBackers.filter((backer) => backer.hasOpened).length;
  const uniqueDownloaders = analyticsBackers.filter((backer) => backer.hasDownloaded).length;
  const totalPageViews = projectEvents.filter((event) => event.eventType === "access_page_view").length;
  const totalDownloads = projectEvents.filter((event) => event.eventType === "file_download").length;

  return {
    project: {
      id: project.id,
      title: project.title,
    },
    windowDays: Math.max(1, Number(days) || 14),
    totals: {
      backerCount: analyticsBackers.length,
      uniqueOpeners,
      unopenedBackers: Math.max(analyticsBackers.length - uniqueOpeners, 0),
      uniqueDownloaders,
      totalPageViews,
      totalDownloads,
    },
    timeline: buildDeliveryTimeline(projectEvents, days),
    backers: analyticsBackers,
  };
}

function ensureUniqueTierSlugs(tiers) {
  const seen = new Set();
  return tiers.map((tier, index) => {
    const baseSlug = slugify(tier.slug || tier.name || `tier-${index + 1}`) || `tier-${index + 1}`;
    let nextSlug = baseSlug;
    let suffix = 2;
    while (seen.has(nextSlug)) {
      nextSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    seen.add(nextSlug);
    return {
      ...tier,
      slug: nextSlug,
      sortOrder: index,
    };
  });
}

function findTierByLabel(tiers, label) {
  const normalized = slugify(label);
  return (
    tiers.find((tier) => tier.slug === normalized) ||
    tiers.find((tier) => slugify(tier.name) === normalized) ||
    null
  );
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

  const firstColumns = parseCsvRow(lines[0]).map((cell) => cell.trim().toLowerCase());
  const emailIndex = firstColumns.findIndex((cell) => cell === "email");
  const tierIndex = firstColumns.findIndex((cell) => cell === "tier");
  const hasHeader = emailIndex >= 0;
  const rows = [];
  const validRows = [];
  const invalidRows = [];
  const duplicateRows = [];
  const seenEmails = new Set();

  for (let index = hasHeader ? 1 : 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const columns = parseCsvRow(raw).map((cell) => cell.trim());
    const email = normalizeEmail(hasHeader ? columns[emailIndex] : columns[0]);
    const tier = String(
      hasHeader && tierIndex >= 0 ? columns[tierIndex] || "" : columns[1] || ""
    ).trim();
    const row = {
      rowNumber: index + 1,
      raw,
      email,
      tier,
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

function parseCsvRow(row) {
  const input = String(row || "");
  const columns = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      columns.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  columns.push(current);
  return columns;
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
        tiers: [],
        tierFiles: [],
        deliveries: [],
        accessEvents: [],
      });
      return;
    }

    const data = await this.read();
    const nextData = {
      projects: Array.isArray(data.projects) ? data.projects : [],
      files: Array.isArray(data.files) ? data.files.map((file) => normalizeDeliveryFile(file)) : [],
      backers: Array.isArray(data.backers) ? data.backers : [],
      tiers: Array.isArray(data.tiers) ? data.tiers.map((tier) => normalizeTier(tier)) : [],
      tierFiles: Array.isArray(data.tierFiles) ? data.tierFiles : [],
      deliveries: Array.isArray(data.deliveries) ? data.deliveries : [],
      accessEvents: Array.isArray(data.accessEvents) ? data.accessEvents : [],
    };

    for (const project of nextData.projects) {
      const projectTiers = nextData.tiers.filter((tier) => tier.projectId === project.id);
      if (!projectTiers.length) {
        nextData.tiers.push(createDefaultTier(project.id));
      }
    }

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
          data.files.filter((file) => file.projectId === project.id && file.kind === "pdf"),
          data.tiers.filter((tier) => tier.projectId === project.id),
          data.accessEvents
        )
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async createProject(userId, payload) {
    const data = await this.read();
    const now = new Date().toISOString();
    const projectId = createId();
    const project = {
      id: projectId,
      userId,
      title: String(payload.title || "").trim(),
      slug: slugify(payload.slug || payload.title),
      creatorName: String(payload.creatorName || "").trim(),
      description: String(payload.description || "").trim(),
      shortMessage: String(payload.shortMessage || "").trim(),
      coverFileId: null,
      lastDeliveredAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    data.projects.unshift(project);
    data.tiers.unshift(createDefaultTier(projectId));
    await this.write(data);
    return summarizeProject(project, [], [], data.tiers.filter((tier) => tier.projectId === projectId), []);
  }

  async updateProject(userId, projectId, payload) {
    const data = await this.read();
    const projectIndex = data.projects.findIndex(
      (entry) => entry.id === projectId && entry.userId === userId
    );

    if (projectIndex === -1) {
      return null;
    }

    const now = new Date().toISOString();
    const project = data.projects[projectIndex];
    const nextProject = {
      ...project,
      title: String(payload.title || project.title).trim(),
      slug: slugify(payload.slug || payload.title || project.slug),
      creatorName: String(payload.creatorName || project.creatorName).trim(),
      description: String(payload.description ?? project.description).trim(),
      shortMessage: String(payload.shortMessage ?? project.shortMessage).trim(),
      updatedAt: now,
    };

    const existingFiles = getProjectFiles(data.files, projectId).filter((file) => file.kind === "pdf");
    const existingTiers = getProjectTiers(data.tiers, projectId);
    const submittedTiers = Array.isArray(payload.tiers) && payload.tiers.length
      ? ensureUniqueTierSlugs(
          payload.tiers.map((tier, index) => ({
            id: tier.id || createId(),
            projectId,
            name: String(tier.name || `Tier ${index + 1}`).trim(),
            slug: tier.slug || tier.name,
            messageOverride: String(tier.messageOverride || "").trim(),
            additionalLinkLabel: String(tier.additionalLinkLabel || "").trim(),
            additionalLinkUrl: String(tier.additionalLinkUrl || "").trim(),
            sortOrder: index,
            createdAt:
              existingTiers.find((entry) => entry.id === tier.id)?.createdAt || now,
            updatedAt: now,
          }))
        )
      : existingTiers;

    const removedTierIds = existingTiers
      .filter((tier) => !submittedTiers.some((entry) => entry.id === tier.id))
      .map((tier) => tier.id);

    const tierBackerConflict = data.backers.find((backer) => removedTierIds.includes(backer.tierId));
    if (tierBackerConflict) {
      throw new Error("Move backers out of a tier before removing it.");
    }

    data.projects[projectIndex] = nextProject;
    data.tiers = data.tiers
      .filter((tier) => !removedTierIds.includes(tier.id))
      .filter((tier) => tier.projectId !== projectId)
      .concat(submittedTiers);

    data.tierFiles = data.tierFiles.filter((entry) => {
      if (entry.projectId !== projectId) {
        return true;
      }
      return !removedTierIds.includes(entry.tierId);
    });

    const nextTierFiles = [];
    for (const tier of submittedTiers) {
      const submittedTier = payload.tiers?.find((entry) => entry.id === tier.id) || null;
      const fileIds = getUniqueFileIds(
        Array.isArray(submittedTier?.fileIds)
          ? submittedTier.fileIds
          : existingFiles.map((file) => file.id),
        existingFiles
      );
      for (const fileId of fileIds) {
        nextTierFiles.push({
          id: createId(),
          projectId,
          tierId: tier.id,
          fileId,
          createdAt: now,
        });
      }
    }

    data.tierFiles = data.tierFiles.filter((entry) => entry.projectId !== projectId).concat(nextTierFiles);
    await this.write(data);
    return buildProjectDetail(data, nextProject);
  }

  async getProject(userId, projectId) {
    const data = await this.read();
    const project = data.projects.find(
      (entry) => entry.id === projectId && entry.userId === userId
    );

    if (!project) {
      return null;
    }

    return buildProjectDetail(data, project);
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
      id: createId(),
      projectId,
      kind: payload.kind,
      storageKey: payload.storageKey,
      originalFilename: payload.originalFilename,
      mimeType: payload.mimeType,
      fileSizeBytes: payload.fileSizeBytes,
      readerPages: normalizeReaderPages(payload.readerPages),
      versionNumber: nextVersion,
      isActive: true,
      createdAt: now,
    };

    if (payload.kind === "cover") {
      data.files = data.files.filter(
        (entry) => !(entry.projectId === projectId && entry.kind === "cover")
      );
      data.projects[projectIndex] = {
        ...project,
        coverFileId: file.id,
        updatedAt: now,
      };
    } else {
      const tiers = getProjectTiers(data.tiers, projectId);
      for (const tier of tiers) {
        data.tierFiles.push({
          id: createId(),
          projectId,
          tierId: tier.id,
          fileId: file.id,
          createdAt: now,
        });
      }
      data.projects[projectIndex] = {
        ...project,
        updatedAt: now,
      };
    }

    data.files.unshift(file);
    await this.write(data);
    return normalizeDeliveryFile(file);
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
    data.tiers = data.tiers.filter((tier) => tier.projectId !== projectId);
    data.tierFiles = data.tierFiles.filter((entry) => entry.projectId !== projectId);
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
    data.files = data.files.filter((entry) => entry.id !== fileId);
    data.tierFiles = data.tierFiles.filter((entry) => entry.fileId !== fileId);

    data.projects[projectIndex] = {
      ...project,
      coverFileId: file.kind === "cover" && project.coverFileId === fileId ? null : project.coverFileId,
      updatedAt: new Date().toISOString(),
    };

    await this.write(data);
    return {
      deletedFile: file,
      nextCoverFileId: data.projects[projectIndex].coverFileId,
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
    const tiers = getProjectTiers(data.tiers, projectId);
    const defaultTier = tiers[0] || null;
    const existingEmails = new Set(
      data.backers
        .filter((backer) => backer.projectId === projectId)
        .map((backer) => backer.normalizedEmail)
    );
    const now = new Date().toISOString();
    let importedCount = 0;
    let skippedExistingCount = 0;
    let skippedUnknownTierCount = 0;

    for (const row of preview.validRows) {
      if (existingEmails.has(row.email)) {
        skippedExistingCount += 1;
        continue;
      }

      const tier = row.tier ? findTierByLabel(tiers, row.tier) : defaultTier;
      if (!tier) {
        skippedUnknownTierCount += 1;
        continue;
      }

      existingEmails.add(row.email);
      importedCount += 1;
      data.backers.unshift({
        id: createId(),
        projectId,
        tierId: tier.id,
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
      summary: createImportSummary(
        preview,
        importedCount,
        skippedExistingCount,
        skippedUnknownTierCount
      ),
    };
  }

  async updateBacker(userId, projectId, backerId, payload) {
    const data = await this.read();
    const project = data.projects.find(
      (entry) => entry.id === projectId && entry.userId === userId
    );
    if (!project) {
      return null;
    }

    const backerIndex = data.backers.findIndex(
      (entry) => entry.id === backerId && entry.projectId === projectId
    );
    if (backerIndex === -1) {
      return null;
    }

    const currentBacker = data.backers[backerIndex];
    const nextEmail = normalizeEmail(payload.email ?? currentBacker.email);
    if (!nextEmail || !isEmailLike(nextEmail)) {
      throw new Error("A valid email is required.");
    }

    const tierId = payload.tierId ?? currentBacker.tierId;
    const tier = data.tiers.find((entry) => entry.id === tierId && entry.projectId === projectId);
    if (!tier) {
      throw new Error("Choose a valid tier.");
    }

    const duplicate = data.backers.find(
      (entry) =>
        entry.projectId === projectId &&
        entry.id !== backerId &&
        entry.normalizedEmail === nextEmail
    );
    if (duplicate) {
      throw new Error("That email is already in this campaign.");
    }

    const now = new Date().toISOString();
    data.backers[backerIndex] = {
      ...currentBacker,
      email: nextEmail,
      normalizedEmail: nextEmail,
      tierId,
      updatedAt: now,
    };
    await this.write(data);

    const detail = buildProjectDetail(data, project);
    return detail.backers.find((entry) => entry.id === backerId) || null;
  }

  async moveBackers(userId, projectId, backerIds, tierId) {
    const data = await this.read();
    const project = data.projects.find(
      (entry) => entry.id === projectId && entry.userId === userId
    );
    if (!project) {
      return null;
    }

    const tier = data.tiers.find((entry) => entry.id === tierId && entry.projectId === projectId);
    if (!tier) {
      throw new Error("Choose a valid tier.");
    }

    const backerIdSet = new Set(
      Array.isArray(backerIds) ? backerIds.filter(Boolean) : []
    );
    const now = new Date().toISOString();
    let movedCount = 0;

    data.backers = data.backers.map((backer) => {
      if (backer.projectId !== projectId || !backerIdSet.has(backer.id)) {
        return backer;
      }
      movedCount += 1;
      return {
        ...backer,
        tierId,
        updatedAt: now,
      };
    });

    await this.write(data);
    return { movedCount, tierId };
  }

  async deleteBacker(userId, projectId, backerId) {
    const data = await this.read();
    const project = data.projects.find(
      (entry) => entry.id === projectId && entry.userId === userId
    );
    if (!project) {
      return null;
    }

    const existing = data.backers.find(
      (entry) => entry.id === backerId && entry.projectId === projectId
    );
    if (!existing) {
      return null;
    }

    data.backers = data.backers.filter((entry) => entry.id !== backerId);
    data.accessEvents = data.accessEvents.filter((entry) => entry.backerId !== backerId);
    await this.write(data);
    return existing;
  }

  async getFile(fileId) {
    const data = await this.read();
    return normalizeDeliveryFile(data.files.find((file) => file.id === fileId)) || null;
  }

  async getAccessByToken(token) {
    const data = await this.read();
    const backer = data.backers.find((entry) => entry.accessToken === token);
    if (!backer) {
      return null;
    }

    const project = data.projects.find((entry) => entry.id === backer.projectId);
    const tier = data.tiers.find((entry) => entry.id === backer.tierId);
    if (!project || !tier) {
      return null;
    }

    const fileIds = getTierFileIds(data.tierFiles, tier.id);
    const files = sortByCreatedDesc(
      data.files
        .filter((file) => file.projectId === project.id && file.kind === "pdf" && fileIds.includes(file.id))
        .map((file) => normalizeDeliveryFile(file))
    );
    const currentCover = normalizeDeliveryFile(
      data.files.find((file) => file.id === project.coverFileId)
    ) || null;

    return {
      project,
      backer,
      tier: {
        ...normalizeTier(tier),
        message: tier.messageOverride || project.shortMessage,
      },
      currentCover,
      files,
    };
  }

  async logAccessEvent(projectId, backerId, eventType, fileId = null) {
    const data = await this.read();
    data.accessEvents.unshift({
      id: createId(),
      projectId,
      backerId,
      fileId,
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

  async getProjectAnalytics(userId, projectId, days = 14) {
    const data = await this.read();
    const project = data.projects.find(
      (entry) => entry.id === projectId && entry.userId === userId
    );

    if (!project) {
      return null;
    }

    const tiersById = new Map(
      data.tiers
        .filter((tier) => tier.projectId === projectId)
        .map((tier) => [tier.id, normalizeTier(tier)])
    );
    const backers = sortByCreatedDesc(
      data.backers
        .filter((backer) => backer.projectId === projectId)
        .map((backer) => ({
          ...backer,
          tierName: tiersById.get(backer.tierId)?.name || "",
        }))
    );

    return buildProjectAnalytics(project, backers, data.accessEvents, days);
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

  async getProjectSnapshot(projectId, userId = null, client = this.pool) {
    const projectResult = await client.query(
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
          p.last_delivered_at AS "lastDeliveredAt",
          p.archived_at AS "archivedAt",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt"
        FROM delivery_projects p
        WHERE p.id = $1
          ${userId ? "AND p.user_id = $2" : ""}
      `,
      userId ? [projectId, userId] : [projectId]
    );
    const project = projectResult.rows[0];
    if (!project) {
      return null;
    }

    const [filesResult, tiersResult, backersResult, downloadsResult] = await Promise.all([
      client.query(
        `
          SELECT
            id,
            project_id AS "projectId",
            kind,
            storage_key AS "storageKey",
            original_filename AS "originalFilename",
            mime_type AS "mimeType",
            file_size_bytes::INT AS "fileSizeBytes",
            reader_pages AS "readerPages",
            version_number AS "versionNumber",
            is_active AS "isActive",
            created_at AS "createdAt"
          FROM delivery_files
          WHERE project_id = $1
          ORDER BY created_at DESC
        `,
        [projectId]
      ),
      client.query(
        `
          SELECT
            t.id,
            t.project_id AS "projectId",
            t.name,
            t.slug,
            t.message_override AS "messageOverride",
            t.additional_link_label AS "additionalLinkLabel",
            t.additional_link_url AS "additionalLinkUrl",
            t.sort_order AS "sortOrder",
            t.created_at AS "createdAt",
            t.updated_at AS "updatedAt",
            COALESCE(ARRAY_AGG(tf.file_id ORDER BY f.created_at DESC) FILTER (WHERE tf.file_id IS NOT NULL), ARRAY[]::uuid[]) AS "fileIds",
            COUNT(DISTINCT b.id)::INT AS "backerCount"
          FROM delivery_tiers t
          LEFT JOIN delivery_tier_files tf ON tf.tier_id = t.id
          LEFT JOIN delivery_files f ON f.id = tf.file_id
          LEFT JOIN delivery_backers b ON b.tier_id = t.id
          WHERE t.project_id = $1
          GROUP BY t.id
          ORDER BY t.sort_order ASC, t.created_at ASC
        `,
        [projectId]
      ),
      client.query(
        `
          SELECT
            b.id,
            b.project_id AS "projectId",
            b.tier_id AS "tierId",
            b.email,
            b.normalized_email AS "normalizedEmail",
            b.access_token AS "accessToken",
            b.last_emailed_at AS "lastEmailedAt",
            b.created_at AS "createdAt",
            b.updated_at AS "updatedAt",
            t.name AS "tierName",
            t.slug AS "tierSlug"
          FROM delivery_backers b
          LEFT JOIN delivery_tiers t ON t.id = b.tier_id
          WHERE b.project_id = $1
          ORDER BY b.created_at DESC
        `,
        [projectId]
      ),
      client.query(
        `
          SELECT COUNT(*)::INT AS "downloadCount"
          FROM delivery_access_events
          WHERE project_id = $1
            AND event_type = 'file_download'
        `,
        [projectId]
      ),
    ]);

    const files = filesResult.rows.map((file) => normalizeDeliveryFile(file));
    const pdfFiles = files.filter((file) => file.kind === "pdf");
    const currentCover =
      files.find((file) => file.kind === "cover" && file.id === project.coverFileId) || null;
    const tiers = tiersResult.rows.map((tier) => ({
      ...normalizeTier(tier),
      fileIds: Array.isArray(tier.fileIds) ? tier.fileIds.filter(Boolean) : [],
      backerCount: Number(tier.backerCount || 0),
    }));
    const backers = backersResult.rows;
    const downloadCount = Number(downloadsResult.rows[0]?.downloadCount || 0);

    return {
      project: {
        ...project,
        backerCount: backers.length,
        emailedCount: backers.filter((backer) => backer.lastEmailedAt).length,
        fileCount: pdfFiles.length,
        tierCount: tiers.length,
        downloadCount,
        status: buildProjectStatus({
          ...project,
          backerCount: backers.length,
          fileCount: pdfFiles.length,
        }),
      },
      currentCover,
      files: pdfFiles,
      tiers,
      backers,
    };
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
        reader_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
        version_number INT NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(
      `ALTER TABLE delivery_files ADD COLUMN IF NOT EXISTS reader_pages JSONB NOT NULL DEFAULT '[]'::jsonb`
    );

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_tiers (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES delivery_projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        message_override TEXT NOT NULL DEFAULT '',
        additional_link_label TEXT NOT NULL DEFAULT '',
        additional_link_url TEXT NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (project_id, slug)
      );
    `);
    await this.pool.query(
      `ALTER TABLE delivery_tiers ADD COLUMN IF NOT EXISTS additional_link_label TEXT NOT NULL DEFAULT ''`
    );
    await this.pool.query(
      `ALTER TABLE delivery_tiers ADD COLUMN IF NOT EXISTS additional_link_url TEXT NOT NULL DEFAULT ''`
    );

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_tier_files (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES delivery_projects(id) ON DELETE CASCADE,
        tier_id UUID NOT NULL REFERENCES delivery_tiers(id) ON DELETE CASCADE,
        file_id UUID NOT NULL REFERENCES delivery_files(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tier_id, file_id)
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_backers (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES delivery_projects(id) ON DELETE CASCADE,
        tier_id UUID NULL REFERENCES delivery_tiers(id) ON DELETE SET NULL,
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
      `ALTER TABLE delivery_backers ADD COLUMN IF NOT EXISTS tier_id UUID NULL REFERENCES delivery_tiers(id) ON DELETE SET NULL`
    );
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
        file_id UUID NULL REFERENCES delivery_files(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(
      `ALTER TABLE delivery_access_events ADD COLUMN IF NOT EXISTS file_id UUID NULL REFERENCES delivery_files(id) ON DELETE SET NULL`
    );

    const projectsResult = await this.pool.query(`SELECT id FROM delivery_projects`);
    for (const row of projectsResult.rows) {
      const tierResult = await this.pool.query(
        `SELECT id FROM delivery_tiers WHERE project_id = $1 LIMIT 1`,
        [row.id]
      );
      if (!tierResult.rows[0]) {
        const tier = createDefaultTier(row.id);
        await this.pool.query(
          `
            INSERT INTO delivery_tiers (
              id,
              project_id,
              name,
              slug,
              message_override,
              sort_order,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            tier.id,
            tier.projectId,
            tier.name,
            tier.slug,
            tier.messageOverride,
            tier.sortOrder,
            tier.createdAt,
            tier.updatedAt,
          ]
        );
      }
    }

    await this.pool.query(`
      UPDATE delivery_backers b
      SET tier_id = t.id
      FROM (
        SELECT DISTINCT ON (project_id) id, project_id
        FROM delivery_tiers
        ORDER BY project_id, sort_order ASC, created_at ASC
      ) t
      WHERE b.project_id = t.project_id
        AND b.tier_id IS NULL
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
          p.last_delivered_at AS "lastDeliveredAt",
          p.archived_at AS "archivedAt",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          COUNT(DISTINCT b.id)::INT AS "backerCount",
          COUNT(DISTINCT b.id) FILTER (WHERE b.last_emailed_at IS NOT NULL)::INT AS "emailedCount",
          COUNT(DISTINCT tf.file_id)::INT AS "fileCount",
          COUNT(DISTINCT t.id)::INT AS "tierCount",
          COUNT(ae.id) FILTER (WHERE ae.event_type = 'file_download')::INT AS "downloadCount"
        FROM delivery_projects p
        LEFT JOIN delivery_backers b ON b.project_id = p.id
        LEFT JOIN delivery_tiers t ON t.project_id = p.id
        LEFT JOIN delivery_tier_files tf ON tf.project_id = p.id
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
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const projectId = createId();
      const now = new Date().toISOString();
      const projectResult = await client.query(
        `
          INSERT INTO delivery_projects (
            id,
            user_id,
            title,
            slug,
            creator_name,
            description,
            short_message,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
          RETURNING
            id,
            user_id AS "userId",
            title,
            slug,
            creator_name AS "creatorName",
            description,
            short_message AS "shortMessage",
            cover_file_id AS "coverFileId",
            last_delivered_at AS "lastDeliveredAt",
            archived_at AS "archivedAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          projectId,
          userId,
          String(payload.title || "").trim(),
          slugify(payload.slug || payload.title),
          String(payload.creatorName || "").trim(),
          String(payload.description || "").trim(),
          String(payload.shortMessage || "").trim(),
          now,
        ]
      );

      const tier = createDefaultTier(projectId);
      await client.query(
        `
          INSERT INTO delivery_tiers (
            id,
            project_id,
            name,
            slug,
            message_override,
            additional_link_label,
            additional_link_url,
            sort_order,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          tier.id,
          tier.projectId,
          tier.name,
          tier.slug,
          tier.messageOverride,
          tier.additionalLinkLabel,
          tier.additionalLinkUrl,
          tier.sortOrder,
          tier.createdAt,
          tier.updatedAt,
        ]
      );
      await client.query("COMMIT");

      return {
        ...projectResult.rows[0],
        backerCount: 0,
        emailedCount: 0,
        fileCount: 0,
        tierCount: 1,
        downloadCount: 0,
        status: "draft",
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
          reader_pages AS "readerPages",
          version_number AS "versionNumber",
          is_active AS "isActive",
          created_at AS "createdAt"
        FROM delivery_files
        WHERE id = $1
      `,
      [fileId]
    );
    return normalizeDeliveryFile(result.rows[0]) || null;
  }

  async getProject(userId, projectId) {
    return this.getProjectSnapshot(projectId, userId);
  }

  async updateProject(userId, projectId, payload) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existingDetail = await this.getProjectSnapshot(projectId, userId, client);
      if (!existingDetail) {
        await client.query("ROLLBACK");
        return null;
      }

      const now = new Date().toISOString();
      const project = existingDetail.project;
      const existingFiles = existingDetail.files;
      const existingTiers = existingDetail.tiers;
      const submittedTiers =
        Array.isArray(payload.tiers) && payload.tiers.length
          ? ensureUniqueTierSlugs(
              payload.tiers.map((tier, index) => ({
                id: tier.id || createId(),
                projectId,
                name: String(tier.name || `Tier ${index + 1}`).trim(),
                slug: tier.slug || tier.name,
                messageOverride: String(tier.messageOverride || "").trim(),
                additionalLinkLabel: String(tier.additionalLinkLabel || "").trim(),
                additionalLinkUrl: String(tier.additionalLinkUrl || "").trim(),
                sortOrder: index,
                createdAt: existingTiers.find((entry) => entry.id === tier.id)?.createdAt || now,
                updatedAt: now,
              }))
            )
          : existingTiers;

      const removedTierIds = existingTiers
        .filter((tier) => !submittedTiers.some((entry) => entry.id === tier.id))
        .map((tier) => tier.id);
      const tierBackerConflict = existingDetail.backers.find((backer) =>
        removedTierIds.includes(backer.tierId)
      );
      if (tierBackerConflict) {
        throw new Error("Move backers out of a tier before removing it.");
      }

      await client.query(
        `
          UPDATE delivery_projects
          SET
            title = $3,
            slug = $4,
            creator_name = $5,
            description = $6,
            short_message = $7,
            updated_at = $8
          WHERE id = $1 AND user_id = $2
        `,
        [
          projectId,
          userId,
          String(payload.title || project.title).trim(),
          slugify(payload.slug || payload.title || project.slug),
          String(payload.creatorName || project.creatorName).trim(),
          String(payload.description ?? project.description).trim(),
          String(payload.shortMessage ?? project.shortMessage).trim(),
          now,
        ]
      );

      if (removedTierIds.length) {
        await client.query(`DELETE FROM delivery_tiers WHERE project_id = $1 AND id = ANY($2::uuid[])`, [
          projectId,
          removedTierIds,
        ]);
      }

      for (const tier of submittedTiers) {
        await client.query(
          `
            INSERT INTO delivery_tiers (
              id,
              project_id,
              name,
              slug,
              message_override,
              additional_link_label,
              additional_link_url,
              sort_order,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              slug = EXCLUDED.slug,
              message_override = EXCLUDED.message_override,
              additional_link_label = EXCLUDED.additional_link_label,
              additional_link_url = EXCLUDED.additional_link_url,
              sort_order = EXCLUDED.sort_order,
              updated_at = EXCLUDED.updated_at
          `,
          [
            tier.id,
            projectId,
            tier.name,
            tier.slug,
            tier.messageOverride,
            tier.additionalLinkLabel,
            tier.additionalLinkUrl,
            tier.sortOrder,
            tier.createdAt,
            tier.updatedAt,
          ]
        );
      }

      await client.query(`DELETE FROM delivery_tier_files WHERE project_id = $1`, [projectId]);
      for (const tier of submittedTiers) {
        const submittedTier = payload.tiers?.find((entry) => entry.id === tier.id) || null;
        const fileIds = getUniqueFileIds(
          Array.isArray(submittedTier?.fileIds)
            ? submittedTier.fileIds
            : existingFiles.map((file) => file.id),
          existingFiles
        );
        for (const fileId of fileIds) {
          await client.query(
            `
              INSERT INTO delivery_tier_files (
                id,
                project_id,
                tier_id,
                file_id,
                created_at
              ) VALUES ($1, $2, $3, $4, $5)
            `,
            [createId(), projectId, tier.id, fileId, now]
          );
        }
      }

      await client.query("COMMIT");
      return this.getProject(userId, projectId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async attachFile(userId, projectId, payload) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const projectResult = await client.query(
        `SELECT id, cover_file_id AS "coverFileId" FROM delivery_projects WHERE id = $1 AND user_id = $2`,
        [projectId, userId]
      );
      const project = projectResult.rows[0];
      if (!project) {
        await client.query("ROLLBACK");
        return null;
      }

      const previousFilesResult = await client.query(
        `SELECT COUNT(*)::INT AS count FROM delivery_files WHERE project_id = $1 AND kind = $2`,
        [projectId, payload.kind]
      );
      const nextVersion = payload.kind === "pdf" ? Number(previousFilesResult.rows[0]?.count || 0) + 1 : 1;
      const now = new Date().toISOString();
      const file = {
        id: createId(),
        projectId,
        kind: payload.kind,
        storageKey: payload.storageKey,
        originalFilename: payload.originalFilename,
        mimeType: payload.mimeType,
        fileSizeBytes: payload.fileSizeBytes,
        readerPages: normalizeReaderPages(payload.readerPages),
        versionNumber: nextVersion,
        isActive: true,
        createdAt: now,
      };

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
            reader_pages,
            version_number,
            is_active,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
        `,
        [
          file.id,
          file.projectId,
          file.kind,
          file.storageKey,
          file.originalFilename,
          file.mimeType,
          file.fileSizeBytes,
          JSON.stringify(file.readerPages),
          file.versionNumber,
          file.isActive,
          file.createdAt,
        ]
      );

      if (payload.kind === "cover") {
        await client.query(
          `
            UPDATE delivery_projects
            SET cover_file_id = $3, updated_at = $4
            WHERE id = $1 AND user_id = $2
          `,
          [projectId, userId, file.id, now]
        );
      } else {
        const tiersResult = await client.query(
          `SELECT id FROM delivery_tiers WHERE project_id = $1 ORDER BY sort_order ASC, created_at ASC`,
          [projectId]
        );
        for (const tier of tiersResult.rows) {
          await client.query(
            `
              INSERT INTO delivery_tier_files (
                id,
                project_id,
                tier_id,
                file_id,
                created_at
              ) VALUES ($1, $2, $3, $4, $5)
            `,
            [createId(), projectId, tier.id, file.id, now]
          );
        }
        await client.query(
          `UPDATE delivery_projects SET updated_at = $3 WHERE id = $1 AND user_id = $2`,
          [projectId, userId, now]
        );
      }

      await client.query("COMMIT");
      return normalizeDeliveryFile(file);
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
      const detail = await this.getProjectSnapshot(projectId, userId, client);
      if (!detail) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query(`DELETE FROM delivery_projects WHERE id = $1 AND user_id = $2`, [
        projectId,
        userId,
      ]);
      await client.query("COMMIT");
      return {
        projectId,
        deletedFileKeys: detail.files.map((file) => file.storageKey).filter(Boolean),
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
      const detail = await this.getProjectSnapshot(projectId, userId, client);
      if (!detail) {
        await client.query("ROLLBACK");
        return null;
      }

      const file =
        detail.files.find((entry) => entry.id === fileId) ||
        (detail.currentCover?.id === fileId ? detail.currentCover : null);
      if (!file) {
        await client.query("ROLLBACK");
        return null;
      }

      if (detail.project.coverFileId === fileId) {
        await client.query(
          `UPDATE delivery_projects SET cover_file_id = NULL, updated_at = $3 WHERE id = $1 AND user_id = $2`,
          [projectId, userId, new Date().toISOString()]
        );
      }

      await client.query(`DELETE FROM delivery_files WHERE id = $1 AND project_id = $2`, [fileId, projectId]);
      await client.query("COMMIT");
      return {
        deletedFile: file,
        nextCoverFileId: file.kind === "cover" ? null : detail.project.coverFileId,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async importBackers(userId, projectId, csvText) {
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

      const preview = parseBackerCsv(csvText);
      const tiersResult = await client.query(
        `
          SELECT
            id,
            project_id AS "projectId",
            name,
            slug,
            message_override AS "messageOverride",
            additional_link_label AS "additionalLinkLabel",
            additional_link_url AS "additionalLinkUrl",
            sort_order AS "sortOrder",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM delivery_tiers
          WHERE project_id = $1
          ORDER BY sort_order ASC, created_at ASC
        `,
        [projectId]
      );
      const tiers = tiersResult.rows.map((tier) => normalizeTier(tier));
      const defaultTier = tiers[0] || null;
      const existingBackersResult = await client.query(
        `SELECT normalized_email AS "normalizedEmail" FROM delivery_backers WHERE project_id = $1`,
        [projectId]
      );
      const existingEmails = new Set(existingBackersResult.rows.map((row) => row.normalizedEmail));
      const now = new Date().toISOString();
      let importedCount = 0;
      let skippedExistingCount = 0;
      let skippedUnknownTierCount = 0;

      for (const row of preview.validRows) {
        if (existingEmails.has(row.email)) {
          skippedExistingCount += 1;
          continue;
        }

        const tier = row.tier ? findTierByLabel(tiers, row.tier) : defaultTier;
        if (!tier) {
          skippedUnknownTierCount += 1;
          continue;
        }

        existingEmails.add(row.email);
        importedCount += 1;
        await client.query(
          `
            INSERT INTO delivery_backers (
              id,
              project_id,
              tier_id,
              email,
              normalized_email,
              access_token,
              last_emailed_at,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $7)
          `,
          [createId(), projectId, tier.id, row.email, row.email, createToken(), now]
        );
      }

      await client.query(
        `UPDATE delivery_projects SET updated_at = $3 WHERE id = $1 AND user_id = $2`,
        [projectId, userId, now]
      );
      await client.query("COMMIT");

      return {
        summary: createImportSummary(
          preview,
          importedCount,
          skippedExistingCount,
          skippedUnknownTierCount
        ),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateBacker(userId, projectId, backerId, payload) {
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

      const backerResult = await client.query(
        `
          SELECT
            id,
            project_id AS "projectId",
            tier_id AS "tierId",
            email,
            normalized_email AS "normalizedEmail",
            access_token AS "accessToken",
            last_emailed_at AS "lastEmailedAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM delivery_backers
          WHERE id = $1 AND project_id = $2
        `,
        [backerId, projectId]
      );
      const currentBacker = backerResult.rows[0];
      if (!currentBacker) {
        await client.query("ROLLBACK");
        return null;
      }

      const nextEmail = normalizeEmail(payload.email ?? currentBacker.email);
      if (!nextEmail || !isEmailLike(nextEmail)) {
        throw new Error("A valid email is required.");
      }

      const tierId = payload.tierId ?? currentBacker.tierId;
      const tierResult = await client.query(
        `SELECT id FROM delivery_tiers WHERE id = $1 AND project_id = $2`,
        [tierId, projectId]
      );
      if (!tierResult.rows[0]) {
        throw new Error("Choose a valid tier.");
      }

      const duplicateResult = await client.query(
        `
          SELECT id
          FROM delivery_backers
          WHERE project_id = $1
            AND id <> $2
            AND normalized_email = $3
        `,
        [projectId, backerId, nextEmail]
      );
      if (duplicateResult.rows[0]) {
        throw new Error("That email is already in this campaign.");
      }

      const now = new Date().toISOString();
      await client.query(
        `
          UPDATE delivery_backers
          SET email = $3, normalized_email = $4, tier_id = $5, updated_at = $6
          WHERE id = $1 AND project_id = $2
        `,
        [backerId, projectId, nextEmail, nextEmail, tierId, now]
      );
      await client.query("COMMIT");

      const detail = await this.getProject(userId, projectId);
      return detail?.backers.find((entry) => entry.id === backerId) || null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async moveBackers(userId, projectId, backerIds, tierId) {
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

      const tierResult = await client.query(
        `SELECT id FROM delivery_tiers WHERE id = $1 AND project_id = $2`,
        [tierId, projectId]
      );
      if (!tierResult.rows[0]) {
        throw new Error("Choose a valid tier.");
      }

      const ids = Array.isArray(backerIds) ? backerIds.filter(Boolean) : [];
      const now = new Date().toISOString();
      const moveResult = ids.length
        ? await client.query(
            `
              UPDATE delivery_backers
              SET tier_id = $3, updated_at = $4
              WHERE project_id = $1 AND id = ANY($2::uuid[])
            `,
            [projectId, ids, tierId, now]
          )
        : { rowCount: 0 };
      await client.query("COMMIT");
      return { movedCount: moveResult.rowCount || 0, tierId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteBacker(userId, projectId, backerId) {
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

      const backerResult = await client.query(
        `
          SELECT
            id,
            project_id AS "projectId",
            tier_id AS "tierId",
            email,
            normalized_email AS "normalizedEmail",
            access_token AS "accessToken",
            last_emailed_at AS "lastEmailedAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM delivery_backers
          WHERE id = $1 AND project_id = $2
        `,
        [backerId, projectId]
      );
      const backer = backerResult.rows[0];
      if (!backer) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query(`DELETE FROM delivery_backers WHERE id = $1 AND project_id = $2`, [
        backerId,
        projectId,
      ]);
      await client.query("COMMIT");
      return backer;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
          b.id AS "backerId",
          b.email,
          b.access_token AS "accessToken",
          t.id AS "tierId",
          t.name AS "tierName",
          t.slug AS "tierSlug",
          t.message_override AS "messageOverride",
          t.additional_link_label AS "additionalLinkLabel",
          t.additional_link_url AS "additionalLinkUrl"
        FROM delivery_backers b
        INNER JOIN delivery_projects p ON p.id = b.project_id
        LEFT JOIN delivery_tiers t ON t.id = b.tier_id
        WHERE b.access_token = $1
      `,
      [token]
    );

    const row = result.rows[0];
    if (!row || !row.tierId) {
      return null;
    }

    const [coverResult, filesResult] = await Promise.all([
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
                reader_pages AS "readerPages",
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
            f.id,
            f.project_id AS "projectId",
            f.kind,
            f.storage_key AS "storageKey",
            f.original_filename AS "originalFilename",
            f.mime_type AS "mimeType",
            f.file_size_bytes::INT AS "fileSizeBytes",
            f.reader_pages AS "readerPages",
            f.version_number AS "versionNumber",
            f.is_active AS "isActive",
            f.created_at AS "createdAt"
          FROM delivery_tier_files tf
          INNER JOIN delivery_files f ON f.id = tf.file_id
          WHERE tf.tier_id = $1
          ORDER BY f.created_at DESC
        `,
        [row.tierId]
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
      },
      backer: {
        id: row.backerId,
        email: row.email,
        accessToken: row.accessToken,
      },
      tier: {
        id: row.tierId,
        name: row.tierName,
        slug: row.tierSlug,
        additionalLinkLabel: row.additionalLinkLabel || "",
        additionalLinkUrl: row.additionalLinkUrl || "",
        message: row.messageOverride || row.shortMessage,
      },
      currentCover: normalizeDeliveryFile(coverResult.rows[0]) || null,
      files: filesResult.rows.map((file) => normalizeDeliveryFile(file)),
    };
  }

  async logAccessEvent(projectId, backerId, eventType, fileId = null) {
    await this.pool.query(
      `
        INSERT INTO delivery_access_events (
          id,
          project_id,
          backer_id,
          file_id,
          event_type
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [createId(), projectId, backerId, fileId, eventType]
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

  async getProjectAnalytics(userId, projectId, days = 14) {
    const projectResult = await this.pool.query(
      `
        SELECT id, title
        FROM delivery_projects
        WHERE id = $1 AND user_id = $2
      `,
      [projectId, userId]
    );
    const project = projectResult.rows[0];
    if (!project) {
      return null;
    }

    const [backersResult, eventsResult] = await Promise.all([
      this.pool.query(
        `
          SELECT
            b.id,
            b.project_id AS "projectId",
            b.tier_id AS "tierId",
            b.email,
            b.last_emailed_at AS "lastEmailedAt",
            t.name AS "tierName",
            b.created_at AS "createdAt"
          FROM delivery_backers b
          LEFT JOIN delivery_tiers t ON t.id = b.tier_id
          WHERE b.project_id = $1
          ORDER BY b.created_at DESC
        `,
        [projectId]
      ),
      this.pool.query(
        `
          SELECT
            project_id AS "projectId",
            backer_id AS "backerId",
            file_id AS "fileId",
            event_type AS "eventType",
            created_at AS "createdAt"
          FROM delivery_access_events
          WHERE project_id = $1
          ORDER BY created_at DESC
        `,
        [projectId]
      ),
    ]);

    return buildProjectAnalytics(project, backersResult.rows, eventsResult.rows, days);
  }
}

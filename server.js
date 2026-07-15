import Stripe from "stripe";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import express from "express";
import { execFile as execFileCallback } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import multer from "multer";
import pg from "pg";
import sharp from "sharp";
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
  mergeCodeManagedPages,
} from "./src/content/defaultSiteData.js";
import {
  DeliveryFileStore,
  DeliveryPgStore,
  parseBackerCsv,
} from "./src/lib/deliveryStore.js";
import {
  buildDeliveryEmail,
  buildLibraryLinkEmail,
  buildOrderDeliveryEmail,
  buildPhysicalOrderEmail,
  escapeHtml,
  resendIsConfigured,
  sendResendEmail,
} from "./src/lib/resendEmail.js";
import {
  FileOrdersStore,
  LIBRARY_SESSION_TTL_MS,
  PgOrdersStore,
} from "./src/lib/ordersStore.js";

const { Pool } = pg;
const execFile = promisify(execFileCallback);
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

function getStorageEnv() {
  return {
    bucket:
      process.env.S3_BUCKET ||
      process.env.AWS_S3_BUCKET_NAME ||
      "",
    region:
      process.env.S3_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      "",
    accessKeyId:
      process.env.S3_ACCESS_KEY_ID ||
      process.env.AWS_ACCESS_KEY_ID ||
      "",
    secretAccessKey:
      process.env.S3_SECRET_ACCESS_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      "",
    endpoint:
      process.env.S3_ENDPOINT ||
      process.env.AWS_ENDPOINT_URL ||
      "",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

const runtimeDir = path.join(__dirname, "runtime");
const runtimeFile = path.join(runtimeDir, "content-store.json");
const deliveryRuntimeFile = path.join(runtimeDir, "delivery-store.json");
const commerceRuntimeFile = path.join(runtimeDir, "commerce-store.json");
const uploadTempDir = path.join(runtimeDir, "uploads");
const distDir = path.join(__dirname, "dist");
const distIndexFile = path.join(distDir, "index.html");
const uploadFileSizeLimitBytes =
  (parsePositiveInteger(process.env.UPLOAD_MAX_FILE_SIZE_MB || "300") || 300) *
  1024 *
  1024;
const pdfPreviewDpi =
  parsePositiveInteger(process.env.PDF_PREVIEW_DPI || "216") || 216;
const pdfPreviewWebpQuality =
  parsePositiveInteger(process.env.PDF_PREVIEW_WEBP_QUALITY || "88") || 88;
const maxRasterImageDimension =
  parsePositiveInteger(process.env.IMAGE_MAX_DIMENSION_PX || "2560") || 2560;
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
const normalizedRasterMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

app.disable("x-powered-by");
app.set("trust proxy", isProduction ? 1 : false);

// Stripe webhooks require the raw request body for signature verification.
// This must be registered before express.json() so the route gets the buffer.
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripeClient();

  if (!stripe || !webhookSecret) {
    res.status(503).json({ error: "Stripe not configured." });
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
    return;
  }

  if (event.type !== "checkout.session.completed") {
    res.json({ received: true });
    return;
  }

  // Idempotency: skip if we already processed this event
  if (await ordersStore.hasProcessedStripeEvent(event.id)) {
    res.json({ received: true });
    return;
  }
  await ordersStore.markStripeEventProcessed(event.id);

  const session = event.data.object;
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { expand: ["data.price.product"] });
  const data = await repository.getAllData();

  const orderId = crypto.randomUUID();
  const deliveryToken = crypto.randomBytes(32).toString("hex");
  const customerEmail = session.customer_details?.email || "";
  const shippingAddress = session.shipping_details?.address || null;

  // Resolve purchased issues from price IDs — matches either a format's base
  // price or its currently-active sale price, since a paid session may
  // reference either depending on when it was checked out.
  function findIssueByPriceId(priceId) {
    for (const issue of data.issues || []) {
      const shop = issue.shop || {};
      if (priceId === shop.digitalPriceId || priceId === shop.digitalSale?.priceId) {
        return { issue, format: "digital" };
      }
      if (priceId === shop.physicalPriceId || priceId === shop.physicalSale?.priceId) {
        return { issue, format: "physical" };
      }
    }
    return null;
  }

  const purchasedItems = [];
  for (const item of lineItems.data) {
    const priceId = item.price?.id;
    const match = findIssueByPriceId(priceId);
    if (match) {
      const { issue, format } = match;
      purchasedItems.push({
        id: crypto.randomUUID(),
        orderId,
        issueId: issue.id,
        issueTitle: issue.title,
        format,
        pricePaid: item.amount_total || 0,
        digitalAssetId: format === "digital" ? (issue.shop?.digitalAssetId || "") : "",
      });
      continue;
    }

    const bundle = data.bundle;
    if (bundle && (priceId === bundle.digitalPriceId || priceId === bundle.digitalSale?.priceId)) {
      const includedIssues = bundle.includedIssueIds
        .map((id) => data.issues?.find((i) => i.id === id))
        .filter(Boolean);
      if (includedIssues.length === 0) continue;
      const perIssueCents = Math.floor((item.amount_total || 0) / includedIssues.length);
      includedIssues.forEach((issue, idx) => {
        purchasedItems.push({
          id: crypto.randomUUID(),
          orderId,
          issueId: issue.id,
          issueTitle: issue.title,
          format: "digital",
          pricePaid: idx === 0
            ? (item.amount_total || 0) - perIssueCents * (includedIssues.length - 1)
            : perIssueCents,
          digitalAssetId: issue.shop?.digitalAssetId || "",
        });
      });
    }
  }

  await ordersStore.insertOrder({
    id: orderId,
    stripeSessionId: session.id,
    customerEmail,
    status: "paid",
    shippingAddress,
    items: purchasedItems,
    deliveryToken,
  });

  const digitalItems = purchasedItems.filter((i) => i.format === "digital" && i.digitalAssetId);
  const creatorName = data.siteSettings?.brandName || "Renowned";

  if (resendIsConfigured() && customerEmail && purchasedItems.length > 0) {
    let emailContent;
    if (digitalItems.length > 0) {
      const origin = getPublicSiteOrigin();
      const accessUrl = `${origin}/order/${deliveryToken}`;
      const itemList = digitalItems.map((i) => i.issueTitle).join(", ");
      emailContent = buildOrderDeliveryEmail({ itemList, accessUrl, creatorName });
    } else {
      const itemList = purchasedItems.map((i) => i.issueTitle).join(", ");
      emailContent = buildPhysicalOrderEmail({ itemList, creatorName, shippingAddress });
    }

    const { subject, html, text } = emailContent;
    await sendResendEmail({ to: customerEmail, subject, html, text }).catch((err) => {
      console.error("Order confirmation email failed:", err.message);
    });
  }

  res.json({ received: true });
});

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

function normalizeDeliveryLinkUrl(rawUrl, siteOrigin = getPublicSiteOrigin()) {
  const value = String(rawUrl || "").trim();
  if (!value) {
    return "";
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  try {
    return new URL(value).toString();
  } catch {
    // Fall through to relative/domain-like normalization.
  }

  try {
    if (value.startsWith("/")) {
      return new URL(value, siteOrigin).toString();
    }

    if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(value)) {
      return new URL(`https://${value}`).toString();
    }

    if (!/\s/.test(value)) {
      return new URL(value.replace(/^\.?\//, ""), `${siteOrigin.replace(/\/$/, "")}/`).toString();
    }
  } catch {
    // Keep the original value if normalization fails unexpectedly.
  }

  return value;
}

function getAllowedRequestOrigins() {
  const origins = new Set([getPublicSiteOrigin()]);

  if (!isProduction) {
    // Default dev pair plus side-by-side alt stacks (see .claude/launch.json
    // "dev-alt": API_PORT=3002 / vite on 5174; "dev-alt2": API_PORT=3003 / vite on 5175).
    for (const port of [3001, 5173, 3002, 5174, 3003, 5175]) {
      origins.add(`http://localhost:${port}`);
      origins.add(`http://127.0.0.1:${port}`);
    }
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

async function removeTempDirectory(directoryPath) {
  if (!directoryPath) {
    return;
  }

  try {
    await fs.rm(directoryPath, { recursive: true, force: true });
  } catch {
    // Temporary render directories are best-effort cleanup.
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

let pdfToImageToolStatusPromise = null;

function getPdfRenderOutputPrefix(projectId) {
  return path.join(uploadTempDir, `pdf-render-${projectId}-${crypto.randomUUID()}`, "page");
}

async function getPdfToImageToolStatus() {
  if (!pdfToImageToolStatusPromise) {
    pdfToImageToolStatusPromise = execFile("pdftoppm", ["-v"], { timeout: 10000 })
      .then(({ stdout, stderr }) => ({
        available: true,
        message: String(stderr || stdout || "").trim(),
      }))
      .catch((error) => ({
        available: false,
        message: error?.message || "pdftoppm is unavailable",
      }));
  }

  return pdfToImageToolStatusPromise;
}

async function renderPdfPagesToImages(pdfPath, projectId) {
  const outputPrefix = getPdfRenderOutputPrefix(projectId);
  const renderDirectory = path.dirname(outputPrefix);
  await fs.mkdir(renderDirectory, { recursive: true });

  try {
    await execFile(
      "pdftoppm",
      [
        "-png",
        "-r",
        String(pdfPreviewDpi),
        pdfPath,
        outputPrefix,
      ],
      { timeout: 120000 }
    );

    const entries = await fs.readdir(renderDirectory, { withFileTypes: true });
    const pngPages = entries
      .filter((entry) => entry.isFile() && /^page-\d+\.png$/i.test(entry.name))
      .map((entry) => ({
        pageNumber: Number(entry.name.match(/(\d+)/)?.[1] || 0),
        filePath: path.join(renderDirectory, entry.name),
        fileName: entry.name,
      }))
      .filter((page) => page.pageNumber > 0)
      .sort((a, b) => a.pageNumber - b.pageNumber);

    const renderedPages = [];
    for (const page of pngPages) {
      const webpPath = page.filePath.replace(/\.png$/i, ".webp");
      const { info } = await sharp(page.filePath, { failOn: "none" })
        .webp({
          quality: pdfPreviewWebpQuality,
          effort: 4,
        })
        .toFile(webpPath);

      await fs.unlink(page.filePath).catch(() => {});
      renderedPages.push({
        pageNumber: page.pageNumber,
        filePath: webpPath,
        fileName: path.basename(webpPath),
        mimeType: "image/webp",
        width: info.width || null,
        height: info.height || null,
      });
    }

    return renderedPages;
  } catch (error) {
    await removeTempDirectory(renderDirectory);
    throw error;
  }
}

function getImageOutputOptions(contentType) {
  if (contentType === "image/png") {
    return {
      contentType,
      apply: (image) => image.png({ compressionLevel: 9, palette: true }),
    };
  }

  if (contentType === "image/webp") {
    return {
      contentType,
      apply: (image) => image.webp({ quality: 84 }),
    };
  }

  return {
    contentType: "image/jpeg",
    apply: (image) => image.jpeg({ quality: 84, mozjpeg: true }),
  };
}

async function prepareUploadedAsset(file) {
  const contentType = file.mimetype || "";
  const baseMetadata = {
    category: "upload",
    contentType,
    fileName: file.originalname,
    size: file.size,
  };

  if (!contentType.startsWith("image/")) {
    return {
      body: createReadStream(file.path),
      contentType,
      metadata: baseMetadata,
    };
  }

  if (!normalizedRasterMimeTypes.has(contentType)) {
    try {
      const metadata = await sharp(file.path, { failOn: "none" }).metadata();
      return {
        body: createReadStream(file.path),
        contentType,
        metadata: {
          ...baseMetadata,
          width: metadata.width || null,
          height: metadata.height || null,
          originalWidth: metadata.width || null,
          originalHeight: metadata.height || null,
          normalized: false,
        },
      };
    } catch {
      return {
        body: createReadStream(file.path),
        contentType,
        metadata: {
          ...baseMetadata,
          normalized: false,
        },
      };
    }
  }

  const originalMetadata = await sharp(file.path, { failOn: "none" }).metadata();
  const output = getImageOutputOptions(contentType);
  const pipeline = sharp(file.path, { failOn: "none" })
    .rotate()
    .resize({
      width: maxRasterImageDimension,
      height: maxRasterImageDimension,
      fit: "inside",
      withoutEnlargement: true,
    });
  const { data, info } = await output.apply(pipeline).toBuffer({ resolveWithObject: true });

  return {
    body: data,
    contentType: output.contentType,
    metadata: {
      ...baseMetadata,
      contentType: output.contentType,
      size: data.length,
      width: info.width || null,
      height: info.height || null,
      originalWidth: originalMetadata.width || null,
      originalHeight: originalMetadata.height || null,
      normalized:
        info.width !== originalMetadata.width ||
        info.height !== originalMetadata.height ||
        output.contentType !== contentType ||
        Boolean(originalMetadata.orientation),
    },
  };
}

function getReaderPageStorageKeys(file) {
  return (file?.readerPages || []).map((page) => page.storageKey).filter(Boolean);
}

function getReaderPageFilename(file, readerPage) {
  const extension =
    readerPage?.mimeType === "image/webp"
      ? "webp"
      : readerPage?.mimeType === "image/png"
        ? "png"
        : "jpg";
  return `${path.parse(file.originalFilename).name}-page-${readerPage?.pageNumber || 1}.${extension}`;
}

function serializeDeliveryFile(file, options = {}) {
  if (!file) {
    return null;
  }

  const { accessToken = "" } = options;
  const readerPages = Array.isArray(file.readerPages) ? file.readerPages : [];
  return {
    ...file,
    readerPages: readerPages.map((page) => ({
      ...page,
      url: accessToken
        ? `/api/delivery/access/${encodeURIComponent(accessToken)}/files/${encodeURIComponent(file.id)}/read/pages/${page.pageNumber}`
        : `/api/delivery/files/${encodeURIComponent(file.id)}/pages/${page.pageNumber}`,
    })),
  };
}

function buildAccessFilePayload(file, accessToken) {
  if (!file) {
    return null;
  }

  return {
    ...serializeDeliveryFile(file, { accessToken }),
    actions: {
      downloadUrl: `/api/delivery/access/${encodeURIComponent(accessToken)}/files/${encodeURIComponent(file.id)}/download`,
      readUrl: `/a/${encodeURIComponent(accessToken)}/read/${encodeURIComponent(file.id)}`,
      readerUrl: `/api/delivery/access/${encodeURIComponent(accessToken)}/files/${encodeURIComponent(file.id)}/read/content`,
    },
  };
}

function buildAccessCoverUrl(accessToken) {
  return `/api/delivery/access/${encodeURIComponent(accessToken)}/cover`;
}

function findAccessibleFile(access, fileId) {
  if (!access?.files?.length) {
    return null;
  }

  if (!fileId) {
    return access.files[0] || null;
  }

  return access.files.find((file) => file.id === fileId) || null;
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

    if (this.repairLegacySocialIconUrls(data)) {
      await this.writeAllData(data);
    }
  }

  repairLegacySocialIconUrls(data) {
    const legacyIconMap = {
      "https://renownedcomic.com/wp-content/uploads/2025/09/Instagram_icon-1.png":
        "/icons/instagram.svg",
      "https://renownedcomic.com/wp-content/uploads/2025/09/youtube.png":
        "/icons/youtube.svg",
      "https://renownedcomic.com/wp-content/uploads/2025/09/patreon.png":
        "/icons/patreon.svg",
      "https://renownedcomic.com/wp-content/uploads/2025/09/web.jpg":
        "/icons/website.svg",
    };

    if (!Array.isArray(data.socialLinks)) {
      return false;
    }

    let changed = false;
    data.socialLinks = data.socialLinks.map((link) => {
      const replacement = legacyIconMap[link.iconUrl];
      if (!replacement) {
        return link;
      }
      changed = true;
      return { ...link, iconUrl: replacement };
    });
    return changed;
  }

  async getAllData() {
    const raw = await fs.readFile(this.filePath, "utf8");
    const data = JSON.parse(raw);
    data.pages = mergeCodeManagedPages(data.pages);
    return data;
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

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS stripe_events (
        event_id TEXT PRIMARY KEY,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        stripe_session_id TEXT UNIQUE NOT NULL,
        customer_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'paid',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;
    `);

    await this.pool.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT;
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        issue_id TEXT NOT NULL,
        issue_title TEXT NOT NULL,
        format TEXT NOT NULL,
        price_paid INTEGER NOT NULL
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS order_deliveries (
        token TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const seed = cloneDefaultSiteData();
    const keys = [
      "siteSettings",
      "pages",
      "issues",
      "bundle",
      "teamMembers",
      "socialLinks",
      "redirects",
      "lettersSubmissions",
      "assets",
      "shareLinks",
      "leads",
    ];

    for (const key of keys) {
      await this.pool.query(
        `
          INSERT INTO content_store (store_key, data)
          VALUES ($1, $2::jsonb)
          ON CONFLICT (store_key) DO NOTHING
        `,
        [key, JSON.stringify(seed[key] ?? [])]
      );
    }

    await this.repairLegacySocialIconUrls();

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

  async repairLegacySocialIconUrls() {
    const legacyIconMap = {
      "https://renownedcomic.com/wp-content/uploads/2025/09/Instagram_icon-1.png":
        "/icons/instagram.svg",
      "https://renownedcomic.com/wp-content/uploads/2025/09/youtube.png":
        "/icons/youtube.svg",
      "https://renownedcomic.com/wp-content/uploads/2025/09/patreon.png":
        "/icons/patreon.svg",
      "https://renownedcomic.com/wp-content/uploads/2025/09/web.jpg":
        "/icons/website.svg",
    };

    const result = await this.pool.query(
      "SELECT data FROM content_store WHERE store_key = 'socialLinks'"
    );
    const socialLinks = result.rows[0]?.data;
    if (!Array.isArray(socialLinks)) {
      return;
    }

    let changed = false;
    const repaired = socialLinks.map((link) => {
      const replacement = legacyIconMap[link.iconUrl];
      if (!replacement) {
        return link;
      }
      changed = true;
      return { ...link, iconUrl: replacement };
    });

    if (changed) {
      await this.pool.query(
        "UPDATE content_store SET data = $1::jsonb WHERE store_key = 'socialLinks'",
        [JSON.stringify(repaired)]
      );
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

    data.pages = mergeCodeManagedPages(data.pages);

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
        "bundle",
        "teamMembers",
        "socialLinks",
        "redirects",
        "lettersSubmissions",
        "assets",
        "shareLinks",
        "leads",
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
const ordersStore = process.env.DATABASE_URL
  ? new PgOrdersStore(repository.pool)
  : new FileOrdersStore(commerceRuntimeFile);

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
const libraryLinkRateLimiter = createRateLimiter({
  keyPrefix: "library-link",
  windowMs: 15 * 60 * 1000,
  maxRequests: 6,
  message: "Too many link requests. Please wait and try again.",
});

setInterval(cleanupRateLimits, 5 * 60 * 1000).unref();

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

// Sale prices never mutate the base Stripe Price (amounts are immutable in
// Stripe anyway) — toggling a sale on creates a second Price under the same
// Product and swaps which one checkout/display use; toggling off reverts to
// the base price, which is never touched. Recomputes only when the percent
// or the base price actually changed, so a save that doesn't touch pricing
// is a no-op here.
async function ensureSalePrice(stripe, basePriceId, sale) {
  if (!sale?.enabled || !basePriceId) return sale;
  if (sale.priceId && sale.percentApplied === sale.percent && sale.sourcePriceId === basePriceId) {
    return sale;
  }
  if (!stripe) return sale;

  const basePrice = await stripe.prices.retrieve(basePriceId);
  const discountedAmount = Math.round(basePrice.unit_amount * (1 - sale.percent / 100));
  const newPrice = await stripe.prices.create({
    product: basePrice.product,
    unit_amount: discountedAmount,
    currency: basePrice.currency,
  });

  if (sale.priceId) {
    stripe.prices.update(sale.priceId, { active: false }).catch(() => {});
  }

  return { ...sale, priceId: newPrice.id, percentApplied: sale.percent, sourcePriceId: basePriceId };
}

function effectivePriceId(basePriceId, sale) {
  return sale?.enabled && sale.priceId ? sale.priceId : basePriceId;
}

// Physical-format checkout only. Adjust here if shipping destinations or rates change.
const SHIPPING_ALLOWED_COUNTRIES = ["US"];
const SHIPPING_FLAT_RATE_CENTS = 500;

// Display prices are never stored — they're always resolved live from Stripe by
// Price ID so the site can never show a stale/mismatched price. Cached briefly
// since the same handful of Price IDs get looked up on every bootstrap request.
const stripePriceCache = new Map();
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
const PRICE_CACHE_NEGATIVE_TTL_MS = 60 * 1000;

function formatStripeAmount(unitAmount, currency) {
  if (typeof unitAmount !== "number") {
    return null;
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(unitAmount / 100);
  } catch {
    return null;
  }
}

async function getLivePriceDisplay(stripe, priceId) {
  if (!priceId) {
    return null;
  }

  const cached = stripePriceCache.get(priceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.display;
  }

  if (!stripe) {
    return null;
  }

  let display = null;
  try {
    const price = await stripe.prices.retrieve(priceId);
    display = formatStripeAmount(price.unit_amount, price.currency);
  } catch (err) {
    console.error(`Failed to fetch Stripe price ${priceId}:`, err?.message || err);
  }

  stripePriceCache.set(priceId, {
    display,
    expiresAt: Date.now() + (display ? PRICE_CACHE_TTL_MS : PRICE_CACHE_NEGATIVE_TTL_MS),
  });

  return display;
}

// Resolves the display price for one format, preferring the sale price (with
// the base price alongside for a strikethrough) when a sale is active and
// its Price ID actually resolves in Stripe.
async function resolveFormatPricing(stripe, basePriceId, sale) {
  const baseDisplay = await getLivePriceDisplay(stripe, basePriceId);
  if (sale?.enabled && sale.priceId) {
    const saleDisplay = await getLivePriceDisplay(stripe, sale.priceId);
    if (saleDisplay) {
      return { price: saleDisplay, basePrice: baseDisplay, onSale: true };
    }
  }
  return { price: baseDisplay, basePrice: null, onSale: false };
}

async function withLiveShopPrices(issues, stripe) {
  return Promise.all(
    issues.map(async (issue) => {
      const shop = issue.shop;
      if (!shop || (!shop.digitalPriceId && !shop.physicalPriceId)) {
        return issue;
      }

      const [digital, physical] = await Promise.all([
        resolveFormatPricing(stripe, shop.digitalPriceId, shop.digitalSale),
        resolveFormatPricing(stripe, shop.physicalPriceId, shop.physicalSale),
      ]);

      return {
        ...issue,
        shop: {
          ...shop,
          digitalPrice: digital.price,
          digitalBasePrice: digital.basePrice,
          digitalOnSale: digital.onSale,
          physicalPrice: physical.price,
          physicalBasePrice: physical.basePrice,
          physicalOnSale: physical.onSale,
        },
      };
    })
  );
}

async function withLiveBundlePrice(bundle, stripe) {
  if (!bundle || !bundle.digitalPriceId) {
    return bundle;
  }
  const digital = await resolveFormatPricing(stripe, bundle.digitalPriceId, bundle.digitalSale);
  return {
    ...bundle,
    digitalPrice: digital.price,
    digitalBasePrice: digital.basePrice,
    digitalOnSale: digital.onSale,
  };
}

function sanitizePublicData(data) {
  return {
    siteSettings: data.siteSettings,
    pages: data.pages,
    issues: data.issues,
    bundle: data.bundle,
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
    assets: normalizeAssets(data.assets),
  };
}

function sanitizeAdminData(data) {
  return {
    ...data,
    assets: normalizeAssets(
      data.assets.filter((asset) => asset.storageType === "s3-bucket")
    ),
    users: data.users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
    })),
    storage: getRuntimeDiagnostics(),
  };
}

function getRuntimeDiagnostics() {
  const storageEnv = getStorageEnv();
  const bucketVars = {
    S3_BUCKET: Boolean(storageEnv.bucket),
    S3_REGION: Boolean(storageEnv.region),
    S3_ACCESS_KEY_ID: Boolean(storageEnv.accessKeyId),
    S3_SECRET_ACCESS_KEY: Boolean(storageEnv.secretAccessKey),
    S3_ENDPOINT: Boolean(storageEnv.endpoint),
    S3_FORCE_PATH_STYLE: storageEnv.forcePathStyle,
  };

  const resendVars = {
    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
    RESEND_FROM_EMAIL: Boolean(process.env.RESEND_FROM_EMAIL),
    RESEND_REPLY_TO: Boolean(process.env.RESEND_REPLY_TO),
  };

  return {
    database: process.env.DATABASE_URL ? "postgres" : "runtime-json",
    bucketConfigured: storageIsConfigured(),
    assetDeliveryMode: storageIsConfigured() ? "signed-app-route" : "not-configured",
    publicSiteOrigin: getPublicSiteOrigin(),
    resendConfigured: resendIsConfigured(),
    bucketVars,
    resendVars,
  };
}

function storageIsConfigured() {
  const storageEnv = getStorageEnv();
  return Boolean(
    storageEnv.bucket &&
      storageEnv.region &&
      storageEnv.accessKeyId &&
      storageEnv.secretAccessKey
  );
}

function createStorageClient() {
  const storageEnv = getStorageEnv();
  return new S3Client({
    region: storageEnv.region,
    endpoint: storageEnv.endpoint || undefined,
    forcePathStyle: storageEnv.forcePathStyle,
    credentials: {
      accessKeyId: storageEnv.accessKeyId,
      secretAccessKey: storageEnv.secretAccessKey,
    },
  });
}

async function deleteStorageKeys(keys) {
  const storageEnv = getStorageEnv();
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
          Bucket: storageEnv.bucket,
          Key: batch[0],
        })
      );
      continue;
    }

    await client.send(
      new DeleteObjectsCommand({
        Bucket: storageEnv.bucket,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
  }
}

async function listStorageKeysByPrefix(prefix) {
  const storageEnv = getStorageEnv();
  if (!prefix || !storageIsConfigured()) {
    return [];
  }

  const client = createStorageClient();
  const keys = [];
  let continuationToken = undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: storageEnv.bucket,
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

function getAssetVariantUrl(assetId, variantId) {
  return `/api/assets/${encodeURIComponent(assetId)}/variants/${encodeURIComponent(
    variantId
  )}`;
}

function normalizeAssetVariant(assetId, variant) {
  if (!variant || typeof variant !== "object") {
    return null;
  }

  return {
    ...variant,
    url: getAssetVariantUrl(assetId, variant.id),
  };
}

function normalizeAsset(asset) {
  if (!asset || typeof asset !== "object") {
    return asset;
  }

  return {
    ...asset,
    url: getAssetUrl(asset.id),
    variants: (asset.variants || [])
      .map((variant) => normalizeAssetVariant(asset.id, variant))
      .filter(Boolean),
  };
}

function normalizeAssets(assets) {
  return (assets || []).map((asset) => normalizeAsset(asset));
}

function collectAssetUsagePaths(value, target, path = [], matches = []) {
  if (typeof value === "string") {
    if (target.has(value)) {
      matches.push(path.join(".").replace(/\.\[/g, "["));
    }
    return matches;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectAssetUsagePaths(entry, target, [...path, `[${index}]`], matches);
    });
    return matches;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => {
      collectAssetUsagePaths(entry, target, [...path, key], matches);
    });
  }

  return matches;
}

function getAssetUsageReferences(data, assetUrls) {
  const targetUrls = new Set((assetUrls || []).filter(Boolean));
  if (!targetUrls.size) {
    return [];
  }

  const targets = [
    ["siteSettings", data.siteSettings],
    ["pages", data.pages],
    ["issues", data.issues],
    ["teamMembers", data.teamMembers],
    ["socialLinks", data.socialLinks],
  ];

  return targets.flatMap(([label, value]) =>
    collectAssetUsagePaths(value, targetUrls, [label])
  );
}

function getAssetVariantById(asset, variantId) {
  return (asset?.variants || []).find((variant) => variant.id === variantId) || null;
}

function getAssetUrls(asset) {
  const normalizedAsset = normalizeAsset(asset);
  return [
    normalizedAsset?.url,
    ...(normalizedAsset?.variants || []).map((variant) => variant.url),
  ].filter(Boolean);
}

function getAssetStorageKeys(asset) {
  return [
    asset?.metadata?.objectKey,
    ...((asset?.variants || []).map((variant) => variant?.metadata?.objectKey)),
  ].filter(Boolean);
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeCropRect(crop) {
  if (!crop || typeof crop !== "object") {
    return null;
  }

  const x = Number(crop.x);
  const y = Number(crop.y);
  const width = Number(crop.width);
  const height = Number(crop.height);

  if (![x, y, width, height].every((entry) => Number.isFinite(entry))) {
    return null;
  }

  const normalizedX = clampNumber(x, 0, 0.99);
  const normalizedY = clampNumber(y, 0, 0.99);
  const normalizedWidth = clampNumber(width, 0.01, 1 - normalizedX);
  const normalizedHeight = clampNumber(height, 0.01, 1 - normalizedY);

  return {
    x: normalizedX,
    y: normalizedY,
    width: normalizedWidth,
    height: normalizedHeight,
  };
}

async function readStorageObjectBuffer(key) {
  const client = createStorageClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getStorageEnv().bucket,
      Key: key,
    })
  );

  if (response.Body?.transformToByteArray) {
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  if (response.Body?.pipe || response.Body?.on) {
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  if (response.Body?.transformToWebStream) {
    const reader = response.Body.transformToWebStream().getReader();
    const chunks = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (!done && result.value) {
        chunks.push(Buffer.from(result.value));
      }
    }
    return Buffer.concat(chunks);
  }

  throw new Error("Unable to read asset file from storage.");
}

function buildVariantStorageKey(assetId, variantId, contentType) {
  const extension =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : "jpg";
  return `uploads/variants/${assetId}/${variantId}.${extension}`;
}

async function prepareAssetVariantUpload(asset, variantInput, variantId) {
  const sourceContentType = asset?.metadata?.contentType || "";
  const objectKey = asset?.metadata?.objectKey || "";
  if (!normalizedRasterMimeTypes.has(sourceContentType) || !objectKey) {
    throw new Error("Only JPG, PNG, or WEBP source images can create cropped versions.");
  }

  const label = String(variantInput?.label || "").trim();
  if (!label) {
    throw new Error("Variant name is required.");
  }

  const crop = normalizeCropRect(variantInput?.crop);
  if (!crop) {
    throw new Error("A valid crop selection is required.");
  }

  const sourceBuffer = await readStorageObjectBuffer(objectKey);
  const sourceMetadata = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .metadata();

  if (!sourceMetadata.width || !sourceMetadata.height) {
    throw new Error("Unable to read source image dimensions.");
  }

  const sourceWidth = sourceMetadata.width;
  const sourceHeight = sourceMetadata.height;
  const left = clampNumber(Math.round(crop.x * sourceWidth), 0, sourceWidth - 1);
  const top = clampNumber(Math.round(crop.y * sourceHeight), 0, sourceHeight - 1);
  const width = clampNumber(
    Math.round(crop.width * sourceWidth),
    1,
    sourceWidth - left
  );
  const height = clampNumber(
    Math.round(crop.height * sourceHeight),
    1,
    sourceHeight - top
  );

  const output = getImageOutputOptions(sourceContentType);
  const pipeline = sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .extract({ left, top, width, height });
  const { data, info } = await output.apply(pipeline).toBuffer({ resolveWithObject: true });
  const storageKey = buildVariantStorageKey(asset.id, variantId, output.contentType);

  return {
    body: data,
    contentType: output.contentType,
    storageKey,
    variant: {
      id: variantId,
      label,
      url: getAssetVariantUrl(asset.id, variantId),
      metadata: {
        contentType: output.contentType,
        objectKey: storageKey,
        size: data.length,
        width: info.width || width,
        height: info.height || height,
        sourceAssetId: asset.id,
        crop,
        sourceWidth,
        sourceHeight,
      },
    },
  };
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
  const storageEnv = getStorageEnv();
  const client = createStorageClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: storageEnv.bucket,
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

async function streamStorageFile(res, { key, contentType, disposition, filename, cacheControl }) {
  const client = createStorageClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getStorageEnv().bucket,
      Key: key,
    })
  );

  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }

  if (disposition && filename) {
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${String(filename).replace(/"/g, "")}"`
    );
  }

  if (response.ContentLength) {
    res.setHeader("Content-Length", String(response.ContentLength));
  }

  res.setHeader("Cache-Control", cacheControl || "private, max-age=300");
  if (response.Body?.pipe) {
    response.Body.pipe(res);
    return;
  }

  if (response.Body?.transformToByteArray) {
    const bytes = await response.Body.transformToByteArray();
    res.end(Buffer.from(bytes));
    return;
  }

  if (response.Body?.transformToWebStream) {
    const webStream = response.Body.transformToWebStream();
    const reader = webStream.getReader();

    let done = false;
    while (!done) {
      const chunk = await reader.read();
      done = chunk.done;
      if (done) {
        break;
      }
      const { value } = chunk;
      res.write(Buffer.from(value));
    }

    res.end();
    return;
  }

  throw new Error("Storage response body could not be streamed.");
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

async function isAdminPreview(req) {
  // Admins hitting recipient endpoints (Preview Page, Preview Email, the
  // Open icon in admin) shouldn't pollute backer analytics.
  const session = await readSession(req);
  return session?.user?.role === "admin";
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
  const stripe = getStripeClient();
  const publishedIssues = data.issues.filter((issue) => issue.status === "published");
  const issues = await withLiveShopPrices(publishedIssues, stripe);
  const bundle = await withLiveBundlePrice(data.bundle, stripe);
  res.json(sanitizePublicData({ ...data, issues, bundle }));
});

const SAFE_RELATIVE_PATH = /^\/[A-Za-z0-9\-_/]*$/;

function safeCancelPath(cancelPath) {
  if (typeof cancelPath === "string" && cancelPath.length <= 200 && SAFE_RELATIVE_PATH.test(cancelPath)) {
    return cancelPath;
  }
  return "/shop";
}

// Accepts either the legacy single-item body ({ issueId, format }) or a cart
// ({ items: [{ issueId, format, quantity }] }). Both flow into one Stripe
// hosted-checkout session; the webhook already resolves any number of line
// items back to issues by price ID.
app.post("/api/checkout", async (req, res) => {
  const { issueId, format, items, cancelPath } = req.body || {};

  const requestedItems = Array.isArray(items) && items.length
    ? items
    : issueId && format
      ? [{ issueId, format, quantity: 1 }]
      : null;
  if (!requestedItems) {
    res.status(400).json({ error: "items (or issueId and format) are required." });
    return;
  }
  if (requestedItems.length > 20) {
    res.status(400).json({ error: "Too many items in one checkout." });
    return;
  }

  const stripe = getStripeClient();
  if (!stripe) {
    res.status(503).json({ error: "Payments are not configured." });
    return;
  }

  const data = await repository.getAllData();

  const lineItems = [];
  let hasPhysical = false;
  for (const entry of requestedItems) {
    if (entry.kind === "bundle" || entry.bundleId) {
      const bundle = data.bundle;
      if (!bundle || entry.bundleId !== bundle.id) {
        res.status(404).json({ error: "Bundle not found." });
        return;
      }
      const priceId = effectivePriceId(bundle.digitalPriceId, bundle.digitalSale);
      if (!priceId) {
        res.status(400).json({ error: `${bundle.title} is not available for purchase yet.` });
        return;
      }
      const quantity = Math.min(Math.max(Math.trunc(Number(entry.quantity) || 1), 1), 10);
      lineItems.push({ price: priceId, quantity });
      continue;
    }

    const issue = data.issues?.find((i) => i.id === entry.issueId);
    if (!issue) {
      res.status(404).json({ error: "Issue not found." });
      return;
    }
    const entryFormat = entry.format === "physical" ? "physical" : entry.format === "digital" ? "digital" : null;
    const priceId = entryFormat === "digital"
      ? effectivePriceId(issue.shop?.digitalPriceId, issue.shop?.digitalSale)
      : entryFormat === "physical"
        ? effectivePriceId(issue.shop?.physicalPriceId, issue.shop?.physicalSale)
        : null;
    if (!priceId) {
      res.status(400).json({ error: `${issue.title} is not available for purchase in that format.` });
      return;
    }
    const quantity = Math.min(Math.max(Math.trunc(Number(entry.quantity) || 1), 1), 10);
    hasPhysical = hasPhysical || entryFormat === "physical";
    lineItems.push({ price: priceId, quantity });
  }

  const origin = getPublicSiteOrigin();
  try {
    const sessionParams = {
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${safeCancelPath(cancelPath)}`,
    };

    if (hasPhysical) {
      sessionParams.shipping_address_collection = { allowed_countries: SHIPPING_ALLOWED_COUNTRIES };
      sessionParams.shipping_options = [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: SHIPPING_FLAT_RATE_CENTS, currency: "usd" },
            display_name: "Standard shipping",
          },
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to create checkout session." });
  }
});

app.get("/api/checkout/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  const stripe = getStripeClient();
  if (!stripe) {
    res.status(503).json({ error: "Payments are not configured." });
    return;
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    res.status(404).json({ error: "Checkout session not found." });
    return;
  }

  const paid = session.status === "complete" || session.payment_status === "paid";

  // The order + delivery token are created asynchronously by the Stripe webhook,
  // so the token may not exist yet on the first poll after returning from checkout.
  let deliveryToken = null;
  if (paid) {
    deliveryToken = await ordersStore.getDeliveryTokenBySessionId(session.id);
  }

  res.json({
    paid,
    status: session.status,
    email: session.customer_details?.email || "",
    deliveryToken,
  });
});

app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
  try {
    const orders = await ordersStore.listOrders(200);
    res.json({ orders });
  } catch (err) {
    console.error("Failed to fetch orders:", err?.message);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

app.patch(
  "/api/admin/orders/:id/fulfillment",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    const { status } = req.body || {};
    if (status !== "pending" && status !== "shipped") {
      res.status(400).json({ error: "status must be \"pending\" or \"shipped\"." });
      return;
    }
    try {
      await ordersStore.updateFulfillmentStatus(req.params.id, status);
      res.json({ ok: true });
    } catch (err) {
      console.error("Failed to update fulfillment status:", err?.message);
      res.status(500).json({ error: "Failed to update fulfillment status." });
    }
  }
);

app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
  try {
    const [stats, data] = await Promise.all([ordersStore.getDashboardStats(), repository.getAllData()]);
    const leadsCount = (data.leads || []).length;
    const conversionRate = leadsCount > 0
      ? Math.round((stats.payingCustomers / leadsCount) * 1000) / 10
      : 0;
    res.json({ ...stats, leadsCount, conversionRate });
  } catch (err) {
    console.error("Failed to load dashboard stats:", err?.message);
    res.status(500).json({ error: "Failed to load dashboard stats." });
  }
});

app.get("/api/admin/customers", requireAdmin, async (_req, res) => {
  try {
    const customers = await ordersStore.listCustomers();
    res.json({ customers });
  } catch (err) {
    console.error("Failed to fetch customers:", err?.message);
    res.status(500).json({ error: "Failed to fetch customers." });
  }
});

app.get("/api/admin/customers/:email", requireAdmin, async (req, res) => {
  const email = normalizeEmail(req.params.email);
  if (!email) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }
  try {
    const { orders, items } = await resolveOwnedIssuesForEmail(email);
    res.json({ orders, owned: items });
  } catch (err) {
    console.error("Failed to fetch customer detail:", err?.message);
    res.status(500).json({ error: "Failed to fetch customer detail." });
  }
});

// An issue's shop.digitalAssetId may hold either a raw asset id or the asset's
// public "/api/assets/<id>" URL (the admin picker has stored both forms).
function resolveAssetByRef(data, assetRef) {
  if (!assetRef) {
    return null;
  }
  let id = String(assetRef).trim();
  const urlMatch = id.match(/^\/api\/assets\/([^/?#]+)/);
  if (urlMatch) {
    id = urlMatch[1];
  }
  return (data.assets || []).find((asset) => asset.id === id) || null;
}

// One digital order item → what the customer sees on /order/:token and in the
// library: cover, a 48h signed download URL when the file is in storage.
async function buildDigitalItemPayload(data, { issueId, issueTitle }) {
  const issue = data.issues?.find((i) => i.id === issueId);
  const asset = resolveAssetByRef(data, issue?.shop?.digitalAssetId);

  let downloadUrl = null;
  const objectKey = asset?.metadata?.objectKey;
  if (objectKey && storageIsConfigured()) {
    const client = createStorageClient();
    const { bucket } = getStorageEnv();
    downloadUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ResponseContentType: asset.metadata?.contentType || undefined,
        ResponseContentDisposition: `attachment; filename="${asset.metadata?.fileName || asset.label || "issue.pdf"}"`,
      }),
      { expiresIn: 60 * 60 * 48 }
    );
  }

  return {
    issueId,
    issueTitle: issue?.title || issueTitle,
    issueSlug: issue?.slug || "",
    coverImage: issue?.coverImage || "",
    downloadUrl,
    hasAsset: Boolean(asset),
  };
}

app.get("/api/order-delivery/:token", async (req, res) => {
  const { token } = req.params;

  const order = await ordersStore.getOrderByDeliveryToken(token);
  if (!order) {
    res.status(404).json({ error: "Delivery link not found." });
    return;
  }

  const data = await repository.getAllData();
  const items = await Promise.all(
    (order.items || [])
      .filter((item) => item.format === "digital")
      .map((item) => buildDigitalItemPayload(data, item))
  );

  res.json({
    orderId: order.id,
    createdAt: order.created_at,
    items,
  });
});

/* ---------------------------------------------------------------------------
 * Library (Phase 5) — magic-link, passwordless, email-keyed. The email address
 * is the account: possession of the inbox (magic link), of an order delivery
 * token (which was emailed), or of a paid Stripe checkout session id (the
 * success redirect) all prove the same thing, so each can open a session.
 * ------------------------------------------------------------------------- */

const LIBRARY_COOKIE = "renowned_library";

function setLibrarySessionCookie(res, session) {
  res.cookie(LIBRARY_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: LIBRARY_SESSION_TTL_MS,
    path: "/",
  });
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200 ? email : null;
}

app.post("/api/library/request-link", libraryLinkRateLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }

  const token = await ordersStore.createLibraryToken(email);
  const linkPath = `/library?token=${token}`;

  if (!resendIsConfigured()) {
    if (isProduction) {
      res.status(503).json({ error: "Email sending is not configured." });
      return;
    }
    // Local dev without Resend: hand the link back so the flow stays testable.
    console.log(`Library magic link for ${email}: ${linkPath}`);
    res.json({ sent: false, devLink: linkPath });
    return;
  }

  const accessUrl = `${getPublicSiteOrigin()}${linkPath}`;
  const data = await repository.getAllData();
  const creatorName = data.siteSettings?.brandName || "Renowned";
  const { subject, html, text } = buildLibraryLinkEmail({ accessUrl, creatorName });
  try {
    await sendResendEmail({ to: email, subject, html, text });
  } catch (err) {
    console.error("Library link email failed:", err?.message);
    res.status(500).json({ error: "Could not send the email. Try again." });
    return;
  }

  res.json({ sent: true });
});

app.post("/api/library/claim", publicFormRateLimiter, async (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (!token) {
    res.status(400).json({ error: "token is required." });
    return;
  }

  const email = await ordersStore.consumeLibraryToken(token);
  if (!email) {
    res.status(410).json({ error: "This link has expired. Request a new one." });
    return;
  }

  const session = await ordersStore.createLibrarySession(email);
  setLibrarySessionCookie(res, session);
  res.json({ email });
});

// Entry point from the existing token routes: an order delivery token was
// emailed to the buyer, so it can open the library for that order's email.
app.post("/api/library/claim-order", publicFormRateLimiter, async (req, res) => {
  const orderToken = String(req.body?.orderToken || "").trim();
  const order = orderToken ? await ordersStore.getOrderByDeliveryToken(orderToken) : null;
  const email = normalizeEmail(order?.customer_email);
  if (!email) {
    res.status(404).json({ error: "Order not found." });
    return;
  }

  const session = await ordersStore.createLibrarySession(email);
  setLibrarySessionCookie(res, session);
  res.json({ email });
});

// Entry point from /checkout/return: the Stripe session id in the success
// redirect identifies a paid checkout and its buyer email.
app.post("/api/library/claim-session", publicFormRateLimiter, async (req, res) => {
  const sessionId = String(req.body?.sessionId || "").trim();
  const stripe = getStripeClient();
  if (!stripe || !sessionId) {
    res.status(503).json({ error: "Payments are not configured." });
    return;
  }

  let checkoutSession;
  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    res.status(404).json({ error: "Checkout session not found." });
    return;
  }

  const paid = checkoutSession.status === "complete" || checkoutSession.payment_status === "paid";
  const email = normalizeEmail(checkoutSession.customer_details?.email);
  if (!paid || !email) {
    res.status(403).json({ error: "This checkout is not confirmed yet." });
    return;
  }

  const session = await ordersStore.createLibrarySession(email);
  setLibrarySessionCookie(res, session);
  res.json({ email });
});

// Everything an email owns: digital items across all their orders, deduped by
// issue. Shared by the public library endpoint and the admin customer detail
// view so the two can't drift apart.
async function resolveOwnedIssuesForEmail(email) {
  const orders = await ordersStore.listOrdersByEmail(email);
  const data = await repository.getAllData();

  const seenIssueIds = new Set();
  const digitalItems = [];
  for (const order of orders) {
    for (const item of order.items || []) {
      if (item.format !== "digital" || !item.issueId || seenIssueIds.has(item.issueId)) {
        continue;
      }
      seenIssueIds.add(item.issueId);
      digitalItems.push(item);
    }
  }

  const items = await Promise.all(digitalItems.map((item) => buildDigitalItemPayload(data, item)));
  return { orders, items };
}

app.get("/api/library", async (req, res) => {
  const session = await ordersStore.readLibrarySession(req.cookies?.[LIBRARY_COOKIE]);
  if (!session) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  const { orders, items } = await resolveOwnedIssuesForEmail(session.email);

  res.json({
    email: session.email,
    items,
    orders: orders.map((order) => ({
      id: order.id,
      createdAt: order.created_at,
      items: (order.items || []).map((item) => ({
        issueTitle: item.issueTitle,
        format: item.format,
      })),
    })),
  });
});

app.post("/api/library/logout", async (req, res) => {
  const token = req.cookies?.[LIBRARY_COOKIE];
  if (token) {
    await ordersStore.deleteLibrarySession(token);
  }
  res.clearCookie(LIBRARY_COOKIE, { path: "/" });
  res.json({ ok: true });
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
  const { name, location, email, issueSlug, message } = req.body ?? {};

  if (!name || !issueSlug || !message) {
    res.status(400).json({ error: "Name, issue, and message are required." });
    return;
  }

  const trimmed = {
    name: String(name).trim(),
    location: String(location || "").trim(),
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

app.post("/api/public/leads", publicFormRateLimiter, async (req, res) => {
  const { email, issueSlug, source } = req.body ?? {};

  if (!email) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  const trimmed = {
    email: String(email).trim(),
    issueSlug: issueSlug ? String(issueSlug).trim() : "",
    source: source ? String(source).trim() : "reader",
  };

  if (!trimmed.email) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  await withData((data) => ({
    ...data,
    leads: [
      {
        id: crypto.randomUUID(),
        ...trimmed,
        createdAt: new Date().toISOString(),
      },
      ...(data.leads || []),
    ],
  }));

  res.json({ ok: true });
});

app.post(
  "/api/public/correspondence",
  publicFormRateLimiter,
  upload.single("image"),
  async (req, res) => {
    const { name, location } = req.body ?? {};
    const file = req.file;

    if (!name?.trim() || !file) {
      if (file) {
        await fs.unlink(file.path).catch(() => {});
      }
      res.status(400).json({ error: "Name and image are required." });
      return;
    }

    if (!resendIsConfigured()) {
      await fs.unlink(file.path).catch(() => {});
      res.status(503).json({ error: "Email delivery is not configured." });
      return;
    }

    const trimmedName = String(name).trim();
    const trimmedLocation = String(location || "").trim();

    try {
      const imageBuffer = await fs.readFile(file.path);
      const base64Content = imageBuffer.toString("base64");
      const extension = path.extname(file.originalname || "scan.jpg") || ".jpg";
      const filename = `correspondence-${Date.now()}${extension}`;

      const toEmail =
        process.env.RESEND_REPLY_TO || process.env.RESEND_FROM_EMAIL;

      const signature = trimmedLocation
        ? `${trimmedName}, ${trimmedLocation}`
        : trimmedName;

      await sendResendEmail({
        to: toEmail,
        subject: `Reader Correspondence — ${signature}`,
        html: `<p>New reader correspondence from <strong>${escapeHtml(trimmedName)}</strong>${trimmedLocation ? `, ${escapeHtml(trimmedLocation)}` : ""}.</p><p>See attached image.</p>`,
        text: `New reader correspondence from ${trimmedName}${trimmedLocation ? `, ${trimmedLocation}` : ""}.\n\nSee attached image.`,
        attachments: [{ filename, content: base64Content }],
      });

      res.json({ ok: true });
    } finally {
      await fs.unlink(file.path).catch(() => {});
    }
  }
);

app.get("/api/admin/data", requireAdmin, async (_req, res) => {
  const data = await repository.getAllData();
  const stripe = getStripeClient();
  const issues = await withLiveShopPrices(data.issues, stripe);
  const bundle = await withLiveBundlePrice(data.bundle, stripe);
  res.json(sanitizeAdminData({ ...data, issues, bundle }));
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

  if (payload.shop) {
    const stripe = getStripeClient();
    payload.shop.digitalSale = await ensureSalePrice(stripe, payload.shop.digitalPriceId, payload.shop.digitalSale);
    payload.shop.physicalSale = await ensureSalePrice(stripe, payload.shop.physicalPriceId, payload.shop.physicalSale);
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

app.put("/api/admin/bundle", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const payload = req.body?.bundle;
  if (!payload) {
    res.status(400).json({ error: "bundle payload is required" });
    return;
  }

  const stripe = getStripeClient();
  payload.digitalSale = await ensureSalePrice(stripe, payload.digitalPriceId, payload.digitalSale);

  const next = await withData((data) => ({ ...data, bundle: payload }));
  res.json(sanitizeAdminData(next));
});

app.post("/api/admin/bundle/create-price", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    res.status(503).json({ error: "Payments are not configured." });
    return;
  }

  const unitAmountCents = Math.round(Number(req.body?.unitAmountCents));
  if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
    res.status(400).json({ error: "unitAmountCents must be a positive number." });
    return;
  }

  const data = await repository.getAllData();
  try {
    const product = await stripe.products.create({ name: data.bundle?.title || "The Complete Run" });
    const price = await stripe.prices.create({ product: product.id, unit_amount: unitAmountCents, currency: "usd" });
    res.json({ priceId: price.id });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to create Stripe price." });
  }
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

app.delete("/api/admin/redirects/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const currentData = await repository.getAllData();
  const redirect = currentData.redirects.find((entry) => entry.id === req.params.id);

  if (!redirect) {
    res.status(404).json({ error: "Redirect not found." });
    return;
  }

  const next = await withData((data) => ({
    ...data,
    redirects: data.redirects.filter((entry) => entry.id !== req.params.id),
  }));
  res.json(sanitizeAdminData(next));
});

app.delete("/api/admin/leads/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const currentData = await repository.getAllData();
  const lead = (currentData.leads || []).find((entry) => entry.id === req.params.id);

  if (!lead) {
    res.status(404).json({ error: "Lead not found." });
    return;
  }

  const next = await withData((data) => ({
    ...data,
    leads: (data.leads || []).filter((entry) => entry.id !== req.params.id),
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

app.put("/api/admin/asset-folders", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const payload = Array.isArray(req.body?.folders) ? req.body.folders : null;
  if (!payload) {
    res.status(400).json({ error: "folders payload is required" });
    return;
  }

  const folders = payload
    .map((folder, index) => ({
      id: String(folder?.id || "").trim(),
      name: String(folder?.name || "").trim(),
      sortOrder: Number.isFinite(Number(folder?.sortOrder)) ? Number(folder.sortOrder) : index,
    }))
    .filter((folder) => folder.id && folder.name);

  const next = await withData((data) => ({
    ...data,
    assetFolders: folders,
  }));
  res.json(sanitizeAdminData(next));
});

app.delete("/api/admin/assets/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  const currentData = await repository.getAllData();
  const asset = currentData.assets.find((entry) => entry.id === req.params.id);

  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }

  const usage = getAssetUsageReferences(currentData, getAssetUrls(asset));
  if (usage.length) {
    res.status(409).json({
      error: "Asset is still in use and cannot be deleted.",
      usage,
    });
    return;
  }

  if (asset.storageType === "s3-bucket" && storageIsConfigured()) {
    await deleteStorageKeys(getAssetStorageKeys(asset));
  }

  const next = await withData((data) => ({
    ...data,
    assets: data.assets.filter((entry) => entry.id !== req.params.id),
  }));
  res.json(sanitizeAdminData(next));
});

app.post(
  "/api/admin/assets/:id/variants",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    if (!storageIsConfigured()) {
      res.status(501).json({
        error:
          "Bucket storage is not configured. Set the required S3_* variables before using uploads.",
      });
      return;
    }

    const currentData = await repository.getAllData();
    const asset = currentData.assets.find((entry) => entry.id === req.params.id);
    if (!asset) {
      res.status(404).json({ error: "Asset not found." });
      return;
    }

    try {
      const variantId = crypto.randomUUID();
      const preparedVariant = await prepareAssetVariantUpload(
        asset,
        req.body?.variant,
        variantId
      );

      const client = createStorageClient();
      await client.send(
        new PutObjectCommand({
          Bucket: getStorageEnv().bucket,
          Key: preparedVariant.storageKey,
          Body: preparedVariant.body,
          ContentType: preparedVariant.contentType,
        })
      );

      const next = await withData((data) => ({
        ...data,
        assets: data.assets.map((entry) =>
          entry.id === req.params.id
            ? {
                ...entry,
                variants: [preparedVariant.variant, ...(entry.variants || [])],
              }
            : entry
        ),
      }));
      res.json(sanitizeAdminData(next));
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to create variant." });
    }
  }
);

app.put(
  "/api/admin/assets/:id/variants/:variantId",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    if (!storageIsConfigured()) {
      res.status(501).json({
        error:
          "Bucket storage is not configured. Set the required S3_* variables before using uploads.",
      });
      return;
    }

    const currentData = await repository.getAllData();
    const asset = currentData.assets.find((entry) => entry.id === req.params.id);
    if (!asset) {
      res.status(404).json({ error: "Asset not found." });
      return;
    }

    const existingVariant = getAssetVariantById(asset, req.params.variantId);
    if (!existingVariant) {
      res.status(404).json({ error: "Variant not found." });
      return;
    }

    try {
      const preparedVariant = await prepareAssetVariantUpload(
        asset,
        req.body?.variant,
        req.params.variantId
      );

      const client = createStorageClient();
      await client.send(
        new PutObjectCommand({
          Bucket: getStorageEnv().bucket,
          Key: preparedVariant.storageKey,
          Body: preparedVariant.body,
          ContentType: preparedVariant.contentType,
        })
      );

      const next = await withData((data) => ({
        ...data,
        assets: data.assets.map((entry) =>
          entry.id === req.params.id
            ? {
                ...entry,
                variants: (entry.variants || []).map((variant) =>
                  variant.id === req.params.variantId ? preparedVariant.variant : variant
                ),
              }
            : entry
        ),
      }));
      res.json(sanitizeAdminData(next));
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to update variant." });
    }
  }
);

app.delete(
  "/api/admin/assets/:id/variants/:variantId",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    const currentData = await repository.getAllData();
    const asset = currentData.assets.find((entry) => entry.id === req.params.id);
    if (!asset) {
      res.status(404).json({ error: "Asset not found." });
      return;
    }

    const variant = getAssetVariantById(asset, req.params.variantId);
    if (!variant) {
      res.status(404).json({ error: "Variant not found." });
      return;
    }

    const usage = getAssetUsageReferences(currentData, [
      getAssetVariantUrl(req.params.id, req.params.variantId),
    ]);
    if (usage.length) {
      res.status(409).json({
        error: "Variant is still in use and cannot be deleted.",
        usage,
      });
      return;
    }

    if (variant.metadata?.objectKey && storageIsConfigured()) {
      await deleteStorageKeys([variant.metadata.objectKey]);
    }

    const next = await withData((data) => ({
      ...data,
      assets: data.assets.map((entry) =>
        entry.id === req.params.id
          ? {
              ...entry,
              variants: (entry.variants || []).filter(
                (item) => item.id !== req.params.variantId
              ),
            }
          : entry
      ),
    }));
    res.json(sanitizeAdminData(next));
  }
);

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
        const preparedAsset = await prepareUploadedAsset(file);

        await client.send(
          new PutObjectCommand({
            Bucket: getStorageEnv().bucket,
            Key: key,
            Body: preparedAsset.body,
            ContentType: preparedAsset.contentType,
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
            ...preparedAsset.metadata,
            category: req.body.category || preparedAsset.metadata.category || "upload",
            objectKey: key,
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

  const objectKey = asset.metadata?.objectKey;
  if (!storageIsConfigured() || !objectKey) {
    res.status(404).json({ error: "Asset file is unavailable." });
    return;
  }

  const client = createStorageClient();
  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getStorageEnv().bucket,
      Key: objectKey,
      ResponseContentType: asset.metadata?.contentType || undefined,
    }),
    { expiresIn: getAssetUrlTtlSeconds() }
  );

  res.redirect(302, signedUrl);
});

app.get("/api/assets/:id/variants/:variantId", async (req, res) => {
  const data = await repository.getAllData();
  const asset = data.assets.find((entry) => entry.id === req.params.id);

  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }

  const variant = getAssetVariantById(asset, req.params.variantId);
  const objectKey = variant?.metadata?.objectKey;
  if (!variant || !storageIsConfigured() || !objectKey) {
    res.status(404).json({ error: "Asset variant not found." });
    return;
  }

  const client = createStorageClient();
  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getStorageEnv().bucket,
      Key: objectKey,
      ResponseContentType: variant.metadata?.contentType || undefined,
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

app.get("/api/admin/share-links", requireAdmin, async (_req, res) => {
  const data = await repository.getAllData();
  res.json({ shareLinks: (data.shareLinks || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

app.post(
  "/api/admin/share-links",
  requireTrustedOrigin,
  requireAdmin,
  upload.single("pdf"),
  async (req, res) => {
    let tempFilePath = null;

    if (!storageIsConfigured()) {
      res.status(501).json({
        error: "Bucket storage is not configured. Set the required S3_* variables before using uploads.",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "pdf file is required." });
      return;
    }

    const looksLikePdf =
      req.file.mimetype === "application/pdf" ||
      path.extname(req.file.originalname).toLowerCase() === ".pdf";

    if (!looksLikePdf) {
      await removeTempUpload(req.file.path);
      res.status(400).json({ error: "Only PDF files are allowed." });
      return;
    }

    tempFilePath = req.file.path;

    try {
      const id = crypto.randomUUID();
      const token = crypto.randomBytes(24).toString("base64url");
      const storageKey = `share-links/${id}.pdf`;
      const client = createStorageClient();

      await client.send(
        new PutObjectCommand({
          Bucket: getStorageEnv().bucket,
          Key: storageKey,
          Body: createReadStream(tempFilePath),
          ContentType: "application/pdf",
          ContentLength: req.file.size,
        })
      );

      const shareLink = {
        id,
        token,
        label: String(req.body.label || "").trim() || req.file.originalname,
        message: String(req.body.message || "").trim(),
        thumbnailUrl: String(req.body.thumbnailUrl || "").trim(),
        filename: req.file.originalname,
        storageKey,
        fileSize: req.file.size,
        createdAt: new Date().toISOString(),
      };

      await withData((data) => ({
        ...data,
        shareLinks: [...(data.shareLinks || []), shareLink],
      }));

      res.json({ shareLink, url: `/share/${token}` });
    } finally {
      await removeTempUpload(tempFilePath);
    }
  }
);

app.delete(
  "/api/admin/share-links/:id",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    const data = await repository.getAllData();
    const link = (data.shareLinks || []).find((entry) => entry.id === req.params.id);

    if (!link) {
      res.status(404).json({ error: "Share link not found." });
      return;
    }

    await deleteStorageKeys([link.storageKey]);
    await withData((d) => ({
      ...d,
      shareLinks: (d.shareLinks || []).filter((entry) => entry.id !== req.params.id),
    }));

    res.status(204).end();
  }
);

app.patch(
  "/api/admin/share-links/:id",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    const { label, message, thumbnailUrl } = req.body || {};
    const data = await repository.getAllData();
    const link = (data.shareLinks || []).find((entry) => entry.id === req.params.id);

    if (!link) {
      res.status(404).json({ error: "Share link not found." });
      return;
    }

    const updated = {
      ...link,
      label: typeof label === "string" ? label.trim() : link.label,
      message: typeof message === "string" ? message.trim() : link.message,
      thumbnailUrl: typeof thumbnailUrl === "string" ? thumbnailUrl.trim() : link.thumbnailUrl,
    };

    await withData((d) => ({
      ...d,
      shareLinks: (d.shareLinks || []).map((entry) =>
        entry.id === req.params.id ? updated : entry
      ),
    }));

    res.json({ shareLink: updated });
  }
);

app.get("/api/share/:token", async (req, res) => {
  const data = await repository.getAllData();
  const link = (data.shareLinks || []).find((entry) => entry.token === req.params.token);

  if (!link) {
    res.status(404).json({ error: "Link not found or expired." });
    return;
  }

  res.json({
    label: link.label,
    message: link.message,
    thumbnailUrl: link.thumbnailUrl || "",
    filename: link.filename,
    fileSize: link.fileSize,
    createdAt: link.createdAt,
  });
});

app.get("/api/share/:token/download", async (req, res) => {
  const data = await repository.getAllData();
  const link = (data.shareLinks || []).find((entry) => entry.token === req.params.token);

  if (!link) {
    res.status(404).json({ error: "Link not found or expired." });
    return;
  }

  if (!storageIsConfigured()) {
    res.status(501).json({ error: "Storage not configured." });
    return;
  }

  const signedUrl = await createSignedStorageUrl({
    key: link.storageKey,
    contentType: "application/pdf",
    disposition: "attachment",
    filename: link.filename,
  });

  res.redirect(302, signedUrl);
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

  res.json({
    ...detail,
    currentCover: serializeDeliveryFile(detail.currentCover),
    files: detail.files.map((file) => serializeDeliveryFile(file)),
  });
});

app.get("/api/admin/delivery/projects/:id/analytics", requireAdmin, async (req, res) => {
  const analytics = await deliveryStore.getProjectAnalytics(
    req.session.user.id,
    req.params.id,
    req.query.days
  );
  if (!analytics) {
    res.status(404).json({ error: "Delivery project not found." });
    return;
  }

  res.json({ analytics });
});

app.delete(
  "/api/admin/delivery/projects/:id/analytics",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await deliveryStore.clearAccessEvents(
        req.session.user.id,
        req.params.id
      );
      if (!result) {
        res.status(404).json({ error: "Delivery project not found." });
        return;
      }
      res.json({ ok: true, clearedCount: result.clearedCount });
    } catch (error) {
      console.error("Delivery analytics clear failed", error);
      res.status(500).json({ error: error.message || "Analytics clear failed." });
    }
  }
);

app.put(
  "/api/admin/delivery/projects/:id",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    try {
      const detail = await deliveryStore.updateProject(
        req.session.user.id,
        req.params.id,
        req.body ?? {}
      );

      if (!detail) {
        res.status(404).json({ error: "Delivery project not found." });
        return;
      }

      res.json({
        ...detail,
        currentCover: serializeDeliveryFile(detail.currentCover),
        files: detail.files.map((file) => serializeDeliveryFile(file)),
      });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to update delivery project." });
    }
  }
);

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

app.put(
  "/api/admin/delivery/projects/:id/files/:fileId",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    const patch = {};
    if (typeof req.body?.displayName === "string") {
      patch.displayName = req.body.displayName;
    }

    try {
      const file = await deliveryStore.updateFile(
        req.session.user.id,
        req.params.id,
        req.params.fileId,
        patch
      );
      if (!file) {
        res.status(404).json({ error: "Delivery file not found." });
        return;
      }
      res.json({ file });
    } catch (error) {
      console.error("Delivery file update failed", error);
      res.status(500).json({ error: error.message || "File update failed." });
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
      await deleteStorageKeys([file.storageKey, ...getReaderPageStorageKeys(file)]);
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
          Bucket: getStorageEnv().bucket,
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
    let renderDirectory = null;
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
    const toolStatus = await getPdfToImageToolStatus();
    let readerPages = [];

    try {
      if (toolStatus.available) {
        const renderedPages = await renderPdfPagesToImages(tempFilePath, req.params.id);
        renderDirectory = renderedPages[0] ? path.dirname(renderedPages[0].filePath) : null;

        for (const page of renderedPages) {
          const pageStorageKey = `delivery/projects/${req.params.id}/reader/${objectId}/page-${String(page.pageNumber).padStart(3, "0")}.webp`;
          const pageStat = await fs.stat(page.filePath);
          await client.send(
            new PutObjectCommand({
              Bucket: getStorageEnv().bucket,
              Key: pageStorageKey,
              Body: createReadStream(page.filePath),
              ContentType: page.mimeType,
              ContentLength: pageStat.size,
            })
          );
          readerPages.push({
            pageNumber: page.pageNumber,
            storageKey: pageStorageKey,
            mimeType: page.mimeType,
            width: page.width,
            height: page.height,
          });
        }
      } else {
        console.warn("pdftoppm unavailable; PDF uploaded without preprocessed reader pages.");
      }

      await client.send(
        new PutObjectCommand({
          Bucket: getStorageEnv().bucket,
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
        readerPages,
      });

      if (!file) {
        await deleteStorageKeys([key, ...readerPages.map((page) => page.storageKey)]);
        res.status(404).json({ error: "Delivery project not found." });
        return;
      }

      res.status(201).json({
        file: serializeDeliveryFile(file),
        preprocessing: {
          available: toolStatus.available,
          pageCount: readerPages.length,
        },
      });
    } catch (error) {
      await deleteStorageKeys(readerPages.map((page) => page.storageKey));
      console.error("Delivery PDF upload failed", error);
      res.status(500).json({ error: "PDF upload failed. Check the server log for details." });
    } finally {
      await removeTempUpload(tempFilePath);
      await removeTempDirectory(renderDirectory);
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

app.put(
  "/api/admin/delivery/projects/:id/backers/:backerId",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    try {
      const backer = await deliveryStore.updateBacker(
        req.session.user.id,
        req.params.id,
        req.params.backerId,
        req.body?.backer ?? {}
      );
      if (!backer) {
        res.status(404).json({ error: "Backer not found." });
        return;
      }
      res.json({ backer });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to update backer." });
    }
  }
);

app.post(
  "/api/admin/delivery/projects/:id/backers/move",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await deliveryStore.moveBackers(
        req.session.user.id,
        req.params.id,
        req.body?.backerIds ?? [],
        req.body?.tierId ?? ""
      );
      if (!result) {
        res.status(404).json({ error: "Delivery project not found." });
        return;
      }
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to move backers." });
    }
  }
);

app.delete(
  "/api/admin/delivery/projects/:id/backers/:backerId",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    const backer = await deliveryStore.deleteBacker(
      req.session.user.id,
      req.params.id,
      req.params.backerId
    );
    if (!backer) {
      res.status(404).json({ error: "Backer not found." });
      return;
    }
    res.json({ deleted: true, backer });
  }
);

app.post(
  "/api/admin/delivery/projects/:id/backers/:backerId/addons",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await deliveryStore.addBackerFile(
        req.session.user.id,
        req.params.id,
        req.params.backerId,
        req.body?.fileId
      );
      if (!result) {
        res.status(404).json({ error: "Backer or file not found." });
        return;
      }
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to add add-on." });
    }
  }
);

app.delete(
  "/api/admin/delivery/projects/:id/backers/:backerId/addons/:fileId",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await deliveryStore.removeBackerFile(
        req.session.user.id,
        req.params.id,
        req.params.backerId,
        req.params.fileId
      );
      if (!result) {
        res.status(404).json({ error: "Backer not found." });
        return;
      }
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to remove add-on." });
    }
  }
);

app.post(
  "/api/admin/delivery/projects/:id/send-emails",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    const resendAll = req.body?.resendAll === true;
    const requestedBackerIds = Array.isArray(req.body?.backerIds)
      ? req.body.backerIds.filter((id) => typeof id === "string" && id)
      : null;
    const testTo = typeof req.body?.testTo === "string" ? req.body.testTo.trim() : "";

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

    if (!detail.files.length) {
      res.status(400).json({ error: "Upload at least one PDF before sending delivery emails." });
      return;
    }

    const siteOrigin = getPublicSiteOrigin();

    if (testTo) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) {
        res.status(400).json({ error: "Provide a valid email address for the test send." });
        return;
      }

      const previewBacker = detail.backers[0] || null;
      const accessUrl = previewBacker
        ? `${siteOrigin}/a/${previewBacker.accessToken}`
        : `${siteOrigin}/a/preview`;
      const tier =
        (previewBacker && detail.tiers.find((entry) => entry.id === previewBacker.tierId)) ||
        detail.tiers[0] ||
        null;
      const email = buildDeliveryEmail({
        projectTitle: detail.project.title,
        creatorName: detail.project.creatorName,
        shortMessage: tier?.messageOverride || detail.project.shortMessage,
        accessUrl,
      });

      try {
        await sendResendEmail({
          to: testTo,
          subject: `[TEST] ${email.subject}`,
          html: email.html,
          text: email.text,
        });
        res.json({ ok: true, testSent: true, testTo });
      } catch (error) {
        res.status(502).json({ error: error.message || "Test send failed." });
      }
      return;
    }

    if (!detail.backers.length) {
      res.status(400).json({ error: "Import at least one backer before sending emails." });
      return;
    }

    let pool = detail.backers;
    if (requestedBackerIds && requestedBackerIds.length) {
      const requestedSet = new Set(requestedBackerIds);
      pool = detail.backers.filter((backer) => requestedSet.has(backer.id));
    }

    const backersToSend = resendAll
      ? pool
      : pool.filter((backer) => !backer.lastEmailedAt);

    if (!backersToSend.length) {
      res.json({
        ok: true,
        sentCount: 0,
        failedCount: 0,
        skippedCount: pool.length,
        targetedCount: 0,
        failures: [],
      });
      return;
    }

    const sentBackerIds = [];
    const failures = [];

    for (const backer of backersToSend) {
      const accessUrl = `${siteOrigin}/a/${backer.accessToken}`;
      const tier =
        detail.tiers.find((entry) => entry.id === backer.tierId) || detail.tiers[0] || null;
      const email = buildDeliveryEmail({
        projectTitle: detail.project.title,
        creatorName: detail.project.creatorName,
        shortMessage: tier?.messageOverride || detail.project.shortMessage,
        accessUrl,
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
      skippedCount: Math.max(pool.length - backersToSend.length, 0),
      targetedCount: backersToSend.length,
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

  if (file.kind !== "cover") {
    const session = await readSession(req);
    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (session.user?.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
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

app.get("/api/delivery/files/:id/content", requireAdmin, async (req, res) => {
  const file = await deliveryStore.getFile(req.params.id);
  if (!file) {
    res.status(404).json({ error: "File not found." });
    return;
  }

  if (!storageIsConfigured() || !file.storageKey) {
    res.status(404).json({ error: "File is unavailable." });
    return;
  }

  try {
    await streamStorageFile(res, {
      key: file.storageKey,
      contentType: file.mimeType,
      disposition: "inline",
      filename: file.originalFilename,
    });
  } catch (error) {
    console.error("Delivery file stream failed", error);
    res.status(500).json({ error: "File is unavailable." });
  }
});

app.get("/api/delivery/files/:id/pages/:pageNumber", requireAdmin, async (req, res) => {
  const file = await deliveryStore.getFile(req.params.id);
  if (!file) {
    res.status(404).json({ error: "File not found." });
    return;
  }

  const pageNumber = Number(req.params.pageNumber);
  const readerPage = (file.readerPages || []).find((page) => page.pageNumber === pageNumber);
  if (!readerPage) {
    res.status(404).json({ error: "Page not found." });
    return;
  }

  if (!storageIsConfigured() || !readerPage.storageKey) {
    res.status(404).json({ error: "Page is unavailable." });
    return;
  }

  try {
    await streamStorageFile(res, {
      key: readerPage.storageKey,
      contentType: readerPage.mimeType,
      disposition: "inline",
      filename: getReaderPageFilename(file, readerPage),
    });
  } catch (error) {
    console.error("Delivery page stream failed", error);
    res.status(500).json({ error: "Page is unavailable." });
  }
});

app.get("/api/delivery/access/:token", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  if (!access) {
    res.status(404).json({ error: "This delivery link is invalid or unavailable." });
    return;
  }

  if (!(await isAdminPreview(req))) {
    await deliveryStore.logAccessEvent(access.project.id, access.backer.id, "access_page_view");
  }
  res.json({
    project: access.project,
    backer: {
      email: access.backer.email,
    },
    tier: access.tier
      ? {
          ...access.tier,
          additionalLinkUrl: normalizeDeliveryLinkUrl(access.tier.additionalLinkUrl, getPublicSiteOrigin()),
        }
      : null,
    assets: {
      coverUrl: access.currentCover
        ? buildAccessCoverUrl(req.params.token)
        : "",
    },
    files: access.files.map((file) => buildAccessFilePayload(file, req.params.token)),
  });
});

app.get("/api/delivery/access/:token/cover", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  if (!access?.currentCover) {
    res.status(404).json({ error: "Cover is unavailable." });
    return;
  }

  if (!storageIsConfigured() || !access.currentCover.storageKey) {
    res.status(404).json({ error: "Cover is unavailable." });
    return;
  }

  try {
    await streamStorageFile(res, {
      key: access.currentCover.storageKey,
      contentType: access.currentCover.mimeType,
      disposition: "inline",
      filename: access.currentCover.originalFilename,
      // Public cache so email image proxies (Gmail, Outlook, etc.) will
      // fetch and cache the cover. Private would block their shared cache.
      cacheControl: "public, max-age=86400",
    });
  } catch (error) {
    console.error("Delivery cover stream failed", error);
    res.status(500).json({ error: "Cover is unavailable." });
  }
});

app.get("/api/delivery/access/:token/download", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  const file = findAccessibleFile(access);
  if (!file) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!storageIsConfigured() || !file.storageKey) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!(await isAdminPreview(req))) {
    await deliveryStore.logAccessEvent(access.project.id, access.backer.id, "file_download", file.id);
  }
  const signedUrl = await createSignedStorageUrl({
    key: file.storageKey,
    contentType: file.mimeType,
    disposition: "attachment",
    filename: file.originalFilename,
  });
  res.redirect(302, signedUrl);
});

app.get("/api/delivery/access/:token/files/:fileId/download", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  const file = findAccessibleFile(access, req.params.fileId);
  if (!file) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!storageIsConfigured() || !file.storageKey) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!(await isAdminPreview(req))) {
    await deliveryStore.logAccessEvent(access.project.id, access.backer.id, "file_download", file.id);
  }
  const signedUrl = await createSignedStorageUrl({
    key: file.storageKey,
    contentType: file.mimeType,
    disposition: "attachment",
    filename: file.originalFilename,
  });
  res.redirect(302, signedUrl);
});

app.get("/api/delivery/access/:token/read", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  const file = findAccessibleFile(access);
  if (!file) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!storageIsConfigured() || !file.storageKey) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!(await isAdminPreview(req))) {
    await deliveryStore.logAccessEvent(access.project.id, access.backer.id, "read_inline", file.id);
  }
  const signedUrl = await createSignedStorageUrl({
    key: file.storageKey,
    contentType: file.mimeType,
    disposition: "inline",
    filename: file.originalFilename,
  });
  res.redirect(302, signedUrl);
});

app.get("/api/delivery/access/:token/files/:fileId/read/content", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  const file = findAccessibleFile(access, req.params.fileId);
  if (!file) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!storageIsConfigured() || !file.storageKey) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!(await isAdminPreview(req))) {
    await deliveryStore.logAccessEvent(access.project.id, access.backer.id, "read_inline", file.id);
  }

  try {
    await streamStorageFile(res, {
      key: file.storageKey,
      contentType: file.mimeType,
      disposition: "inline",
      filename: file.originalFilename,
    });
  } catch (error) {
    console.error("Delivery read stream failed", error);
    res.status(500).json({ error: "This file is unavailable." });
  }
});

app.get("/api/delivery/access/:token/read/content", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  const file = findAccessibleFile(access);
  if (!file) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!storageIsConfigured() || !file.storageKey) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  if (!(await isAdminPreview(req))) {
    await deliveryStore.logAccessEvent(access.project.id, access.backer.id, "read_inline", file.id);
  }

  try {
    await streamStorageFile(res, {
      key: file.storageKey,
      contentType: file.mimeType,
      disposition: "inline",
      filename: file.originalFilename,
    });
  } catch (error) {
    console.error("Delivery read stream failed", error);
    res.status(500).json({ error: "This file is unavailable." });
  }
});

app.get("/api/delivery/access/:token/files/:fileId/read/pages/:pageNumber", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  const file = findAccessibleFile(access, req.params.fileId);
  if (!file) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  const pageNumber = Number(req.params.pageNumber);
  const readerPage = (file.readerPages || []).find(
    (page) => page.pageNumber === pageNumber
  );
  if (!readerPage) {
    res.status(404).json({ error: "This page is unavailable." });
    return;
  }

  if (!storageIsConfigured() || !readerPage.storageKey) {
    res.status(404).json({ error: "This page is unavailable." });
    return;
  }

  if (!(await isAdminPreview(req))) {
    await deliveryStore.logAccessEvent(access.project.id, access.backer.id, "read_inline", file.id);
  }

  try {
    await streamStorageFile(res, {
      key: readerPage.storageKey,
      contentType: readerPage.mimeType,
      disposition: "inline",
      filename: getReaderPageFilename(file, readerPage),
    });
  } catch (error) {
    console.error("Delivery read page stream failed", error);
    res.status(500).json({ error: "This page is unavailable." });
  }
});

app.get("/api/delivery/access/:token/read/pages/:pageNumber", async (req, res) => {
  const access = await deliveryStore.getAccessByToken(req.params.token);
  const file = findAccessibleFile(access);
  if (!file) {
    res.status(404).json({ error: "This file is unavailable." });
    return;
  }

  const pageNumber = Number(req.params.pageNumber);
  const readerPage = (file.readerPages || []).find((page) => page.pageNumber === pageNumber);
  if (!readerPage) {
    res.status(404).json({ error: "This page is unavailable." });
    return;
  }

  if (!storageIsConfigured() || !readerPage.storageKey) {
    res.status(404).json({ error: "This page is unavailable." });
    return;
  }

  if (!(await isAdminPreview(req))) {
    await deliveryStore.logAccessEvent(access.project.id, access.backer.id, "read_inline", file.id);
  }

  try {
    await streamStorageFile(res, {
      key: readerPage.storageKey,
      contentType: readerPage.mimeType,
      disposition: "inline",
      filename: getReaderPageFilename(file, readerPage),
    });
  } catch (error) {
    console.error("Delivery read page stream failed", error);
    res.status(500).json({ error: "This page is unavailable." });
  }
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
await ordersStore.init();

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

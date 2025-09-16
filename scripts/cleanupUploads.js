import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

import { logRequest, logSuccess, logError } from '../src/utils/logger.js';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const parsedRetention = Number.parseInt(process.env.UPLOAD_RETENTION_DAYS ?? '', 10);
const DEFAULT_RETENTION_DAYS =
  Number.isNaN(parsedRetention) || parsedRetention <= 0 ? 30 : parsedRetention;
const DEFAULT_RETENTION_MS = DEFAULT_RETENTION_DAYS * MILLISECONDS_PER_DAY;
const UPLOAD_DIR = path.join(process.cwd(), 'public/uploads');
const PLACEHOLDER_FILES = new Set(['placeholder.png']);

export async function cleanupUploads({ retentionMs } = {}) {
  const retentionWindow =
    typeof retentionMs === 'number' && retentionMs > 0 ? retentionMs : DEFAULT_RETENTION_MS;
  const cutoff = Date.now() - retentionWindow;
  const uploadDirResolved = path.resolve(UPLOAD_DIR);

  try {
    const entries = await fs.readdir(uploadDirResolved, { withFileTypes: true });
    logRequest('Running upload cleanup', {
      retentionMs: retentionWindow,
      directory: uploadDirResolved,
      fileCount: entries.length,
    });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      if (entry.name.startsWith('.')) {
        continue;
      }
      if (PLACEHOLDER_FILES.has(entry.name)) {
        continue;
      }

      const filePath = path.join(uploadDirResolved, entry.name);
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtimeMs < cutoff) {
          await fs.unlink(filePath);
          logSuccess('Removed stale upload', { file: filePath });
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          continue;
        }
        logError('Failed to process upload during cleanup', { file: filePath, error });
      }
    }

    logSuccess('Upload cleanup complete', { retentionMs: retentionWindow });
  } catch (error) {
    if (error.code === 'ENOENT') {
      logRequest('Upload directory missing during cleanup', { directory: uploadDirResolved });
      return;
    }
    throw error;
  }
}

if (process.argv[1]) {
  const entryUrl = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryUrl) {
    cleanupUploads().catch((error) => {
      logError('Cleanup failed', error);
      process.exitCode = 1;
    });
  }
}

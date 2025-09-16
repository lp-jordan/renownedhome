import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { logRequest, logSuccess, logError } from './src/utils/logger.js';
import { cleanupUploads } from './scripts/cleanupUploads.js';

const app = express();
app.use(cors());
app.use(express.json());

const CONTENT_DIR = path.join(process.cwd(), 'content');
const UPLOAD_DIR = path.join(process.cwd(), 'public/uploads');
const PLACEHOLDER_PATHS = new Set(['/uploads/placeholder.png']);
await fs.mkdir(CONTENT_DIR, { recursive: true });
logSuccess('Content directory ready', { path: CONTENT_DIR });
await fs.mkdir(UPLOAD_DIR, { recursive: true });
logSuccess('Upload directory ready', { path: UPLOAD_DIR });
cleanupUploads().catch((err) => logError('Initial upload cleanup failed', err));

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
logRequest('Server environment', { PORT, NODE_ENV });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

app.get('/api/pages/:page', async (req, res) => {
  const file = path.join(CONTENT_DIR, `${req.params.page}.json`);
  try {
    const data = await fs.readFile(file, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    logError('Read/write error', err);
    res.status(500).json({ error: 'Unable to read file' });
  }
});

app.post('/api/pages/:page', async (req, res) => {
  const file = path.join(CONTENT_DIR, `${req.params.page}.json`);
  try {
    await fs.writeFile(file, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    logError('Read/write error', err);
    res.status(500).json({ error: 'Unable to write file' });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    logRequest('Uploading', { file: req.file, body: req.body });
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const responsePath = `/uploads/${req.file.filename}`;
    const { oldPath } = req.body ?? {};
    if (typeof oldPath === 'string') {
      const trimmedOldPath = oldPath.trim();
      if (trimmedOldPath) {
        const normalizedOldPath = path.posix.normalize(trimmedOldPath);
        if (
          normalizedOldPath.startsWith('/uploads/') &&
          !PLACEHOLDER_PATHS.has(normalizedOldPath)
        ) {
          const relativeOldPath = normalizedOldPath.replace(/^\/uploads\//, '');
          if (relativeOldPath) {
            const uploadDirResolved = path.resolve(UPLOAD_DIR);
            const oldFilePath = path.resolve(uploadDirResolved, relativeOldPath);
            const relativeToUpload = path.relative(uploadDirResolved, oldFilePath);
            const isInsideUploadDir =
              relativeToUpload &&
              !relativeToUpload.startsWith('..') &&
              !path.isAbsolute(relativeToUpload);
            if (isInsideUploadDir) {
              try {
                await fs.stat(oldFilePath);
                await fs.unlink(oldFilePath);
                logSuccess('Removed previous upload', { file: oldFilePath });
              } catch (unlinkErr) {
                if (unlinkErr.code === 'ENOENT') {
                  logRequest('Old upload not found for removal', { file: oldFilePath });
                } else {
                  logError('Failed to remove old upload', unlinkErr);
                }
              }
            } else {
              logError('Invalid old upload path outside upload directory', {
                provided: oldPath,
                resolved: oldFilePath,
              });
            }
          }
        }
      }
    }

    res.json({ path: responsePath });
  } catch (err) {
    logError('Upload error', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.listen(PORT, () => {
  logSuccess('API server listening', {
    port: PORT,
    contentDir: CONTENT_DIR,
    uploadDir: UPLOAD_DIR,
  });
});

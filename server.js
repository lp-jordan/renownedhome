import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';

const app = express();
app.use(cors());
app.use(express.json());

const CONTENT_DIR = path.join(process.cwd(), 'content');
const UPLOAD_DIR = path.join(process.cwd(), 'public/uploads');
await fs.mkdir(UPLOAD_DIR, { recursive: true });

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
    console.error('Read/write error:', err);
    res.status(500).json({ error: 'Unable to read file' });
  }
});

app.post('/api/pages/:page', async (req, res) => {
  const file = path.join(CONTENT_DIR, `${req.params.page}.json`);
  try {
    await fs.writeFile(file, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Read/write error:', err);
    res.status(500).json({ error: 'Unable to write file' });
  }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    console.log('Uploading:', req.file);
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ path: `/uploads/${req.file.filename}` });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API server listening on ${port}`);
});

import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const CONTENT_DIR = path.join(process.cwd(), 'content');

app.get('/api/pages/:page', async (req, res) => {
  const file = path.join(CONTENT_DIR, `${req.params.page}.json`);
  try {
    const data = await fs.readFile(file, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Unable to read file' });
  }
});

app.post('/api/pages/:page', async (req, res) => {
  const file = path.join(CONTENT_DIR, `${req.params.page}.json`);
  try {
    await fs.writeFile(file, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Unable to write file' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API server listening on ${port}`);
});

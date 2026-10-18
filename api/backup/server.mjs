import 'dotenv/config';
import express from 'express';
import archiver from 'archiver';
import { Readable } from 'node:stream';
import { list } from '@vercel/blob';
import path from 'node:path';

const app = express();

// Serve the HTML frontend
app.use(express.static('public'));

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('Missing BLOB_READ_WRITE_TOKEN');
  process.exit(1);
}

// Optional simple gate — set BACKUP_PASSWORD in env to enable
app.use('/api', (req, res, next) => {
  const expected = process.env.BACKUP_PASSWORD;
  if (!expected) return next();
  const provided = req.query.key || req.headers['x-backup-key'];
  if (provided === expected) return next();
  res.status(401).json({ error: 'unauthorized' });
});

function safeRelative(pathname) {
  const cleaned = pathname.replace(/^\/+/, '');
  const normalized = path.posix.normalize(cleaned);
  if (normalized === '..' || normalized.startsWith('../') || path.isAbsolute(normalized)) {
    throw new Error(`Unsafe pathname: ${pathname}`);
  }
  return normalized;
}

app.get('/api/backup', async (req, res) => {
  const prefix = String(req.query.prefix || 'production/');
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${date}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('warning', (err) => console.warn('archive warning:', err.message));
  archive.on('error', (err) => { console.error('archive error:', err); res.destroy(err); });
  archive.pipe(res);

  let cursor, count = 0;
  try {
    do {
      const page = await list({ cursor, limit: 1000, prefix });
      for (const blob of page.blobs) {
        const rel = safeRelative(blob.pathname);
        const r = await fetch(blob.url);
        if (!r.ok) { console.error(`skip ${rel}: ${r.status}`); continue; }
        // Stream the blob into the archive — no full buffering
        archive.append(Readable.fromWeb(r.body), { name: rel });
        count++;
      }
      cursor = page.cursor;
    } while (cursor);

    await archive.finalize();
    console.log(`✓ streamed ${count} files as ${filename}`);
  } catch (err) {
    console.error(err);
    archive.abort();
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.destroy(err);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`http://localhost:${process.env.PORT || 3000}`);
});

import { list } from '@vercel/blob';
import archiver from 'archiver';
import path from 'node:path';

export const runtime = 'nodejs';
export const maxDuration = 300;

function safeRelative(p: string) {
  const n = path.posix.normalize(p.replace(/^\/+/, ''));
  if (n === '..' || n.startsWith('../') || path.isAbsolute(n)) {
    throw new Error(`Unsafe pathname: ${p}`);
  }
  return n;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get('prefix') || 'production/';

  const expected = process.env.BACKUP_PASSWORD;
  if (expected) {
    const provided =
      searchParams.get('key') || request.headers.get('x-backup-key') || '';
    if (provided !== expected) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const archive = archiver('zip', { zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  archive.on('data', (c: Buffer) => chunks.push(c));

  const finished = new Promise<void>((resolve, reject) => {
    archive.on('end', resolve);
    archive.on('error', reject);
    archive.on('warning', (e) => {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') reject(e);
    });
  });

  try {
    let cursor: string | undefined;
    let count = 0;
    do {
      const page = await list({ cursor, limit: 1000, prefix });
      for (const blob of page.blobs) {
        const rel = safeRelative(blob.pathname);
        const r = await fetch(blob.url, { signal: request.signal });
        if (!r.ok || !r.body) {
          throw new Error(`fetch ${rel} failed: ${r.status} ${r.statusText}`);
        }
        archive.append(Buffer.from(await r.arrayBuffer()), { name: rel });
        count++;
      }
      cursor = page.cursor;
    } while (cursor);

    await archive.finalize();
    await finished;

    const zip = Buffer.concat(chunks);
    console.log(`✓ built ${count} files, ${zip.length} bytes`);

    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return new Response(zip, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="backup-${date}.zip"`,
        'Content-Length': String(zip.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('backup failed:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

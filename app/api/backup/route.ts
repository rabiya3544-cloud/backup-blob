import { list } from '@vercel/blob';
import archiver from 'archiver';
import { Readable } from 'node:stream';
import path from 'node:path';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — Hobby/Fluid ceiling

function safeRelative(pathname: string): string {
  const cleaned = pathname.replace(/^\/+/, '');
  const normalized = path.posix.normalize(cleaned);
  if (
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.isAbsolute(normalized)
  ) {
    throw new Error(`Unsafe pathname: ${pathname}`);
  }
  return normalized;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get('prefix') || 'production/';

  // Optional password gate
  const expectedPassword = process.env.BACKUP_PASSWORD;
  if (expectedPassword) {
    const provided =
      searchParams.get('key') || request.headers.get('x-backup-key') || '';
    if (provided !== expectedPassword) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${date}.zip`;

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('warning', (e) => console.warn('archive warning:', e.message));
  archive.on('error', (e) => console.error('archive error:', e));

  // Stop fetching if the client hangs up
  request.signal.addEventListener('abort', () => {
    console.log('client aborted /api/backup');
    try { archive.abort(); } catch { /* already closed */ }
  });

  // Node stream → Web stream for the Response body
  const body = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;

  // Feed the archive in the background
  (async () => {
    try {
      let cursor: string | undefined;
      let count = 0;
      do {
        const page = await list({ cursor, limit: 1000, prefix });
        for (const blob of page.blobs) {
          const rel = safeRelative(blob.pathname);
          const r = await fetch(blob.url);
          if (!r.ok) {
            console.error(`skip ${rel}: ${r.status} ${r.statusText}`);
            continue;
          }
          archive.append(
            Readable.fromWeb(r.body as any),
            { name: rel }
          );
          count++;
        }
        cursor = page.cursor;
      } while (cursor);

      await archive.finalize();
      console.log(`✓ streamed ${count} files as ${filename}`);
    } catch (err) {
      console.error('backup error:', err);
      try { archive.abort(); } catch { /* already closed */ }
    }
  })();

  return new Response(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({
    hasToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 12) ?? null,
    node: process.version,
  });
}

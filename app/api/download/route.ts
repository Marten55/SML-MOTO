import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

import { isAccessConfigured, isDownloadKind, verifyAccessToken } from '@/lib/access';
import { getAllRoutes } from '@/lib/routes';

/**
 * Chránené stiahnutie. Súbory zámerne NIE SÚ v public/ — čokoľvek tam leží
 * je dostupné bez overenia, takže by sa platený produkt dal stiahnuť zadarmo.
 */
const GPX_DIR = path.join(process.cwd(), 'content', 'gpx');

const CONTENT_TYPES: Record<string, string> = {
  '.gpx': 'application/gpx+xml',
  '.pdf': 'application/pdf',
};

export async function GET(request: Request) {
  if (!isAccessConfigured()) {
    return NextResponse.json({ error: 'downloads_not_configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const kind = searchParams.get('kind');

  if (!token || !kind || !isDownloadKind(kind)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 403 });
  }

  const route = getAllRoutes().find((r) => r.id === payload.routeId);
  if (!route) {
    return NextResponse.json({ error: 'route_not_found' }, { status: 404 });
  }

  const filename = route.assets[kind];
  if (!filename) {
    return NextResponse.json({ error: 'file_not_available' }, { status: 404 });
  }

  // Meno súboru pochádza z našich dát, nie od používateľa, ale radšej sa uistím,
  // že sa nikto nedostane mimo priečinka cez ../
  const resolved = path.resolve(GPX_DIR, filename);
  if (!resolved.startsWith(path.resolve(GPX_DIR) + path.sep)) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 });
  }

  let file: Buffer;
  try {
    file = await readFile(resolved);
  } catch {
    console.error(`[download] chýba súbor ${filename} pre trasu ${route.slug}`);
    return NextResponse.json({ error: 'file_missing' }, { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();

  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(file.byteLength),
      // Platený obsah nemá čo visieť v cache sprostredkovateľov
      'Cache-Control': 'private, no-store',
    },
  });
}

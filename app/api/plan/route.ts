import { NextResponse } from 'next/server';

import { MAX_PLAN_POINTS, planRoute } from '@/lib/routing';

/**
 * Výpočet trasy pre bezplatný plánovač.
 *
 * Existuje preto, aby API kľúč routing služby ostal na serveri. Keby si
 * ho ťahal prehliadač, bol by v zdrojáku stránky a ktokoľvek by ním mohol
 * míňať našu kvótu.
 */

/**
 * Jednoduché obmedzenie počtu dopytov na IP.
 *
 * Drží sa v pamäti procesu, takže sa vynuluje pri reštarte a nefunguje
 * naprieč viacerými inštanciami. Je to vedomý kompromis: pri jednom serveri
 * a bezplatnej vrstve to stačí a nepotrebuje databázu. Ak by web niekedy
 * bežal na viacerých strojoch, treba to presunúť do spoločného úložiska.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }

  recent.push(now);
  hits.set(ip, recent);

  // Aby mapa nerástla donekonečna pri dlhom behu
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }

  return false;
}

function clientIp(request: Request): string {
  // Za reverzným proxy je skutočná IP v hlavičke, nie v spojení
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { points } = (body ?? {}) as { points?: unknown };

  // Vstup je od používateľa, takže sa overuje tvar aj rozsah hodnôt
  if (!Array.isArray(points) || points.length < 2 || points.length > MAX_PLAN_POINTS) {
    return NextResponse.json({ error: 'invalid_points' }, { status: 400 });
  }

  const parsed: [number, number][] = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2) {
      return NextResponse.json({ error: 'invalid_points' }, { status: 400 });
    }
    const [lat, lng] = point as [unknown, unknown];
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return NextResponse.json({ error: 'invalid_points' }, { status: 400 });
    }
    parsed.push([lat, lng]);
  }

  const result = await planRoute(parsed);

  if ('error' in result) {
    const status = result.error === 'not_configured' ? 503 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ route: result.route });
}

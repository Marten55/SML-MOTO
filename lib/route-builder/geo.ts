import type { BBox, TrackPoint } from './types';

/**
 * Geometria nad zemepisnými súradnicami.
 *
 * Zem nie je rovina, takže vzdialenosť sa počíta cez haversine (po povrchu
 * gule). Pri zjednodušovaní trasy si naopak vystačíme s rovinnou aproximáciou
 * okolo každého úseku — na pár kilometroch je chyba zanedbateľná a výpočet
 * je o rád rýchlejší.
 */

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

type LatLng = { lat: number; lng: number };

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function trackDistanceM(track: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < track.length; i++) total += haversineM(track[i - 1], track[i]);
  return total;
}

export function bboxOf(points: LatLng[]): BBox {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, minLng, maxLat, maxLng };
}

/** Ťažisko ako priemer bodov — rovnako ako routeCenter() v lib/routes.ts. */
export function centerOf(points: LatLng[]): LatLng {
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

/**
 * Vzdialenosť bodu od ÚSEČKY a–b v metroch (nie od nekonečnej priamky —
 * bod za koncom úseku by inak vyšiel bližšie, než naozaj je).
 */
function distanceToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  const cosLat = Math.cos(toRad(a.lat));
  const kx = 111_320 * cosLat;
  const ky = 110_540;

  const bx = (b.lng - a.lng) * kx;
  const by = (b.lat - a.lat) * ky;
  const px = (p.lng - a.lng) * kx;
  const py = (p.lat - a.lat) * ky;

  const lenSq = bx * bx + by * by;
  if (lenSq === 0) return Math.hypot(px, py);

  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq));
  return Math.hypot(px - t * bx, py - t * by);
}

/**
 * Ramer–Douglas–Peucker: nechá body, kde trasa mení smer, a zahodí tie,
 * ktoré ležia na rovnej čiare. Presne to potrebujeme pri navigovanej verzii —
 * zákruty musia ostať, rovinky sa môžu zjednodušiť.
 *
 * Písané cez vlastný zásobník, nie rekurziu. Stopa zo Swisstopo môže mať
 * desaťtisíce bodov a rekurzívna verzia by v najhoršom prípade pretiekla
 * zásobník volaní.
 */
export function rdp<T extends LatLng>(points: T[], epsilonM: number): T[] {
  if (points.length <= 2) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let maxIdx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distanceToSegmentM(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxIdx !== -1 && maxDist > epsilonM) {
      keep[maxIdx] = 1;
      stack.push([start, maxIdx], [maxIdx, end]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

/**
 * Zjednoduší trasu na najviac `maxCount` bodov a nechá z nej čo najviac detailu.
 *
 * Tolerancia sa hľadá binárne: čím väčšia tolerancia, tým menej bodov,
 * takže hľadáme najmenšiu, pri ktorej sa zmestíme do limitu.
 * Prvý a posledný bod ostávajú vždy.
 */
export function simplifyToCount<T extends LatLng>(points: T[], maxCount: number): T[] {
  if (maxCount < 2) throw new Error('maxCount musí byť aspoň 2');
  if (points.length <= maxCount) return points.slice();

  let lo = 0;
  let hi = 50_000; // 50 km — väčšiu toleranciu nemá zmysel skúšať
  let best = rdp(points, hi);

  // Aj pri obrovskej tolerancii je bodov priveľa: trasa sa kľukatí tak,
  // že RDP nič nezahodí. Vtedy už len rovnomerne vzorkujeme.
  if (best.length > maxCount) return sampleEvenly(points, maxCount);

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const result = rdp(points, mid);
    if (result.length <= maxCount) {
      best = result;
      hi = mid;
    } else {
      lo = mid;
    }
    if (hi - lo < 0.5) break; // pol metra presnosti na toleranciu stačí
  }
  return best;
}

/** Rovnomerný výber `count` bodov, vrátane prvého a posledného. */
export function sampleEvenly<T>(points: T[], count: number): T[] {
  if (points.length <= count) return points.slice();
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    out.push(points[Math.round((i * (points.length - 1)) / (count - 1))]);
  }
  return out;
}

/** Najmenšia vzdialenosť bodu od stopy. Na kontrolu, či bod záujmu leží pri trase. */
export function distanceToTrackM(p: LatLng, track: LatLng[]): number {
  let min = Infinity;
  for (let i = 1; i < track.length; i++) {
    const d = distanceToSegmentM(p, track[i - 1], track[i]);
    if (d < min) min = d;
  }
  if (track.length === 1) min = haversineM(p, track[0]);
  return min;
}

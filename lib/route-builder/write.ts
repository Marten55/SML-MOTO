import { simplifyToCount } from './geo';
import type { MapsLink, TrackPoint, Waypoint } from './types';

/**
 * Zápis výsledných súborov.
 *
 * Poradie prvkov v GPX nie je náhodné: norma GPX 1.1 predpisuje
 * metadata, potom body, potom trasy, potom stopy. Väčšina aplikácií to
 * odpustí, ale Garmin BaseCamp je prísny a súbor v inom poradí odmietne.
 */

/**
 * Koľko bodov unesie navigovaná verzia. Staršie Garminy majú limit rádovo
 * 50 bodov na trasu — držíme sa ho, aby súbor fungoval aj na nich.
 * Novšie prístroje zvládnu viac, ale pre ne je aj tak lepšia stopa.
 */
export const MAX_NAVIGATION_POINTS = 50;

/**
 * Google Maps unesie v odkaze obmedzený počet zastávok. Úsek má preto
 * štart, cieľ a osem bodov medzi — spolu desať, rovnako ako v lib/routes.ts.
 */
export const MAPS_POINTS_PER_SEGMENT = 10;
/** Jeden úsek na zhruba 80 km — aby jazdec neklikal na desať odkazov denne. */
const KM_PER_MAPS_SEGMENT = 80;
const MAX_MAPS_SEGMENTS = 5;

const CREATOR = 'SML Moto';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Šesť desatinných miest je zhruba 10 cm. Viac je šum, menej by ubralo presnosť.
const coord = (v: number) => v.toFixed(6);
const eleTag = (ele?: number) => (ele === undefined ? '' : `<ele>${ele.toFixed(1)}</ele>`);

function header(name: string, desc?: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="${CREATOR}" xmlns="http://www.topografix.com/GPX/1/1" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n` +
    `  <metadata>\n    <name>${escapeXml(name)}</name>\n` +
    (desc ? `    <desc>${escapeXml(desc)}</desc>\n` : '') +
    `  </metadata>\n`
  );
}

function wptXml(w: Waypoint): string {
  return (
    `  <wpt lat="${coord(w.lat)}" lon="${coord(w.lng)}">${eleTag(w.ele)}` +
    `<name>${escapeXml(w.name)}</name>` +
    (w.desc ? `<desc>${escapeXml(w.desc)}</desc>` : '') +
    `</wpt>\n`
  );
}

/**
 * Hlavný súbor: stopa aj body záujmu v jednom. Toto je ten univerzálny
 * formát, ktorý otvorí Garmin, Kurviger, OsmAnd, Gaia aj Mapy.cz — aj offline.
 */
export function writeMasterGpx(opts: {
  name: string;
  desc?: string;
  track: TrackPoint[];
  waypoints: Waypoint[];
}): string {
  const pts = opts.track
    .map((p) => `      <trkpt lat="${coord(p.lat)}" lon="${coord(p.lng)}">${eleTag(p.ele)}</trkpt>`)
    .join('\n');

  return (
    header(opts.name, opts.desc) +
    opts.waypoints.map(wptXml).join('') +
    `  <trk>\n    <name>${escapeXml(opts.name)}</name>\n    <trkseg>\n${pts}\n    </trkseg>\n  </trk>\n` +
    `</gpx>\n`
  );
}

/**
 * Verzia na navigovanie: tá istá cesta z tvarovacích bodov. Body sa vyberajú
 * tak, aby ostali zákruty (Ramer–Douglas–Peucker), nie rovnomerne — inak by
 * prístroj medzi nimi ustrihol presne tie pekné úseky.
 */
export function writeNavigationGpx(opts: { name: string; track: TrackPoint[] }): string {
  const shaping = simplifyToCount(opts.track, MAX_NAVIGATION_POINTS);
  const pts = shaping
    .map(
      (p, i) =>
        `    <rtept lat="${coord(p.lat)}" lon="${coord(p.lng)}">${eleTag(p.ele)}` +
        `<name>${escapeXml(opts.name)} ${i + 1}</name></rtept>`,
    )
    .join('\n');

  return header(opts.name) + `  <rte>\n    <name>${escapeXml(opts.name)}</name>\n${pts}\n  </rte>\n</gpx>\n`;
}

/** Len body záujmu — dajú sa zapnúť a vypnúť nezávisle od trasy. */
export function writePoiGpx(opts: { name: string; waypoints: Waypoint[] }): string | null {
  if (opts.waypoints.length === 0) return null;
  return header(opts.name) + opts.waypoints.map(wptXml).join('') + `</gpx>\n`;
}

function mapsUrl(points: TrackPoint[]): string {
  const fmt = (p: TrackPoint) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  const params = new URLSearchParams({
    api: '1',
    origin: fmt(points[0]),
    destination: fmt(points[points.length - 1]),
    travelmode: 'driving',
  });
  const via = points.slice(1, -1);
  if (via.length > 0) params.set('waypoints', via.map(fmt).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Odkazy do Google Maps rozdelené po úsekoch. Susedné úseky zdieľajú bod —
 * cieľ jedného je štartom ďalšieho, aby na prechode nevznikla diera.
 *
 * Pozor, Google si medzi bodmi počíta cestu sám, takže sa od stopy môže
 * odchýliť. Preto sú odkazy doplnok pre nenáročných, hlavným produktom
 * zostáva GPX so stopou.
 */
export function buildMapsLinks(track: TrackPoint[], distanceKm: number): MapsLink[] {
  if (track.length < 2) return [];

  const wanted = Math.min(
    MAX_MAPS_SEGMENTS,
    Math.max(1, Math.ceil(distanceKm / KM_PER_MAPS_SEGMENT)),
  );
  const step = MAPS_POINTS_PER_SEGMENT - 1; // zdieľaný bod sa neráta dvakrát
  const points = simplifyToCount(track, wanted * step + 1);
  const segments = Math.max(1, Math.ceil((points.length - 1) / step));

  const links: MapsLink[] = [];
  for (let s = 0; s < segments; s++) {
    const chunk = points.slice(s * step, s * step + MAPS_POINTS_PER_SEGMENT);
    if (chunk.length < 2) break;
    links.push({
      label: segments === 1 ? 'Celá trasa' : `Úsek ${s + 1} z ${segments}`,
      url: mapsUrl(chunk),
      points: chunk.length,
    });
  }
  return links;
}

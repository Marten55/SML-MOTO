import { XMLParser, XMLValidator } from 'fast-xml-parser';

import { bboxOf, haversineM, trackDistanceM } from './geo';
import { detectSwissGrid, swissToWgs84 } from './swiss-coords';
import type {
  FileFormat,
  InputFile,
  ParsedFile,
  SourceKind,
  SwissGrid,
  TrackPoint,
  Waypoint,
} from './types';

/**
 * Rozbor súborov zo Swisstopo a iných nástrojov.
 *
 * XML sa zámerne nečíta regulárnymi výrazmi. GPX z rôznych programov dáva
 * atribúty v rôznom poradí, používa predpony menných priestorov (`gpx:trkpt`),
 * CDATA v názvoch a podobne — regex na tom skôr či neskôr ticho zlyhá.
 */

/** Vstup je od používateľa. Priveľký súbor odmietneme skôr, než ho začneme čítať. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

type XmlNode = Record<string, unknown>;

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // `gpx:trkpt` aj `trkpt` sa majú čítať rovnako
  removeNSPrefix: true,
  // Hodnoty nechávame ako text a čísla prevádzame sami. Inak by sa
  // napríklad <name>123</name> zmenilo na číslo 123 a nie text „123".
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  // Tieto značky môžu byť raz aj viackrát. Bez tohto by jeden bod prišiel
  // ako objekt a dva body ako pole — klasická pasca tohto parsera.
  isArray: (tagName) =>
    [
      'trk', 'trkseg', 'trkpt', 'rte', 'rtept', 'wpt',
      'Placemark', 'Folder', 'Document', 'LineString', 'Point', 'MultiGeometry',
    ].includes(tagName),
});

/**
 * Parser sám od seba neoveruje, či je XML celé — z useknutého súboru
 * by ticho vrátil polovicu trasy. Preto najprv validácia, až potom rozbor.
 */
function parseXml(content: string): XmlNode {
  const valid = XMLValidator.validate(content);
  if (valid !== true) {
    throw new Error(`poškodené XML na riadku ${valid.err.line}: ${valid.err.msg}`);
  }
  return xml.parse(content) as XmlNode;
}

function asArray(v: unknown): XmlNode[] {
  if (Array.isArray(v)) return v as XmlNode[];
  if (v == null) return [];
  return [v as XmlNode];
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : undefined;
}

function text(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && '#text' in v) return text((v as XmlNode)['#text']);
  return undefined;
}

function pointFrom(node: XmlNode): TrackPoint | null {
  const lat = num(node['@_lat']);
  const lng = num(node['@_lon']);
  if (lat === undefined || lng === undefined) return null;
  const ele = num(node.ele);
  return ele === undefined ? { lat, lng } : { lat, lng, ele };
}

// ---------------------------------------------------------------------------
// GPX
// ---------------------------------------------------------------------------

export function parseGpx(content: string): Omit<ParsedFile, 'fileName' | 'format'> {
  const root = parseXml(content);
  if (root.gpx === undefined) throw new Error('Súbor nemá koreň <gpx> — nie je to GPX.');
  // Prázdne <gpx></gpx> príde ako prázdny text, nie objekt
  const gpx = typeof root.gpx === 'object' && root.gpx !== null ? (root.gpx as XmlNode) : {};

  const kinds = new Set<SourceKind>();

  // Stopa: všetky segmenty všetkých stôp v poradí, ako idú v súbore.
  // Viac segmentov vzniká napríklad keď sa nahrávanie prerušilo.
  const track: TrackPoint[] = [];
  for (const trk of asArray(gpx.trk)) {
    for (const seg of asArray(trk.trkseg)) {
      for (const pt of asArray(seg.trkpt)) {
        const p = pointFrom(pt);
        if (p) track.push(p);
      }
    }
  }
  if (track.length > 0) kinds.add('trk');

  // Trasa na prepočítanie. Použije sa ako stopa len vtedy, keď stopa chýba.
  const routePoints: TrackPoint[] = [];
  for (const rte of asArray(gpx.rte)) {
    for (const pt of asArray(rte.rtept)) {
      const p = pointFrom(pt);
      if (p) routePoints.push(p);
    }
  }
  if (routePoints.length > 0) kinds.add('rte');

  const waypoints: Waypoint[] = [];
  for (const w of asArray(gpx.wpt)) {
    const p = pointFrom(w);
    if (!p) continue;
    waypoints.push({
      ...p,
      name: text(w.name) ?? `Bod ${waypoints.length + 1}`,
      ...(text(w.desc) ? { desc: text(w.desc) } : {}),
    });
  }
  if (waypoints.length > 0) kinds.add('wpt');

  return {
    track: track.length > 0 ? track : routePoints,
    waypoints,
    kinds: [...kinds],
  };
}

// ---------------------------------------------------------------------------
// KML
// ---------------------------------------------------------------------------

/**
 * POZOR: KML píše súradnice v poradí dĺžka, šírka, výška — teda opačne,
 * než ako sa bežne čítajú. „8.41,46.57" je Furka, nie bod v Afrike.
 */
function parseKmlCoordinates(raw: unknown): TrackPoint[] {
  const s = text(raw);
  if (!s) return [];
  const out: TrackPoint[] = [];
  for (const tuple of s.split(/\s+/)) {
    const [lngS, latS, eleS] = tuple.split(',');
    const lng = num(lngS);
    const lat = num(latS);
    if (lat === undefined || lng === undefined) continue;
    const ele = num(eleS);
    out.push(ele === undefined ? { lat, lng } : { lat, lng, ele });
  }
  return out;
}

/** Placemarky môžu byť vnorené v priečinkoch ľubovoľne hlboko — pozbierame všetky. */
function collectPlacemarks(node: unknown, out: XmlNode[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectPlacemarks(item, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node as XmlNode)) {
    if (key === 'Placemark') out.push(...asArray(value));
    else collectPlacemarks(value, out);
  }
}

export function parseKml(content: string): Omit<ParsedFile, 'fileName' | 'format'> {
  const root = parseXml(content);
  if (root.kml === undefined) throw new Error('Súbor nemá koreň <kml> — nie je to KML.');

  const placemarks: XmlNode[] = [];
  collectPlacemarks(root.kml, placemarks);

  const kinds = new Set<SourceKind>();
  const track: TrackPoint[] = [];
  const waypoints: Waypoint[] = [];

  for (const pm of placemarks) {
    // Geometria priamo v Placemarku alebo zabalená v MultiGeometry
    const geometries = [pm, ...asArray(pm.MultiGeometry)];
    const name = text(pm.name);

    for (const g of geometries) {
      for (const line of asArray(g.LineString)) {
        const pts = parseKmlCoordinates(line.coordinates);
        if (pts.length > 0) {
          // Cyklus namiesto push(...pts): rozbalenie státisícov bodov
          // do argumentov funkcie padá na limite zásobníka
          for (const p of pts) track.push(p);
          kinds.add('trk');
        }
      }
      for (const point of asArray(g.Point)) {
        const [p] = parseKmlCoordinates(point.coordinates);
        if (p) {
          waypoints.push({ ...p, name: name ?? `Bod ${waypoints.length + 1}` });
          kinds.add('wpt');
        }
      }
    }
  }

  return { track, waypoints, kinds: [...kinds] };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Stĺpce sa hľadajú podľa názvu v hlavičke, lebo rôzne nástroje ich volajú
 * rôzne — a Swisstopo po nemecky. Porovnáva sa bez veľkosti písmen a diakritiky.
 */
const COLUMN_ALIASES = {
  lat: ['lat', 'latitude', 'breite', 'breitengrad', 'sirka'],
  lng: ['lon', 'lng', 'long', 'longitude', 'lange', 'langengrad', 'dlzka'],
  e: ['e', 'easting', 'east', 'x', 'rechtswert', 'ost', 'e (lv95)', 'e_lv95'],
  n: ['n', 'northing', 'north', 'y', 'hochwert', 'nord', 'n (lv95)', 'n_lv95'],
  ele: ['ele', 'elevation', 'alt', 'altitude', 'hohe', 'height', 'z', 'vyska'],
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // po NFD sú mäkčene samostatné znaky: höhe -> hohe
    .replace(/^["']|["']$/g, '')
    .replace(/\[.*?\]/g, '') // „Höhe [m]" -> „hohe"
    .trim();
}

function findColumn(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.includes(h));
}

/**
 * Európske CSV často oddeľuje stĺpce bodkočiarkou, lebo čiarka je
 * desatinná — „46,95;8,07". Oddeľovač preto odhadneme z obsahu.
 */
function detectDelimiter(line: string): string {
  const counts = [';', '\t', ','].map((d) => ({ d, n: line.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ',';
}

/**
 * Desatinnú čiarku neodvodzujeme od oddeľovača stĺpcov. Nemecký export
 * s bodkočiarkou pokojne píše „46.57;8.41" s bodkou — keby sme bodku brali
 * ako oddeľovač tisícov, z 46.57 by bolo 4657 a trasa by skončila v Antarktíde.
 */
function csvNumber(raw: string | undefined, delimiter: string): number | undefined {
  if (raw == null) return undefined;
  // Medzera a apostrof sú oddeľovače tisícov (švajčiarsky zápis 2'600'000)
  let s = raw.trim().replace(/^["']|["']$/g, '').replace(/[\s']/g, '');
  if (delimiter !== ',' && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.'); // 2.600.000,5 -> 2600000.5
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, ''); // 2.600.000 -> 2600000
  }
  return num(s);
}

export function parseCsv(content: string): Omit<ParsedFile, 'fileName' | 'format'> {
  const lines = content
    .replace(/^\uFEFF/, '') // BOM, ktorý pridáva Excel
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('Súbor CSV je prázdny.');

  const delimiter = detectDelimiter(lines[0]);
  const rows = lines.map((l) => l.split(delimiter));

  // Má súbor hlavičku? Ak prvý riadok neobsahuje žiadne číslo, je to hlavička.
  const firstIsHeader = rows[0].every((c) => csvNumber(c, delimiter) === undefined);
  const headers = firstIsHeader ? rows[0].map(normalizeHeader) : [];
  const data = firstIsHeader ? rows.slice(1) : rows;

  const col = {
    lat: findColumn(headers, COLUMN_ALIASES.lat),
    lng: findColumn(headers, COLUMN_ALIASES.lng),
    e: findColumn(headers, COLUMN_ALIASES.e),
    n: findColumn(headers, COLUMN_ALIASES.n),
    ele: findColumn(headers, COLUMN_ALIASES.ele),
  };

  let swissGrid: SwissGrid | undefined;
  const track: TrackPoint[] = [];

  for (const row of data) {
    const ele = col.ele >= 0 ? csvNumber(row[col.ele], delimiter) : undefined;
    let point: { lat: number; lng: number } | null = null;

    if (col.lat >= 0 && col.lng >= 0) {
      const lat = csvNumber(row[col.lat], delimiter);
      const lng = csvNumber(row[col.lng], delimiter);
      if (lat !== undefined && lng !== undefined) point = { lat, lng };
    } else {
      // Bez stĺpcov so šírkou a dĺžkou rozhoduje veľkosť čísel. Poradie E/N
      // netreba riešiť — Švajčiari ho navyše volajú opačne než matematika
      // (Y je východ, X je sever) a detectSwissGrid to rozozná sám.
      const a = col.e >= 0 ? csvNumber(row[col.e], delimiter) : undefined;
      const b = col.n >= 0 ? csvNumber(row[col.n], delimiter) : undefined;
      const nums =
        a !== undefined && b !== undefined
          ? [a, b]
          : row.map((c) => csvNumber(c, delimiter)).filter((v): v is number => v !== undefined);

      // Švajčiarsku dvojicu hľadáme v celom riadku — export môže mať pred
      // súradnicami poradové číslo alebo vzdialenosť od štartu
      for (let i = 0; i + 1 < nums.length && !point; i++) {
        const swiss = detectSwissGrid(nums[i], nums[i + 1]);
        if (swiss) {
          swissGrid = swiss.grid;
          point = swissToWgs84(swiss.e, swiss.n, swiss.grid);
        }
      }
      if (!point && nums.length >= 2 && Math.abs(nums[0]) <= 90 && Math.abs(nums[1]) <= 180) {
        point = { lat: nums[0], lng: nums[1] };
      }
    }

    if (point) track.push(ele === undefined ? point : { ...point, ele });
  }

  return {
    track,
    waypoints: [],
    kinds: track.length > 0 ? ['trk'] : [],
    ...(swissGrid ? { swissGrid } : {}),
  };
}

// ---------------------------------------------------------------------------
// Rozpoznanie formátu a zlúčenie
// ---------------------------------------------------------------------------

export function detectFormat(file: InputFile): FileFormat {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'gpx' || ext === 'kml' || ext === 'csv') return ext;
  // Bez prípony sa pozrieme dovnútra
  const head = file.content.slice(0, 2000).toLowerCase();
  if (head.includes('<gpx')) return 'gpx';
  if (head.includes('<kml')) return 'kml';
  return 'csv';
}

export function parseFile(file: InputFile): ParsedFile {
  if (file.content.length > MAX_FILE_BYTES) {
    throw new Error(`Súbor ${file.name} je väčší ako ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }
  const format = detectFormat(file);
  const parsed =
    format === 'gpx' ? parseGpx(file.content) : format === 'kml' ? parseKml(file.content) : parseCsv(file.content);
  return { fileName: file.name, format, ...parsed };
}

const SAME_ENDPOINT_M = 200;
const SAME_BBOX_M = 1000;
const SAME_LENGTH_RATIO = 0.2;
const SAME_WAYPOINT_M = 25;
/** Koniec jednej časti a začiatok ďalšej v tom istom bode — netreba ho dvakrát. */
const JOIN_POINT_M = 1;

/**
 * Je to tá istá trasa, len v inom súbore? Typicky GPX aj KML z jedného
 * exportu, alebo stopa a jej navigovaná verzia.
 *
 * Nestačí rovnaký štart a cieľ — dva rôzne okruhy z toho istého hotela ich
 * majú tiež. Líšia sa ale tým, kam až siahajú, a dĺžkou.
 */
export function isSameTrack(a: TrackPoint[], b: TrackPoint[]): boolean {
  if (a.length < 2 || b.length < 2) return false;
  if (haversineM(a[0], b[0]) > SAME_ENDPOINT_M) return false;
  if (haversineM(a[a.length - 1], b[b.length - 1]) > SAME_ENDPOINT_M) return false;

  const ba = bboxOf(a);
  const bb = bboxOf(b);
  const corner = (lat: number, lng: number) => ({ lat, lng });
  if (haversineM(corner(ba.minLat, ba.minLng), corner(bb.minLat, bb.minLng)) > SAME_BBOX_M) return false;
  if (haversineM(corner(ba.maxLat, ba.maxLng), corner(bb.maxLat, bb.maxLng)) > SAME_BBOX_M) return false;

  const la = trackDistanceM(a);
  const lb = trackDistanceM(b);
  return Math.abs(la - lb) <= SAME_LENGTH_RATIO * Math.max(la, lb);
}

/**
 * Z dvoch kópií tej istej trasy nechá lepšiu: stopu pred trasou na
 * prepočítanie, potom tú s výškami, potom tú s viac bodmi.
 * Pri úplnej zhode vyhráva skôr nahratý súbor.
 */
function betterCopy(a: ParsedFile, b: ParsedFile): ParsedFile {
  const score = (f: ParsedFile) => [
    f.kinds.includes('trk') ? 1 : 0,
    f.track.some((p) => p.ele !== undefined) ? 1 : 0,
    f.track.length,
  ];
  const sa = score(a);
  const sb = score(b);
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] > sa[i] ? b : a;
  return a;
}

export interface DuplicateTrack {
  fileName: string;
  keptFileName: string;
}

/**
 * Zlúči viac súborov do jednej trasy — presne ten krok, ktorý Miroslav
 * dnes robí ručne v gpx.studio. Rôzne časti trasy idú za sebou v poradí
 * nahratia. Tá istá trasa vo viacerých formátoch sa použije len raz —
 * inak by sa po nahratí GPX aj KML z jedného exportu zdvojnásobila.
 */
export function mergeParsed(files: ParsedFile[]): {
  track: TrackPoint[];
  waypoints: Waypoint[];
  kinds: SourceKind[];
  swissGrid?: SwissGrid;
  duplicates: DuplicateTrack[];
} {
  const parts: ParsedFile[] = [];
  const dropped: { fileName: string; partIndex: number }[] = [];

  for (const f of files) {
    if (f.track.length === 0) continue;
    const twin = parts.findIndex((p) => isSameTrack(p.track, f.track));
    if (twin === -1) {
      parts.push(f);
      continue;
    }
    const kept = betterCopy(parts[twin], f);
    dropped.push({ fileName: (kept === f ? parts[twin] : f).fileName, partIndex: twin });
    parts[twin] = kept;
  }

  const track: TrackPoint[] = [];
  for (const part of parts) {
    const last = track[track.length - 1];
    const start = last && haversineM(last, part.track[0]) < JOIN_POINT_M ? 1 : 0;
    for (let i = start; i < part.track.length; i++) track.push(part.track[i]);
  }

  // Ten istý bod v dvoch súboroch: rovnaké meno a pár metrov od seba.
  // Porovnanie zaokrúhlených súradníc by zlyhalo, lebo GPX a KML
  // z toho istého exportu nemusia mať rovnaký počet desatinných miest.
  const waypoints: Waypoint[] = [];
  for (const f of files) {
    for (const w of f.waypoints) {
      const existing = waypoints.find((x) => x.name === w.name && haversineM(x, w) < SAME_WAYPOINT_M);
      if (!existing) {
        waypoints.push({ ...w });
        continue;
      }
      // KML často nemá popis alebo výšku, ktorú má GPX — doplníme, čo chýba
      existing.desc ??= w.desc;
      existing.ele ??= w.ele;
    }
  }

  const kinds = new Set<SourceKind>();
  for (const part of parts) for (const k of part.kinds) if (k !== 'wpt') kinds.add(k);
  if (waypoints.length > 0) kinds.add('wpt');

  const swissGrid = parts.find((p) => p.swissGrid)?.swissGrid;

  return {
    track,
    waypoints,
    kinds: [...kinds],
    ...(swissGrid ? { swissGrid } : {}),
    // Meno ponechaného súboru sa dopĺňa až na konci: tretia kópia mohla
    // medzitým vytlačiť tú, ktorá vyhrala ako prvá
    duplicates: dropped.map((d) => ({ fileName: d.fileName, keptFileName: parts[d.partIndex].fileName })),
  };
}

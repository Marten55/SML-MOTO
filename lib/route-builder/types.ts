/**
 * Spoločný model, do ktorého sa zlejú všetky formáty — GPX, KML aj CSV.
 *
 * Celé jadro zámerne nepoužíva `server-only` ani alias `@/`. Nemá žiadne
 * tajomstvá, len spracúva súbory, a vďaka tomu sa dá testovať samostatne,
 * mimo Next.js. Na serveri ho bude volať až API pre administráciu.
 */

export interface TrackPoint {
  lat: number;
  lng: number;
  /** Nadmorská výška v metroch, ak ju súbor obsahuje. */
  ele?: number;
}

export interface Waypoint {
  lat: number;
  lng: number;
  name: string;
  desc?: string;
  ele?: number;
}

/**
 * Čo súbor naozaj obsahoval. Toto je jadro celej kontroly:
 *   trk — stopa, presná čiara bod po bode. Toto sa predáva.
 *   rte — trasa, ktorú si prístroj prepočíta. Použiteľná, ale nie ideálna.
 *   wpt — len body. Navigácia ich nevie spojiť.
 */
export type SourceKind = 'trk' | 'rte' | 'wpt';

export type FileFormat = 'gpx' | 'kml' | 'csv';

export type SwissGrid = 'LV95' | 'LV03';

export interface InputFile {
  name: string;
  content: string;
}

export interface ParsedFile {
  fileName: string;
  format: FileFormat;
  track: TrackPoint[];
  waypoints: Waypoint[];
  kinds: SourceKind[];
  /** Vyplnené, ak boli súradnice vo švajčiarskej sieti a prepočítali sa. */
  swissGrid?: SwissGrid;
}

export interface BBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface RouteStats {
  pointCount: number;
  distanceKm: number;
  /** null, keď súbor nemá výšky — radšej „nevieme" než falošná nula. */
  ascentM: number | null;
  descentM: number | null;
  minEleM: number | null;
  maxEleM: number | null;
  meanSpacingM: number;
  maxGapM: number;
  bbox: BBox;
  center: { lat: number; lng: number };
}

export type IssueLevel = 'error' | 'warning' | 'info';

export interface Issue {
  level: IssueLevel;
  /** Stabilný kód pre program; `message` je pre človeka. */
  code: string;
  message: string;
}

export interface MapsLink {
  label: string;
  url: string;
  points: number;
}

export interface RoutePackage {
  /** false, keď je aspoň jedna chyba — taký balíček sa nesmie zverejniť. */
  ok: boolean;
  track: TrackPoint[];
  waypoints: Waypoint[];
  stats: RouteStats | null;
  issues: Issue[];
  files: {
    master: string;
    navigation: string;
    poi: string | null;
  } | null;
  mapsLinks: MapsLink[];
}

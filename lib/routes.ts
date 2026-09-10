import routesData from '@/data/routes.json';
import type { Locale } from './i18n';

export type Tier = 'silver' | 'gold';
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Každý text, ktorý číta jazdec, existuje vo všetkých štyroch jazykoch. */
export type LocalizedText = Record<Locale, string>;

export interface GeoPoint {
  lat: number;
  lng: number;
  /** Názov je len pre nás a pre odkaz do máp, neprekladá sa. */
  name: string;
}

export interface RouteAssets {
  /** Presná stopa. Prístroj ju nepočíta, len kreslí. */
  track: string;
  /** Tá istá cesta z tvarovacích bodov — z nej vzniká hlasová navigácia. */
  navigation: string;
  /** Čerpačky, obedy, vyhliadky. */
  poi?: string;
  /** Len Gold. */
  roadbook?: string;
  /**
   * Verejná ukážka na pár sekúnd bez zvuku, cesta v public/ (napr. /pov/furka.mp4).
   * NIE plné POV video z Gold — to je platený obsah a ide cez /api/download.
   */
  previewVideo?: string;
  /** Prvý záber ukážky. Zobrazí sa, kým sa video nespustí. */
  poster?: string;
}

export interface Route {
  id: string;
  slug: string;
  tier: Tier;
  priceChf: number;
  /** Kraj alebo kantón. Vlastné meno, neprekladá sa. */
  region: string;
  /** ISO kód krajiny — podľa neho sa zoskupuje katalóg. */
  country: 'CH' | 'IT' | 'FR' | 'RO' | 'NO';
  distanceKm: number;
  ascentM: number;
  /** Koľko to reálne zaberie aj so zastávkami, napr. „7–9". */
  durationHours: string;
  /** Priemerná teplota na vrchole v sezóne. Rozhoduje o výbave. */
  avgTempC: number;
  /**
   * Či je priesmyk práve otvorený. Na starom webe to bolo „Prejazdná /
   * Neprejazdná" a je to jedna z mála vecí, ktorá jazdcovi ušetrí zbytočnú
   * cestu — preto to prežíva aj sem.
   */
  passable: boolean;
  difficulty: Difficulty;
  /** 1 = pohodová kochačka, 5 = samá zákruta. Prevzaté od Calimota. */
  curviness: 1 | 2 | 3 | 4 | 5;
  /** Mesiace, kedy býva priesmyk otvorený. */
  seasonFrom: number;
  seasonTo: number;
  start: GeoPoint;
  finish: GeoPoint;
  /**
   * Body, cez ktoré trasa vedie. Google Maps unesie v odkaze len obmedzený
   * počet zastávok, preto sem patria tie kľúčové, nie celá stopa.
   */
  via: GeoPoint[];
  /** Bod, pre ktorý sa ťahá počasie. */
  weatherPoint: GeoPoint;
  title: LocalizedText;
  summary: LocalizedText;
  highlights: LocalizedText[];
  /** Čo si obliecť. Prevzaté zo starého webu — jazdci si to tam všímali. */
  gear: LocalizedText;
  assets: RouteAssets;
  /**
   * Ukážkový obsah, kým nedorazia skutočné podklady. V rozhraní sa označuje,
   * aby sa nikdy nevydával za reálnu prejazdenú trasu.
   */
  isExample?: boolean;
}

const routes = routesData as unknown as Route[];

export function getAllRoutes(): Route[] {
  return routes;
}

export function getRouteBySlug(slug: string): Route | undefined {
  return routes.find((r) => r.slug === slug);
}

/**
 * Odkaz do Google Maps so zastávkami. Toto dostane Bronze zadarmo a Silver
 * aj Gold ako doplnok k GPX — generuje sa z tých istých dát, takže nestojí nič.
 *
 * Google zvláda v URL len obmedzený počet zastávok, preto sa zoznam oreže.
 * Radšej menej bodov a funkčný odkaz než dlhý odkaz, ktorý sa zlomí.
 */
const MAX_WAYPOINTS = 8;

export function googleMapsUrl(route: Route): string {
  const coord = (p: GeoPoint) => `${p.lat},${p.lng}`;

  const via = route.via.slice(0, MAX_WAYPOINTS);

  const params = new URLSearchParams({
    api: '1',
    origin: coord(route.start),
    destination: coord(route.finish),
    travelmode: 'driving',
  });

  if (via.length > 0) {
    params.set('waypoints', via.map(coord).join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Trasa je v predaji len vtedy, ak má obe podoby GPX. */
export function isSellable(route: Route): boolean {
  return Boolean(route.assets.track && route.assets.navigation);
}

/**
 * Ťažisko trasy. Na mape sa marker umiestňuje sem, nie na štart — označuje,
 * kde trasa je, a nezlepí sa s inou, ktorá vychádza z toho istého mesta.
 * (Bernina aj Julier štartujú z Churu a markery si navzájom blokovali klik.)
 */
export function routeCenter(route: Route): [number, number] {
  const points = [route.start, ...route.via, route.finish];
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  return [lat, lng];
}

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
  previewVideo?: string;
  poster?: string;
}

export interface Route {
  id: string;
  slug: string;
  tier: Tier;
  priceChf: number;
  canton: string;
  distanceKm: number;
  ascentM: number;
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

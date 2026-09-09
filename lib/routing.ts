import 'server-only';

/**
 * Výpočet trasy pre bezplatný plánovač (vrstva Bronze).
 *
 * POZOR na poradie súradníc: GeoJSON aj obe tieto služby používajú
 * [longitude, latitude] — teda opačne, než ako sa súradnice bežne píšu
 * a než ako ich má Leaflet. Je to najčastejšia chyba pri práci s mapami:
 * kód prejde, nespadne, len trasa skončí niekde v mori pri Afrike.
 * V tomto súbore sa preto prevod robí na jednom mieste a nikde inde.
 */

export interface PlannedRoute {
  /** Body trasy v poradí [lat, lng] — pripravené pre Leaflet. */
  path: [number, number][];
  distanceKm: number;
  durationMin: number;
  /** Ktorá služba to spočítala. Ide do rozhrania, nech je to priznané. */
  provider: 'openrouteservice' | 'osrm-demo';
}

export type RoutingError =
  | 'not_configured'
  | 'too_few_points'
  | 'no_route'
  | 'upstream_failed';

/** Google Maps unesie v odkaze obmedzený počet zastávok — viac nemá zmysel zbierať. */
export const MAX_PLAN_POINTS = 8;

export function isRoutingConfigured(): boolean {
  return Boolean(process.env.OPENROUTESERVICE_KEY);
}

/**
 * Bez kľúča sa použije verejný demo server OSRM. Ten je podľa podmienok
 * určený VÝHRADNE na vývoj a testovanie — na ostrom webe sa použiť nesmie.
 * Preto sa v produkcii bez kľúča radšej vráti chyba, než aby sme ticho
 * jazdili na cudzom demo serveri.
 */
function devFallbackAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export async function planRoute(
  points: [number, number][],
): Promise<{ route: PlannedRoute } | { error: RoutingError }> {
  if (points.length < 2) return { error: 'too_few_points' };

  const trimmed = points.slice(0, MAX_PLAN_POINTS);

  if (isRoutingConfigured()) {
    return planWithOpenRouteService(trimmed);
  }

  if (devFallbackAllowed()) {
    console.warn(
      '[routing] OPENROUTESERVICE_KEY nie je nastavený — používam demo server OSRM. ' +
        'Na ostrom webe to nesmie zostať.',
    );
    return planWithOsrmDemo(trimmed);
  }

  return { error: 'not_configured' };
}

/** Hlavná cesta. Vyhýba sa diaľniciam a mýtu, čo je pri motorke zmysel celej veci. */
async function planWithOpenRouteService(
  points: [number, number][],
): Promise<{ route: PlannedRoute } | { error: RoutingError }> {
  try {
    const res = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: {
          Authorization: process.env.OPENROUTESERVICE_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Tu sa prevracia [lat, lng] na [lng, lat]
          coordinates: points.map(([lat, lng]) => [lng, lat]),
          options: { avoid_features: ['highways', 'tollways'] },
        }),
        signal: AbortSignal.timeout(12000),
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      console.error(`[routing] OpenRouteService vrátil ${res.status}`);
      return { error: 'upstream_failed' };
    }

    const data = (await res.json()) as {
      features?: {
        geometry?: { coordinates?: [number, number][] };
        properties?: { summary?: { distance?: number; duration?: number } };
      }[];
    };

    const feature = data.features?.[0];
    const coords = feature?.geometry?.coordinates;
    if (!coords?.length) return { error: 'no_route' };

    const summary = feature?.properties?.summary;

    return {
      route: {
        // A tu späť na [lat, lng] pre Leaflet
        path: coords.map(([lng, lat]) => [lat, lng] as [number, number]),
        distanceKm: Math.round((summary?.distance ?? 0) / 1000),
        durationMin: Math.round((summary?.duration ?? 0) / 60),
        provider: 'openrouteservice',
      },
    };
  } catch (error) {
    console.error('[routing] OpenRouteService zlyhal', error);
    return { error: 'upstream_failed' };
  }
}

/** Len pre vývoj — pozri poznámku pri devFallbackAllowed(). */
async function planWithOsrmDemo(
  points: [number, number][],
): Promise<{ route: PlannedRoute } | { error: RoutingError }> {
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(';');

  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(12000), cache: 'no-store' },
    );

    if (!res.ok) return { error: 'upstream_failed' };

    const data = (await res.json()) as {
      routes?: {
        geometry?: { coordinates?: [number, number][] };
        distance?: number;
        duration?: number;
      }[];
    };

    const route = data.routes?.[0];
    const line = route?.geometry?.coordinates;
    if (!line?.length) return { error: 'no_route' };

    return {
      route: {
        path: line.map(([lng, lat]) => [lat, lng] as [number, number]),
        distanceKm: Math.round((route?.distance ?? 0) / 1000),
        durationMin: Math.round((route?.duration ?? 0) / 60),
        provider: 'osrm-demo',
      },
    };
  } catch (error) {
    console.error('[routing] OSRM demo zlyhal', error);
    return { error: 'upstream_failed' };
  }
}

/**
 * Odkaz do Google Maps z naplánovanej trasy. Berie kliknuté body,
 * nie vypočítanú líniu — tá má tisíce bodov a do URL sa nezmestí.
 */
export function planToGoogleMapsUrl(points: [number, number][]): string {
  const fmt = ([lat, lng]: [number, number]) => `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const list = points.slice(0, MAX_PLAN_POINTS);

  const params = new URLSearchParams({
    api: '1',
    origin: fmt(list[0]),
    destination: fmt(list[list.length - 1]),
    travelmode: 'driving',
  });

  const via = list.slice(1, -1);
  if (via.length > 0) params.set('waypoints', via.map(fmt).join('|'));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

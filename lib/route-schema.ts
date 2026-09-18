import { z } from 'zod';

import type { Route } from './routes';

/**
 * Tvar trasy, ako ho aplikácia očakáva. Stráži dáta na hraniciach, kde
 * TypeScript nepomôže, lebo prichádzajú zvonku:
 *
 * - pri čítaní z databázy — jsonb stĺpce databáza sama nekontroluje,
 * - pri ukladaní z administrácie (krok B) — formulár sa dá podvrhnúť.
 *
 * Zámerne bez 'server-only' a bez aliasu @/: tú istú schému použije formulár
 * v prehliadači, testy aj skript scripts/seed-routes.ts.
 */

const localized = z.object({
  en: z.string(),
  de: z.string(),
  fr: z.string(),
  sk: z.string(),
});

const geoPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string(),
});

const assets = z.object({
  track: z.string().min(1),
  navigation: z.string().min(1),
  poi: z.string().optional(),
  roadbook: z.string().optional(),
  previewVideo: z.string().optional(),
  poster: z.string().optional(),
});

const month = z.number().int().min(1).max(12);

// `satisfies` zaručí, že schéma a typ Route sa nerozídu: keď niekto pridá pole
// do Route a zabudne sem, TypeScript to nahlási pri builde.
export const routeSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  tier: z.enum(['silver', 'gold']),
  priceChf: z.number().int().min(1).max(500),
  region: z.string().min(1),
  country: z.enum(['CH', 'IT', 'FR', 'RO', 'NO']),
  distanceKm: z.number().positive(),
  ascentM: z.number().int().min(0),
  durationHours: z.string().min(1),
  avgTempC: z.number().int(),
  passable: z.boolean(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  curviness: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  seasonFrom: month,
  seasonTo: month,
  start: geoPoint,
  finish: geoPoint,
  via: z.array(geoPoint),
  weatherPoint: geoPoint,
  title: localized,
  summary: localized,
  highlights: z.array(localized),
  gear: localized,
  assets,
  isExample: z.boolean().optional(),
}) satisfies z.ZodType<Route>;

/** Riadok tabuľky public.routes tak, ako ho vráti Supabase. */
export interface RouteRow {
  id: string;
  slug: string;
  published: boolean;
  is_example: boolean;
  tier: string;
  price_chf: number;
  region: string;
  country: string;
  /** Postgres numeric — PostgREST ho posiela ako číslo, ale radšej ho prevádzam. */
  distance_km: number | string;
  ascent_m: number;
  duration_hours: string;
  avg_temp_c: number;
  passable: boolean;
  difficulty: string;
  curviness: number;
  season_from: number;
  season_to: number;
  start_point: unknown;
  finish_point: unknown;
  via: unknown;
  weather_point: unknown;
  title: unknown;
  summary: unknown;
  highlights: unknown;
  gear: unknown;
  assets: unknown;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Riadok z databázy → trasa. Pri zlých dátach vráti chybu namiesto výnimky,
 * aby jedna pokazená trasa nezhodila celý katalóg.
 */
export function rowToRoute(row: RouteRow): { route: Route } | { error: string } {
  const result = routeSchema.safeParse({
    id: row.id,
    slug: row.slug,
    tier: row.tier,
    priceChf: row.price_chf,
    region: row.region,
    country: row.country,
    distanceKm: Number(row.distance_km),
    ascentM: row.ascent_m,
    durationHours: row.duration_hours,
    avgTempC: row.avg_temp_c,
    passable: row.passable,
    difficulty: row.difficulty,
    curviness: row.curviness,
    seasonFrom: row.season_from,
    seasonTo: row.season_to,
    start: row.start_point,
    finish: row.finish_point,
    via: row.via,
    weatherPoint: row.weather_point,
    title: row.title,
    summary: row.summary,
    highlights: row.highlights,
    gear: row.gear,
    assets: row.assets,
    isExample: row.is_example,
  });

  if (!result.success) {
    return { error: `trasa ${row.id}: ${z.prettifyError(result.error)}` };
  }
  return { route: result.data };
}

/** Trasa → riadok na zápis. Časové značky dopĺňa databáza sama. */
export function routeToRow(
  route: Route,
  options: { published: boolean; sortOrder: number },
): Omit<RouteRow, 'created_at' | 'updated_at'> {
  return {
    id: route.id,
    slug: route.slug,
    published: options.published,
    is_example: route.isExample ?? false,
    tier: route.tier,
    price_chf: route.priceChf,
    region: route.region,
    country: route.country,
    distance_km: route.distanceKm,
    ascent_m: route.ascentM,
    duration_hours: route.durationHours,
    avg_temp_c: route.avgTempC,
    passable: route.passable,
    difficulty: route.difficulty,
    curviness: route.curviness,
    season_from: route.seasonFrom,
    season_to: route.seasonTo,
    start_point: route.start,
    finish_point: route.finish,
    via: route.via,
    weather_point: route.weatherPoint,
    title: route.title,
    summary: route.summary,
    highlights: route.highlights,
    gear: route.gear,
    assets: route.assets,
    sort_order: options.sortOrder,
  };
}

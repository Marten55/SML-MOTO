import 'server-only';
import { cache } from 'react';

import routesJson from '@/data/routes.json';
import { requireAdmin } from './admin-session';
import { routeSchema, rowToRoute, type RouteRow } from './route-schema';
import type { Route } from './routes';
import { adminClient, isSupabaseConfigured, publicClient } from './supabase';

/**
 * Odkiaľ web berie trasy. Od kroku A je zdrojom Supabase; data/routes.json
 * ostáva ako seed (scripts/seed-routes.ts) a ako záloha pri lokálnom vývoji.
 *
 * Záloha platí LEN mimo produkcie — rovnaké pravidlo ako pri demo serveri
 * v lib/routing.ts. Na ostrom webe by tichý prechod na JSON predával podľa
 * starých cien a nikto by si nevšimol, že databáza nie je pripojená.
 */

function jsonFallbackAllowed(): boolean {
  return !isSupabaseConfigured() && process.env.NODE_ENV !== 'production';
}

function assertConfigured(): void {
  if (!isSupabaseConfigured() && !jsonFallbackAllowed()) {
    throw new Error('[routes] Supabase nie je nastavený — pozri SUPABASE_* v .env.example.');
  }
}

function routesFromJson(): Route[] {
  return (routesJson as unknown[]).map((r) => routeSchema.parse(r));
}

/** Pokazenú trasu vynechá a zapíše do logu — jedna chyba nezhodí celý katalóg. */
function validRoutes(rows: RouteRow[]): Route[] {
  const routes: Route[] = [];
  for (const row of rows) {
    const result = rowToRoute(row);
    if ('error' in result) console.error(`[routes] Neplatná ${result.error}`);
    else routes.push(result.route);
  }
  return routes;
}

// cache() = jedno načítanie na požiadavku, hoci trasy chce stránka aj metadata
export const getAllRoutes = cache(async (): Promise<Route[]> => {
  if (jsonFallbackAllowed()) return routesFromJson();
  assertConfigured();

  const { data, error } = await publicClient()
    .from('routes')
    .select('*')
    .eq('published', true)
    .order('sort_order')
    .order('id');

  if (error) throw new Error(`[routes] Trasy sa nepodarilo načítať: ${error.message}`);
  return validRoutes(data as RouteRow[]);
});

/** Len zverejnené — podľa toho sa predáva a zobrazuje. */
export async function getRouteBySlug(slug: string): Promise<Route | undefined> {
  return (await getAllRoutes()).find((r) => r.slug === slug);
}

/**
 * Trasa, za ktorú už niekto zaplatil — aj keď ju Miroslav medzičasom stiahol
 * z predaja. Prístup je trvalý (rozhodnutie C), takže stiahnutie musí fungovať
 * ďalej. Preto secret kľúč: verejný by nezverejnenú trasu nevidel.
 *
 * Volať LEN s ID z overeného tokenu alebo zaplatenej Stripe session.
 */
export async function getPurchasedRoute(id: string): Promise<Route | undefined> {
  if (jsonFallbackAllowed()) return routesFromJson().find((r) => r.id === id);
  assertConfigured();

  const { data, error } = await adminClient()
    .from('routes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`[routes] Trasa ${id} sa nepodarilo načítať: ${error.message}`);
  if (!data) return undefined;
  return validRoutes([data as RouteRow])[0];
}

export interface AdminRouteItem {
  id: string;
  slug: string;
  title: string;
  tier: string;
  priceChf: number;
  published: boolean;
  isExample: boolean;
  updatedAt: string | null;
  /** Neprázdne, keď riadok v databáze nezodpovedá schéme. */
  problem: string | null;
}

/** Všetky trasy vrátane nezverejnených. Overenie admina je priamo tu (DAL). */
export async function getRoutesForAdmin(): Promise<AdminRouteItem[]> {
  await requireAdmin();

  if (jsonFallbackAllowed()) {
    return routesFromJson().map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title.sk,
      tier: r.tier,
      priceChf: r.priceChf,
      published: true,
      isExample: r.isExample ?? false,
      updatedAt: null,
      problem: null,
    }));
  }
  assertConfigured();

  const { data, error } = await adminClient()
    .from('routes')
    .select('*')
    .order('sort_order')
    .order('id');

  if (error) throw new Error(`[routes] Zoznam pre administráciu zlyhal: ${error.message}`);

  return (data as RouteRow[]).map((row) => {
    const result = rowToRoute(row);
    const title = (row.title as { sk?: string } | null)?.sk ?? row.slug;
    return {
      id: row.id,
      slug: row.slug,
      title,
      tier: row.tier,
      priceChf: row.price_chf,
      published: row.published,
      isExample: row.is_example,
      updatedAt: row.updated_at ?? null,
      problem: 'error' in result ? result.error : null,
    };
  });
}

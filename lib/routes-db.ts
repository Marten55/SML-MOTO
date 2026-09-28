import 'server-only';
import { cache } from 'react';

import routesJson from '@/data/routes.json';
import { requireAdmin } from './admin-session';
import { routeSchema, routeToRow, rowToRoute, type RouteRow } from './route-schema';
import { isSellable, type Route } from './routes';
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

// ── Zápis z administrácie (krok D3) ────────────────────────────────────────

/** Postgres: porušená podmienka unique (slug alebo ID už existuje). */
const UNIQUE_VIOLATION = '23505';

/** Je adresa trasy obsadená? Aj skrytou trasou — slug je jedinečný v celej tabuľke. */
export async function isSlugTaken(slug: string): Promise<boolean> {
  await requireAdmin();
  const { data, error } = await adminClient().from('routes').select('id').eq('slug', slug).maybeSingle();
  if (error) throw new Error(`[routes] Kontrola adresy ${slug} zlyhala: ${error.message}`);
  return data !== null;
}

/**
 * Uloží novú trasu ako skrytú (published = false). Zverejní ju až Miroslav
 * v zozname trás (krok D4). Nová trasa ide na koniec katalógu.
 *
 * 'slug_taken' namiesto výnimky: kontrola pred nahratím súborov a zápis nie
 * sú jedna operácia, takže adresu mohol medzitým obsadiť niekto iný (druhá
 * karta prehliadača). Rozhodne databáza, nie predchádzajúca kontrola.
 */
export async function insertHiddenRoute(route: Route): Promise<'ok' | 'slug_taken'> {
  await requireAdmin();
  const db = adminClient();

  const { data: last, error: orderError } = await db
    .from('routes')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) throw new Error(`[routes] Poradie trás sa nepodarilo zistiť: ${orderError.message}`);

  const row = routeToRow(route, { published: false, sortOrder: (last?.sort_order ?? 0) + 1 });
  const { error } = await db.from('routes').insert(row);

  if (error?.code === UNIQUE_VIOLATION && error.message.includes('slug')) return 'slug_taken';
  if (error) throw new Error(`[routes] Trasu ${route.id} sa nepodarilo uložiť: ${error.message}`);
  return 'ok';
}

// ── Zverejnenie (krok D4) ──────────────────────────────────────────────────

export type PublishResult = 'ok' | 'not_found' | 'invalid';

/**
 * Zverejní trasu alebo ju stiahne z predaja. Stiahnutie nič nemaže:
 * kto trasu kúpil, stiahne si ju ďalej (getPurchasedRoute číta aj skryté).
 *
 * Zverejniť sa dá len trasa, ktorá prejde routeSchema a má obe podoby GPX.
 * Pokazený riadok by katalóg ticho vynechal (validRoutes) — Miroslav by
 * videl „Zverejnená" a zákazník nič. Radšej odmietnuť nahlas.
 */
export async function setRoutePublished(id: string, published: boolean): Promise<PublishResult> {
  await requireAdmin();
  const db = adminClient();

  const { data: row, error: readError } = await db.from('routes').select('*').eq('id', id).maybeSingle();
  if (readError) throw new Error(`[routes] Trasu ${id} sa nepodarilo načítať: ${readError.message}`);
  if (!row) return 'not_found';

  if (published) {
    const result = rowToRoute(row as RouteRow);
    if ('error' in result || !isSellable(result.route)) {
      console.error(`[routes] ${id} sa nedá zverejniť: ${'error' in result ? result.error : 'chýba GPX'}`);
      return 'invalid';
    }
  }

  const { error } = await db.from('routes').update({ published }).eq('id', id);
  if (error) throw new Error(`[routes] Trasu ${id} sa nepodarilo ${published ? 'zverejniť' : 'skryť'}: ${error.message}`);
  return 'ok';
}

/**
 * Trasa pre náhľad v administrácii — aj skrytá. null aj pri pokazenom
 * riadku: taký sa zákazníkovi neukáže, takže nemá čo náhľadovať.
 */
export interface AdminRoute {
  route: Route;
  published: boolean;
  /** ISO čas poslednej zmeny v databáze; null pri lokálnom JSON. */
  updatedAt: string | null;
}

export async function getRouteForAdmin(id: string): Promise<AdminRoute | null> {
  await requireAdmin();
  if (jsonFallbackAllowed()) {
    const route = routesFromJson().find((r) => r.id === id);
    return route ? { route, published: true, updatedAt: null } : null;
  }
  assertConfigured();

  const { data, error } = await adminClient().from('routes').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`[routes] Trasu ${id} sa nepodarilo načítať: ${error.message}`);
  if (!data) return null;
  const route = validRoutes([data as RouteRow])[0];
  const row = data as RouteRow;
  return route ? { route, published: row.published, updatedAt: row.updated_at ?? null } : null;
}

// ── Úprava (krok D5) ───────────────────────────────────────────────────────

/**
 * Prepíše obsah existujúcej trasy. Stav zverejnenia a poradie v katalógu
 * nemení — na to je zoznam trás (D4). 'slug_taken' ako pri insertHiddenRoute.
 */
export async function updateRouteContent(route: Route): Promise<'ok' | 'slug_taken' | 'not_found'> {
  await requireAdmin();
  const row: Partial<RouteRow> = routeToRow(route, { published: false, sortOrder: 0 });
  // Tieto dva stĺpce patria zoznamu trás — úprava textov ich nesmie prepísať
  delete row.published;
  delete row.sort_order;
  delete row.id;

  const { data, error } = await adminClient().from('routes').update(row).eq('id', route.id).select('id');
  if (error?.code === UNIQUE_VIOLATION && error.message.includes('slug')) return 'slug_taken';
  if (error) throw new Error(`[routes] Trasu ${route.id} sa nepodarilo upraviť: ${error.message}`);
  return data.length === 0 ? 'not_found' : 'ok';
}

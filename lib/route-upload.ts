import { signToken, verifyToken } from './signed-token';
import { slugify } from './slug';

/**
 * Nahratie novej trasy v dvoch krokoch (krok D3):
 *
 *   1. prepareRouteUpload  server vymyslí ID trasy a pre každý zdrojový súbor
 *                          vydá podpísanú adresu na nahratie + lístok
 *   2. prehliadač          nahrá súbory rovno do úložiska (Server Action
 *                          unesie 1 MB, export zo Swisstopo má až 25 MB)
 *   3. saveRoute           server podľa lístka stiahne zdroj, zopakuje rozbor
 *                          a uloží trasu ako skrytú
 *
 * Lístok existuje preto, že server medzi krokmi 1 a 3 nič nepamätá. Keby
 * v kroku 3 prišlo ID a cesty od prehliadača, dalo by sa podstrčiť ID
 * existujúcej trasy — a upratovanie po chybe by zmazalo jej súbory.
 * Z lístka vie server, že ID vymyslel on a ktoré súbory k nemu patria.
 *
 * Bez 'server-only' (ako signed-token.ts), aby sa dal testovať.
 */

/** Viac súborov na jednu trasu Swisstopo nevyexportuje; chráni pred zahltením. */
export const MAX_SOURCE_FILES = 10;

/**
 * Podpísaná adresa na nahratie platí v Supabase 2 hodiny a nedá sa skrátiť.
 * Lístok platí kratšie: nahratie aj uloženie idú hneď po sebe jedným kliknutím.
 */
const TICKET_SECONDS = 30 * 60;

const SOURCE_EXTENSIONS = new Set(['gpx', 'kml', 'csv']);

// Tvar crypto.randomUUID(). Staré trasy majú ID r001…, nové UUID —
// lístok s ID inej podoby je podvrh alebo chyba.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Kde leží zdrojový export: `<id>/source/01-furka-export.gpx`.
 *
 * - Podpriečinok `source/` sa zákazníkovi nedá stiahnuť — /api/download berie
 *   len mená bez lomky (lib/route-file-path.ts).
 * - Číslo drží poradie: pri viacerých súboroch záleží na tom, ktorý bol prvý.
 * - Meno od Miroslava prejde cez slugify, takže medzery, diakritika ani
 *   `../` sa do cesty nedostanú. Pôvodné meno netreba, rozbor potrebuje
 *   len príponu.
 *
 * null = súbor nie je GPX, KML ani CSV.
 */
export function sourcePath(routeId: string, index: number, originalName: string): string | null {
  const match = /^(.*)\.([^.]+)$/.exec(originalName);
  const ext = match?.[2].toLowerCase();
  if (!match || !ext || !SOURCE_EXTENSIONS.has(ext)) return null;

  const base = slugify(match[1]).slice(0, 60) || 'export';
  return `${routeId}/source/${String(index + 1).padStart(2, '0')}-${base}.${ext}`;
}

/** Mená, pod ktorými si zákazník stiahne balíček — rovnaký tvar ako pri ukážkových trasách. */
export function packageFileNames(slug: string) {
  return {
    track: `${slug}-track.gpx`,
    navigation: `${slug}-navigation.gpx`,
    poi: `${slug}-poi.gpx`,
  };
}

// ── Lístok ─────────────────────────────────────────────────────────────────

export interface UploadTicket {
  routeId: string;
  /** Cesty v úložisku v poradí, v akom ich Miroslav nahral. */
  sources: string[];
}

interface TicketPayload extends UploadTicket {
  /** Účel — lístok sa nedá použiť ako prihlasovacia cookie ani naopak. */
  use: 'route-upload';
  exp: number;
}

export function createUploadTicket(ticket: UploadTicket, secret: string, now: number): string {
  const payload: TicketPayload = { use: 'route-upload', ...ticket, exp: now + TICKET_SECONDS * 1000 };
  return signToken(payload, secret);
}

/** Obsah lístka, alebo null pri podvrhu, vypršaní či nezmyselnom obsahu. */
export function verifyUploadTicket(token: unknown, secret: string, now: number): UploadTicket | null {
  if (typeof token !== 'string') return null;
  const p = verifyToken(token, secret) as Partial<TicketPayload> | null;

  if (!p || p.use !== 'route-upload' || typeof p.exp !== 'number' || p.exp < now) return null;
  if (typeof p.routeId !== 'string' || !UUID.test(p.routeId)) return null;
  if (!Array.isArray(p.sources) || p.sources.length === 0 || p.sources.length > MAX_SOURCE_FILES) return null;
  // Podpis sedí, takže cesty sme vyrobili my — ale radšej overiť, že patria k tejto trase
  const prefix = `${p.routeId}/source/`;
  if (!p.sources.every((s) => typeof s === 'string' && s.startsWith(prefix) && !s.includes('..'))) return null;

  return { routeId: p.routeId, sources: p.sources };
}

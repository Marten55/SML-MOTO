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
 * Úprava existujúcej trasy (krok D5) ide tou istou cestou s ID tej trasy.
 * Tam chráni pred zmazaním cudzích súborov niečo iné: všetko, čo pokus
 * zapíše, má nové meno (dávka v ceste zdroja, iné meno balíčka), takže
 * upratovanie po chybe nikdy nezasiahne súbory, ktoré trasa práve používa.
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

// Tvar crypto.randomUUID(). Staré trasy majú ID r001…, nové UUID — lístok
// na NOVÚ trasu s ID inej podoby je podvrh alebo chyba.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Pri výmene súborov je ID existujúcej trasy — len bezpečné znaky (ako route-file-path.ts)
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

/**
 * Kde leží zdrojový export: `<id>/source/<dávka>-01-furka-export.gpx`.
 *
 * - Dávka (čas nahratia) odlíši nový export od starého pri úprave trasy —
 *   podpísaná adresa na nahratie existujúci súbor neprepíše.
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
export function sourcePath(routeId: string, batch: string, index: number, originalName: string): string | null {
  const match = /^(.*)\.([^.]+)$/.exec(originalName);
  const ext = match?.[2].toLowerCase();
  if (!match || !ext || !SOURCE_EXTENSIONS.has(ext)) return null;

  const base = slugify(match[1]).slice(0, 60) || 'export';
  if (!/^[a-z0-9]+$/.test(batch)) return null;
  return `${routeId}/source/${batch}-${String(index + 1).padStart(2, '0')}-${base}.${ext}`;
}

/** Označenie dávky nahratia: čas v base36, krátke a zoradené podľa času. */
export function uploadBatch(now: number): string {
  return now.toString(36);
}

/**
 * Mená, pod ktorými si zákazník stiahne balíček — rovnaký tvar ako pri
 * ukážkových trasách: `furka-track.gpx`.
 *
 * `taken` = mená súborov, ktoré trasa práve používa. Pri výmene súborov
 * (krok D5) nový balíček nesmie staré prepísať: keby zápis do databázy
 * potom zlyhal, trasa by ukazovala na súbory, ktoré upratovanie zmazalo.
 * Preto sa strieda `furka-track.gpx` a `furka-track-2.gpx`.
 */
export function packageFileNames(slug: string, taken: Iterable<string> = []) {
  const used = new Set(taken);
  const names = (suffix: string) => ({
    track: `${slug}-track${suffix}.gpx`,
    navigation: `${slug}-navigation${suffix}.gpx`,
    poi: `${slug}-poi${suffix}.gpx`,
  });
  const plain = names('');
  const clash = Object.values(plain).some((n) => used.has(n));
  return clash ? names('-2') : plain;
}

// ── Lístok ─────────────────────────────────────────────────────────────────

export type UploadKind = 'new' | 'replace';

export interface UploadTicket {
  /** new = nová trasa (ID vymyslel server), replace = výmena súborov existujúcej. */
  kind: UploadKind;
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
  if (p.kind !== 'new' && p.kind !== 'replace') return null;
  if (typeof p.routeId !== 'string' || !(p.kind === 'new' ? UUID : SAFE_ID).test(p.routeId)) return null;
  if (!Array.isArray(p.sources) || p.sources.length === 0 || p.sources.length > MAX_SOURCE_FILES) return null;
  // Podpis sedí, takže cesty sme vyrobili my — ale radšej overiť, že patria k tejto trase
  const prefix = `${p.routeId}/source/`;
  if (!p.sources.every((s) => typeof s === 'string' && s.startsWith(prefix) && !s.includes('..'))) return null;

  return { kind: p.kind, routeId: p.routeId, sources: p.sources };
}

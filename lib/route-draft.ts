import { z } from 'zod';

import { buildRoutePackage, type InputFile, type RoutePackage } from './route-builder';
import { simplifyToCount } from './route-builder/geo';
import { routeSchema } from './route-schema';
import { MAX_WAYPOINTS, type GeoPoint, type Route, type RouteAssets } from './routes';
import { slugify } from './slug';

/**
 * Koncept trasy: údaje, ktoré GPX nemá a vypĺňa ich Miroslav vo formulári
 * (/admin/nova-trasa) — texty v štyroch jazykoch, cena, obtiažnosť, sezóna…
 *
 * Tok dát:
 *
 *   formulár (RouteDraft) ──┐
 *                           ├─ checkDraft() → RouteFields ─┐
 *   GPX (routeGeometry) ────┘                              ├─ assembleRoute() → Route
 *   server pri uložení (ID, súbory; krok D3) ──────────────┘
 *
 * Zámerne bez 'server-only' a bez aliasu @/ (ako route-schema.ts): tú istú
 * kontrolu robí prehliadač pre okamžitú odpoveď a v kroku D3 ju zopakuje
 * server, lebo formulár sa dá podvrhnúť.
 */

/** Ceny z odsúhlaseného cenníka. Len predvyplnenie — cena sa ukladá ku každej trase zvlášť. */
export const DEFAULT_PRICE_CHF = { silver: 9, gold: 19 } as const;

/** Viac zaujímavostí na stránke trasy už nikto nedočíta. */
export const MAX_HIGHLIGHTS = 8;

/** Poradie jazykov vo formulári: najprv ten, v ktorom Miroslav píše, potom hlavný trh. */
export const DRAFT_LOCALES = ['sk', 'de', 'en', 'fr'] as const;

// Dĺžky textov. Limity v databáze nie sú — tieto chránia rozloženie stránky.
export const TEXT_LIMITS = {
  name: 120,
  title: 80,
  summary: 600,
  highlight: 160,
  gear: 300,
  region: 60,
  weatherName: 60,
} as const;

// ── Schéma formulára ───────────────────────────────────────────────────────
//
// Čítanie z databázy (routeSchema) je zhovievavé: prázdny preklad tam prejde,
// lebo prísnosť by zo zoznamu vyhodila trasu, ktorú si už niekto kúpil.
// Zápis je naopak prísny — do databázy sa nový prázdny text nedostane.
// Pravidlá pre čísla a výbery sa neopisujú, berú sa z routeSchema.shape,
// aby sa formulár a schéma trasy nerozišli.

function text(max: number) {
  return z.string().trim().min(1).max(max);
}

function localizedText(max: number) {
  const t = text(max);
  return z.object({ sk: t, de: t, en: t, fr: t });
}

/**
 * Číslo z textového poľa. Formulár drží čísla ako text: s type="number" a stavom
 * typu number by sa vymazané pole zmenilo na 0 a „-" pri zápornej teplote by
 * zmizlo skôr, než človek dopíše číslicu. Čiarka platí ako desatinná bodka.
 */
function numberFromText<T extends z.core.$ZodType<unknown, number>>(schema: T) {
  return z
    .string()
    .trim()
    .min(1)
    .transform((s) => Number(s.replace(',', '.')))
    .pipe(schema);
}

/** Výber (select, prepínač) je v stave formulára text; '' znamená „nevybrané". */
function choice<T extends z.core.$ZodType<unknown, string>>(schema: T) {
  return z.string().pipe(schema);
}

const routeDraftSchema = z.object({
  /** Hlavný názov — ide do GPX a vzniká z neho adresa stránky (slug). */
  name: text(TEXT_LIMITS.name).refine((name) => routeSchema.shape.slug.safeParse(slugify(name)).success, {
    error: 'Z názvu sa nedá vyrobiť adresa stránky — použi aspoň jedno písmeno alebo číslo.',
  }),
  tier: choice(routeSchema.shape.tier),
  priceChf: numberFromText(routeSchema.shape.priceChf),
  country: choice(routeSchema.shape.country),
  region: text(TEXT_LIMITS.region),
  difficulty: choice(routeSchema.shape.difficulty),
  curviness: numberFromText(routeSchema.shape.curviness),
  seasonFrom: numberFromText(routeSchema.shape.seasonFrom),
  seasonTo: numberFromText(routeSchema.shape.seasonTo),
  durationHours: z
    .string()
    .trim()
    // „7-9", „7 - 9" aj „7—9" → „7–9", ako to majú ostatné trasy
    .transform((s) => s.replace(/\s*[-‐‑‒–—]\s*/g, '–'))
    .pipe(z.string().regex(/^\d{1,2}(–\d{1,2})?$/, { error: 'Napíš počet hodín, napr. 7–9 alebo 5.' })),
  // Priemerná teplota na vrchole v sezóne; mimo rozsahu je skoro isto preklep
  avgTempC: numberFromText(routeSchema.shape.avgTempC.min(-20).max(35)),
  passable: z.boolean(),
  title: localizedText(TEXT_LIMITS.title),
  summary: localizedText(TEXT_LIMITS.summary),
  highlights: z.array(localizedText(TEXT_LIMITS.highlight)).min(1).max(MAX_HIGHLIGHTS),
  gear: localizedText(TEXT_LIMITS.gear),
  /** Kľúč jednej z možností v RouteGeometry.weatherOptions. Overuje sa až s trasou. */
  weatherKey: z.string(),
  /** Meno bodu, ktoré vidí zákazník: „Počasie na Furka". */
  weatherName: text(TEXT_LIMITS.weatherName),
});

/**
 * Stav formulára — všetko ako text alebo boolean, presne ako to dávajú polia.
 * Na typy trasy (čísla, výbery) ho prevedie až checkDraft().
 */
export type RouteDraft = z.input<typeof routeDraftSchema>;

export function emptyRouteDraft(): RouteDraft {
  const empty = () => ({ sk: '', de: '', en: '', fr: '' });
  return {
    name: '',
    tier: 'silver',
    priceChf: String(DEFAULT_PRICE_CHF.silver),
    // Krajina, obtiažnosť a kľukatosť sú filtre katalógu. Zámerne bez
    // predvolenej hodnoty: prehliadnutá predvoľba by trasu zaradila zle a ticho.
    country: '',
    region: '',
    difficulty: '',
    curviness: '',
    // Bežná sezóna vysokohorských priesmykov. Filter to nie je, len údaj na stránke.
    seasonFrom: '6',
    seasonTo: '10',
    durationHours: '',
    avgTempC: '',
    passable: true,
    title: empty(),
    summary: empty(),
    highlights: [empty()],
    gear: empty(),
    weatherKey: '',
    weatherName: '',
  };
}

// ── Chybové hlášky ─────────────────────────────────────────────────────────

/**
 * Hlášky pre Miroslava. Zod má aj vlastnú slovenčinu, ale znie ako z prekladača
 * („string musí mať >=1 znakov"). Názov poľa stojí pri hláške vo formulári,
 * preto stačí krátko povedať, čo je zle.
 *
 * Vracia undefined pre prípady, ktoré tu nie sú — vtedy použije zod svoju hlášku.
 */
function slovakMessage(issue: z.core.$ZodRawIssue): string | undefined {
  switch (issue.code) {
    case 'too_small':
      if (issue.origin === 'string') return 'Vyplň.';
      if (issue.origin === 'array') return `Pridaj aspoň ${issue.minimum}.`;
      return `Najmenej ${issue.minimum}.`;
    case 'too_big':
      if (issue.origin === 'string') return `Najviac ${issue.maximum} znakov.`;
      return `Najviac ${issue.maximum}.`;
    case 'invalid_type':
      if (issue.expected === 'int') return 'Zadaj celé číslo.';
      if (issue.expected === 'number') return 'Zadaj číslo.';
      return undefined;
    case 'invalid_value':
    case 'invalid_union':
      return 'Vyber jednu z možností.';
    default:
      return undefined;
  }
}

/** Kľúč = cesta k poľu: „priceChf", „title.de", „highlights.2.fr". */
export type FieldErrors = Partial<Record<string, string>>;

/** Chyba, ktorá nepatrí k žiadnemu poľu formulára, ale k nahratej trase. */
export const GEOMETRY_ERROR = 'geometry';

function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    // Jedna hláška na pole stačí — prvá je tá podstatná („Vyplň." pred „zlý tvar")
    errors[issue.path.map(String).join('.')] ??= issue.message;
  }
  return errors;
}

// ── Údaje zo stopy ─────────────────────────────────────────────────────────

export interface WeatherOption {
  key: string;
  label: string;
  point: { lat: number; lng: number };
  /** Návrh mena pre zákazníka. Prázdny, keď bod meno nemá (najvyšší bod, štart). */
  suggestedName: string;
}

/** Čo sa o trase dá zistiť z nahratého GPX — Miroslav to neprepisuje ručne. */
export interface RouteGeometry {
  distanceKm: number;
  /** null, keď súbor nemá výšky. */
  ascentM: number | null;
  start: GeoPoint;
  finish: GeoPoint;
  via: GeoPoint[];
  /** Body, pre ktoré sa dá ťahať počasie. Prvý je najvyšší bod, ak ho poznáme. */
  weatherOptions: WeatherOption[];
}

type LatLng = { lat: number; lng: number };

/** 5 desatinných miest ≈ 1 m. Viac presnosti v databáze nič nepridá. */
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const latLng = (p: LatLng): LatLng => ({ lat: round5(p.lat), lng: round5(p.lng) });
const pointKey = (p: LatLng) => `${round5(p.lat)},${round5(p.lng)}`;
const geoPoint = (p: LatLng, name: string): GeoPoint => ({ ...latLng(p), name });

/**
 * Z balíčka po kontrole vytiahne všetko, čo formulár nevypĺňa. null, keď sa
 * trasa predať nedá — z takej sa katalógový záznam robiť nemá.
 *
 * Názvy bodov (štart, cieľ, via) zákazník nevidí, slúžia len nám. Jediný
 * viditeľný je bod na počasie, ten preto pomenuje Miroslav.
 */
export function routeGeometry(pkg: RoutePackage): RouteGeometry | null {
  const { track, waypoints, stats } = pkg;
  if (!pkg.ok || !stats || track.length < 2) return null;

  // Body pre odkaz do Google Maps a náznak trasy na mape. RDP namiesto
  // rovnomerného výberu: ostanú body, kde trasa mení smer, takže Google
  // si medzi nimi menej vymýšľa vlastnú cestu.
  const via = simplifyToCount(track, MAX_WAYPOINTS + 2)
    .slice(1, -1)
    .map((p, i) => geoPoint(p, `Bod ${i + 1}`));

  const start = track[0];
  const finish = track[track.length - 1];

  // Počasie má zmysel ukazovať tam, kde je najchladnejšie a najčastejšie
  // sa mení — na priesmyku. Preto je najvyšší bod prvý v zozname.
  const candidates: Omit<WeatherOption, 'key'>[] = [];
  const highest = track.reduce((best, p) => ((p.ele ?? -Infinity) > (best.ele ?? -Infinity) ? p : best));
  if (highest.ele !== undefined && stats.maxEleM !== null) {
    candidates.push({
      label: `Najvyšší bod trasy (${stats.maxEleM.toLocaleString('sk-SK')} m n. m.)`,
      point: latLng(highest),
      suggestedName: '',
    });
  }
  for (const w of waypoints) {
    candidates.push({ label: `Bod záujmu: ${w.name}`, point: latLng(w), suggestedName: w.name });
  }
  candidates.push(
    { label: 'Štart trasy', point: latLng(start), suggestedName: '' },
    { label: 'Cieľ trasy', point: latLng(finish), suggestedName: '' },
  );

  // Okruh má štart aj cieľ na tom istom mieste — v zozname stačí raz
  const weatherOptions = new Map<string, WeatherOption>();
  for (const c of candidates) {
    const key = pointKey(c.point);
    if (!weatherOptions.has(key)) weatherOptions.set(key, { ...c, key });
  }

  return {
    distanceKm: stats.distanceKm,
    ascentM: stats.ascentM,
    start: geoPoint(start, 'Štart'),
    finish: geoPoint(finish, 'Cieľ'),
    via,
    weatherOptions: [...weatherOptions.values()],
  };
}

// ── Kontrola konceptu ──────────────────────────────────────────────────────

/** Všetko o trase okrem toho, čo pridelí server pri uložení (ID, súbory v úložisku). */
export type RouteFields = Omit<Route, 'id' | 'assets' | 'isExample'>;

export type DraftCheck = { ok: true; fields: RouteFields } | { ok: false; errors: FieldErrors };

/**
 * Formulár + trasa → údaje do katalógu, alebo zoznam chýb podľa polí.
 *
 * `draft` je `unknown`, lebo v kroku D3 ho server dostane z požiadavky
 * a nesmie predpokladať, že prišiel z nášho formulára.
 */
export function checkDraft(draft: unknown, geometry: RouteGeometry | null): DraftCheck {
  // Bod na počasie sa dá overiť len proti trase, ktorá je práve nahratá —
  // po výmene súborov môže vybraný bod v trase chýbať.
  const weatherKeys = new Set(geometry?.weatherOptions.map((o) => o.key));
  const schema = routeDraftSchema.extend({
    weatherKey: z.string().refine((key) => weatherKeys.has(key), {
      error: 'Vyber bod, pre ktorý sa ukáže počasie.',
    }),
  });

  const parsed = schema.safeParse(draft, { error: slovakMessage });
  const errors: FieldErrors = parsed.success ? {} : toFieldErrors(parsed.error);

  if (!geometry) {
    errors[GEOMETRY_ERROR] = 'Najprv nahraj trasu, ktorá prejde kontrolou.';
  } else if (geometry.ascentM === null) {
    errors[GEOMETRY_ERROR] =
      'Súbor nemá výšky, takže sa nedá spočítať stúpanie — v katalógu by svietilo 0 m. ' +
      'Exportuj zo Swisstopo GPX s výškami.';
  }

  if (!parsed.success || !geometry || geometry.ascentM === null) return { ok: false, errors };

  const d = parsed.data;
  const weather = geometry.weatherOptions.find((o) => o.key === d.weatherKey)!;

  return {
    ok: true,
    fields: {
      slug: slugify(d.name),
      tier: d.tier,
      priceChf: d.priceChf,
      region: d.region,
      country: d.country,
      distanceKm: geometry.distanceKm,
      ascentM: geometry.ascentM,
      durationHours: d.durationHours,
      avgTempC: d.avgTempC,
      passable: d.passable,
      difficulty: d.difficulty,
      curviness: d.curviness,
      seasonFrom: d.seasonFrom,
      seasonTo: d.seasonTo,
      start: geometry.start,
      finish: geometry.finish,
      via: geometry.via,
      weatherPoint: { ...weather.point, name: d.weatherName },
      title: d.title,
      summary: d.summary,
      highlights: d.highlights,
      gear: d.gear,
    },
  };
}

/**
 * Posledná brána pred databázou (krok D3): koncept + to, čo pridelí server,
 * musí prejsť tou istou schémou, ktorou sa trasa číta. Keby sa pravidlá
 * formulára a routeSchema rozišli, zastaví sa to tu — nie až v katalógu,
 * kde by trasa ticho chýbala.
 */
export function assembleRoute(
  fields: RouteFields,
  server: { id: string; assets: RouteAssets },
): { route: Route } | { error: string } {
  const result = routeSchema.safeParse({ ...fields, ...server, isExample: false });
  if (!result.success) return { error: z.prettifyError(result.error) };
  return { route: result.data };
}

/** Súbory balíčka, ktoré server uloží k trase. */
export type PackageFiles = NonNullable<RoutePackage['files']>;

/**
 * Server (krok D3): nahraté zdroje + formulár → údaje trasy a súbory balíčka.
 *
 * Tá istá cesta ako náhľad v prehliadači (buildRoutePackage → routeGeometry
 * → checkDraft), len nad súbormi, ktoré server stiahol z úložiska sám.
 * Dĺžka, stúpanie a body sa tak vždy počítajú z toho, čo si zákazník kúpi.
 */
export function routeFromSources(
  inputs: InputFile[],
  draft: unknown,
): { ok: true; fields: RouteFields; files: PackageFiles } | { ok: false; errors: FieldErrors } {
  // Názov ide do GPX ešte pred kontrolou formulára; zlý názov checkDraft
  // aj tak odmietne, takže sa z neho nič neuloží
  const rawName = (draft as { name?: unknown } | null)?.name;
  const name = typeof rawName === 'string' ? rawName.trim() : '';

  const pkg = buildRoutePackage(inputs, { name: name || 'Nová trasa' });
  const check = checkDraft(draft, routeGeometry(pkg));
  if (!check.ok) return check;
  // routeGeometry vracia null pre balíček bez súborov, takže sem sa bez nich nedostane
  if (!pkg.files) return { ok: false, errors: { [GEOMETRY_ERROR]: 'Balíček sa nepodarilo zostaviť.' } };

  return { ok: true, fields: check.fields, files: pkg.files };
}

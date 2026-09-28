import { describe, expect, it } from 'vitest';

import { buildRoutePackage, type TrackPoint } from './route-builder';
import {
  assembleRoute,
  checkDraft,
  emptyRouteDraft,
  GEOMETRY_ERROR,
  MAX_HIGHLIGHTS,
  routeGeometry,
  type RouteDraft,
  type RouteGeometry,
} from './route-draft';
import { routeSchema } from './route-schema';
import { MAX_WAYPOINTS } from './routes';

/**
 * Formulár s údajmi trasy (krok D2). Chráni hlavne dve veci:
 * - čo formulár pustí, to databáza a katalóg prijmú (inak by trasa po uložení
 *   ticho chýbala v katalógu),
 * - prázdne alebo pokazené pole sa nahlási pri poli, po slovensky.
 */

// --- testovacia trasa: Furka s výškami a dvoma bodmi záujmu ------------------

function furkaTrack(points = 300): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    out.push({
      lat: 46.5725 + 0.06 * t + 0.01 * Math.sin(t * 20),
      lng: 8.4147 - 0.2 * t + 0.01 * Math.cos(t * 20),
      ele: 1500 + 936 * Math.sin(t * Math.PI),
    });
  }
  return out;
}

function gpx(track: TrackPoint[], { withEle = true } = {}): string {
  const pts = track
    .map((p) => `<trkpt lat="${p.lat}" lon="${p.lng}">${withEle ? `<ele>${p.ele}</ele>` : ''}</trkpt>`)
    .join('');
  const mid = track[Math.floor(track.length / 2)];
  const wpts =
    `<wpt lat="${track[40].lat}" lon="${track[40].lng}"><name>Hotel Belvédère</name></wpt>` +
    `<wpt lat="${mid.lat}" lon="${mid.lng}"><name>Furkapass</name></wpt>`;
  return `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${wpts}<trk><trkseg>${pts}</trkseg></trk></gpx>`;
}

function geometryOf(content: string): RouteGeometry | null {
  return routeGeometry(buildRoutePackage([{ name: 'furka.gpx', content }], { name: 'Furka' }));
}

const geometry = geometryOf(gpx(furkaTrack()))!;

const both = (text: string) => ({ sk: text, de: text, en: text, fr: text });

/** Vyplnený formulár, ako ho odošle Miroslav. */
function filledDraft(overrides: Partial<RouteDraft> = {}): RouteDraft {
  return {
    ...emptyRouteDraft(),
    name: 'Furka · Grimsel · Susten',
    tier: 'gold',
    priceChf: '19',
    country: 'CH',
    region: 'Uri · Wallis · Bern',
    difficulty: 'medium',
    curviness: '5',
    durationHours: '7–9',
    avgTempC: '8',
    title: both('Furka · Grimsel · Susten'),
    summary: both('Veľká trojka za jeden deň.'),
    highlights: [both('Vracáky pri Belvédère'), both('Žulové steny Grimselu')],
    gear: both('Vetrovka a teplá vrstva.'),
    weatherKey: geometry.weatherOptions[0].key,
    weatherName: 'Furka',
    ...overrides,
  };
}

function errorsOf(draft: unknown, geo: RouteGeometry | null = geometry) {
  const result = checkDraft(draft, geo);
  if (result.ok) throw new Error('čakal som chyby, kontrola prešla');
  return result.errors;
}

function fieldsOf(draft: unknown) {
  const result = checkDraft(draft, geometry);
  if (!result.ok) throw new Error(`čakal som úspech: ${JSON.stringify(result.errors)}`);
  return result.fields;
}

// --- testy -------------------------------------------------------------------

describe('údaje zo stopy', () => {
  it('štart a cieľ sú krajné body stopy, via sa zmestí do odkazu Google Maps', () => {
    const track = furkaTrack();
    expect(geometry.start).toMatchObject({ lat: 46.5725, lng: expect.closeTo(track[0].lng, 5) });
    expect(geometry.finish.lat).toBeCloseTo(track[track.length - 1].lat, 5);
    expect(geometry.via.length).toBeGreaterThan(0);
    expect(geometry.via.length).toBeLessThanOrEqual(MAX_WAYPOINTS);
  });

  it('na počasie ponúkne najprv najvyšší bod, potom body záujmu s ich menom', () => {
    const [highest, ...rest] = geometry.weatherOptions;
    // toLocaleString('sk-SK') oddeľuje tisíce nezalomiteľnou medzerou, \s ju chytí
    expect(highest.label).toMatch(/2\s436 m/);
    expect(highest.suggestedName).toBe('');
    expect(rest.map((o) => o.suggestedName)).toContain('Furkapass');
    expect(rest.at(-1)!.label).toBe('Cieľ trasy');
  });

  it('okruh neponúkne štart a cieľ dvakrát', () => {
    const loop = furkaTrack();
    loop.push({ ...loop[0] });
    const keys = geometryOf(gpx(loop))!.weatherOptions.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('trasa, ktorá neprešla kontrolou, nedá žiadne údaje', () => {
    expect(geometryOf('<gpx></gpx>')).toBeNull();
  });
});

describe('vyplnený formulár', () => {
  it('prejde a po pridaní ID a súborov ho prijme aj schéma trasy z databázy', () => {
    const fields = fieldsOf(filledDraft());
    const result = assembleRoute(fields, {
      id: 'r010',
      assets: { track: 'furka-master.gpx', navigation: 'furka-navigation.gpx' },
    });

    expect(result).toHaveProperty('route');
    const route = (result as { route: unknown }).route;
    expect(routeSchema.safeParse(route).success).toBe(true);
    expect(route).toMatchObject({
      slug: 'furka-grimsel-susten',
      priceChf: 19,
      curviness: 5,
      seasonFrom: 6,
      ascentM: geometry.ascentM,
      weatherPoint: { name: 'Furka' },
      isExample: false,
    });
  });

  it('dĺžku a stúpanie berie zo stopy, nie z formulára', () => {
    const fields = fieldsOf({ ...filledDraft(), distanceKm: 1, ascentM: 1 });
    expect(fields.distanceKm).toBe(geometry.distanceKm);
    expect(fields.ascentM).toBe(geometry.ascentM);
  });

  it('čísla s čiarkou a medzerami prečíta, pomlčku v trvaní zjednotí', () => {
    const fields = fieldsOf(filledDraft({ avgTempC: ' -3 ', durationHours: '7 - 9' }));
    expect(fields.avgTempC).toBe(-3);
    expect(fields.durationHours).toBe('7–9');
    expect(fieldsOf(filledDraft({ durationHours: '5' })).durationHours).toBe('5');
  });

  it('texty oreže o medzery na krajoch', () => {
    const fields = fieldsOf(filledDraft({ region: '  Graubünden  ' }));
    expect(fields.region).toBe('Graubünden');
  });
});

describe('chyby pri poliach', () => {
  it('prázdny formulár nahlási každé povinné pole po slovensky', () => {
    const errors = errorsOf(emptyRouteDraft());
    expect(errors).toMatchObject({
      name: 'Vyplň.',
      country: 'Vyber jednu z možností.',
      difficulty: 'Vyber jednu z možností.',
      curviness: 'Vyplň.',
      region: 'Vyplň.',
      avgTempC: 'Vyplň.',
      'title.sk': 'Vyplň.',
      'title.fr': 'Vyplň.',
      'highlights.0.de': 'Vyplň.',
      weatherKey: 'Vyber bod, pre ktorý sa ukáže počasie.',
    });
    expect(errors.durationHours).toContain('7–9');
  });

  it('text len z medzier je prázdny text', () => {
    const draft = filledDraft();
    expect(errorsOf({ ...draft, summary: { ...draft.summary, fr: '   ' } })).toEqual({
      'summary.fr': 'Vyplň.',
    });
  });

  it('cenu pustí len celú a v rozsahu, ktorý prijme databáza', () => {
    expect(errorsOf(filledDraft({ priceChf: '9,5' })).priceChf).toBe('Zadaj celé číslo.');
    expect(errorsOf(filledDraft({ priceChf: '0' })).priceChf).toBe('Najmenej 1.');
    expect(errorsOf(filledDraft({ priceChf: '900' })).priceChf).toBe('Najviac 500.');
    expect(errorsOf(filledDraft({ priceChf: 'deväť' })).priceChf).toBe('Zadaj číslo.');
  });

  it('teplotu mimo rozumného rozsahu berie ako preklep', () => {
    expect(errorsOf(filledDraft({ avgTempC: '80' })).avgTempC).toBe('Najviac 35.');
  });

  it('trvanie musí byť počet hodín', () => {
    expect(errorsOf(filledDraft({ durationHours: 'celý deň' })).durationHours).toContain('7–9');
  });

  it('názov bez písmen a číslic nahlási, lebo z neho nevznikne adresa', () => {
    expect(errorsOf(filledDraft({ name: '· · ·' })).name).toContain('adresa');
  });

  it('dlhý text nahlási s limitom', () => {
    expect(errorsOf(filledDraft({ title: both('x'.repeat(81)) }))['title.sk']).toBe('Najviac 80 znakov.');
  });

  it('zaujímavostí musí byť aspoň jedna a nie viac než sa oplatí čítať', () => {
    expect(errorsOf(filledDraft({ highlights: [] })).highlights).toBe('Pridaj aspoň 1.');
    const many = Array.from({ length: MAX_HIGHLIGHTS + 1 }, () => both('Vyhliadka'));
    expect(errorsOf(filledDraft({ highlights: many })).highlights).toBe(`Najviac ${MAX_HIGHLIGHTS}.`);
  });

  it('bod na počasie, ktorý po výmene súborov v trase nie je, nahlási', () => {
    const errors = errorsOf(filledDraft({ weatherKey: '47.1,8.1' }));
    expect(errors).toEqual({ weatherKey: 'Vyber bod, pre ktorý sa ukáže počasie.' });
  });

  it('bez nahratej trasy nahlási trasu, nie len polia', () => {
    const errors = errorsOf(filledDraft(), null);
    expect(errors[GEOMETRY_ERROR]).toContain('nahraj trasu');
  });

  it('trasu bez výšiek zastaví — stúpanie 0 m by v katalógu klamalo', () => {
    const flat = geometryOf(gpx(furkaTrack(), { withEle: false }))!;
    expect(flat.ascentM).toBeNull();
    const draft = filledDraft({ weatherKey: flat.weatherOptions[0].key });
    expect(errorsOf(draft, flat)[GEOMETRY_ERROR]).toContain('výšky');
  });

  it('podvrhnutý vstup (nie objekt formulára) nezhodí server, len vráti chyby', () => {
    for (const junk of [null, 'text', 42, [], { name: 7 }]) {
      expect(checkDraft(junk, geometry).ok).toBe(false);
    }
  });
});

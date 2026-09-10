import { describe, expect, it } from 'vitest';

import { computeStats, ELEVATION_THRESHOLD_M, validate } from './analyze';
import { haversineM, rdp, simplifyToCount } from './geo';
import { buildRoutePackage, MAPS_POINTS_PER_SEGMENT, MAX_NAVIGATION_POINTS } from './index';
import { parseCsv, parseGpx, parseKml } from './parse';
import { detectSwissGrid, swissToWgs84 } from './swiss-coords';
import type { TrackPoint } from './types';

/**
 * Testy jadra nástroja na výrobu trás.
 *
 * Každý test chráni jednu konkrétnu vec, ktorá by sa inak pokazila ticho —
 * kód by prešiel, nič by nespadlo, len by trasa u zákazníka nefungovala.
 */

// --- pomocníci na výrobu testovacích súborov ---------------------------------

/** Stopa po Furke: husté body na krivke, s výškami. Pripomína export zo Swisstopo. */
function furkaTrack(points = 400): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    out.push({
      lat: 46.5725 + 0.06 * t + 0.01 * Math.sin(t * 20),
      lng: 8.4147 - 0.2 * t + 0.01 * Math.cos(t * 20),
      ele: 1500 + 900 * Math.sin(t * Math.PI),
    });
  }
  return out;
}

function gpxWithTrack(track: TrackPoint[], extra = ''): string {
  const pts = track
    .map((p) => `<trkpt lat="${p.lat}" lon="${p.lng}"><ele>${p.ele ?? 0}</ele></trkpt>`)
    .join('');
  return `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${extra}<trk><trkseg>${pts}</trkseg></trk></gpx>`;
}

/** Zhruba 200 km cez pol Švajčiarska — aby sa odkazy do Google Maps museli deliť. */
function longTrack(points = 3000): TrackPoint[] {
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    return { lat: 46.2 + 1.2 * t + 0.02 * Math.sin(t * 60), lng: 6.9 + 1.5 * t, ele: 800 };
  });
}

// --- švajčiarske súradnice ----------------------------------------------------

describe('švajčiarska súradnicová sieť', () => {
  // Bern je stred siete. Keby tu vzorec nesedel, nesedel by nikde.
  it('LV95 bod Bern sa prepočíta na správne GPS súradnice', () => {
    const p = swissToWgs84(2_600_000, 1_200_000, 'LV95');
    expect(p.lat).toBeCloseTo(46.95108, 4);
    expect(p.lng).toBeCloseTo(7.43864, 4);
  });

  it('staršia sieť LV03 dá pre ten istý bod rovnaký výsledok', () => {
    const p = swissToWgs84(600_000, 200_000, 'LV03');
    expect(p.lat).toBeCloseTo(46.95108, 4);
    expect(p.lng).toBeCloseTo(7.43864, 4);
  });

  it('rozpozná sieť podľa veľkosti čísel aj pri prehodených stĺpcoch', () => {
    expect(detectSwissGrid(2_650_000, 1_170_000)).toMatchObject({ grid: 'LV95', e: 2_650_000 });
    expect(detectSwissGrid(1_170_000, 2_650_000)).toMatchObject({ grid: 'LV95', e: 2_650_000 });
    expect(detectSwissGrid(46.57, 8.41)).toBeNull(); // GPS stupne nie sú švajčiarska sieť
  });
});

// --- geometria ----------------------------------------------------------------

describe('geometria', () => {
  it('vzdialenosť Bern – Zürich vyjde okolo 95 km', () => {
    const km = haversineM({ lat: 46.948, lng: 7.4474 }, { lat: 47.3769, lng: 8.5417 }) / 1000;
    expect(km).toBeGreaterThan(94);
    expect(km).toBeLessThan(97);
  });

  it('rovnú čiaru zjednoduší na dva body — zákruty tam nie sú', () => {
    const line = Array.from({ length: 100 }, (_, i) => ({ lat: 46 + i * 0.001, lng: 8 }));
    expect(rdp(line, 1)).toHaveLength(2);
  });

  it('zjednodušenie sa zmestí do limitu a nechá prvý aj posledný bod', () => {
    const track = furkaTrack(2000);
    const s = simplifyToCount(track, 50);
    expect(s.length).toBeLessThanOrEqual(50);
    expect(s[0]).toEqual(track[0]);
    expect(s[s.length - 1]).toEqual(track[track.length - 1]);
  });
});

// --- rozbor súborov -----------------------------------------------------------

describe('rozbor GPX', () => {
  it('spojí viac segmentov stopy za sebou — napr. keď sa prerušilo nahrávanie', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="46.1" lon="8.1"/><trkpt lat="46.2" lon="8.2"/></trkseg>
      <trkseg><trkpt lat="46.3" lon="8.3"/></trkseg></trk></gpx>`;
    const r = parseGpx(gpx);
    expect(r.track.map((p) => p.lat)).toEqual([46.1, 46.2, 46.3]);
    expect(r.kinds).toEqual(['trk']);
  });

  // Klasická pasca parsera: jeden bod príde ako objekt, nie ako pole
  it('prečíta aj stopu s jediným bodom', () => {
    const r = parseGpx(`<gpx><trk><trkseg><trkpt lat="46.1" lon="8.1"/></trkseg></trk></gpx>`);
    expect(r.track).toHaveLength(1);
  });

  it('zvládne predponu menného priestoru gpx:', () => {
    const r = parseGpx(
      `<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1"><gpx:trk><gpx:trkseg>` +
        `<gpx:trkpt lat="46.1" lon="8.1"/><gpx:trkpt lat="46.2" lon="8.2"/></gpx:trkseg></gpx:trk></gpx:gpx>`,
    );
    expect(r.track).toHaveLength(2);
  });

  it('názov bodu „123" ostane textom, nezmení sa na číslo', () => {
    const r = parseGpx(`<gpx><wpt lat="46.1" lon="8.1"><name>123</name></wpt></gpx>`);
    expect(r.waypoints[0].name).toBe('123');
  });

  it('súbor len s trasou na prepočítanie použije jej body ako stopu', () => {
    const r = parseGpx(`<gpx><rte><rtept lat="46.1" lon="8.1"/><rtept lat="46.2" lon="8.2"/></rte></gpx>`);
    expect(r.track).toHaveLength(2);
    expect(r.kinds).toEqual(['rte']);
  });

  it('súbor len s bodmi nemá žiadnu stopu', () => {
    const r = parseGpx(`<gpx><wpt lat="46.1" lon="8.1"><name>A</name></wpt><wpt lat="46.2" lon="8.2"><name>B</name></wpt></gpx>`);
    expect(r.track).toHaveLength(0);
    expect(r.waypoints).toHaveLength(2);
    expect(r.kinds).toEqual(['wpt']);
  });
});

describe('rozbor KML', () => {
  // KML píše dĺžku PRED šírkou. Keby sa to prehodilo, Furka skončí v Afrike.
  it('číta súradnice v poradí dĺžka, šírka', () => {
    const kml = `<kml><Document><Placemark><LineString><coordinates>8.4147,46.5725,2436 8.3372,46.5614,1757</coordinates></LineString></Placemark></Document></kml>`;
    const r = parseKml(kml);
    expect(r.track[0]).toEqual({ lat: 46.5725, lng: 8.4147, ele: 2436 });
  });

  it('nájde body aj v ľubovoľne vnorených priečinkoch', () => {
    const kml = `<kml><Document><Folder><Folder><Placemark><name>Vyhliadka</name>
      <Point><coordinates>8.41,46.57</coordinates></Point></Placemark></Folder></Folder></Document></kml>`;
    const r = parseKml(kml);
    expect(r.waypoints).toEqual([{ lat: 46.57, lng: 8.41, name: 'Vyhliadka' }]);
  });
});

describe('rozbor CSV', () => {
  it('bodkočiarka a desatinná čiarka — európsky Excel', () => {
    const r = parseCsv('Lat;Lon;Höhe [m]\n46,5725;8,4147;2436\n46,5614;8,3372;1757');
    expect(r.track[0]).toEqual({ lat: 46.5725, lng: 8.4147, ele: 2436 });
  });

  it('švajčiarske súradnice LV95 prepočíta na GPS', () => {
    const r = parseCsv('Easting,Northing,Altitude\n2600000,1200000,540\n2600100,1200100,545');
    expect(r.swissGrid).toBe('LV95');
    expect(r.track[0].lat).toBeCloseTo(46.95108, 4);
    expect(r.track[0].lng).toBeCloseTo(7.43864, 4);
  });

  it('švajčiarsky oddeľovač tisícov 2\'600\'000', () => {
    const r = parseCsv("E;N\n2'600'000;1'200'000\n2'600'100;1'200'100");
    expect(r.swissGrid).toBe('LV95');
    expect(r.track).toHaveLength(2);
  });

  it('bez hlavičky rozpozná GPS stupne podľa veľkosti', () => {
    const r = parseCsv('46.5725,8.4147\n46.5614,8.3372');
    expect(r.track).toHaveLength(2);
    expect(r.swissGrid).toBeUndefined();
  });

  // Keby sa bodka brala ako oddeľovač tisícov, z 46.57 by bolo 4657
  it('bodkočiarka s desatinnou bodkou — bodka nesmie zmiznúť', () => {
    const r = parseCsv('lat;lon\n46.5725;8.4147\n46.5614;8.3372');
    expect(r.track[0]).toEqual({ lat: 46.5725, lng: 8.4147 });
  });

  it('bez hlavičky nájde švajčiarske súradnice aj za poradovým číslom', () => {
    const r = parseCsv('1,2600000,1200000,540\n2,2600100,1200100,545');
    expect(r.swissGrid).toBe('LV95');
    expect(r.track[0].lat).toBeCloseTo(46.95108, 4);
  });

  it('ignoruje BOM, ktorý pridáva Excel', () => {
    const r = parseCsv('\uFEFFlat,lon\n46.1,8.1\n46.2,8.2');
    expect(r.track).toHaveLength(2);
  });
});

// --- kontrola -----------------------------------------------------------------

describe('kontrola trasy', () => {
  // Toto je hlavný dôvod, prečo nástroj existuje
  it('súbor len s bodmi odmietne a vysvetlí, čo spraviť v Swisstopo', () => {
    const issues = validate({
      track: [],
      waypoints: [{ lat: 46.1, lng: 8.1, name: 'A' }],
      kinds: ['wpt'],
      stats: null,
    });
    expect(issues[0]).toMatchObject({ level: 'error', code: 'only_waypoints' });
    expect(issues[0].message).toContain('Linie zeichnen');
  });

  it('riedku stopu označí — medzi bodmi by boli rovné čiary', () => {
    const sparse = Array.from({ length: 10 }, (_, i) => ({ lat: 46 + i * 0.02, lng: 8 }));
    const issues = validate({ track: sparse, waypoints: [], kinds: ['trk'], stats: computeStats(sparse) });
    expect(issues.map((i) => i.code)).toContain('sparse_track');
  });

  it('prehodenú šírku a dĺžku odhalí — trasa by skončila mimo Európy', () => {
    const swapped = furkaTrack(50).map((p) => ({ lat: p.lng, lng: p.lat }));
    const issues = validate({ track: swapped, waypoints: [], kinds: ['trk'], stats: computeStats(swapped) });
    expect(issues.map((i) => i.code)).toContain('outside_europe');
  });

  it('bod záujmu ďaleko od trasy označí ako možný omyl', () => {
    const track = furkaTrack(100);
    const issues = validate({
      track,
      waypoints: [{ lat: 47.5, lng: 9.5, name: 'Omyl' }],
      kinds: ['trk', 'wpt'],
      stats: computeStats(track),
    });
    expect(issues.map((i) => i.code)).toContain('waypoint_off_track');
  });

  // Bez hysterézie by šum výšky nafúkal prevýšenie na násobky skutočnosti
  it('šum vo výške nenafúkne prevýšenie', () => {
    const noisy: TrackPoint[] = Array.from({ length: 200 }, (_, i) => ({
      lat: 46 + i * 0.0005,
      lng: 8,
      ele: 1000 + i * 0.5 + (i % 2 === 0 ? 1 : -1), // stúpa o 100 m, kolíše o ±1 m
    }));
    const naive = noisy.reduce(
      (sum, p, i) => (i > 0 && p.ele! > noisy[i - 1].ele! ? sum + p.ele! - noisy[i - 1].ele! : sum),
      0,
    );
    const { ascentM } = computeStats(noisy);
    expect(naive).toBeGreaterThan(200); // naivný súčet by tvrdil vyše 200 m
    expect(ascentM).toBeGreaterThan(90);
    expect(ascentM).toBeLessThan(100 + ELEVATION_THRESHOLD_M * 2);
  });

  it('bez výšok vráti prevýšenie ako „nevieme", nie nulu', () => {
    const flat = furkaTrack(50).map(({ lat, lng }) => ({ lat, lng }));
    expect(computeStats(flat).ascentM).toBeNull();
  });
});

// --- celý balíček -------------------------------------------------------------

describe('zloženie balíčka', () => {
  const wpts =
    `<wpt lat="46.5725" lon="8.4147"><name>Belvédère &amp; ľadovec</name></wpt>` +
    `<wpt lat="46.6" lon="8.35"><name>Obed</name></wpt>`;

  it('z dobrého GPX vyrobí všetky súbory aj odkazy', () => {
    const pkg = buildRoutePackage([{ name: 'furka.gpx', content: gpxWithTrack(furkaTrack(), wpts) }], {
      name: 'Furka',
    });
    expect(pkg.ok).toBe(true);
    expect(pkg.files?.master).toContain('<trk>');
    expect(pkg.files?.master).toContain('<wpt');
    expect(pkg.files?.poi).toContain('<wpt');
    expect(pkg.mapsLinks.length).toBeGreaterThan(0);
  });

  it('v hlavnom súbore sú body pred stopou — Garmin BaseCamp to vyžaduje', () => {
    const pkg = buildRoutePackage([{ name: 'f.gpx', content: gpxWithTrack(furkaTrack(), wpts) }], { name: 'F' });
    const master = pkg.files!.master;
    expect(master.indexOf('<wpt')).toBeLessThan(master.indexOf('<trk>'));
  });

  it('navigovaná verzia sa zmestí pod limit starších Garminov', () => {
    const pkg = buildRoutePackage([{ name: 'f.gpx', content: gpxWithTrack(furkaTrack(3000)) }], { name: 'F' });
    const count = (pkg.files!.navigation.match(/<rtept/g) ?? []).length;
    expect(count).toBeLessThanOrEqual(MAX_NAVIGATION_POINTS);
    expect(count).toBeGreaterThan(10);
  });

  it('dlhú trasu rozdelí do Google Maps na úseky, ktoré na seba nadväzujú', () => {
    const pkg = buildRoutePackage([{ name: 'long.gpx', content: gpxWithTrack(longTrack()) }], { name: 'L' });
    expect(pkg.mapsLinks.length).toBeGreaterThan(1);
    for (const link of pkg.mapsLinks) expect(link.points).toBeLessThanOrEqual(MAPS_POINTS_PER_SEGMENT);

    const dest = (u: string) => new URL(u).searchParams.get('destination');
    const orig = (u: string) => new URL(u).searchParams.get('origin');
    for (let i = 1; i < pkg.mapsLinks.length; i++) {
      expect(orig(pkg.mapsLinks[i].url)).toBe(dest(pkg.mapsLinks[i - 1].url));
    }
  });

  it('znaky ako & v názvoch sa v GPX správne ošetria', () => {
    const pkg = buildRoutePackage([{ name: 'f.gpx', content: gpxWithTrack(furkaTrack(), wpts) }], { name: 'A & B' });
    expect(pkg.files!.master).toContain('A &amp; B');
    expect(pkg.files!.master).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it('súbor len s bodmi balíček nevyrobí', () => {
    const pkg = buildRoutePackage([{ name: 'body.gpx', content: `<gpx>${wpts}</gpx>` }], { name: 'X' });
    expect(pkg.ok).toBe(false);
    expect(pkg.files).toBeNull();
    expect(pkg.issues[0].code).toBe('only_waypoints');
  });

  it('zlúči stopu z jedného súboru a body z druhého — krok z gpx.studio', () => {
    const pkg = buildRoutePackage(
      [
        { name: 'stopa.gpx', content: gpxWithTrack(furkaTrack()) },
        { name: 'body.gpx', content: `<gpx>${wpts}</gpx>` },
      ],
      { name: 'Furka' },
    );
    expect(pkg.ok).toBe(true);
    expect(pkg.waypoints).toHaveLength(2);
  });

  it('pokazený súbor nahlási, ale ostatné spracuje', () => {
    const pkg = buildRoutePackage(
      [
        { name: 'zly.gpx', content: '<gpx><nedokoncene' },
        { name: 'dobry.gpx', content: gpxWithTrack(furkaTrack()) },
      ],
      { name: 'F' },
    );
    expect(pkg.issues.map((i) => i.code)).toContain('unreadable_file');
    expect(pkg.track.length).toBeGreaterThan(0);
  });

  // Najdôležitejší test: čo zapíšeme, to musí ísť prečítať späť bez straty
  it('hlavný súbor sa dá prečítať späť a vyjde tá istá trasa', () => {
    const track = furkaTrack(500);
    const pkg = buildRoutePackage([{ name: 'f.gpx', content: gpxWithTrack(track, wpts) }], { name: 'F' });
    const back = parseGpx(pkg.files!.master);

    expect(back.track).toHaveLength(track.length);
    expect(back.waypoints).toHaveLength(2);
    expect(back.waypoints[0].name).toBe('Belvédère & ľadovec');
    for (let i = 0; i < track.length; i += 50) {
      expect(back.track[i].lat).toBeCloseTo(track[i].lat, 6);
      expect(back.track[i].lng).toBeCloseTo(track[i].lng, 6);
    }
  });
});

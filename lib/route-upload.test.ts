import { describe, expect, it } from 'vitest';

import { signToken } from './signed-token';
import {
  createUploadTicket,
  MAX_SOURCE_FILES,
  packageFileNames,
  sourcePath,
  verifyUploadTicket,
} from './route-upload';

/**
 * Lístok medzi rezerváciou nahratia a uložením trasy. Chráni hlavne to,
 * že upratovanie po neúspešnom uložení nezmaže súbory inej trasy.
 */

const SECRET = 'x'.repeat(40);
const ID = '0f8e2c1a-6b3d-4e5f-9a7b-1c2d3e4f5a6b';
const NOW = Date.UTC(2026, 8, 28, 12);
const B = 'k1';

describe('cesta k zdrojovému exportu', () => {
  it('očísluje súbory v poradí a meno prevedie na bezpečný tvar', () => {
    expect(sourcePath(ID, B, 0, 'Furka Export (2).GPX')).toBe(`${ID}/source/k1-01-furka-export-2.gpx`);
    expect(sourcePath(ID, B, 1, 'Grimsel Körper.kml')).toBe(`${ID}/source/k1-02-grimsel-korper.kml`);
  });

  it('pokus o ../ alebo lomku v mene ostane v priečinku trasy', () => {
    expect(sourcePath(ID, B, 0, '../../r001/furka-track.gpx')).toBe(`${ID}/source/k1-01-r001-furka-track.gpx`);
    expect(sourcePath(ID, B, 0, '.gpx')).toBe(`${ID}/source/k1-01-export.gpx`);
  });

  it('dávka odlíši nový export od starého, zlá dávka neprejde', () => {
    expect(sourcePath('r001', 'k2', 0, 'furka.gpx')).toBe('r001/source/k2-01-furka.gpx');
    expect(sourcePath(ID, '../x', 0, 'furka.gpx')).toBeNull();
  });

  it('iné formáty odmietne', () => {
    expect(sourcePath(ID, B, 0, 'trasa.kmz')).toBeNull();
    expect(sourcePath(ID, B, 0, 'trasa.gpx.exe')).toBeNull();
    expect(sourcePath(ID, B, 0, 'trasa')).toBeNull();
  });

  it('súbory balíčka majú rovnaké mená ako pri ukážkových trasách', () => {
    expect(packageFileNames('furka')).toEqual({
      track: 'furka-track.gpx',
      navigation: 'furka-navigation.gpx',
      poi: 'furka-poi.gpx',
    });
  });

  it('pri výmene neprepíše súbory, ktoré trasa práve používa — mená sa striedajú', () => {
    const first = packageFileNames('furka');
    const second = packageFileNames('furka', Object.values(first));
    expect(second.track).toBe('furka-track-2.gpx');
    expect(Object.values(second).some((n) => Object.values(first).includes(n))).toBe(false);
    expect(packageFileNames('furka', Object.values(second))).toEqual(first);
    // Po premenovaní skrytej trasy nová adresa s ničím nekoliduje
    expect(packageFileNames('grimsel', Object.values(first)).track).toBe('grimsel-track.gpx');
  });
});

describe('lístok na nahratie', () => {
  const sources = [`${ID}/source/k1-01-furka.gpx`];

  it('platný lístok vráti ID a cesty v rovnakom poradí', () => {
    const ticket = createUploadTicket({ kind: 'new', routeId: ID, sources }, SECRET, NOW);
    expect(verifyUploadTicket(ticket, SECRET, NOW + 60_000)).toEqual({ kind: 'new', routeId: ID, sources });
  });

  it('po 30 minútach neplatí', () => {
    const ticket = createUploadTicket({ kind: 'new', routeId: ID, sources }, SECRET, NOW);
    expect(verifyUploadTicket(ticket, SECRET, NOW + 31 * 60_000)).toBeNull();
  });

  it('s cudzím kľúčom alebo upravený neplatí', () => {
    const ticket = createUploadTicket({ kind: 'new', routeId: ID, sources }, SECRET, NOW);
    expect(verifyUploadTicket(ticket, 'y'.repeat(40), NOW)).toBeNull();
    const [, signature] = ticket.split('.');
    const forged = Buffer.from(JSON.stringify({ use: 'route-upload', kind: 'new', routeId: 'r001', sources, exp: NOW + 1e6 })).toString('base64url');
    expect(verifyUploadTicket(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it('neprijme ID existujúcej trasy, ani keby bol podpis pravý', () => {
    // Dôvod lístka: pri chybe sa maže priečinok trasy — r001 zmazať nesmie
    const ticket = signToken({ use: 'route-upload', kind: 'new', routeId: 'r001', sources: ['r001/source/k1-01-a.gpx'], exp: NOW + 1e6 }, SECRET);
    expect(verifyUploadTicket(ticket, SECRET, NOW)).toBeNull();
  });

  it('neprijme cesty mimo priečinka source/ tejto trasy', () => {
    for (const bad of [[`${ID}/furka-track.gpx`], [`r001/source/k1-01-a.gpx`], [`${ID}/source/../../r001/a.gpx`], []]) {
      const ticket = signToken({ use: 'route-upload', kind: 'new', routeId: ID, sources: bad, exp: NOW + 1e6 }, SECRET);
      expect(verifyUploadTicket(ticket, SECRET, NOW)).toBeNull();
    }
  });

  it('lístok na výmenu súborov prijme ID existujúcej trasy, nový nie', () => {
    const src = ['r001/source/k1-01-a.gpx'];
    const replace = createUploadTicket({ kind: 'replace', routeId: 'r001', sources: src }, SECRET, NOW);
    expect(verifyUploadTicket(replace, SECRET, NOW)).toEqual({ kind: 'replace', routeId: 'r001', sources: src });
    const noKind = signToken({ use: 'route-upload', routeId: ID, sources, exp: NOW + 1e6 }, SECRET);
    expect(verifyUploadTicket(noKind, SECRET, NOW)).toBeNull();
    const badId = signToken({ use: 'route-upload', kind: 'replace', routeId: '../r001', sources: ['../r001/source/a.gpx'], exp: NOW + 1e6 }, SECRET);
    expect(verifyUploadTicket(badId, SECRET, NOW)).toBeNull();
  });

  it('prihlasovacia cookie (ten istý kľúč) nie je lístok', () => {
    const session = signToken({ exp: NOW + 1e6, pv: 'abc' }, SECRET);
    expect(verifyUploadTicket(session, SECRET, NOW)).toBeNull();
  });

  it('priveľa súborov alebo nie-text odmietne', () => {
    const many = Array.from({ length: MAX_SOURCE_FILES + 1 }, (_, i) => `${ID}/source/${i}.gpx`);
    const ticket = signToken({ use: 'route-upload', kind: 'new', routeId: ID, sources: many, exp: NOW + 1e6 }, SECRET);
    expect(verifyUploadTicket(ticket, SECRET, NOW)).toBeNull();
    expect(verifyUploadTicket(undefined, SECRET, NOW)).toBeNull();
    expect(verifyUploadTicket({ routeId: ID }, SECRET, NOW)).toBeNull();
  });
});

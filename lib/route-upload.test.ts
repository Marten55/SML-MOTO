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

describe('cesta k zdrojovému exportu', () => {
  it('očísluje súbory v poradí a meno prevedie na bezpečný tvar', () => {
    expect(sourcePath(ID, 0, 'Furka Export (2).GPX')).toBe(`${ID}/source/01-furka-export-2.gpx`);
    expect(sourcePath(ID, 1, 'Grimsel Körper.kml')).toBe(`${ID}/source/02-grimsel-korper.kml`);
  });

  it('pokus o ../ alebo lomku v mene ostane v priečinku trasy', () => {
    expect(sourcePath(ID, 0, '../../r001/furka-track.gpx')).toBe(`${ID}/source/01-r001-furka-track.gpx`);
    expect(sourcePath(ID, 0, '.gpx')).toBe(`${ID}/source/01-export.gpx`);
  });

  it('iné formáty odmietne', () => {
    expect(sourcePath(ID, 0, 'trasa.kmz')).toBeNull();
    expect(sourcePath(ID, 0, 'trasa.gpx.exe')).toBeNull();
    expect(sourcePath(ID, 0, 'trasa')).toBeNull();
  });

  it('súbory balíčka majú rovnaké mená ako pri ukážkových trasách', () => {
    expect(packageFileNames('furka')).toEqual({
      track: 'furka-track.gpx',
      navigation: 'furka-navigation.gpx',
      poi: 'furka-poi.gpx',
    });
  });
});

describe('lístok na nahratie', () => {
  const sources = [`${ID}/source/01-furka.gpx`];

  it('platný lístok vráti ID a cesty v rovnakom poradí', () => {
    const ticket = createUploadTicket({ routeId: ID, sources }, SECRET, NOW);
    expect(verifyUploadTicket(ticket, SECRET, NOW + 60_000)).toEqual({ routeId: ID, sources });
  });

  it('po 30 minútach neplatí', () => {
    const ticket = createUploadTicket({ routeId: ID, sources }, SECRET, NOW);
    expect(verifyUploadTicket(ticket, SECRET, NOW + 31 * 60_000)).toBeNull();
  });

  it('s cudzím kľúčom alebo upravený neplatí', () => {
    const ticket = createUploadTicket({ routeId: ID, sources }, SECRET, NOW);
    expect(verifyUploadTicket(ticket, 'y'.repeat(40), NOW)).toBeNull();
    const [, signature] = ticket.split('.');
    const forged = Buffer.from(JSON.stringify({ use: 'route-upload', routeId: 'r001', sources, exp: NOW + 1e6 })).toString('base64url');
    expect(verifyUploadTicket(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it('neprijme ID existujúcej trasy, ani keby bol podpis pravý', () => {
    // Dôvod lístka: pri chybe sa maže priečinok trasy — r001 zmazať nesmie
    const ticket = signToken({ use: 'route-upload', routeId: 'r001', sources: ['r001/source/01-a.gpx'], exp: NOW + 1e6 }, SECRET);
    expect(verifyUploadTicket(ticket, SECRET, NOW)).toBeNull();
  });

  it('neprijme cesty mimo priečinka source/ tejto trasy', () => {
    for (const bad of [[`${ID}/furka-track.gpx`], [`r001/source/01-a.gpx`], [`${ID}/source/../../r001/a.gpx`], []]) {
      const ticket = signToken({ use: 'route-upload', routeId: ID, sources: bad, exp: NOW + 1e6 }, SECRET);
      expect(verifyUploadTicket(ticket, SECRET, NOW)).toBeNull();
    }
  });

  it('prihlasovacia cookie (ten istý kľúč) nie je lístok', () => {
    const session = signToken({ exp: NOW + 1e6, pv: 'abc' }, SECRET);
    expect(verifyUploadTicket(session, SECRET, NOW)).toBeNull();
  });

  it('priveľa súborov alebo nie-text odmietne', () => {
    const many = Array.from({ length: MAX_SOURCE_FILES + 1 }, (_, i) => `${ID}/source/${i}.gpx`);
    const ticket = signToken({ use: 'route-upload', routeId: ID, sources: many, exp: NOW + 1e6 }, SECRET);
    expect(verifyUploadTicket(ticket, SECRET, NOW)).toBeNull();
    expect(verifyUploadTicket(undefined, SECRET, NOW)).toBeNull();
    expect(verifyUploadTicket({ routeId: ID }, SECRET, NOW)).toBeNull();
  });
});

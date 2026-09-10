import { computeStats, validate } from './analyze';
import { mergeParsed, parseFile } from './parse';
import type { InputFile, Issue, ParsedFile, RoutePackage } from './types';
import { buildMapsLinks, writeMasterGpx, writeNavigationGpx, writePoiGpx } from './write';

export type * from './types';
export { MAX_NAVIGATION_POINTS, MAPS_POINTS_PER_SEGMENT } from './write';

/**
 * Z exportu zo Swisstopo poskladá celý predajný balíček.
 *
 * Jeden alebo viac súborov (GPX, KML, CSV) → rozbor → zlúčenie → kontrola →
 * súbory a odkazy. Ak kontrola nájde chybu, balíček sa nevyrobí a vráti sa
 * len zoznam problémov — nemá zmysel skladať súbory, ktoré sa nesmú predať.
 */
export function buildRoutePackage(files: InputFile[], opts: { name: string; desc?: string }): RoutePackage {
  const parsed: ParsedFile[] = [];
  const parseIssues: Issue[] = [];

  for (const file of files) {
    try {
      parsed.push(parseFile(file));
    } catch (error) {
      // Jeden pokazený súbor nemá zhodiť ostatné — nahlásime ho a ideme ďalej
      parseIssues.push({
        level: 'error',
        code: 'unreadable_file',
        message: `Súbor ${file.name} sa nepodarilo prečítať: ${error instanceof Error ? error.message : 'neznáma chyba'}`,
      });
    }
  }

  const merged = mergeParsed(parsed);
  const stats = merged.track.length >= 2 ? computeStats(merged.track) : null;
  const duplicateIssues = merged.duplicates.map(
    (d): Issue => ({
      level: 'info',
      code: 'duplicate_track',
      message: `Súbor ${d.fileName} obsahuje tú istú trasu ako ${d.keptFileName} — použil som len ${d.keptFileName}.`,
    }),
  );
  const issues = [...parseIssues, ...validate({ ...merged, stats }), ...duplicateIssues];
  const ok = !issues.some((i) => i.level === 'error');

  if (!ok || !stats) {
    return { ok: false, track: merged.track, waypoints: merged.waypoints, stats, issues, files: null, mapsLinks: [] };
  }

  return {
    ok: true,
    track: merged.track,
    waypoints: merged.waypoints,
    stats,
    issues,
    files: {
      master: writeMasterGpx({ name: opts.name, desc: opts.desc, track: merged.track, waypoints: merged.waypoints }),
      navigation: writeNavigationGpx({ name: opts.name, track: merged.track }),
      poi: writePoiGpx({ name: opts.name, waypoints: merged.waypoints }),
    },
    mapsLinks: buildMapsLinks(merged.track, stats.distanceKm),
  };
}

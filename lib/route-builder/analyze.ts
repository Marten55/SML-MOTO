import { bboxOf, centerOf, distanceToTrackM, haversineM } from './geo';
import type { Issue, RouteStats, SourceKind, SwissGrid, TrackPoint, Waypoint } from './types';

/**
 * Štatistiky a kontrola trasy.
 *
 * Hlášky sú písané pre Miroslava, nie pre programátora: čo je zle a čo s tým
 * spraviť v Swisstopo. Chyba zastaví zverejnenie, upozornenie nie.
 */

/**
 * Prevýšenie sa počíta s hysteréziou. Výšky z GPS aj z modelu terénu mierne
 * kolíšu, a keby sme sčítali každé stúpnutie o pol metra, na rovinke by
 * nabehli stovky „nastúpaných" metrov. Stúpanie sa započíta, až keď sa
 * výška od posledného bodu zmení aspoň o prah.
 */
export const ELEVATION_THRESHOLD_M = 3;

/** Bodov s výškou musí byť väčšina, inak prevýšenie radšej neuvádzame. */
const MIN_ELEVATION_SHARE = 0.8;

export const LIMITS = {
  /** Priemerná vzdialenosť bodov, nad ktorou je stopa podozrivo riedka. */
  sparseMeanSpacingM: 500,
  /** Skok medzi dvoma bodmi, ktorý naznačuje prerušenie alebo zlé poradie súborov. */
  gapM: 2000,
  minDistanceKm: 1,
  maxDistanceKm: 1500,
  /** Bod záujmu ďalej od trasy je pravdepodobne omyl. */
  waypointOffTrackM: 1000,
};

// Hrubé ohraničenie Európy — na odhalenie prehodenej šírky a dĺžky
const EUROPE = { minLat: 34, maxLat: 72, minLng: -25, maxLng: 45 };

export function computeStats(track: TrackPoint[]): RouteStats {
  let distance = 0;
  let maxGap = 0;
  for (let i = 1; i < track.length; i++) {
    const d = haversineM(track[i - 1], track[i]);
    distance += d;
    if (d > maxGap) maxGap = d;
  }

  const withEle = track.filter((p) => p.ele !== undefined);
  const hasElevation = track.length > 0 && withEle.length / track.length >= MIN_ELEVATION_SHARE;

  let ascent: number | null = null;
  let descent: number | null = null;
  let minEle: number | null = null;
  let maxEle: number | null = null;

  if (hasElevation) {
    ascent = 0;
    descent = 0;
    let ref = withEle[0].ele!;
    minEle = ref;
    maxEle = ref;
    for (const p of withEle) {
      const e = p.ele!;
      if (e < minEle) minEle = e;
      if (e > maxEle) maxEle = e;
      const diff = e - ref;
      if (diff >= ELEVATION_THRESHOLD_M) {
        ascent += diff;
        ref = e;
      } else if (diff <= -ELEVATION_THRESHOLD_M) {
        descent += -diff;
        ref = e;
      }
    }
    ascent = Math.round(ascent);
    descent = Math.round(descent);
    minEle = Math.round(minEle);
    maxEle = Math.round(maxEle);
  }

  return {
    pointCount: track.length,
    distanceKm: Math.round((distance / 1000) * 10) / 10,
    ascentM: ascent,
    descentM: descent,
    minEleM: minEle,
    maxEleM: maxEle,
    meanSpacingM: track.length > 1 ? Math.round(distance / (track.length - 1)) : 0,
    maxGapM: Math.round(maxGap),
    bbox: bboxOf(track),
    center: centerOf(track),
  };
}

export function validate(input: {
  track: TrackPoint[];
  waypoints: Waypoint[];
  kinds: SourceKind[];
  swissGrid?: SwissGrid;
  stats: RouteStats | null;
}): Issue[] {
  const { track, waypoints, kinds, swissGrid, stats } = input;
  const issues: Issue[] = [];

  // --- chyby: toto sa zverejniť nesmie ---

  if (track.length === 0 && waypoints.length > 0) {
    issues.push({
      level: 'error',
      code: 'only_waypoints',
      message:
        'Súbor obsahuje len body (špendlíky), nie súvislú čiaru. Navigácia ich nevie spojiť do trasy. ' +
        'V Swisstopo nakresli trasu nástrojom na čiaru (Linie zeichnen), nie značkami, a exportuj ju znova.',
    });
    return issues;
  }

  if (track.length === 0) {
    issues.push({
      level: 'error',
      code: 'empty',
      message: 'V súbore sa nenašla žiadna trasa ani body. Skontroluj, či je to správny export.',
    });
    return issues;
  }

  if (track.length < 2) {
    issues.push({
      level: 'error',
      code: 'too_short_track',
      message: 'Trasa má len jeden bod. Na čiaru sú potrebné aspoň dva.',
    });
    return issues;
  }

  // --- upozornenia: dá sa zverejniť, ale treba sa pozrieť ---

  if (kinds.includes('rte') && !kinds.includes('trk')) {
    issues.push({
      level: 'warning',
      code: 'route_not_track',
      message:
        'Súbor obsahuje trasu na prepočítanie, nie stopu. Použil som jej body ako stopu, ' +
        'ale ak je bodov málo, medzi nimi budú rovné čiary. Ideálne exportuj zo Swisstopo stopu.',
    });
  }

  if (stats && stats.meanSpacingM > LIMITS.sparseMeanSpacingM) {
    issues.push({
      level: 'warning',
      code: 'sparse_track',
      message:
        `Body stopy sú od seba v priemere ${stats.meanSpacingM} m. Medzi nimi bude navigácia ` +
        'kresliť rovné čiary a v zákrutách to nebude sedieť na ceste. Pridaj v Swisstopo viac bodov.',
    });
  }

  if (stats && stats.maxGapM > LIMITS.gapM) {
    issues.push({
      level: 'warning',
      code: 'gap_in_track',
      message:
        `V stope je skok ${(stats.maxGapM / 1000).toFixed(1)} km medzi dvoma bodmi. ` +
        'Buď sa prerušilo nahrávanie, alebo sú súbory nahraté v zlom poradí.',
    });
  }

  if (stats && stats.distanceKm < LIMITS.minDistanceKm) {
    issues.push({
      level: 'warning',
      code: 'very_short',
      message: `Trasa má len ${stats.distanceKm} km. Je to celý export?`,
    });
  }

  if (stats && stats.distanceKm > LIMITS.maxDistanceKm) {
    issues.push({
      level: 'warning',
      code: 'very_long',
      message: `Trasa má ${stats.distanceKm} km. Nie sú v nej omylom spojené dve rôzne trasy?`,
    });
  }

  const outside = track.filter(
    (p) =>
      p.lat < EUROPE.minLat || p.lat > EUROPE.maxLat || p.lng < EUROPE.minLng || p.lng > EUROPE.maxLng,
  );
  if (outside.length > track.length * 0.5) {
    issues.push({
      level: 'warning',
      code: 'outside_europe',
      message:
        'Väčšina bodov leží mimo Európy. Najčastejšie to znamená, že sú prehodené ' +
        'zemepisná šírka a dĺžka.',
    });
  }

  const offTrack = waypoints.filter((w) => distanceToTrackM(w, track) > LIMITS.waypointOffTrackM);
  if (offTrack.length > 0) {
    issues.push({
      level: 'warning',
      code: 'waypoint_off_track',
      message:
        `${offTrack.length === 1 ? 'Bod' : 'Body'} ${offTrack.map((w) => `„${w.name}"`).join(', ')} ` +
        `${offTrack.length === 1 ? 'leží' : 'ležia'} viac ako ${LIMITS.waypointOffTrackM / 1000} km od trasy. Nie je to omyl?`,
    });
  }

  // --- informácie ---

  if (swissGrid) {
    issues.push({
      level: 'info',
      code: 'swiss_grid_converted',
      message: `Súradnice boli vo švajčiarskej sieti ${swissGrid} a prepočítali sa na GPS súradnice.`,
    });
  }

  if (stats && stats.ascentM === null) {
    issues.push({
      level: 'info',
      code: 'no_elevation',
      message: 'Súbor nemá výšky, preto nevieme spočítať prevýšenie.',
    });
  }

  if (waypoints.length === 0) {
    issues.push({
      level: 'info',
      code: 'no_waypoints',
      message:
        'Trasa nemá žiadne body záujmu. Pri Silver to nevadí, pri Gold sú vyhliadky a zastávky súčasťou hodnoty.',
    });
  }

  return issues;
}

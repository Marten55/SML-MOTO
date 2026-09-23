import { describe, expect, it } from 'vitest';

import { routeFilePath } from './route-file-path';

describe('cesta k súboru trasy v úložisku', () => {
  it('zloží ID trasy a meno súboru', () => {
    expect(routeFilePath('r001', 'example-furka-grimsel-susten-track.gpx')).toBe(
      'r001/example-furka-grimsel-susten-track.gpx',
    );
  });

  it('odmietne pokus dostať sa mimo priečinka trasy', () => {
    expect(routeFilePath('r001', '../r002/furka-track.gpx')).toBeNull();
    expect(routeFilePath('r001', 'furka..gpx')).toBeNull();
    expect(routeFilePath('..', 'furka-track.gpx')).toBeNull();
    expect(routeFilePath('r001/..', 'furka-track.gpx')).toBeNull();
  });

  it('odmietne lomky, skryté súbory a prázdne hodnoty', () => {
    expect(routeFilePath('r001', 'sub/furka-track.gpx')).toBeNull();
    expect(routeFilePath('r001', 'sub\\furka-track.gpx')).toBeNull();
    expect(routeFilePath('r001', '.env')).toBeNull();
    expect(routeFilePath('r001', '')).toBeNull();
    expect(routeFilePath('', 'furka-track.gpx')).toBeNull();
  });
});

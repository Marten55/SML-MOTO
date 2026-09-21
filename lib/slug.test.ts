import { describe, expect, it } from 'vitest';

import { routeSchema } from './route-schema';
import { slugify } from './slug';

describe('slugify', () => {
  it('spraví z názvu trasy adresu', () => {
    expect(slugify('Furka · Grimsel · Susten')).toBe('furka-grimsel-susten');
    expect(slugify('Col de la Bonette')).toBe('col-de-la-bonette');
  });

  it('odstráni diakritiku zo všetkých štyroch jazykov', () => {
    expect(slugify('Žltý kôň úpel ďábelské ódy')).toBe('zlty-kon-upel-dabelske-ody');
    expect(slugify('Passhöhe Grüningen')).toBe('passhohe-gruningen');
    expect(slugify('Col du Galibier — télégraphe')).toBe('col-du-galibier-telegraphe');
    expect(slugify('Große Scheidegg')).toBe('grosse-scheidegg');
  });

  it('nenechá pomlčky na krajoch ani zdvojené', () => {
    expect(slugify('  -- Stelvio!!  (2757 m) -- ')).toBe('stelvio-2757-m');
  });

  it('výsledok vždy prejde kontrolou slugu v databáze', () => {
    const route = routeSchema.shape.slug;
    for (const name of ['Furka · Grimsel', 'Žltý kôň', 'Passhöhe 2 436 m', 'a']) {
      expect(route.safeParse(slugify(name)).success).toBe(true);
    }
  });

  it('prázdny alebo nepoužiteľný názov dá prázdny reťazec', () => {
    expect(slugify('')).toBe('');
    expect(slugify('·—·')).toBe('');
  });
});

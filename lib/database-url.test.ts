import { describe, expect, it } from 'vitest';

import { databaseUrlProblem } from './database-url';

// Tvar adresy, ktorú dáva Neon → Connect (vymyslené údaje)
const GOOD = 'postgresql://sml_owner:abc123@ep-cool-name-a1b2c3-pooler.eu-central-1.aws.neon.tech/sml?sslmode=require';

describe('DATABASE_URL', () => {
  it('prijme adresu z Neonu, aj s predponou postgres://', () => {
    expect(databaseUrlProblem(GOOD)).toBeNull();
    expect(databaseUrlProblem(GOOD.replace('postgresql://', 'postgres://'))).toBeNull();
  });

  it('chytí časté chyby pri kopírovaní', () => {
    const cases: [string, string][] = [
      [`"${GOOD}"`, 'úvodzovky'],
      [`${GOOD} `, 'medzeru'],
      [`DATABASE_URL=${GOOD}`, 'postgresql://'],
      ['https://console.neon.tech/app/projects/cool-name', 'postgresql://'],
      [GOOD.replace(':abc123', ''), 'heslo'],
      ['postgresql://sml_owner:abc123@ep-cool-name.neon.tech', 'databázy'],
    ];
    for (const [url, hint] of cases) {
      expect(databaseUrlProblem(url)).toContain(hint);
    }
  });

  it('prázdna adresa má vlastnú hlášku', () => {
    expect(databaseUrlProblem(undefined)).toContain('nie je nastavený');
    expect(databaseUrlProblem('')).toContain('nie je nastavený');
  });
});

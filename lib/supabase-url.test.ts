import { describe, expect, it } from 'vitest';

import { supabaseUrlProblem } from './supabase-url';

const ID = 'abcdefghijklmnopqrst';

describe('adresa projektu Supabase', () => {
  it('prijme správnu adresu, aj s lomkou na konci', () => {
    expect(supabaseUrlProblem(`https://${ID}.supabase.co`)).toBeNull();
    expect(supabaseUrlProblem(`https://${ID}.supabase.co/`)).toBeNull();
  });

  it('chytí preklep .com namiesto .co — presne ten z 21. 9. 2026', () => {
    expect(supabaseUrlProblem(`https://${ID}.supabase.com`)).toContain('.supabase.com');
  });

  it('chytí ďalšie časté chyby pri kopírovaní', () => {
    const cases: [string, string][] = [
      [`"https://${ID}.supabase.co"`, 'úvodzovky'],
      [`https://${ID}.supabase.co `, 'medzeru'],
      [`${ID}.supabase.co`, 'https://'],
      [`https://${ID}.supabase.co/rest/v1`, 'cesta'],
      [`NEXT_PUBLIC_SUPABASE_URL=https://${ID}.supabase.co`, 'https://'],
    ];
    for (const [url, hint] of cases) {
      expect(supabaseUrlProblem(url)).toContain(hint);
    }
  });

  it('prázdna adresa má vlastnú hlášku', () => {
    expect(supabaseUrlProblem(undefined)).toContain('nie je nastavený');
    expect(supabaseUrlProblem('')).toContain('nie je nastavený');
  });
});

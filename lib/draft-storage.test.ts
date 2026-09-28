import { describe, expect, it } from 'vitest';

import { hasContent, restoreDraft } from './draft-storage';
import { emptyRouteDraft, MAX_HIGHLIGHTS } from './route-draft';

/**
 * Obnova rozpísaného konceptu z localStorage. To, čo si prehliadač pamätá,
 * mohla zapísať staršia verzia formulára alebo to môže byť rozbité —
 * formulár na tom nesmie spadnúť.
 */

const stored = (draft: unknown, savedAt: unknown = 1) => JSON.stringify({ savedAt, draft });
const both = (t: string) => ({ sk: t, de: t, en: t, fr: t });

describe('obnova konceptu', () => {
  it('uložený koncept vráti tak, ako bol', () => {
    const draft = { ...emptyRouteDraft(), name: 'Furka', title: both('Furka'), highlights: [both('a'), both('b')] };
    expect(restoreDraft(stored(draft, 123))).toEqual({ savedAt: 123, draft });
  });

  it('pole, ktoré v starej verzii chýbalo, dostane predvolenú hodnotu', () => {
    const old: Record<string, unknown> = { ...emptyRouteDraft(), name: 'Furka' };
    delete old.region;
    expect(restoreDraft(stored(old))?.draft).toEqual({ ...emptyRouteDraft(), name: 'Furka' });
  });

  it('zlý typ alebo neznáme pole ignoruje', () => {
    const restored = restoreDraft(stored({ name: 42, passable: 'áno', title: { sk: 'len sk' }, hack: '<script>' }));
    expect(restored?.draft).toEqual(emptyRouteDraft());
  });

  it('zaujímavosti: rozbité zahodí, priveľa oreže', () => {
    expect(restoreDraft(stored({ highlights: [] }))?.draft.highlights).toEqual(emptyRouteDraft().highlights);
    expect(restoreDraft(stored({ highlights: [{ sk: 1 }] }))?.draft.highlights).toEqual(emptyRouteDraft().highlights);
    const many = Array.from({ length: MAX_HIGHLIGHTS + 3 }, (_, i) => both(String(i)));
    expect(restoreDraft(stored({ highlights: many }))?.draft.highlights).toHaveLength(MAX_HIGHLIGHTS);
  });

  it('nič, rozbitý JSON alebo cudzí obsah → null, formulár začne prázdny', () => {
    for (const raw of [null, '', '{', 'null', '[]', '"text"', stored('x'), stored({}, 'včera')]) {
      expect(restoreDraft(raw)).toBeNull();
    }
  });

  it('prázdny formulár sa neukladá — po návrate by strašil hláškou o obnove', () => {
    expect(hasContent(emptyRouteDraft())).toBe(false);
    expect(hasContent({ ...emptyRouteDraft(), region: 'Uri' })).toBe(true);
  });
});

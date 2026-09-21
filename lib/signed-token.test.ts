import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { signToken, verifyToken } from './signed-token';

const SECRET = 'testovaci-kluc-ktory-je-dost-dlhy-na-podpis';

/**
 * Presná kópia pôvodného algoritmu z lib/access.ts pred presunom sem.
 * Ak tento test spadne, prestali by fungovať odkazy v e-mailoch zákazníkov.
 */
function legacyAccessToken(payload: object, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(data).digest().toString('base64url');
  return `${data}.${signature}`;
}

describe('signToken / verifyToken', () => {
  it('vráti pôvodný obsah', () => {
    const payload = { routeId: 'r001', ref: 'cs_test_1', issuedAt: 1_700_000_000_000 };
    expect(verifyToken(signToken(payload, SECRET), SECRET)).toEqual(payload);
  });

  it('vyrobí rovnaký token ako pôvodný lib/access.ts — odkazy v e-mailoch platia ďalej', () => {
    const payload = { routeId: 'r001', ref: 'cs_live_abc', issuedAt: 1_757_000_000_000 };
    const old = legacyAccessToken(payload, SECRET);

    expect(signToken(payload, SECRET)).toBe(old);
    expect(verifyToken(old, SECRET)).toEqual(payload);
  });

  it('odmietne upravený obsah', () => {
    const [, signature] = signToken({ routeId: 'r001' }, SECRET).split('.');
    const forged = Buffer.from(JSON.stringify({ routeId: 'r009' })).toString('base64url');
    expect(verifyToken(`${forged}.${signature}`, SECRET)).toBeNull();
  });

  it('odmietne token podpísaný iným kľúčom', () => {
    expect(verifyToken(signToken({ a: 1 }, 'iny-kluc'), SECRET)).toBeNull();
  });

  it('nespadne na poškodenom vstupe', () => {
    for (const bad of ['', 'abc', 'a.b.c', '.', 'x.', '.y', '%%%.%%%']) {
      expect(verifyToken(bad, SECRET)).toBeNull();
    }
  });
});

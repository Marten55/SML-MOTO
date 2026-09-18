import { describe, expect, it } from 'vitest';

import routesJson from '../data/routes.json';
import { routeSchema, rowToRoute, routeToRow, type RouteRow } from './route-schema';

const routes = (routesJson as unknown[]).map((r) => routeSchema.parse(r));

describe('schéma trasy', () => {
  it('prejdú ňou všetky trasy z data/routes.json — seed do databázy nezlyhá', () => {
    for (const raw of routesJson as unknown[]) {
      expect(routeSchema.safeParse(raw).success).toBe(true);
    }
  });

  it('odmietne cenu, ktorá by sa nedala predať', () => {
    const route = { ...(routesJson as object[])[0] };
    for (const priceChf of [0, -9, 9.5, '9', 1000]) {
      expect(routeSchema.safeParse({ ...route, priceChf }).success).toBe(false);
    }
  });

  it('odmietne text, ktorému chýba jazyk', () => {
    const route = (routesJson as { title: object }[])[0];
    const title = { ...route.title, fr: undefined };
    expect(routeSchema.safeParse({ ...route, title }).success).toBe(false);
  });
});

describe('prevod medzi trasou a riadkom databázy', () => {
  it('trasa → riadok → trasa nič nestratí', () => {
    routes.forEach((route, i) => {
      const row = routeToRow(route, { published: true, sortOrder: i }) as RouteRow;
      const back = rowToRoute(row);
      expect(back).toEqual({ route: { ...route, isExample: route.isExample ?? false } });
    });
  });

  it('numeric z Postgresu ako text sa prevedie na číslo', () => {
    const row = routeToRow(routes[0], { published: true, sortOrder: 0 }) as RouteRow;
    const back = rowToRoute({ ...row, distance_km: '310.0' });
    expect('route' in back && back.route.distanceKm).toBe(310);
  });

  it('pokazený riadok vráti chybu, nie výnimku — katalóg nespadne', () => {
    const row = routeToRow(routes[0], { published: true, sortOrder: 0 }) as RouteRow;
    const result = rowToRoute({ ...row, title: { de: 'len nemčina' } });
    expect(result).toHaveProperty('error');
    expect('error' in result && result.error).toContain(routes[0].id);
  });
});

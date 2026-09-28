import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getRouteForAdmin } from '@/lib/routes-db';
import { RouteBuilderForm } from '../../nova-trasa/route-builder-form';

export const metadata = { title: 'Úprava trasy · SML administrácia' };

/*
 * Úprava existujúcej trasy (krok D5) — ten istý formulár ako pri novej trase,
 * predvyplnený z databázy. Pravidlá (adresa, výmena súborov) sú v updateRoute
 * v nova-trasa/actions.ts.
 */
export default async function EditRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // getRouteForAdmin() si prihlásenie overí sama — Data Access Layer
  const found = await getRouteForAdmin(id);
  // Aj trasa s pokazenými údajmi v databáze — formulár by ju nevedel predvyplniť
  if (!found) notFound();

  return (
    <>
      <h1 className="font-display text-4xl font-semibold">Úprava trasy</h1>
      <p className="mt-3 max-w-[62ch] text-ink-2">
        {found.route.title.sk} ·{' '}
        <Link href={`/admin/nahlad/${found.route.id}`} className="text-accent hover:underline">
          náhľad
        </Link>
      </p>
      <RouteBuilderForm
        edit={{
          route: found.route,
          published: found.published,
          updatedAt: found.updatedAt ? Date.parse(found.updatedAt) : null,
        }}
      />
    </>
  );
}

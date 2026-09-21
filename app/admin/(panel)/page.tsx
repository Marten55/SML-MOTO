import Link from 'next/link';

import { getRoutesForAdmin } from '@/lib/routes-db';

const dateFormat = new Intl.DateTimeFormat('sk-SK', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Zurich',
});

export default async function AdminHomePage() {
  // getRoutesForAdmin() si prihlásenie overí sama — Data Access Layer
  const routes = await getRoutesForAdmin();
  const published = routes.filter((r) => r.published).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold">Trasy</h1>
        <div className="flex items-center gap-6">
          <p className="font-mono text-sm text-ink-3 tabular-nums">
            {routes.length} spolu · {published} zverejnených
          </p>
          <Link
            href="/admin/nova-trasa"
            className="rounded-sm bg-accent px-5 py-2.5 font-display text-sm font-semibold tracking-wider text-ground uppercase"
          >
            Nová trasa
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-strong text-left font-display text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">
              <th className="py-2 pr-4">Trasa</th>
              <th className="py-2 pr-4">Vrstva</th>
              <th className="py-2 pr-4 text-right">Cena</th>
              <th className="py-2 pr-4">Stav</th>
              <th className="py-2">Upravená</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.id} className="border-b border-line align-top">
                <td className="py-3 pr-4">
                  <span className="block font-medium">{route.title}</span>
                  <span className="block font-mono text-xs text-ink-3">{route.slug}</span>
                  {route.problem && (
                    <span className="mt-1 block text-xs text-crit">
                      Dáta v databáze nesedia, na webe sa trasa nezobrazí.
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 capitalize">{route.tier}</td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums">
                  {route.priceChf} CHF
                </td>
                <td className="py-3 pr-4">
                  {route.published ? (
                    <span className="text-accent">Zverejnená</span>
                  ) : (
                    <span className="text-ink-3">Skrytá</span>
                  )}
                  {route.isExample && (
                    <span className="ml-2 font-mono text-xs text-warn">ukážka</span>
                  )}
                </td>
                <td className="py-3 font-mono text-xs text-ink-3 tabular-nums">
                  {route.updatedAt ? dateFormat.format(new Date(route.updatedAt)) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </>
  );
}

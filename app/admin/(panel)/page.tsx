import Link from 'next/link';

import { getRoutesForAdmin } from '@/lib/routes-db';
import { PublishToggle } from './publish-toggle';

const dateFormat = new Intl.DateTimeFormat('sk-SK', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Zurich',
});

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ ulozena?: string; upravena?: string }>;
}) {
  // getRoutesForAdmin() si prihlásenie overí sama — Data Access Layer
  const routes = await getRoutesForAdmin();
  const published = routes.filter((r) => r.published).length;
  // Po uložení novej trasy. Hláška sa ukáže len pre trasu, ktorá naozaj
  // existuje — nie hocijaký text z adresy
  const { ulozena, upravena } = await searchParams;
  const justSaved = routes.find((r) => r.slug === ulozena);
  const justEdited = routes.find((r) => r.slug === upravena);

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

      {justSaved && (
        <p role="status" className="mt-6 rounded-sm border-l-4 border-accent bg-surface px-5 py-4 text-sm text-ink-2">
          Trasa <strong className="font-medium text-ink">{justSaved.title}</strong> je uložená ako
          skrytá. Zákazníci ju zatiaľ nevidia.
        </p>
      )}
      {justEdited && (
        <p role="status" className="mt-6 rounded-sm border-l-4 border-accent bg-surface px-5 py-4 text-sm text-ink-2">
          Zmeny trasy <strong className="font-medium text-ink">{justEdited.title}</strong> sú uložené.
          {justEdited.published && ' Zákazníci ich vidia hneď.'}
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-strong text-left font-display text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">
              <th className="py-2 pr-4">Trasa</th>
              <th className="py-2 pr-4">Vrstva</th>
              <th className="py-2 pr-4 text-right">Cena</th>
              <th className="py-2 pr-4">Stav</th>
              <th className="py-2 pr-4">Predaj</th>
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
                  {!route.problem && (
                    <>
                      <Link
                        href={`/admin/upravit/${route.id}`}
                        className="mt-1 mr-3 inline-block text-xs text-ink-3 hover:text-accent"
                      >
                        Upraviť
                      </Link>
                      <Link
                        href={`/admin/nahlad/${route.id}`}
                        className="mt-1 mr-3 inline-block text-xs text-ink-3 hover:text-accent"
                      >
                        Náhľad
                      </Link>
                    </>
                  )}
                  {route.published && (
                    // Katalóg je v nemčine (hlavný trh), slovenčina je pre Miroslava
                    <a
                      href={`/sk/trasy/${route.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-ink-3 hover:text-accent"
                    >
                      Na webe ↗
                    </a>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <PublishToggle id={route.id} published={route.published} title={route.title} />
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

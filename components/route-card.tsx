import Link from 'next/link';

import type { Dictionary, Locale } from '@/lib/i18n';
import type { Route } from '@/lib/routes';
import { PovPreview } from './pov-preview';

export function RouteCard({
  route,
  lang,
  dict,
  eager = false,
}: {
  route: Route;
  lang: Locale;
  dict: Dictionary;
  /** Karta je pri otvorení stránky hneď viditeľná — obrázok načítať bez čakania. */
  eager?: boolean;
}) {
  return (
    <Link
      href={`/${lang}/trasy/${route.slug}`}
      data-pov-trigger
      // Karta sa pod kurzorom zdvihne nad susedov. Zväčšenie nemení rozloženie
      // mriežky, takže nič neposkočí. hover: v Tailwinde 4 platí len na
      // zariadeniach s myšou, na mobile sa karta nezväčšuje.
      // Pozor: scale-* v Tailwinde 4 zapisuje CSS vlastnosť `scale`, nie
      // `transform` — preto je v zozname prechodov `scale`, inak by karta skočila.
      className="group relative flex flex-col overflow-hidden rounded-sm border border-line bg-surface transition-[scale,box-shadow,border-color] duration-300 ease-out hover:z-10 hover:border-line-strong hover:shadow-[0_24px_48px_-16px_rgb(0_0_0/0.45)] motion-safe:hover:scale-[1.04]"
    >
      {route.assets.previewVideo ? (
        <PovPreview
          src={route.assets.previewVideo}
          poster={route.assets.poster}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          eager={eager}
          className="aspect-video border-b border-line"
        />
      ) : (
        // Kým video nedorazí, miesto drží pomer strán, aby karta neposkakovala
        <div className="flex aspect-video items-center justify-center border-b border-line bg-surface-2">
          <span className="font-mono text-xs text-ink-3">POV</span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <span
            className="font-display text-xs font-bold tracking-[0.16em] uppercase"
            style={{ color: `var(--${route.tier})` }}
          >
            {dict.tiers[route.tier].name}
          </span>
          {route.isExample && (
            <span className="rounded-sm bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-ink-3">
              {dict.common.example}
            </span>
          )}
        </div>

        <h3 className="mt-2 font-display text-xl leading-tight font-semibold group-hover:text-accent">
          {route.title[lang]}
        </h3>

        <p className="mt-1 text-sm text-ink-3">
          {route.region}
          {!route.passable && (
            <span className="text-crit"> · {dict.status.closed}</span>
          )}
        </p>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink-3 tabular-nums">
          <div className="flex gap-1.5">
            <dt>{dict.route.length}</dt>
            <dd className="text-ink-2">{route.distanceKm} km</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>{dict.route.ascent}</dt>
            <dd className="text-ink-2">{route.ascentM} m</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>{dict.route.curviness}</dt>
            <dd className="text-ink-2">{'▲'.repeat(route.curviness)}</dd>
          </div>
        </dl>

        <p className="mt-auto pt-5 font-mono text-lg tabular-nums">
          {route.priceChf} CHF
        </p>
      </div>
    </Link>
  );
}

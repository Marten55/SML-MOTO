'use client';

import Link from 'next/link';

import { useConsent } from './cookie-consent';
import { HeroVideo } from './hero-video';

/**
 * Hero zo starého webu: video na pozadí a cez neho jediná veta.
 * Kým nie je súhlas s cookies, video sa nenačíta a ostáva tmavé pozadie —
 * stránka je aj tak čitateľná a nič nepreskakuje.
 */
export function Hero({
  lang,
  labels,
}: {
  lang: string;
  labels: { tagline: string; browse: string; plan: string };
}) {
  const consent = useConsent();

  return (
    <section className="relative mb-16 h-[68vh] min-h-[420px] overflow-hidden bg-[#0f1613]">
      <HeroVideo consent={consent === 'granted'} />

      {/* Bez prekrytia by biele písmo na svetlých záberoch zmizlo */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/30 to-black/70" />

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-[16ch] font-display text-5xl leading-[0.95] font-bold text-balance text-white md:text-7xl">
          {labels.tagline}
        </h1>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${lang}/trasy`}
            className="rounded-sm bg-accent px-6 py-3 font-display text-sm font-semibold tracking-wider text-ground uppercase"
          >
            {labels.browse}
          </Link>
          <Link
            href={`/${lang}/planovac`}
            className="rounded-sm border border-white/50 px-6 py-3 font-display text-sm font-semibold tracking-wider text-white uppercase hover:border-white"
          >
            {labels.plan}
          </Link>
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getGuide } from '@/content/guide';
import { getDictionary, isLocale, locales } from '@/lib/i18n';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const guide = getGuide(lang);
  return { title: guide.title, description: guide.lede };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const g = getGuide(lang);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-display text-xs font-semibold tracking-[0.22em] text-accent uppercase">
        {dict.nav.guide}
      </p>
      <h1 className="mt-3 max-w-[22ch] font-display text-4xl leading-[1.04] font-semibold text-balance md:text-5xl">
        {g.title}
      </h1>
      <p className="mt-5 max-w-[62ch] text-lg text-ink-2">{g.lede}</p>

      {/* --- kroky v mobile --- */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">{g.phoneHeading}</h2>
        <p className="mt-2 text-ink-2">{g.phoneIntro}</p>

        <ol className="mt-8 flex flex-col gap-px rounded-sm border border-line bg-line">
          {g.steps.map((step, i) => (
            <li key={step.title} className="grid grid-cols-[54px_1fr] gap-4 bg-surface p-5">
              <span className="font-mono text-sm text-accent tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 text-ink-2">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* --- prečo dva súbory --- */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">{g.filesHeading}</h2>
        <p className="mt-2 max-w-[62ch] text-ink-2">{g.filesIntro}</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {[
            { title: g.trackTitle, body: g.trackBody },
            { title: g.navTitle, body: g.navBody },
            { title: g.poiTitle, body: g.poiBody },
          ].map((card) => (
            <div key={card.title} className="border-t-2 border-accent pt-4">
              <h3 className="font-display text-lg font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm text-ink-2">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- navigácie --- */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">{g.devicesHeading}</h2>
        <p className="mt-2 max-w-[62ch] text-ink-2">{g.devicesIntro}</p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr>
                {[g.devicesCols.device, g.devicesCols.how, g.devicesCols.voice].map((h) => (
                  <th
                    key={h}
                    className="border-b border-line-strong pr-5 pb-2 text-left font-display text-xs font-semibold tracking-[0.13em] text-ink-3 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.devices.map((row) => (
                <tr key={row.device}>
                  <td className="border-b border-line py-3 pr-5 align-top font-medium">
                    {row.device}
                  </td>
                  <td className="border-b border-line py-3 pr-5 align-top text-ink-2">
                    {row.how}
                  </td>
                  <td className="border-b border-line py-3 align-top text-ink-2">{row.voice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- nastavenie prístroja --- */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">{g.settingsHeading}</h2>
        <p className="mt-2 max-w-[62ch] text-ink-2">{g.settingsBody}</p>
        <ul className="mt-5 flex flex-col gap-3">
          {g.settingsList.map((item) => (
            <li key={item} className="grid grid-cols-[18px_1fr] gap-2 text-ink-2">
              <span className="font-mono text-accent">+</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* --- disclaimer ako férová dohoda, nie drobné písmo v pätičke --- */}
      <section className="mt-16 rounded-sm border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">{g.disclaimerHeading}</h2>
        <p className="mt-2 max-w-[62ch] text-sm text-ink-2">{g.disclaimerBody}</p>
      </section>
    </div>
  );
}

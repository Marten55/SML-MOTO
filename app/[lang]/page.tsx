import Image from "next/image";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { Hero } from "@/components/hero";
import { RouteCard } from "@/components/route-card";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getAllRoutes } from "@/lib/routes";

// Leaflet siaha na window, takže sa mapa nesmie renderovať na serveri
const RouteMap = dynamic(() =>
  import("@/components/route-map").then((m) => m.RouteMap),
);

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const routes = getAllRoutes();

  return (
    <>
      {/* Hero ide cez celú šírku okna, ako na starom webe — preto je mimo
          kontajnera, ktorý drží zvyšok obsahu v čitateľnej šírke. */}
      <Hero
        lang={lang}
        labels={{
          tagline: dict.brand.tagline,
          browse: dict.home.browse,
          plan: dict.home.planFree,
        }}
      />

      <div className="mx-auto max-w-6xl px-6">
        {/* Intro zo starého webu — „Objavuj trasy / Každá cesta má svoj príbeh" */}
        <section className="grid items-center gap-10 border-b border-line pb-16 md:grid-cols-2">
          <div>
            <p className="font-display text-xs font-semibold tracking-[0.22em] text-accent uppercase">
              {dict.intro.label}
            </p>
            <h2 className="mt-3 max-w-[16ch] font-display text-4xl leading-[1.02] font-semibold text-balance md:text-5xl">
              {dict.intro.head}
            </h2>
            <p className="mt-5 max-w-[52ch] text-lg text-ink-2">
              {dict.intro.body}
            </p>
          </div>

          <div className="flex aspect-[4/3] items-center justify-center rounded-sm border border-line bg-surface-2">
            <span className="font-mono text-xs text-ink-3">
              {dict.common.example}
            </span>
          </div>
        </section>

        <section className="grid gap-px border-b border-line bg-line py-px md:grid-cols-3">
          {(["bronze", "silver", "gold"] as const).map((tier) => (
            <div key={tier} className="bg-ground px-6 py-8">
              <span
                className="font-display text-sm font-bold tracking-[0.19em] uppercase"
                style={{ color: `var(--${tier})` }}
              >
                {dict.tiers[tier].name}
              </span>
              <p className="mt-2 text-sm text-ink-2">
                {dict.tiers[tier].short}
              </p>
            </div>
          ))}
        </section>

        <section className="py-16">
          <h2 className="font-display text-3xl font-semibold">
            {dict.map.heading}
          </h2>
          <p className="mt-2 max-w-[58ch] text-ink-2">{dict.map.lede}</p>

          <div className="mt-8">
            <RouteMap routes={routes} lang={lang} dict={dict} />
          </div>
        </section>

        <section className="border-t border-line py-16">
          <h2 className="font-display text-3xl font-semibold">
            {dict.nav.routes}
          </h2>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => (
              <RouteCard key={route.id} route={route} lang={lang} dict={dict} />
            ))}
          </div>
        </section>

        {/* „O mne" zo starého webu */}
        <section
          id="omne"
          className="grid items-center gap-10 border-t border-line py-16 md:grid-cols-[280px_minmax(0,1fr)]"
        >
          <div className="flex aspect-square items-center justify-center rounded-sm border border-line bg-surface-2">
            <Image
              src="/logo.png"
              alt="SML"
              width={180}
              height={180}
              className="opacity-90"
            />
          </div>

          <div>
            <h2 className="font-display text-3xl font-semibold">
              {dict.about.title}
            </h2>
            <p className="mt-2 font-display text-xl text-accent">
              {dict.about.tagline}
            </p>
            <p className="mt-5 max-w-[58ch] text-lg text-ink-2">
              {dict.about.body}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

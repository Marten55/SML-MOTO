import type { Metadata } from 'next';
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { getDictionary, isLocale, locales, localeNames, type Locale } from '@/lib/i18n';
import '../globals.css';

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

/** Všetky štyri jazyky sa predgenerujú pri builde. */
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

  const dict = await getDictionary(lang);

  return {
    title: {
      default: `${dict.brand.name} — ${dict.brand.tagline}`,
      template: `%s · SML`,
    },
    description: dict.home.subtitle,
    // Google potrebuje vedieť, že tie štyri adresy sú tá istá stránka
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <html
      lang={lang}
      className={`${barlowCondensed.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-dvh font-sans antialiased">
        <SiteHeader lang={lang} dict={dict} />
        <main>{children}</main>
        <SiteFooter dict={dict} />
      </body>
    </html>
  );
}

function SiteHeader({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Awaited<ReturnType<typeof getDictionary>>;
}) {
  const links = [
    { href: `/${lang}/trasy`, label: dict.nav.routes },
    { href: `/${lang}/planovac`, label: dict.nav.planner },
    { href: `/${lang}/navod`, label: dict.nav.guide },
  ];

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
        <Link
          href={`/${lang}`}
          className="font-display text-sm font-semibold tracking-[0.2em] text-accent uppercase"
        >
          SML
        </Link>

        <nav className="flex flex-1 flex-wrap gap-6 text-sm text-ink-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-accent">
              {l.label}
            </Link>
          ))}
        </nav>

        <LocaleSwitcher current={lang} />
      </div>
    </header>
  );
}

function LocaleSwitcher({ current }: { current: Locale }) {
  return (
    <div className="flex gap-1 font-mono text-xs">
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}`}
          hrefLang={l}
          title={localeNames[l]}
          aria-current={l === current ? 'true' : undefined}
          className={
            l === current
              ? 'rounded-sm bg-accent-soft px-2 py-1 text-accent'
              : 'rounded-sm px-2 py-1 text-ink-3 hover:text-accent'
          }
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

function SiteFooter({ dict }: { dict: Awaited<ReturnType<typeof getDictionary>> }) {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-8 font-mono text-xs text-ink-3">
        <span>{dict.brand.claim}</span>
        <span>Ride simple. Live free.</span>
      </div>
    </footer>
  );
}

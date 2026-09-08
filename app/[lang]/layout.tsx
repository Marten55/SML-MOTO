import type { Metadata } from 'next';
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { ConsentProvider } from '@/components/cookie-consent';
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
        <ConsentProvider
          labels={{
            text: dict.consent.text,
            accept: dict.consent.accept,
            decline: dict.consent.decline,
            more: dict.consent.more,
            moreHref: `/${lang}/datenschutz`,
          }}
        >
          <SiteHeader lang={lang} dict={dict} />
          <main>{children}</main>
          <SiteFooter lang={lang} dict={dict} />
        </ConsentProvider>
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

/** Sociálne siete zo starého webu. Odkazy zatiaľ nikam nevedú — klient ich dodá. */
const SOCIALS = [
  { label: 'Facebook', glyph: 'f', href: '#' },
  { label: 'Instagram', glyph: '◍', href: '#' },
  { label: 'YouTube', glyph: '▶', href: '#' },
  { label: 'TikTok', glyph: '♫', href: '#' },
  { label: 'E-mail', glyph: '✉', href: 'mailto:info@sml.sk' },
];

function SiteFooter({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Awaited<ReturnType<typeof getDictionary>>;
}) {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12">
        <Image src="/logo.png" alt="SML" width={110} height={110} className="opacity-90" />

        <nav className="flex gap-3" aria-label={dict.footer.contact}>
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              title={s.label}
              aria-label={s.label}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-3 hover:border-accent hover:text-accent"
            >
              <span aria-hidden>{s.glyph}</span>
            </a>
          ))}
        </nav>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-xs text-ink-3">
          <Link href={`/${lang}/impressum`} className="hover:text-accent">
            Impressum
          </Link>
          <Link href={`/${lang}/datenschutz`} className="hover:text-accent">
            {dict.consent.more}
          </Link>
          <Link href={`/${lang}/agb`} className="hover:text-accent">
            AGB
          </Link>
        </div>

        <p className="font-mono text-xs text-ink-3">{dict.brand.claim}</p>

        {/* Easter egg zo starého webu — viditeľný až po označení textu */}
        <p className="font-mono text-xs text-transparent select-all">
          {dict.footer.secret}
        </p>
      </div>
    </footer>
  );
}

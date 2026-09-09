import Link from 'next/link';
import { notFound } from 'next/navigation';

import { downloadUrl, verifyAccessToken, type DownloadKind } from '@/lib/access';
import { accessTokenFor, availableDownloads } from '@/lib/delivery';
import { getDictionary, isLocale, type Dictionary, type Locale } from '@/lib/i18n';
import { getAllRoutes, googleMapsUrl, type Route } from '@/lib/routes';
import { RouteQr } from '@/components/route-qr';
import { getStripe } from '@/lib/stripe';

/** Závisí od parametrov v adrese a od Stripe — nedá sa predgenerovať. */
export const dynamic = 'force-dynamic';

export default async function UnlockedPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ session_id?: string; token?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { session_id: sessionId, token: tokenParam } = await searchParams;
  const dict = await getDictionary(lang);

  const resolved = await resolveAccess({ sessionId, tokenParam });

  if (!resolved) {
    return <AccessProblem lang={lang} dict={dict} />;
  }

  const { route, token } = resolved;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl font-semibold md:text-5xl">
        {dict.delivery.title}
      </h1>
      <p className="mt-4 max-w-[58ch] text-lg text-ink-2">{dict.delivery.subtitle}</p>

      <p className="mt-10 font-display text-2xl font-semibold">{route.title[lang]}</p>

      <ul className="mt-6 flex flex-col gap-px rounded-sm border border-line bg-line">
        {availableDownloads(route).map((kind) => (
          <li key={kind} className="bg-surface">
            <a
              href={downloadUrl(token, kind)}
              className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2"
            >
              <span>
                <span className="block font-medium group-hover:text-accent">
                  {labelFor(dict, kind)}
                </span>
                <span className="block text-sm text-ink-3">{hintFor(dict, kind)}</span>
              </span>
              <span aria-hidden className="font-mono text-ink-3">
                ↓
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <a
          href={googleMapsUrl(route)}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-sm border border-line px-5 py-4 text-center hover:border-accent hover:text-accent"
        >
          {dict.delivery.maps}
        </a>

        {/* Prenos z obrazovky do mobilu bez prepisovania odkazu */}
        <RouteQr url={googleMapsUrl(route)} label={dict.delivery.qr} />
      </div>

      <Link
        href={`/${lang}/navod`}
        className="mt-8 inline-block font-mono text-sm text-accent hover:underline"
      >
        {dict.delivery.howto} →
      </Link>
    </div>
  );
}

/**
 * Dve cesty sem: hneď po platbe (session_id od Stripe) alebo trvalým odkazom
 * z mailu (token). Obe musia skončiť rovnako.
 */
async function resolveAccess({
  sessionId,
  tokenParam,
}: {
  sessionId?: string;
  tokenParam?: string;
}): Promise<{ route: Route; token: string } | null> {
  if (tokenParam) {
    const payload = verifyAccessToken(tokenParam);
    if (!payload) return null;

    const route = getAllRoutes().find((r) => r.id === payload.routeId);
    return route ? { route, token: tokenParam } : null;
  }

  if (!sessionId) return null;

  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Token sa vydá len proti skutočne zaplatenej platbe
    if (session.payment_status !== 'paid') return null;

    const routeId = session.metadata?.routeId;
    const route = getAllRoutes().find((r) => r.id === routeId);
    if (!route) return null;

    return { route, token: accessTokenFor(route, session.id) };
  } catch (error) {
    console.error('[odomknute] Session sa nepodarilo načítať', error);
    return null;
  }
}

function AccessProblem({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="font-display text-3xl font-semibold">{dict.checkout.error}</h1>
      <Link
        href={`/${lang}/trasy`}
        className="mt-6 inline-block font-mono text-sm text-accent hover:underline"
      >
        ← {dict.route.backToRoutes}
      </Link>
    </div>
  );
}

function labelFor(dict: Dictionary, kind: DownloadKind): string {
  switch (kind) {
    case 'track':
      return dict.delivery.track;
    case 'navigation':
      return dict.delivery.navigation;
    case 'poi':
      return dict.delivery.poi;
    case 'roadbook':
      return dict.delivery.roadbook;
  }
}

function hintFor(dict: Dictionary, kind: DownloadKind): string {
  switch (kind) {
    case 'track':
      return dict.delivery.trackHint;
    case 'navigation':
      return dict.delivery.navigationHint;
    case 'poi':
      return dict.delivery.poiHint;
    case 'roadbook':
      return '';
  }
}

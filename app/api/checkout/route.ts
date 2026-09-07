import { NextResponse } from 'next/server';

import { isLocale } from '@/lib/i18n';
import { getRouteBySlug, isSellable } from '@/lib/routes';
import { CURRENCY, PAYMENT_METHODS, getStripe } from '@/lib/stripe';

export async function POST(request: Request) {
  const stripe = getStripe();

  // Kľúče ešte nie sú — rozhranie na to reaguje vlastnou hláškou, nie chybou
  if (!stripe) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { slug, lang } = (body ?? {}) as { slug?: string; lang?: string };

  if (!slug || !lang || !isLocale(lang)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const route = getRouteBySlug(slug);
  if (!route || !isSellable(route)) {
    return NextResponse.json({ error: 'route_not_found' }, { status: 404 });
  }

  // Cena sa berie zo servera, nikdy z požiadavky — inak by si ju kupujúci prepísal
  const amount = route.priceChf * 100;

  const origin = new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: PAYMENT_METHODS,
      locale: lang,
      // Potrebujeme ho na doručenie trasy aj na neskoršie obnovenie prístupu
      customer_creation: 'always',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: amount,
            product_data: {
              name: route.title[lang],
              description: route.summary[lang].slice(0, 200),
            },
          },
        },
      ],
      metadata: { routeId: route.id, slug: route.slug, lang },
      success_url: `${origin}/${lang}/odomknute?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${lang}/trasy/${route.slug}`,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'no_session_url' }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[checkout] Stripe session failed', error);
    return NextResponse.json({ error: 'stripe_error' }, { status: 502 });
  }
}

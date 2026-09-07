import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { isAccessConfigured } from '@/lib/access';
import { accessTokenFor, sendRouteEmail } from '@/lib/delivery';
import { isLocale } from '@/lib/i18n';
import { getAllRoutes } from '@/lib/routes';
import { getStripe } from '@/lib/stripe';

/**
 * Webhook od Stripe. Beží až po skutočnom zaplatení a jeho jediná úloha je
 * poslať jazdcovi trvalý odkaz na trasu.
 *
 * Podpis sa overuje vždy — bez toho by ktokoľvek mohol poslať falošnú platbu
 * a nechať si vygenerovať prístup zadarmo.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  // Podpis sa počíta z presného tela požiadavky, takže sa číta ako text
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch (error) {
    console.error('[webhook] Neplatný podpis', error);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    // Ostatné udalosti nás nezaujímajú, ale musíme potvrdiť prijatie,
    // inak ich Stripe skúša doručovať znova
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ received: true });
  }

  const routeId = session.metadata?.routeId;
  const lang = session.metadata?.lang;
  const email = session.customer_details?.email;

  if (!routeId || !lang || !isLocale(lang)) {
    console.error('[webhook] Chýbajúce metadata v session', session.id);
    return NextResponse.json({ received: true });
  }

  const route = getAllRoutes().find((r) => r.id === routeId);
  if (!route) {
    console.error(`[webhook] Neznáma trasa ${routeId} v session ${session.id}`);
    return NextResponse.json({ received: true });
  }

  if (!isAccessConfigured()) {
    console.error('[webhook] DOWNLOAD_SIGNING_SECRET chýba — odkaz sa nedá vydať');
    return NextResponse.json({ received: true });
  }

  if (!email) {
    // Jazdec trasu aj tak uvidí na návratovej stránke, len nedostane mail
    console.warn(`[webhook] Session ${session.id} nemá e-mail, mail sa neposiela`);
    return NextResponse.json({ received: true });
  }

  const token = accessTokenFor(route, session.id);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const sent = await sendRouteEmail({ to: email, route, lang, token, baseUrl });
  if (!sent) {
    // Zámerne stále 200: platba prebehla a opakované doručenie webhooku
    // by na neodoslanom maile nič nezmenilo
    console.error(`[webhook] Mail sa nepodarilo odoslať pre session ${session.id}`);
  }

  return NextResponse.json({ received: true });
}

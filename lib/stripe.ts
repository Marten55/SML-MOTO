import 'server-only';
import Stripe from 'stripe';

/**
 * Stripe je voliteľný. Kým klient nemá účet a kľúče, web má bežať normálne —
 * len sa nedá zaplatiť. Preto sa nikde neháda výnimka pri importe, ale vracia
 * sa null a volajúci na to reaguje odpoveďou 503.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  cached ??= new Stripe(key);
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * TWINT nie je samostatná integrácia a nemá vlastný kľúč — je to platobná
 * metóda vnútri Stripe. Musí byť zapnutá v Stripe Dashboarde, inak ju Stripe
 * v Checkoute jednoducho nezobrazí.
 *
 * TWINT funguje len v CHF, takže ceny sú vo frankoch.
 */
export const CURRENCY = 'chf';
export const PAYMENT_METHODS: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [
  'card',
  'twint',
];

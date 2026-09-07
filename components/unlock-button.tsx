'use client';

import { useState } from 'react';

/**
 * Zámerne si neberie celý slovník — ten sa načítava na serveri a nemá čo
 * chodiť do klientskeho balíka. Stačia štyri reťazce.
 */
type CheckoutStrings = {
  checkout: {
    unlock: string;
    processing: string;
    unavailable: string;
    error: string;
  };
};

type Status = 'idle' | 'loading' | 'unavailable' | 'error';

export function UnlockButton({
  slug,
  lang,
  dict,
}: {
  slug: string;
  lang: string;
  dict: CheckoutStrings;
}) {
  const [status, setStatus] = useState<Status>('idle');

  async function startCheckout() {
    setStatus('loading');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, lang }),
      });

      if (res.status === 503) {
        // Stripe ešte nie je nakonfigurovaný — nie je to chyba jazdca
        setStatus('unavailable');
        return;
      }

      if (!res.ok) {
        setStatus('error');
        return;
      }

      const { url } = (await res.json()) as { url?: string };
      if (!url) {
        setStatus('error');
        return;
      }

      window.location.assign(url);
    } catch {
      setStatus('error');
    }
  }

  const disabled = status === 'loading' || status === 'unavailable';

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={startCheckout}
        disabled={disabled}
        className="w-full rounded-sm bg-accent px-6 py-3.5 font-display text-sm font-semibold tracking-wider text-ground uppercase disabled:cursor-not-allowed disabled:opacity-55"
      >
        {status === 'loading' ? dict.checkout.processing : dict.checkout.unlock}
      </button>

      {status === 'unavailable' && (
        <p role="status" className="mt-3 text-center text-sm text-warn">
          {dict.checkout.unavailable}
        </p>
      )}

      {status === 'error' && (
        <p role="alert" className="mt-3 text-center text-sm text-crit">
          {dict.checkout.error}
        </p>
      )}
    </div>
  );
}

'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * Súhlas s cookies. Vo Švajčiarsku ho pýta nDSG a klient naň v poznámkach
 * výslovne upozorňoval.
 *
 * Drží sa zámerne jednoducho: rozhoduje o jedinej veci — či sa smie načítať
 * YouTube v hero sekcii. Mapa beží na OpenStreetMap a nič nesleduje, takže
 * tú nemá zmysel blokovať.
 *
 * Voľba sa ukladá do localStorage, nie do cookie. Bez súhlasu tak web
 * neuloží ani ten jeden záznam, čo by inak bolo trochu absurdné.
 *
 * Číta sa cez useSyncExternalStore, nie cez useEffect — localStorage je
 * externé úložisko a takto sa stav nastaví hneď pri prvom vykreslení
 * v prehliadači, bez preblikávania a bez kaskádových prekreslení.
 */

const STORAGE_KEY = 'sml-consent';

export type Consent = 'granted' | 'denied' | null;

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Zmena v inej karte toho istého webu
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function getSnapshot(): Consent {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : null;
  } catch {
    // Súkromné okno alebo zablokované úložisko — správame sa ako bez súhlasu
    return null;
  }
}

/** Na serveri o voľbe nevieme nič, takže banner vykreslíme až v prehliadači. */
function getServerSnapshot(): Consent {
  return null;
}

function store(value: Exclude<Consent, null>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* voľba potom platí aspoň pre toto načítanie stránky */
  }
  for (const notify of listeners) notify();
}

const ConsentContext = createContext<Consent>(null);

export function useConsent() {
  return useContext(ConsentContext);
}

export function ConsentProvider({
  children,
  labels,
}: {
  children: React.ReactNode;
  labels: { text: string; accept: string; decline: string; more: string; moreHref: string };
}) {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <ConsentContext.Provider value={consent}>
      {children}

      {consent === null && (
        <div
          role="dialog"
          aria-live="polite"
          className="fixed right-4 bottom-4 left-4 z-[2000] rounded-sm border border-line bg-surface p-5 shadow-lg sm:left-auto sm:max-w-[420px]"
        >
          <p className="text-sm text-ink-2">{labels.text}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => store('granted')}
              className="rounded-sm bg-accent px-4 py-2 font-display text-xs font-semibold tracking-wider text-ground uppercase"
            >
              {labels.accept}
            </button>
            <button
              type="button"
              onClick={() => store('denied')}
              className="rounded-sm border border-line px-4 py-2 font-display text-xs font-semibold tracking-wider uppercase hover:border-line-strong"
            >
              {labels.decline}
            </button>
            <a
              href={labels.moreHref}
              className="ml-auto font-mono text-xs text-ink-3 hover:text-accent"
            >
              {labels.more}
            </a>
          </div>
        </div>
      )}
    </ConsentContext.Provider>
  );
}

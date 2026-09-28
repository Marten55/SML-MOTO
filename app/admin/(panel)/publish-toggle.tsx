'use client';

import { useActionState } from 'react';

import { togglePublished, type PublishState } from './actions';

const initial: PublishState = { error: null };

/**
 * Tlačidlo v zozname trás. Obyčajný formulár s Server Action — funguje aj
 * pred načítaním JavaScriptu. useActionState drží chybu zo servera
 * a `pending`, aby druhé kliknutie počas ukladania nič neposlalo.
 */
export function PublishToggle({ id, published, title }: { id: string; published: boolean; title: string }) {
  const [state, action, pending] = useActionState(togglePublished, initial);

  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="published" value={String(!published)} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`${published ? 'Stiahnuť z predaja' : 'Zverejniť'}: ${title}`}
        className={`rounded-sm border px-3 py-1.5 text-xs font-medium disabled:cursor-wait disabled:opacity-60 ${
          published
            ? 'border-line text-ink-2 hover:border-crit hover:text-crit'
            : 'border-accent text-accent hover:bg-accent hover:text-ground'
        }`}
      >
        {pending ? 'Ukladám…' : published ? 'Stiahnuť z predaja' : 'Zverejniť'}
      </button>
      {state.error && (
        <span role="alert" className="max-w-[24ch] text-xs text-crit">
          {state.error}
        </span>
      )}
    </form>
  );
}

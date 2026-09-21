'use client';

import { useActionState } from 'react';

import { login, type LoginState } from '../actions';

const initialState: LoginState = { error: null };

/**
 * Formulár volá Server Action priamo. useActionState drží chybovú hlášku
 * a stav odosielania — bez vlastného fetch a bez API route navyše.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="font-display text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">
          Heslo
        </span>
        <input
          type="password"
          name="password"
          required
          maxLength={200}
          autoComplete="current-password"
          autoFocus
          className="rounded-sm border border-line bg-surface px-4 py-3 text-base focus:border-accent focus:outline-none"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-crit">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-accent px-6 py-3.5 font-display text-sm font-semibold tracking-wider text-ground uppercase disabled:cursor-not-allowed disabled:opacity-55"
      >
        {pending ? 'Overujem…' : 'Prihlásiť sa'}
      </button>
    </form>
  );
}

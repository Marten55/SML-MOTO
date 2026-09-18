import Link from 'next/link';

import { requireAdmin } from '@/lib/admin-session';
import { logout } from '../actions';

/*
 * Skupina (panel) = všetko za prihlásením. Zátvorky znamenajú, že sa názov
 * nepremietne do adresy: (panel)/page.tsx je /admin.
 *
 * Kontrola v layoute NESTAČÍ ako jediná: pri navigácii v rámci administrácie
 * sa layout znova nevykreslí. Preto ju má aj každá stránka a Server Action,
 * väčšinou cez funkcie v lib/routes-db.ts (Data Access Layer).
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between gap-6 border-b border-line pb-4">
        <Link
          href="/admin"
          className="font-display text-sm font-semibold tracking-[0.2em] text-accent uppercase"
        >
          SML · administrácia
        </Link>

        <form action={logout}>
          <button type="submit" className="font-mono text-sm text-ink-3 hover:text-accent">
            Odhlásiť sa
          </button>
        </form>
      </header>

      <main className="py-8">{children}</main>
    </div>
  );
}

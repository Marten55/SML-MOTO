import { redirect } from 'next/navigation';

import { isAdmin } from '@/lib/admin-session';
import { LoginForm } from './login-form';

export default async function AdminLoginPage() {
  // Prihlásený nemá na prihlasovacej stránke čo robiť
  if (await isAdmin()) redirect('/admin');

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-16">
      <p className="font-display text-sm font-semibold tracking-[0.2em] text-accent uppercase">
        SML · administrácia
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Prihlásenie</h1>
      <LoginForm />
    </main>
  );
}

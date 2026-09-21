import { requireAdmin } from '@/lib/admin-session';
import { RouteBuilderForm } from './route-builder-form';

export const metadata = { title: 'Nová trasa · SML administrácia' };

export default async function NewRoutePage() {
  // Layout skupiny (panel) prihlásenie overuje tiež, ale pri navigácii v rámci
  // administrácie sa znova nevykreslí — každá stránka si to overí sama.
  await requireAdmin();

  return (
    <>
      <h1 className="font-display text-4xl font-semibold">Nová trasa</h1>
      <p className="mt-3 max-w-[62ch] text-ink-2">
        Nahraj export zo Swisstopo — GPX, KML alebo CSV, pokojne všetky naraz. Skontrolujem,
        či sa trasa dá predať, a poskladám z nej balíček pre navigácie.
      </p>
      <RouteBuilderForm />
    </>
  );
}

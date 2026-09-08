import type { LegalPage } from '@/content/legal';

/** Spoločné vykreslenie pre Impressum, ochranu údajov aj obchodné podmienky. */
export function LegalPageView({ page }: { page: LegalPage }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl font-semibold md:text-5xl">{page.title}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-2">{page.lede}</p>

      {page.todo && (
        <p className="mt-8 rounded-sm border-l-3 border-warn bg-[color:var(--warn-soft)] px-5 py-4 text-sm text-ink-2">
          {page.todo}
        </p>
      )}

      <div className="mt-12 flex flex-col gap-10">
        {page.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-display text-xl font-semibold">{s.heading}</h2>
            <div className="mt-3 flex flex-col gap-3">
              {s.body.map((p, i) => (
                <p key={i} className="max-w-[64ch] text-ink-2">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

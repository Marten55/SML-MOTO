# Stav práce — nástroj na výrobu trás (administrácia)

Posledná aktualizácia: 23. 9. 2026. Technické pravidlá projektu sú v `AGENTS.md`,
tu je len to, kde práca stojí a čo ju blokuje.

## Kroky

| Krok | Obsah | Stav |
|---|---|---|
| Jadro | rozbor GPX/KML/CSV, kontroly, zloženie balíčka (`lib/route-builder/`) | ✅ v `main` |
| **A** | Supabase, prihlásenie do `/admin`, trasy z databázy | ✅ v `main`, beží na sml.admtechnics.sk (21. 9.) |
| B | obrazovka nahratia a náhľadu trasy (`/admin/nova-trasa`) | ✅ v `main` (21. 9.) |
| D | zverejnenie trasy do katalógu — rozdelené na D1–D5 nižšie | 🟡 D1 hotové |
| C | RoadBook z Word šablóny (`docx-templates`) | ⬜ čaká na `.docx` šablónu od klienta |

Poradie je A → B → D → C: zverejnenie potrebuje databázu z A a RoadBook
čaká na podklad.

## Krok D — rozdelený na časti

Každá časť ide na vlastnú vetvu a dá sa nasadiť sama, bez rozbitia náhľadu.

| Časť | Obsah | Stav |
|---|---|---|
| **D1** | súkromné úložisko súborov, `/api/download` z neho | 🟡 hotové na vetve `feature/admin-d1-uloziste` |
| D2 | formulár s údajmi, ktoré GPX nemá: názov a popis ×4 jazyky, highlights, výbava, Silver/Gold, cena, krajina, obtiažnosť, kľukatosť, sezóna, bod na počasie. Kontrola cez `routeSchema`, zatiaľ bez uloženia | ⬜ |
| D3 | uloženie konceptu: prehliadač nahrá zdroj rovno do úložiska (signed upload URL — Server Action unesie len 1 MB, export má až 25 MB), server rozbor zopakuje, uloží GPX a riadok s `published = false` | ⬜ potrebuje D1, D2 |
| D4 | zverejniť / stiahnuť z predaja v zozname trás + `revalidatePath` pre katalóg, detail **aj úvodnú stránku** (mapa trás) | ⬜ potrebuje D3 |
| D5 | úprava existujúcej trasy tým istým formulárom, výmena súborov | ⬜ potrebuje D3 |

## Krok D1 — čo je hotové

- **Úložisko:** bucket `route-files` v Supabase Storage, súkromný, limit 30 MB
  na súbor. Cesta `<id trasy>/<meno súboru>` (`lib/route-file-path.ts`).
  Vytvára ho `npm run db:subory`, ktorý nahrá aj ukážkové súbory — dá sa
  pustiť opakovane a na tabuľku `routes` nesiaha.
- **Stiahnutie:** `/api/download` po overení tokenu presmeruje (303) na odkaz
  platný 60 s (`lib/route-files.ts`). Súbor nejde cez funkciu Vercelu, takže
  ju neobmedzuje limit 4,5 MB. Bez Supabase (lokálny vývoj) číta z `content/gpx/`.
- **Nasadené v Supabase (23. 9.):** bucket vytvorený, 28 ukážkových súborov nahraných.
- **Overené:** bez kľúča aj s verejným kľúčom sa súbor nedá stiahnuť, podpísať,
  nahrať ani vypísať; secret kľúč áno. Produkčný build: 4 súbory trasy r001
  stiahnuté cez token bajt po bajte zhodné s originálom, pod správnym menom;
  roadbook pri Silver → `file_not_available`, podvrhnutý token → `invalid_token`,
  chýbajúci súbor v úložisku → `file_missing` + záznam v logu.
- **Neoverené:** vypršanie 60 s odkazu (správanie Supabase, nie nášho kódu).

## Krok A — čo je hotové

- **Databáza:** `supabase/migrations/20260918120000_routes_and_admin.sql` —
  tabuľka `routes` (peniaze a filtre ako stĺpce s kontrolou, texty a body
  ako `jsonb`), pravidlá RLS, tabuľka `admin_login_attempts`.
- **Čítanie trás:** `lib/routes-db.ts` (len server), schéma a prevod riadkov
  `lib/route-schema.ts` (zod). Bez Supabase lokálne číta `data/routes.json`.
- **Zaplatené trasy:** `/api/download`, webhook a `/odomknute` čítajú cez
  `getPurchasedRoute()` — trasa stiahnutá z predaja sa kupujúcim dá stiahnuť ďalej.
- **Prihlásenie:** scrypt hash hesla (`npm run admin:heslo`), podpísaná cookie
  na 12 h, limit 5 pokusov z IP / 50 celkovo za 15 min, `requireAdmin()`
  v každej stránke a Server Action, `proxy.ts` ako predbežná kontrola.
  Pokus sa zapisuje **pred** overením hesla — pôvodné poradie pustilo
  12 súbežných pokusov naraz (overené testom, opravené 21. 9.).
- **Obrazovky:** `/admin/login`, `/admin` (zoznam trás), odhlásenie.
- **Upratanie:** `middleware.ts` → `proxy.ts` (Next.js 16), podpis tokenov
  na jednom mieste (`lib/signed-token.ts`) — staré odkazy v e-mailoch platia.
- **Testy:** 63 (z toho 24 nových). Prihlásenie prejdené v prehliadači
  13/13: presmerovanie, zlé a správne heslo, vlastnosti cookie, odhlásenie,
  podvrhnutá cookie, limit pokusov; 12 pokusov naraz → 0 overených.
- **Overené s databázou (21. 9.):** 9 trás naplnených, produkčný build
  (77 stránok), katalóg a detail z databázy, stiahnutie cez token.
  RLS: verejný kľúč nevidí skrytú trasu, nezapíše trasu, nezmení cenu,
  nevidí pokusy o prihlásenie; databáza odmietne cenu 0 aj od admina.

## Krok B — čo je hotové

- **`/admin/nova-trasa`:** výber alebo pretiahnutie GPX/KML/CSV (aj viac naraz,
  rovnaké meno nahradí starší súbor), KMZ odmietne s vysvetlením.
- **Rozbor v prehliadači** — súbor sa nikam neposiela (žiadny limit 4,5 MB
  serverovej funkcie, nič neopustí počítač pred zverejnením). Pri zverejnení
  v kroku D ho server zopakuje sám.
- **Náhľad:** verdikt (dá sa / nedá sa predať), chyby a upozornenia z jadra,
  8 štatistík, mapa so stopou, štartom, cieľom a bodmi záujmu, stiahnutie
  `-master`, `-navigation`, `-poi.gpx`, odkazy do Google Maps po úsekoch.
- **Upratanie:** mapové podklady pre všetky mapy v `lib/map-tiles.ts` —
  pred spustením sa menia na jednom mieste. `lib/slug.ts` pre názvy súborov
  a neskôr adresy trás.
- **Overené v prehliadači 12/12:** dobrá trasa, len body záujmu (nedá sa
  predať, balíček sa neponúkne), len `<rte>` (upozornenie), KMZ, stiahnutý
  GPX obsahuje stopu, body aj názov, žiadne chyby v konzole.
- **Chýba:** skúška na skutočnom exporte zo Swisstopo — čaká na podklady.

## Krok A — nasadenie (hotové 21. 9.)

1. [x] Projekt Supabase na účte ADM, región Frankfurt; `SUPABASE_*` do `.env.local`.
2. [x] Spustiť migráciu (SQL Editor alebo Supabase MCP) a `npm run db:seed`.
3. [x] `npm run admin:heslo` → `ADMIN_*` do `.env.local`.
4. [x] Produkčný build lokálne s databázou (`npm run build`).
5. [x] Na Verceli pridať `SUPABASE_*` a `ADMIN_*` (typ Secret, Production aj Preview).
6. [x] Spojené do `main`, overené naživo: `/admin` → prihlásenie, zlé heslo
   odmietnuté a zapísané do databázy, katalóg a detail z databázy.

**Keď build na Verceli zlyhá** (napr. chýba premenná), doména ďalej ukazuje
poslednú funkčnú verziu — web nespadne, len sa nová verzia nedostane von.

**Pasce z nasadenia (21. 9.):**
- Skutočné hodnoty patria do `.env.local` a do Vercelu, **nikdy** do
  `.env.example` (ten je v gite). GitHub push s kľúčom Supabase odmietol.
- `SUPABASE_URL` končí na `.supabase.co`, nie `.com`. Preklep dával len
  „fetch failed“; odteraz build povie priamo, čo je zle (`lib/supabase-url.ts`).
- `SUPABASE_URL` ukladať na Verceli ako typ **Config** — dá sa skontrolovať.

## Vyskúšanie lokálne

```bash
npm run admin:heslo        # vypíše ADMIN_PASSWORD_HASH a ADMIN_SESSION_SECRET
# oba riadky do .env.local
npm run dev                # http://localhost:3000/admin
```

## Na neskôr (nie je súčasť kroku A)

- Funkcie na Verceli z `iad1` (USA) prepnúť na `fra1` (Frankfurt).
- Testovacie kľúče Stripe, keď má klient vyskúšať kúpu.
- Bezplatný Supabase: projekt sa po týždni bez aktivity uspí a úložisko má 1 GB.
  Plné POV videá (Gold) sa tam nezmestia — rozhodnúť pred prvou Gold trasou.
- Hosting ostrého webu: Vercel Hobby je len na nekomerčné použitie.

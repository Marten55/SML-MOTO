# Stav práce — nástroj na výrobu trás (administrácia)

Posledná aktualizácia: 28. 9. 2026. Technické pravidlá projektu sú v `AGENTS.md`,
tu je len to, kde práca stojí a čo ju blokuje.

## Kroky

| Krok | Obsah | Stav |
|---|---|---|
| Jadro | rozbor GPX/KML/CSV, kontroly, zloženie balíčka (`lib/route-builder/`) | ✅ v `main` |
| **A** | Supabase, prihlásenie do `/admin`, trasy z databázy | ✅ v `main`, beží na sml.admtechnics.sk (21. 9.) |
| B | obrazovka nahratia a náhľadu trasy (`/admin/nova-trasa`) | ✅ v `main` (21. 9.) |
| D | zverejnenie trasy do katalógu — rozdelené na D1–D5 nižšie | 🟡 D1–D4 v `main` + náhľad trasy, ďalej D5 |
| C | RoadBook z Word šablóny (`docx-templates`) | ⬜ čaká na `.docx` šablónu od klienta |

Poradie je A → B → D → C: zverejnenie potrebuje databázu z A a RoadBook
čaká na podklad.

## Krok D — rozdelený na časti

Každá časť ide na vlastnú vetvu a dá sa nasadiť sama, bez rozbitia náhľadu.

| Časť | Obsah | Stav |
|---|---|---|
| **D1** | súkromné úložisko súborov, `/api/download` z neho | ✅ v `main`, nasadené na náhľad (23. 9.) |
| D2 | formulár s údajmi, ktoré GPX nemá: názov a popis ×4 jazyky, highlights, výbava, Silver/Gold, cena, krajina, obtiažnosť, kľukatosť, sezóna, bod na počasie. Kontrola cez `routeSchema`, zatiaľ bez uloženia | ✅ v `main`, nasadené na náhľad (28. 9.) |
| D3 | uloženie hotovej trasy ako skrytej: prehliadač nahrá zdroj rovno do úložiska (signed upload URL — Server Action unesie len 1 MB, export má až 25 MB), server rozbor zopakuje, uloží GPX a riadok s `published = false`. Rozpísaný formulár v `localStorage` | ✅ v `main`, nasadené na náhľad (28. 9.) |
| D4 | zverejniť / stiahnuť z predaja v zozname trás + `revalidatePath` pre katalóg, detail, úvodnú stránku (mapa trás) **aj plánovač** | ✅ v `main`, nasadené na náhľad (28. 9.) |
| D5 | úprava existujúcej trasy tým istým formulárom, výmena súborov | ⬜ potrebuje D3 |

## Krok D4 — čo je hotové

- **Zoznam trás** (`/admin`): stĺpec „Predaj" s tlačidlom Zverejniť /
  Stiahnuť z predaja (`publish-toggle.tsx`, Server Action v
  `app/admin/(panel)/actions.ts`), pri zverejnenej odkaz „Na webe ↗".
- **Zverejniť sa dá len platná trasa** (`setRoutePublished` v
  `lib/routes-db.ts`): riadok musí prejsť `routeSchema` a mať obe GPX.
  Inak by katalóg pokazenú trasu ticho vynechal a v administrácii by
  svietila ako zverejnená.
- **Stiahnutie nič nemaže** — kto trasu kúpil, stiahne si ju ďalej.
- **Obnova webu:** `revalidatePath('/[lang]', 'layout')` — celý verejný web
  naraz (úvod, katalóg, detail, plánovač aj stránky, ktoré pribudnú).
  Zoznam jednotlivých stránok by sa pri novej stránke zabudol doplniť;
  zbytočne prestavané právne stránky nič nestoja.
- **Overené na produkčnom builde (`npm start`), nie v `next dev`** — dev
  stránky nekešuje, takže by skúška nič nedokázala. Dve dočasné skryté
  trasy v Supabase: neúplná → odmietnutá s hláškou; platná → po zverejnení
  hneď na `/sk`, `/sk/trasy`, `/de/trasy`, `/sk/planovac`, detail 200 (hoci
  pri builde neexistoval); po stiahnutí zo všetkých preč, detail 404.
  Konzola bez chýb. Testovacie trasy potom zmazané.
- **Testy:** bez nových — nová logika je len zápis do databázy a
  revalidácia, obe overené naživo. Spolu 116.

**Náhľad trasy (28. 9., vetva `feature/admin-nahlad-trasy`):**
- `/admin/nahlad/<id>?jazyk=de` — ktorákoľvek trasa vrátane skrytej,
  prepínač SK/DE/EN/FR (preklady píše Miroslav ručne, automatický preklad
  zamietnutý 28. 9.). Odkaz „Náhľad" v zozname trás.
- Obsah detailu je jeden komponent `components/route-detail.tsx` pre web
  aj náhľad — náhľad sa nemôže rozísť s tým, čo uvidí zákazník. V náhľade
  je namiesto tlačidla na kúpu poznámka.
- Pod `/admin`, nie `?nahlad` na verejnom detaile: ten je predgenerovaný
  a čítanie cookie by ho spravilo dynamickým pre všetkých; cookie admina
  má aj tak `path=/admin`.
- Overené na produkčnom builde: skrytá trasa verejne 404, náhľad bez
  prihlásenia → login, s prihlásením DE aj FR text, žiadne tlačidlo kúpy,
  verejný detail ďalej s tlačidlom. Konzola bez chýb.
- Rozdiel oproti webu: náhľad je v užšom stĺpci administrácie a bez
  hlavičky webu. Texty, fotky a údaje sú tie isté.

**Na neskôr:**
- **Na Verceli overiť raz naživo** (zverejniť a stiahnuť skúšobnú trasu) —
  lokálne `npm start` má cache na disku, Vercel vlastnú zdieľanú; správanie
  má byť rovnaké, ale overené je len lokálne.

## Krok D3 — čo je hotové

- **Rozhodnutie (28. 9.):** do tabuľky `routes` ide len **hotová** trasa
  (povinné stĺpce, každý riadok prejde `routeSchema`). Rozpísaný formulár
  chráni `localStorage` v prehliadači (`lib/draft-storage.ts`), nie tabuľka
  na polotovary — tá by znamenala druhý tvar tých istých dát pri D5.
  Cena: koncept je len v jednom prehliadači, GPX treba po návrate nahrať znova.
- **Postup** (`lib/route-upload.ts`, akcie v `app/admin/(panel)/nova-trasa/actions.ts`):
  `prepareRouteUpload` overí admina a voľnú adresu, vymyslí ID (UUID)
  a vydá jednorazové adresy na nahratie + **podpísaný lístok** (30 min,
  kľúč `ADMIN_SESSION_SECRET`) → prehliadač nahrá zdroj priamo do Supabase →
  `saveRoute` podľa lístka stiahne zdroj, zopakuje rozbor (`routeFromSources`),
  uloží balíček a riadok ako skrytý.
- **Prečo lístok:** pri chybe sa súbory pokusu mažú. ID a cesty od prehliadača
  by umožnili podstrčiť `r001` a zmazať súbory existujúcej trasy. Lístok
  s ID inej podoby než UUID sa odmietne (test v `lib/route-upload.test.ts`).
- **Úložisko:** zdroj v `<id>/source/01-<meno>.gpx` (zákazník sa k nemu cez
  `/api/download` nedostane, mená s lomkou neprejdú), balíček ako
  `<slug>-track.gpx`, `-navigation`, `-poi` — rovnako ako ukážkové trasy.
- **Overené proti Supabase (28. 9.):** nahratie bez kľúča ide, CORS pustí,
  podpísaná adresa platí len pre svoju cestu a len raz.
- **V prehliadači prejdené:** obsadená adresa → hláška pri „Názov trasy",
  kurzor tam, nič sa nenahralo; odchod na „Trasy" a späť → koncept obnovený
  s hláškou; uloženie → presmerovanie na zoznam s hláškou, koncept zmazaný.
  V databáze `published = false`, 23,9 km / 934 m ako v náhľade, 4 súbory
  v úložisku. Testovacia trasa potom zmazaná. Produkčný build prešiel.
- **Testy:** 116 (21 nových).

**Neoverené / otvorené:**
- **Upratanie po chybe na serveri** (zlý formulár, zlyhaný zápis) je len
  v kóde, v prehliadači sa nedalo vyvolať bez podvrhu.
- **Osirotené súbory:** keď nahratie v prehliadači spadne v polovici alebo
  sa zavrie karta medzi nahratím a uložením, zdroj ostane v úložisku bez
  riadku. Pri desiatkach trás to nevadí; neskôr upratovací skript
  (priečinky bez riadku v `routes` staršie ako deň).
- **25 MB export** neskúšaný — rozbor na serveri beží vo funkcii Vercelu,
  pri veľkom súbore sledovať čas behu.

## Krok D2 — čo je hotové

- **Jadro bez Reactu:** `lib/route-draft.ts`. `routeGeometry()` vytiahne zo
  stopy dĺžku, stúpanie, štart, cieľ, 8 bodov pre Google Maps (RDP) a body
  na počasie. `checkDraft()` skontroluje formulár a vráti chyby podľa polí,
  `assembleRoute()` pridá ID a súbory a pustí to cez `routeSchema` — tú
  v D3 zavolá server.
- **Pravidlá:** čísla a výbery sa berú z `routeSchema.shape`, texty sú
  prísnejšie (nesmú byť prázdne, majú limity). Čítanie z databázy ostáva
  zhovievavé — prázdny preklad by inak vyhodil z katalógu aj zaplatenú trasu.
- **Formulár:** `app/admin/(panel)/nova-trasa/route-details-form.tsx` pod
  náhľadom trasy. Chyby až po prvom „Skontrolovať údaje", potom sa menia pri
  písaní; kurzor skočí na prvé chybné pole. Krajina, obtiažnosť a kľukatosť
  nemajú predvoľbu (sú to filtre katalógu), sezóna áno (VI–X).
- **Trasa bez výšok sa nedá dokončiť** — stúpanie by v katalógu svietilo 0 m.
  Ukážkové GPX v repe výšky nemajú, na skúšku treba súbor s `<ele>`.
- **Testy:** 95 (20 nových). V prehliadači prejdené: prázdny formulár, nahratie
  GPX, bod na počasie (návrh mena vs. vlastné meno), cena pri zmene vrstvy,
  doplnenie názvov, pridanie/odobratie bodu, výmena súboru za verziu bez
  výšok a späť, dlhý text, konzola bez varovaní. Produkčný build prešiel.

Poznámky pre D3 z tohto kroku (serverová kontrola, strata konceptu,
jedinečný slug) sú vyriešené — pozri krok D3 vyššie.

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
- **Naživo na náhľade (23. 9.):** nasadenie prešlo, katalóg beží, `/api/download`
  odmieta zlý token. Celé stiahnutie sa tam overiť nedalo — náhľad má iný
  `DOWNLOAD_SIGNING_SECRET` (zámerne) a Stripe ešte nie je nastavený.
  **Overiť pri prvom testovacom nákupe:** zaplatiť kartou 4242…, na `/odomknute`
  stiahnuť všetky súbory.
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

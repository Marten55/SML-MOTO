<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# SML Moto — čo treba vedieť pred prvým zásahom

Web a e-shop na predaj overených motorkárskych trás po alpských priesmykoch.
Odsúhlasený rozsah a rozhodnutia: [artefakt v3](https://claude.ai/code/artifact/1fd826fe-b2fd-4a13-a4a8-c4900903b51d)

## Tri veci, ktoré sa dajú ľahko pokaziť

**1. Repo je verejný — predávaný obsah sem nesmie.**
Skutočné GPX a roadbooky by si ktokoľvek stiahol priamo z GitHubu a platený
produkt by stratil zmysel. `.gitignore` pustí do `content/gpx/` len súbory
s predponou `example-`. Nikdy to pravidlo neuvoľňuj.

**2. GPX nikdy nepatrí do `public/`.**
Čokoľvek tam leží je dostupné bez overenia. Súbory chodia cez
`/api/download`, ktoré najprv overí podpísaný token.

**3. `index.html` v koreni sa nesmie zmazať.**
Je to starý statický web, ktorý práve beží na GitHub Pages a ktorý klient
ukazuje. Viac nižšie.

## V repe stoja dve veci vedľa seba

Prechodný stav, kým nie je nová aplikácia nasadená:

| Čo | Kde | Beží na |
|---|---|---|
| Starý statický web | `index.html`, `style.css`, `cookies.js`, `Videa/`, `Ikony/`, `vlajky/` | GitHub Pages — [živý](https://marten55.github.io/SML-MOTO/) |
| Nová aplikácia | `app/`, `lib/`, `components/`, `content/`, `data/` | zatiaľ nikde |

Pages servírujú `index.html` z koreňa a o zvyšok sa nestarajú. `.nojekyll`
je tam preto, aby sa Jekyll nepokúšal spracovať zdrojáky a Pages nespadli
na niečom, čo s webom nesúvisí. `.gitattributes` má pravidlo pre Git LFS
na hero videá — bez neho by sa MP4 commitli ako stovky MB do histórie.

Starého webu sa nedotýkaj inak než cez vetvu a PR.

**Keď bude nová aplikácia nasadená:** zmazať `index.html`, `style.css`,
`cookies.js` a mediálne priečinky starého webu, vypnúť Pages.

## Ako to funguje

Bez databázy a bez prihlasovania. Prístup k zaplatenej trase nesie token
podpísaný cez HMAC-SHA256 — nemusí sa nikde ukladať a nedá sa podvrhnúť.
Platí trvalo: trasu si človek kupuje týždne pred dovolenkou a na ceste ju
otvára opakovane, takže expirácia by vyrábala len reklamácie.

Trasy sú v `data/routes.json`, žiadna databáza. Odkaz do Google Maps sa
generuje z tých istých dát. Zoznam zastávok sa orezáva na 8 — Google Maps
URL viac neunesie a odkaz by sa ticho zlomil.

Každá trasa má GPX v dvoch podobách a je to jadro produktu:
**stopa** sa nepočíta, len kreslí (prístroj ju nemá ako skrátiť),
**verzia na navigovanie** je z tvarovacích bodov a z nej vzniká hlasová
navigácia. Vysvetlené pre zákazníka v `content/guide.ts`.

## Cenník

Bronze zadarmo (plánovač, zatiaľ neimplementovaný) · Silver 9 CHF ·
Gold 19 CHF (navyše roadbook a POV videá) · sezónny pas 89 CHF.

Ceny sa berú **vždy zo servera**, nikdy z požiadavky.

## Spustenie

```bash
npm install
cp .env.example .env.local   # doplniť kľúče
npm run dev
```

Bez kľúčov web beží normálne — checkout vráti 503 a rozhranie na to reaguje
hláškou „platby nie sú nastavené". To je zámer, nie chyba.

## Nasadenie

Potrebuje hosting s Node.js. GitHub Pages ani PHP webhosting to nezvládnu:
Stripe webhook, overenie tokenu aj chránené sťahovanie sú serverový kód.

Premenné prostredia sú v `.env.example`. `DOWNLOAD_SIGNING_SECRET`
vygeneruješ cez `openssl rand -hex 32`. Po nasadení pridať v Stripe
Dashboarde webhook na `https://<doména>/api/webhook`, udalosť
`checkout.session.completed`.

**TWINT nemá vlastný API kľúč.** Zapína sa ako platobná metóda priamo
v Stripe Dashboarde. Nehľadaj integráciu, ktorá neexistuje.

### Náhľad pre klienta (staging)

Beží na https://sml.admtechnics.sk (Vercel, DNS záznam CNAME vo Websupporte)
so `SITE_ENV=staging`. To pridá noindex (meta tag v `app/[lang]/layout.tsx`
pre stránky, hlavičku `X-Robots-Tag` v `next.config.ts` pre všetko ostatné)
a pruh „toto nie je ostrý web". Všetko sa rozhoduje pri builde — po zmene
premennej treba nasadiť znova.

- **Do Vercelu nevkladaj celý `.env.example`.** Presne tak vznikol prázdny
  `SITE_ENV` a náhľad bežal bez pruhu aj bez noindexu, hoci premenná
  v zozname stála.
- **Netajné premenné (`SITE_ENV`, `NEXT_PUBLIC_SITE_URL`, `MAIL_FROM`) ukladaj
  vo Verceli ako typ Config.** Typ Secret sa po uložení nedá zobraziť, takže
  chybnú hodnotu neodhalíš inak než z výsledku na webe.
- **Pruh overuj na vykreslenom prvku (`role="note"`), nie na texte.** Text
  pruhu je v slovníku, ktorý ide do prehliadača vždy — nájdeš ho aj vtedy,
  keď pruh na stránke nie je.

- **Zámerne nie `Disallow` v robots.txt.** Google musí stránku načítať,
  aby noindex videl. Zakázaná stránka sa do výsledkov dostane aj tak.
- **Iný `DOWNLOAD_SIGNING_SECRET` než na ostrom webe.** Token vydaný
  na náhľade by inak otváral platené trasy aj na ostrom webe.
- **Stripe len testovacie kľúče** (`sk_test_`). Po platbe sa trasa odomkne
  aj bez webhooku a bez Resend — `/odomknute` si platbu overí cez `session_id`.
- **Bez `OPENROUTESERVICE_KEY` plánovač vráti 503.** Náhľad beží ako
  produkcia, takže demo server OSRM sa nepoužije.

### Na čo pri hostingu pozor

- **Vercel Hobby je len na nekomerčné použitie** — výslovne vrátane webu,
  za ktorý niekto dostal zaplatené
  ([fair use](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)).
  Klientsky projekt patrí na Pro.
- **Git LFS na Verceli nezapínať.** V LFS sú len hero videá starého webu
  (`Videa/`, spolu ~870 MB) a nová aplikácia ich nepoužíva. Každý build by
  ich stiahol a minul bezplatný LFS limit GitHubu (1 GB mesačne).
- **Na serveri sú len ukážkové GPX.** `/api/download` číta z `content/gpx/`
  a do gitu smú len `example-*`. Skutočné trasy potrebujú súkromné
  úložisko — otvorené rozhodnutie, rieši sa pred prvou ostrou trasou.
- Build zbalí `content/gpx/` k funkcii `/api/download` sám (overené
  v `.next/server/app/api/download/route.js.nft.json`). Ak sa zmení, ako
  sa cesta k súboru skladá, treba to overiť znova — inak stiahnutie
  na serveri vráti `file_missing`, hoci lokálne funguje.

## Vetvenie

GitHub Flow. `main` je vždy funkčný, práca ide vo vetvách pomenovaných
podľa fáz z ponuky (`feature/faza-1-web`), spája sa cez PR.

## Dve cudzie služby, ktoré treba pred spustením doriešiť

Obe teraz fungujú bez kľúča a bez registrácie, obe majú licenčný háčik
pre komerčnú prevádzku. V oboch prípadoch je to zmena URL a kľúča,
nie prepisovanie kódu:

| Služba | Kde | Háčik |
|---|---|---|
| **OpenStreetMap dlaždice** | `components/route-map.tsx` | OSM neodporúča komerčnú prevádzku na svojich dlaždiciach. Riešenie: MapTiler, Stadia alebo Thunderforest. |
| **Open-Meteo** | `lib/weather.ts` | Bezplatné pásmo je určené na nekomerčné použitie. Overiť licenciu, prípadne platený plán. |
| **Routing pre plánovač** | `lib/routing.ts` | Bez `OPENROUTESERVICE_KEY` sa vo vývoji použije demo server OSRM, ktorý je podľa podmienok **len na testovanie**. V produkcii bez kľúča vráti 503 — to je zámer, nie chyba. |

## Čo ešte nie je overené

- **Skutočná platba cez TWINT** — čaká na Stripe účet
- **Import GPX do Garmin Zumo XT** — čaká na prístroj

Kým to druhé neprebehne, na predajnej stránke nesmie stáť tvrdenie,
že to na konkrétnom modeli funguje. Formát je otvorený a Garmin ho číta,
ale neoverený sľub na e-shope sa prevalí až u prvého platiaceho zákazníka.

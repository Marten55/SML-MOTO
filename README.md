# SML Moto — Simply Moto Life

Web a e-shop na predaj overených motorkárskych trás po švajčiarskych Alpách.

> „Keine App. Keine Anmeldung. Nur der Pass."

Návrh riešenia a odsúhlasený rozsah: [artefakt v3](https://claude.ai/code/artifact/1fd826fe-b2fd-4a13-a4a8-c4900903b51d)

---

## Čo to je

Jazdec si buď zadarmo vyskladá vlastnú trasu (Bronze), alebo si kúpi hotovú od SML —
ako GPX, ktoré sa v navigácii neprepočíta (Silver), prípadne aj s roadbookom
a POV videami z jednotlivých bodov (Gold). Bez registrácie, platba cez TWINT alebo kartu.

| Vrstva | Cena | Obsah |
|---|---|---|
| Bronze | zadarmo | Vlastná trasa z plánovača → odkaz do Google Maps |
| Silver | 9 CHF | GPX (stopa + verzia na navigovanie) + body záujmu |
| Gold | 19 CHF | Silver + topografia + RoadBook + POV z bodov |
| Sezónny pas | 89 CHF | Celý archív Silver na 12 mesiacov |

## Technológie

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** — tokeny v `app/globals.css`
- **Stripe Checkout** — TWINT + karta (TWINT sa zapína v Stripe Dashboarde, nemá vlastný kľúč)
- Dáta trás v **JSON**, žiadna databáza

Jazyky: **EN · DE · FR · SK**

## Spustenie

```bash
npm install
cp .env.example .env.local   # doplniť kľúče
npm run dev
```

Bez Stripe kľúčov web beží normálne, len sa nedá zaplatiť — platobné tlačidlo
oznámi, že platby nie sú nakonfigurované.

## Štruktúra

```
app/[lang]/          stránky, jedna sada pre všetky štyri jazyky
app/api/             Stripe checkout, webhook, chránené stiahnutie GPX
data/routes.json     jediný zdroj pravdy o trasách
content/gpx/         GPX súbory — MIMO public/, chodia cez API po overení
dictionaries/        preklady rozhraní
lib/                 i18n, načítanie trás, Stripe
```

**GPX nikdy nepatrí do `public/`.** Čokoľvek v `public/` je verejné bez overenia,
takže by sa platený produkt dal stiahnuť zadarmo.

## Vetvenie

GitHub Flow — `main` je vždy funkčný a nasaditeľný, práca ide vo vetvách
a spája sa cez pull request.

```
main                ●──────────●──────────●
                     \        /          /
feature/faza-0-pilot  ●──●──●           /
                                       /
feature/faza-1-web            ●──●──●
```

| Vetva | Čo v nej vzniká |
|---|---|
| `main` | Vždy funkčný stav |
| `feature/faza-0-pilot` | Dizajn a prvá trasa od zobrazenia po doručenie |
| `feature/faza-1-web` | Katalóg, mapa, štyri jazyky, právne texty |
| `feature/faza-1b-planovac` | Bronze plánovač trás |

Vetva sa volá podľa fázy z ponuky, aby sa dalo dohľadať, čo bolo za čo zaplatené.

## Predávaný obsah nepatrí do gitu

Repo je **verejný**. Skutočné GPX a roadbooky by si ktokoľvek stiahol priamo
z GitHubu a platený produkt by stratil zmysel. `.gitignore` preto pustí do repa
len súbory s predponou `example-`; všetko ostatné v `content/gpx/` ignoruje.

Ukážkové súbory sa dajú kedykoľvek pregenerovať:

```bash
node scripts/generate-example-content.mjs
```

Stopa je v nich priamkovo interpolovaná medzi priesmykmi, takže **nekopíruje
skutočné cesty** — slúžia na test doručovania, nie na navigáciu.

## Stav

**Fáza 0 hotová.** Celý tok od zobrazenia trasy po stiahnutie GPX beží
a je otestovaný. Chýbajú už len prístupy:

| Čo | Kým chýba |
|---|---|
| `STRIPE_SECRET_KEY` + TWINT v Dashboarde | checkout vráti 503, tlačidlo hlási „platby nie sú nastavené" |
| `STRIPE_WEBHOOK_SECRET` | webhook vráti 503 |
| `RESEND_API_KEY` + `MAIL_FROM` | mail sa nepošle, len zaloguje — trasu jazdec aj tak vidí na obrazovke |
| `DOWNLOAD_SIGNING_SECRET` | sťahovanie vráti 503 |

Otestované: podpísané odkazy (platný token 200, podvrhnutý 403, žiadny 400,
cudzia trasa 404), GPX nie je dostupné bez tokenu, doručovacia stránka,
všetky štyri jazyky a presmerovanie podľa `Accept-Language`.

Neotestované: **skutočná platba cez TWINT** a **import GPX do Garmin Zumo XT**
— oboje čaká na prístupy a na prístroj.

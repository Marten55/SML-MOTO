import type { Locale } from '@/lib/i18n';

/**
 * Právne texty pre švajčiarsku prevádzku.
 *
 * Vychádzajú z toho, na čo klient v poznámkach sám upozorňoval: Impressum
 * je povinné, nDSG platí od septembra 2023, a v AGB musí byť jasné, že
 * jazdec jazdí na vlastné riziko a že pri digitálnom obsahu zaniká právo
 * na vrátenie peňazí.
 *
 * Jedna vec je tu navyše oproti poznámkam a je dôležitá: podmienky musia
 * odlíšiť trasu vygenerovanú plánovačom (Bronze) od trasy, ktorú niekto
 * osobne prešiel (Silver, Gold). Pri Bronze SML negarantuje nič.
 *
 * POZOR: toto nie je právne stanovisko. Pred ostrým spustením to má prejsť
 * niekto, kto na švajčiarske právo naozaj je — najmä Impressum a nDSG.
 */

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalPage {
  title: string;
  lede: string;
  sections: LegalSection[];
  /** Text, ktorý drží miesto pre údaje, čo musí dodať klient. */
  todo?: string;
}

export interface LegalContent {
  impressum: LegalPage;
  privacy: LegalPage;
  terms: LegalPage;
}

const PLACEHOLDER = '[doplniť]';

const sk: LegalContent = {
  impressum: {
    title: 'Impressum',
    lede: 'Údaje o prevádzkovateľovi podľa švajčiarskych predpisov.',
    todo: 'Tieto údaje musí dodať prevádzkovateľ. Bez nich sa web nesmie spustiť.',
    sections: [
      {
        heading: 'Prevádzkovateľ',
        body: [
          `Názov firmy: ${PLACEHOLDER}`,
          `Adresa: ${PLACEHOLDER}`,
          `E-mail: ${PLACEHOLDER}`,
          `Identifikačné číslo (UID/CHE): ${PLACEHOLDER}`,
        ],
      },
      {
        heading: 'Zodpovednosť za obsah',
        body: [
          'Obsah tejto stránky je pripravovaný s najlepším vedomím. Za aktuálnosť, úplnosť a správnosť sa však neručí.',
        ],
      },
    ],
  },

  privacy: {
    title: 'Ochrana údajov',
    lede: 'Ako nakladáme s údajmi podľa revidovaného zákona o ochrane údajov (nDSG).',
    sections: [
      {
        heading: 'Čo nezbierame',
        body: [
          'Na nákup trasy nepotrebuješ účet ani heslo. Neprevádzkujeme registráciu ani používateľské profily.',
          'Nepoužívame reklamné ani analytické sledovanie tretích strán.',
        ],
      },
      {
        heading: 'Čo spracúvame',
        body: [
          'E-mailovú adresu, ktorú zadáš pri platbe — použije sa výhradne na doručenie zakúpenej trasy a na prípadné obnovenie prístupu.',
          'Platbu spracúva Stripe. Údaje o karte alebo TWINT sa k nám nikdy nedostanú.',
          'Mapové podklady načítava OpenStreetMap, ktorý pritom vidí IP adresu tvojho zariadenia.',
        ],
      },
      {
        heading: 'YouTube',
        body: [
          'Video na úvodnej stránke je vložené z YouTube. Načíta sa až po tvojom súhlase; do tej doby sa neodošle nič.',
          'Súhlas sa ukladá v tvojom prehliadači a môžeš ho kedykoľvek odvolať vymazaním údajov stránky.',
        ],
      },
      {
        heading: 'Tvoje práva',
        body: [
          'Máš právo vedieť, aké údaje o tebe spracúvame, a žiadať ich opravu alebo vymazanie. Stačí napísať na kontaktnú adresu v Impressum.',
        ],
      },
    ],
  },

  terms: {
    title: 'Obchodné podmienky',
    lede: 'Podmienky predaja trás a férová dohoda o tom, ako to na ceste funguje.',
    sections: [
      {
        heading: 'Čo kupuješ',
        body: [
          'Silver: trasu vo formáte GPX v dvoch podobách — presnú stopu a verziu na navigovanie — spolu s bodmi záujmu.',
          'Gold: to isté plus RoadBook v PDF a POV videá z jednotlivých bodov trasy.',
          'Bronze je bezplatný. Trasu si zostavuje návštevník sám a dostane odkaz do Google Maps.',
        ],
      },
      {
        heading: 'Rozdiel medzi generovanou a overenou trasou',
        body: [
          'Trasy Silver a Gold niekto osobne prešiel a overil.',
          'Trasa z bezplatného plánovača (Bronze) je výsledok automatického výpočtu. Nikto ju neprešiel a SML za ňu neručí v ničom — ani za zjazdnosť, ani za povolenie vjazdu, ani za povrch.',
        ],
      },
      {
        heading: 'Jazda je na vlastné riziko',
        body: [
          'Jazdíme slobodne, ale zodpovedne. Trasy sú odporúčania, nie pokyny.',
          'SML nezodpovedá za stav ciest, uzávery priesmykov, počasie, pokuty ani nehody.',
          'Vždy rešpektuj miestne dopravné značenie a prispôsob jazdu svojim schopnostiam a technickému stavu motocykla.',
        ],
      },
      {
        heading: 'Platba a doručenie',
        body: [
          'Platí sa cez Stripe, kartou alebo TWINT. Ceny sú v CHF.',
          'Po zaplatení sa trasa zobrazí okamžite a súčasne príde odkaz na e-mail. Odkaz neexpiruje.',
        ],
      },
      {
        heading: 'Vrátenie peňazí',
        body: [
          'Ide o digitálny obsah. Stiahnutím alebo zobrazením trasy zaniká právo na odstúpenie od zmluvy.',
          'Ak sa niečo pokazí — súbor nejde stiahnuť, odkaz nefunguje — ozvi sa a vyriešime to.',
        ],
      },
      {
        heading: 'Autorské práva',
        body: [
          'Trasy, roadbooky a videá sú autorským dielom. Kúpou získavaš právo použiť ich pre seba, nie ich ďalej šíriť ani predávať.',
        ],
      },
    ],
  },
};

const de: LegalContent = {
  impressum: {
    title: 'Impressum',
    lede: 'Angaben zum Betreiber nach schweizerischem Recht.',
    todo: 'Diese Angaben muss der Betreiber liefern. Ohne sie darf die Seite nicht online gehen.',
    sections: [
      {
        heading: 'Betreiber',
        body: [
          `Firma: ${PLACEHOLDER}`,
          `Adresse: ${PLACEHOLDER}`,
          `E-Mail: ${PLACEHOLDER}`,
          `UID/CHE-Nummer: ${PLACEHOLDER}`,
        ],
      },
      {
        heading: 'Haftung für Inhalte',
        body: [
          'Die Inhalte dieser Seite werden nach bestem Wissen erstellt. Für Aktualität, Vollständigkeit und Richtigkeit wird keine Gewähr übernommen.',
        ],
      },
    ],
  },

  privacy: {
    title: 'Datenschutzerklärung',
    lede: 'Wie wir mit Daten umgehen — nach dem revidierten Datenschutzgesetz (nDSG).',
    sections: [
      {
        heading: 'Was wir nicht erheben',
        body: [
          'Für den Kauf einer Route brauchst du kein Konto und kein Passwort. Es gibt keine Registrierung und keine Nutzerprofile.',
          'Wir setzen kein Werbe- oder Analyse-Tracking Dritter ein.',
        ],
      },
      {
        heading: 'Was wir verarbeiten',
        body: [
          'Die E-Mail-Adresse, die du bei der Zahlung angibst — ausschliesslich zur Zustellung der gekauften Route und für einen allfälligen erneuten Zugang.',
          'Die Zahlung wickelt Stripe ab. Karten- oder TWINT-Daten erreichen uns nie.',
          'Das Kartenmaterial lädt OpenStreetMap; dabei sieht OpenStreetMap die IP-Adresse deines Geräts.',
        ],
      },
      {
        heading: 'YouTube',
        body: [
          'Das Video auf der Startseite ist von YouTube eingebettet. Es lädt erst nach deiner Zustimmung; vorher wird nichts übermittelt.',
          'Die Zustimmung wird in deinem Browser gespeichert und lässt sich jederzeit widerrufen, indem du die Seitendaten löschst.',
        ],
      },
      {
        heading: 'Deine Rechte',
        body: [
          'Du hast das Recht zu erfahren, welche Daten wir über dich verarbeiten, und deren Berichtigung oder Löschung zu verlangen. Eine Nachricht an die Adresse im Impressum genügt.',
        ],
      },
    ],
  },

  terms: {
    title: 'Allgemeine Geschäftsbedingungen',
    lede: 'Bedingungen für den Verkauf der Routen und eine faire Abmachung für unterwegs.',
    sections: [
      {
        heading: 'Was du kaufst',
        body: [
          'Silver: die Route als GPX in zwei Formen — exakte Spur und Navigationsversion — samt Wegpunkten.',
          'Gold: dasselbe plus RoadBook als PDF und POV-Videos von den einzelnen Punkten.',
          'Bronze ist kostenlos. Die Route stellt sich der Besucher selbst zusammen und erhält einen Google-Maps-Link.',
        ],
      },
      {
        heading: 'Unterschied zwischen generierter und geprüfter Route',
        body: [
          'Silver- und Gold-Routen wurden persönlich abgefahren und geprüft.',
          'Eine Route aus dem kostenlosen Planer (Bronze) ist ein automatisches Rechenergebnis. Niemand ist sie gefahren, und SML übernimmt dafür keinerlei Gewähr — weder für Befahrbarkeit noch für Zufahrtsrechte oder Belag.',
        ],
      },
      {
        heading: 'Fahren auf eigenes Risiko',
        body: [
          'Wir fahren frei, aber verantwortungsvoll. Routen sind Empfehlungen, keine Anweisungen.',
          'SML haftet nicht für Strassenzustand, Passsperrungen, Wetter, Bussen oder Unfälle.',
          'Beachte immer die Beschilderung vor Ort und passe die Fahrweise deinem Können und dem Zustand des Motorrads an.',
        ],
      },
      {
        heading: 'Zahlung und Lieferung',
        body: [
          'Bezahlt wird über Stripe, per Karte oder TWINT. Die Preise verstehen sich in CHF.',
          'Nach der Zahlung erscheint die Route sofort und der Link kommt zusätzlich per E-Mail. Der Link läuft nicht ab.',
        ],
      },
      {
        heading: 'Rückerstattung',
        body: [
          'Es handelt sich um digitale Inhalte. Mit dem Herunterladen oder Anzeigen der Route erlischt das Widerrufsrecht.',
          'Wenn etwas schiefgeht — die Datei lädt nicht, der Link funktioniert nicht — melde dich, wir lösen das.',
        ],
      },
      {
        heading: 'Urheberrecht',
        body: [
          'Routen, RoadBooks und Videos sind urheberrechtlich geschützt. Mit dem Kauf erwirbst du das Recht zur eigenen Nutzung, nicht zur Weitergabe oder zum Weiterverkauf.',
        ],
      },
    ],
  },
};

const en: LegalContent = {
  impressum: {
    title: 'Legal notice',
    lede: 'Operator details as required under Swiss law.',
    todo: 'These details must come from the operator. The site must not go live without them.',
    sections: [
      {
        heading: 'Operator',
        body: [
          `Company: ${PLACEHOLDER}`,
          `Address: ${PLACEHOLDER}`,
          `E-mail: ${PLACEHOLDER}`,
          `UID/CHE number: ${PLACEHOLDER}`,
        ],
      },
      {
        heading: 'Liability for content',
        body: [
          'The content of this site is prepared to the best of our knowledge. No guarantee is given for its currency, completeness or accuracy.',
        ],
      },
    ],
  },

  privacy: {
    title: 'Privacy',
    lede: 'How we handle data under the revised Swiss Data Protection Act (nDSG).',
    sections: [
      {
        heading: 'What we do not collect',
        body: [
          'Buying a route needs no account and no password. There is no registration and there are no user profiles.',
          'We use no third-party advertising or analytics tracking.',
        ],
      },
      {
        heading: 'What we process',
        body: [
          'The e-mail address you give at payment — used solely to deliver the route you bought and to restore access if needed.',
          'Payment is handled by Stripe. Card or TWINT details never reach us.',
          'Map tiles are loaded from OpenStreetMap, which sees your device’s IP address in the process.',
        ],
      },
      {
        heading: 'YouTube',
        body: [
          'The video on the home page is embedded from YouTube. It loads only after you agree; nothing is sent before that.',
          'Your choice is stored in your browser and can be withdrawn at any time by clearing the site data.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'You have the right to know what data we process about you and to request its correction or deletion. A message to the address in the legal notice is enough.',
        ],
      },
    ],
  },

  terms: {
    title: 'Terms',
    lede: 'Terms for buying routes, and a fair deal about how this works on the road.',
    sections: [
      {
        heading: 'What you are buying',
        body: [
          'Silver: the route as GPX in two forms — the exact track and a navigation version — together with waypoints.',
          'Gold: the same plus a RoadBook in PDF and POV videos from the individual points.',
          'Bronze is free. The visitor assembles the route themselves and gets a Google Maps link.',
        ],
      },
      {
        heading: 'Generated versus checked routes',
        body: [
          'Silver and Gold routes were ridden and checked in person.',
          'A route from the free planner (Bronze) is the result of an automatic calculation. Nobody has ridden it, and SML gives no warranty for it whatsoever — not for passability, not for access rights, not for surface.',
        ],
      },
      {
        heading: 'Riding is at your own risk',
        body: [
          'We ride free, but responsibly. Routes are recommendations, not instructions.',
          'SML is not liable for road conditions, pass closures, weather, fines or accidents.',
          'Always respect the signage in front of you and ride within your ability and the condition of your motorcycle.',
        ],
      },
      {
        heading: 'Payment and delivery',
        body: [
          'Payment goes through Stripe, by card or TWINT. Prices are in CHF.',
          'After payment the route appears immediately and the link also arrives by e-mail. The link does not expire.',
        ],
      },
      {
        heading: 'Refunds',
        body: [
          'This is digital content. Downloading or viewing the route ends the right of withdrawal.',
          'If something goes wrong — the file will not download, the link does not work — get in touch and we will sort it out.',
        ],
      },
      {
        heading: 'Copyright',
        body: [
          'Routes, RoadBooks and videos are protected works. Buying gives you the right to use them yourself, not to pass them on or resell them.',
        ],
      },
    ],
  },
};

const fr: LegalContent = {
  impressum: {
    title: 'Mentions légales',
    lede: 'Informations sur l’exploitant selon le droit suisse.',
    todo: 'Ces informations doivent être fournies par l’exploitant. Sans elles, le site ne doit pas être mis en ligne.',
    sections: [
      {
        heading: 'Exploitant',
        body: [
          `Société : ${PLACEHOLDER}`,
          `Adresse : ${PLACEHOLDER}`,
          `E-mail : ${PLACEHOLDER}`,
          `Numéro UID/CHE : ${PLACEHOLDER}`,
        ],
      },
      {
        heading: 'Responsabilité du contenu',
        body: [
          'Le contenu de ce site est préparé au mieux de nos connaissances. Aucune garantie n’est donnée quant à son actualité, son exhaustivité ou son exactitude.',
        ],
      },
    ],
  },

  privacy: {
    title: 'Confidentialité',
    lede: 'Comment nous traitons les données selon la loi révisée sur la protection des données (nLPD).',
    sections: [
      {
        heading: 'Ce que nous ne collectons pas',
        body: [
          'Acheter un itinéraire ne nécessite ni compte ni mot de passe. Il n’y a ni inscription ni profil utilisateur.',
          'Nous n’utilisons aucun traceur publicitaire ou analytique tiers.',
        ],
      },
      {
        heading: 'Ce que nous traitons',
        body: [
          'L’adresse e-mail donnée au moment du paiement — uniquement pour livrer l’itinéraire acheté et rétablir l’accès si nécessaire.',
          'Le paiement est traité par Stripe. Les données de carte ou TWINT ne nous parviennent jamais.',
          'Les fonds de carte proviennent d’OpenStreetMap, qui voit alors l’adresse IP de votre appareil.',
        ],
      },
      {
        heading: 'YouTube',
        body: [
          'La vidéo de la page d’accueil est intégrée depuis YouTube. Elle ne se charge qu’après votre accord ; rien n’est transmis avant.',
          'Votre choix est enregistré dans votre navigateur et peut être retiré à tout moment en effaçant les données du site.',
        ],
      },
      {
        heading: 'Vos droits',
        body: [
          'Vous avez le droit de savoir quelles données nous traitons à votre sujet et d’en demander la rectification ou la suppression. Un message à l’adresse figurant dans les mentions légales suffit.',
        ],
      },
    ],
  },

  terms: {
    title: 'Conditions générales',
    lede: 'Conditions de vente des itinéraires et accord loyal sur la façon dont cela fonctionne sur la route.',
    sections: [
      {
        heading: 'Ce que vous achetez',
        body: [
          'Silver : l’itinéraire en GPX sous deux formes — la trace exacte et la version navigation — avec les points d’intérêt.',
          'Gold : la même chose plus un RoadBook en PDF et des vidéos POV des différents points.',
          'Bronze est gratuit. Le visiteur compose lui-même son itinéraire et reçoit un lien Google Maps.',
        ],
      },
      {
        heading: 'Itinéraire généré ou vérifié',
        body: [
          'Les itinéraires Silver et Gold ont été parcourus et vérifiés en personne.',
          'Un itinéraire issu du planificateur gratuit (Bronze) est le résultat d’un calcul automatique. Personne ne l’a parcouru et SML n’offre aucune garantie le concernant — ni praticabilité, ni droit d’accès, ni revêtement.',
        ],
      },
      {
        heading: 'Rouler à vos propres risques',
        body: [
          'Nous roulons libres, mais responsables. Les itinéraires sont des recommandations, pas des instructions.',
          'SML n’est pas responsable de l’état des routes, des fermetures de cols, de la météo, des amendes ni des accidents.',
          'Respectez toujours la signalisation sur place et adaptez votre conduite à votre niveau et à l’état de votre moto.',
        ],
      },
      {
        heading: 'Paiement et livraison',
        body: [
          'Le paiement passe par Stripe, par carte ou TWINT. Les prix sont en CHF.',
          'Après le paiement, l’itinéraire s’affiche immédiatement et le lien arrive aussi par e-mail. Ce lien n’expire pas.',
        ],
      },
      {
        heading: 'Remboursement',
        body: [
          'Il s’agit de contenu numérique. Le téléchargement ou l’affichage de l’itinéraire met fin au droit de rétractation.',
          'Si quelque chose ne va pas — le fichier ne se télécharge pas, le lien ne fonctionne pas — écrivez-nous et nous réglerons cela.',
        ],
      },
      {
        heading: 'Droits d’auteur',
        body: [
          'Les itinéraires, RoadBooks et vidéos sont des œuvres protégées. L’achat vous donne le droit de les utiliser vous-même, pas de les transmettre ni de les revendre.',
        ],
      },
    ],
  },
};

const LEGAL: Record<Locale, LegalContent> = { de, en, fr, sk };

export function getLegal(locale: Locale): LegalContent {
  return LEGAL[locale];
}

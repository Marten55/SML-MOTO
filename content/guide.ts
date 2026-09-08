import type { Locale } from '@/lib/i18n';

/**
 * Návod „Ako dostať trasu do mobilu za dve minúty".
 *
 * Je to obchodne dôležitejší text, než sa zdá: jazdec ho číta hneď po zaplatení
 * a rozhoduje, či produkt považuje za funkčný. Vychádza z poznámky klienta
 * (1.) prechod na offline mapy) a dopĺňa ju o to, čo GPX naozaj obsahuje.
 *
 * Dlhé texty zámerne nie sú v dictionaries/ — tie sú na popisky rozhrania,
 * nie na články.
 */

export interface GuideStep {
  title: string;
  body: string;
}

export interface DeviceRow {
  device: string;
  how: string;
  voice: string;
}

export interface GuideContent {
  title: string;
  lede: string;

  phoneHeading: string;
  phoneIntro: string;
  steps: GuideStep[];

  filesHeading: string;
  filesIntro: string;
  trackTitle: string;
  trackBody: string;
  navTitle: string;
  navBody: string;
  poiTitle: string;
  poiBody: string;

  devicesHeading: string;
  devicesIntro: string;
  devicesCols: { device: string; how: string; voice: string };
  devices: DeviceRow[];

  settingsHeading: string;
  settingsBody: string;
  settingsList: string[];

  disclaimerHeading: string;
  disclaimerBody: string;
}

const de: GuideContent = {
  title: 'Die Route aufs Handy — in zwei Minuten',
  lede: 'Vergiss Google Maps, das in den Bergen das Signal verliert und dich eigenmächtig durch Tunnel schickt. Deine Route liegt als GPX vor: ein offenes Format, das offline funktioniert und sich nicht neu berechnet.',

  phoneHeading: 'Auf dem Handy',
  phoneIntro: 'Vier Schritte, den ersten und zweiten machst du zu Hause am WLAN.',
  steps: [
    {
      title: 'App installieren',
      body: 'Mapy.cz ist am einfachsten zu bedienen, Guru Maps zeichnet in den Bergen am schnellsten, OsmAnd zeigt auch die kleinsten Bergsträsschen. Alle drei sind kostenlos und laufen auf iPhone wie Android.',
    },
    {
      title: 'Offline-Karte laden',
      body: 'In den Einstellungen der App die Karte der Region herunterladen — für die Schweiz rund 500 MB. Mach das zu Hause am WLAN. Danach navigiert dich das Handy auch auf dem Pass, wo kein Netz mehr ist.',
    },
    {
      title: 'GPX-Datei öffnen',
      body: 'Tippe die heruntergeladene Datei an und wähle deine App aus. Die Route erscheint sofort als durchgehende Linie samt allen Wegpunkten.',
    },
    {
      title: 'Losfahren',
      body: 'Handy in die Halterung, mit dem Intercom im Helm verbinden, Start drücken. Die App führt dich exakt auf der Linie — sie sucht keine schnellere Alternative, du verpasst also kein Panorama.',
    },
  ],

  filesHeading: 'Warum zwei GPX-Dateien?',
  filesIntro: 'GPX kann zwei verschiedene Dinge transportieren, und jedes löst etwas anderes. Du bekommst beide und entscheidest unterwegs.',
  trackTitle: 'Spur (Track)',
  trackBody: 'Die Route Punkt für Punkt, so wie sie gefahren wurde. Dein Gerät berechnet sie nicht, es zeichnet sie nur — es kann sie also gar nicht abkürzen oder durch einen Tunnel umleiten. Dafür sagt es dir nicht „in 200 Metern rechts".',
  navTitle: 'Navigationsversion (Route)',
  navBody: 'Dieselbe Strecke aus Stützpunkten, zwischen denen das Gerät selbst rechnet. Daraus entsteht die Sprachnavigation Kurve für Kurve — so, als hättest du eine Adresse eingegeben.',
  poiTitle: 'Wegpunkte',
  poiBody: 'Tankstellen, Mittagshalt, Aussichtspunkte. Getrennt, damit du sie unabhängig von der Route ein- und ausschalten kannst.',

  devicesHeading: 'Motorradnavis',
  devicesIntro: 'GPX lesen praktisch alle. Die Datei kommt per Kabel oder über die App des Herstellers aufs Gerät.',
  devicesCols: { device: 'Gerät', how: 'Übertragung', voice: 'Sprachnavigation' },
  devices: [
    { device: 'Garmin Zumo XT, XT2, Tread', how: 'Kabel in den Ordner Garmin/GPX, oder über Garmin Explore', voice: 'Ja' },
    { device: 'BMW Navigator', how: 'Gleich wie Garmin — es ist ein umbenannter Garmin', voice: 'Ja' },
    { device: 'TomTom Rider', how: 'Über TomTom MyDrive', voice: 'Ja' },
    { device: 'Calimoto, Scenic, MyRoute-app', how: 'Import direkt in der App', voice: 'Ja' },
    { device: 'Mapy.cz, Guru Maps, OsmAnd', how: 'Datei auf dem Handy öffnen', voice: 'Führt entlang der Linie' },
  ],

  settingsHeading: 'Eine Einstellung, die den Unterschied macht',
  settingsBody: 'Bei der Navigationsversion entscheidet immer dein Gerät nach seinen eigenen Einstellungen. Steht dort „schnellste Route", weicht es von der schönen Strecke ab — das kann niemand von aussen abschalten. Stell vor der Fahrt ein:',
  settingsList: [
    'Routenberechnung auf „kürzeste" oder „kurvenreich", nicht auf „schnellste"',
    'Autobahnen vermeiden einschalten',
    'Neuberechnung ausschalten, wenn dein Gerät das anbietet',
    'Bei Garmin die Route als „Direkt" statt „Auf Strasse" laden, wenn du exakt der Spur folgen willst',
  ],

  disclaimerHeading: 'Und noch etwas Ehrliches',
  disclaimerBody: 'Die Route gibt den besten Stand zum Zeitpunkt der Planung wieder. In den Alpen ändern sich die Verhältnisse schnell — Schnee, Erdrutsche, Sperrungen. Respektiere immer die Beschilderung vor Ort und passe das Tempo deinem Können an. Die Nutzung erfolgt auf eigenes Risiko.',
};

const en: GuideContent = {
  title: 'Getting the route onto your phone — two minutes',
  lede: 'Forget Google Maps, which loses signal in the mountains and quietly drags you through tunnels. Your route comes as GPX: an open format that works offline and does not recalculate itself.',

  phoneHeading: 'On your phone',
  phoneIntro: 'Four steps. Do the first two at home on Wi-Fi.',
  steps: [
    {
      title: 'Install an app',
      body: 'Mapy.cz is the simplest to use, Guru Maps redraws fastest in the mountains, OsmAnd shows even the smallest mountain lanes. All three are free and run on iPhone and Android.',
    },
    {
      title: 'Download the offline map',
      body: 'In the app settings, download the map for the region — around 500 MB for Switzerland. Do this at home on Wi-Fi. After that your phone navigates even on the pass where there is no signal at all.',
    },
    {
      title: 'Open the GPX file',
      body: 'Tap the downloaded file and pick your app. The route appears immediately as one continuous line, waypoints included.',
    },
    {
      title: 'Ride',
      body: 'Phone in the mount, paired with the intercom in your helmet, press start. The app follows the line exactly — it will not look for a faster alternative, so you will not miss a single view.',
    },
  ],

  filesHeading: 'Why two GPX files?',
  filesIntro: 'GPX can carry two different things and each solves something else. You get both and decide on the road.',
  trackTitle: 'Track',
  trackBody: 'The route point by point, exactly as it was ridden. Your device does not calculate it, it only draws it — so it has no way to shorten it or reroute you through a tunnel. In return it will not tell you "right in 200 metres".',
  navTitle: 'Navigation version (route)',
  navBody: 'The same road built from shaping points, with the device working out what lies between them. That is what produces turn-by-turn voice guidance, just as if you had typed in an address.',
  poiTitle: 'Waypoints',
  poiBody: 'Fuel, lunch stop, viewpoints. Kept separate so you can switch them on and off independently of the route.',

  devicesHeading: 'Motorcycle sat-navs',
  devicesIntro: 'Practically all of them read GPX. The file gets there by cable or through the maker’s own app.',
  devicesCols: { device: 'Device', how: 'How it gets there', voice: 'Voice guidance' },
  devices: [
    { device: 'Garmin Zumo XT, XT2, Tread', how: 'Cable into the Garmin/GPX folder, or via Garmin Explore', voice: 'Yes' },
    { device: 'BMW Navigator', how: 'Same as Garmin — it is a rebadged Garmin', voice: 'Yes' },
    { device: 'TomTom Rider', how: 'Through TomTom MyDrive', voice: 'Yes' },
    { device: 'Calimoto, Scenic, MyRoute-app', how: 'Import directly in the app', voice: 'Yes' },
    { device: 'Mapy.cz, Guru Maps, OsmAnd', how: 'Open the file on your phone', voice: 'Follows the line' },
  ],

  settingsHeading: 'One setting that makes the difference',
  settingsBody: 'With the navigation version your device always decides according to its own settings. If it is set to "fastest route", it will wander off the good road — and nobody can switch that off from the outside. Before you set off:',
  settingsList: [
    'Set route calculation to "shortest" or "curvy", not "fastest"',
    'Turn on avoid motorways',
    'Turn off recalculation if your device offers it',
    'On Garmin, load the route as "Direct" rather than "On road" if you want to follow the track exactly',
  ],

  disclaimerHeading: 'And one honest word',
  disclaimerBody: 'The route reflects the best information available when it was planned. Conditions in the Alps change fast — snow, landslides, closures. Always respect the signage in front of you and ride within your ability. Use is at your own risk.',
};

const fr: GuideContent = {
  title: 'Charger l’itinéraire sur votre téléphone — deux minutes',
  lede: 'Oubliez Google Maps, qui perd le signal en montagne et vous entraîne dans les tunnels sans prévenir. Votre itinéraire est au format GPX : un format ouvert qui fonctionne hors ligne et ne se recalcule pas.',

  phoneHeading: 'Sur le téléphone',
  phoneIntro: 'Quatre étapes. Faites les deux premières chez vous, en Wi-Fi.',
  steps: [
    {
      title: 'Installer une application',
      body: 'Mapy.cz est la plus simple, Guru Maps affiche le plus vite en montagne, OsmAnd montre jusqu’aux plus petites routes de montagne. Les trois sont gratuites, sur iPhone comme sur Android.',
    },
    {
      title: 'Télécharger la carte hors ligne',
      body: 'Dans les réglages de l’application, téléchargez la carte de la région — environ 500 Mo pour la Suisse. Faites-le chez vous en Wi-Fi. Ensuite le téléphone vous guide même au col, là où il n’y a plus de réseau.',
    },
    {
      title: 'Ouvrir le fichier GPX',
      body: 'Touchez le fichier téléchargé et choisissez votre application. L’itinéraire s’affiche aussitôt comme une ligne continue, points de passage compris.',
    },
    {
      title: 'Rouler',
      body: 'Téléphone sur le support, relié à l’intercom du casque, appuyez sur départ. L’application suit exactement la ligne — elle ne cherche pas d’alternative plus rapide, vous ne manquerez donc aucun panorama.',
    },
  ],

  filesHeading: 'Pourquoi deux fichiers GPX ?',
  filesIntro: 'Le GPX peut transporter deux choses différentes, et chacune résout un problème distinct. Vous recevez les deux et choisissez sur la route.',
  trackTitle: 'Trace',
  trackBody: 'L’itinéraire point par point, tel qu’il a été parcouru. Votre appareil ne le calcule pas, il le dessine — il n’a donc aucun moyen de le raccourcir ni de vous faire passer par un tunnel. En revanche, il ne vous dira pas « à droite dans 200 mètres ».',
  navTitle: 'Version navigation',
  navBody: 'La même route construite à partir de points de forme, entre lesquels l’appareil calcule lui-même. C’est ce qui produit le guidage vocal virage après virage, comme si vous aviez saisi une adresse.',
  poiTitle: 'Points d’intérêt',
  poiBody: 'Carburant, pause déjeuner, points de vue. Séparés, pour que vous puissiez les activer indépendamment de l’itinéraire.',

  devicesHeading: 'GPS moto',
  devicesIntro: 'Pratiquement tous lisent le GPX. Le fichier arrive par câble ou via l’application du fabricant.',
  devicesCols: { device: 'Appareil', how: 'Transfert', voice: 'Guidage vocal' },
  devices: [
    { device: 'Garmin Zumo XT, XT2, Tread', how: 'Câble vers le dossier Garmin/GPX, ou via Garmin Explore', voice: 'Oui' },
    { device: 'BMW Navigator', how: 'Comme Garmin — c’est un Garmin rebadgé', voice: 'Oui' },
    { device: 'TomTom Rider', how: 'Via TomTom MyDrive', voice: 'Oui' },
    { device: 'Calimoto, Scenic, MyRoute-app', how: 'Import direct dans l’application', voice: 'Oui' },
    { device: 'Mapy.cz, Guru Maps, OsmAnd', how: 'Ouvrir le fichier sur le téléphone', voice: 'Suit la ligne' },
  ],

  settingsHeading: 'Un réglage qui change tout',
  settingsBody: 'Avec la version navigation, c’est toujours votre appareil qui décide, selon ses propres réglages. S’il est sur « itinéraire le plus rapide », il s’écartera de la belle route — et personne ne peut désactiver cela de l’extérieur. Avant de partir :',
  settingsList: [
    'Réglez le calcul sur « le plus court » ou « sinueux », pas sur « le plus rapide »',
    'Activez l’évitement des autoroutes',
    'Désactivez le recalcul si votre appareil le propose',
    'Sur Garmin, chargez l’itinéraire en « Direct » plutôt qu’en « Sur route » pour suivre la trace exactement',
  ],

  disclaimerHeading: 'Et une chose en toute franchise',
  disclaimerBody: 'L’itinéraire reflète le meilleur état connu au moment de sa préparation. En montagne, les conditions changent vite — neige, éboulements, fermetures. Respectez toujours la signalisation sur place et adaptez votre allure à votre niveau. L’utilisation se fait à vos propres risques.',
};

const sk: GuideContent = {
  title: 'Ako dostať trasu do mobilu za dve minúty',
  lede: 'Zabudni na Google Mapy, ktoré v horách strácajú signál a svojvoľne ťa ťahajú do tunelov. Tvoja trasa je vo formáte GPX: otvorenom formáte, ktorý funguje offline a sám sa neprepočíta.',

  phoneHeading: 'V mobile',
  phoneIntro: 'Štyri kroky. Prvé dva sprav doma na Wi-Fi.',
  steps: [
    {
      title: 'Nainštaluj si aplikáciu',
      body: 'Mapy.cz sa ovládajú najjednoduchšie, Guru Maps vykresľujú v horách najrýchlejšie, OsmAnd ukáže aj tie najmenšie horské asfaltky. Všetky tri sú zadarmo a bežia na iPhone aj Androide.',
    },
    {
      title: 'Stiahni si offline mapu',
      body: 'V nastaveniach aplikácie stiahni mapu regiónu — pre Švajčiarsko asi 500 MB. Urob to doma na Wi-Fi. Potom ťa mobil naviguje aj na priesmyku, kde nie je vôbec signál.',
    },
    {
      title: 'Otvor GPX súbor',
      body: 'Ťukni na stiahnutý súbor a vyber svoju aplikáciu. Trasa sa hneď vykreslí ako jedna súvislá čiara vrátane všetkých bodov.',
    },
    {
      title: 'Sadni a choď',
      body: 'Mobil do držiaka, prepoj s interkomom v prilbe a stlač štart. Aplikácia ťa vedie presne po čiare — nehľadá rýchlejšiu alternatívu, takže neprídeš o žiadnu panorámu.',
    },
  ],

  filesHeading: 'Prečo dva GPX súbory?',
  filesIntro: 'GPX vie niesť dve rôzne veci a každá rieši niečo iné. Dostaneš obe a na ceste sa rozhodneš.',
  trackTitle: 'Stopa',
  trackBody: 'Trasa bod po bode presne tak, ako sa išla. Prístroj ju nepočíta, iba kreslí — nemá ju teda ako skrátiť ani presmerovať cez tunel. Zato ti nepovie „o 200 metrov doprava".',
  navTitle: 'Verzia na navigovanie',
  navBody: 'Tá istá cesta poskladaná z tvarovacích bodov, medzi ktorými si prístroj dopočíta cestu sám. Z toho vzniká hlasová navigácia zákruta po zákrute, presne ako keby si zadal adresu.',
  poiTitle: 'Body záujmu',
  poiBody: 'Čerpačky, obed, vyhliadky. Zvlášť, aby si ich vedel zapnúť a vypnúť nezávisle od trasy.',

  devicesHeading: 'Motonavigácie',
  devicesIntro: 'GPX prečítajú prakticky všetky. Súbor sa do prístroja dostane káblom alebo cez aplikáciu výrobcu.',
  devicesCols: { device: 'Prístroj', how: 'Ako sa tam dostane', voice: 'Hlasová navigácia' },
  devices: [
    { device: 'Garmin Zumo XT, XT2, Tread', how: 'Káblom do priečinka Garmin/GPX, alebo cez Garmin Explore', voice: 'Áno' },
    { device: 'BMW Navigator', how: 'Rovnako ako Garmin — je to prebrandovaný Garmin', voice: 'Áno' },
    { device: 'TomTom Rider', how: 'Cez TomTom MyDrive', voice: 'Áno' },
    { device: 'Calimoto, Scenic, MyRoute-app', how: 'Import priamo v aplikácii', voice: 'Áno' },
    { device: 'Mapy.cz, Guru Maps, OsmAnd', how: 'Otvorením súboru v telefóne', voice: 'Vedie po čiare' },
  ],

  settingsHeading: 'Jedno nastavenie, na ktorom to stojí',
  settingsBody: 'Pri verzii na navigovanie rozhoduje vždy tvoj prístroj podľa vlastných nastavení. Ak má zapnuté „najrýchlejšia trasa", odbočí z peknej cesty — a nikto to zvonku nevypne. Pred jazdou si nastav:',
  settingsList: [
    'Výpočet trasy na „najkratšia" alebo „kľukatá", nie na „najrýchlejšia"',
    'Zapni vyhýbanie sa diaľniciam',
    'Vypni prepočítavanie, ak to prístroj ponúka',
    'Na Garmine načítaj trasu ako „Priama" namiesto „Po ceste", ak chceš ísť presne po stope',
  ],

  disclaimerHeading: 'A ešte jedna vec na rovinu',
  disclaimerBody: 'Trasa odráža najlepší známy stav v čase plánovania. V Alpách sa podmienky menia rýchlo — sneh, zosuvy, uzávery. Vždy rešpektuj značenie na mieste a prispôsob jazdu svojim schopnostiam. Použitie je na vlastné riziko.',
};

const GUIDES: Record<Locale, GuideContent> = { de, en, fr, sk };

export function getGuide(locale: Locale): GuideContent {
  return GUIDES[locale];
}

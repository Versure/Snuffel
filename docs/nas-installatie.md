# Snuffel op de NAS installeren

Dit stappenplan zet Snuffel op je Synology NAS. Aan het eind open je Snuffel op elke telefoon, tablet en laptop in huis via het adres **`http://snuffel.internal`**. Buiten je huis is Snuffel niet bereikbaar.

Het plan gaat ervan uit dat je dit voor het eerst doet. Elke stap vertelt waarom hij nodig is, waar je precies klikt, wat je invult en hoe je controleert dat het gelukt is.

## Voordat je begint

### Zo gebruik je dit plan

- Doe de stappen **op volgorde**. Sla niets over, tenzij er staat dat het mag.
- Elke stap eindigt met **Controle**. Ga pas verder als de controle lukt. Lukt hij niet, kijk dan bij **Als het niet lukt** onder die stap of bij [Problemen oplossen](#problemen-oplossen) onderaan.
- **Vetgedrukte woorden** zijn knoppen, menu's, tabbladen of velden die je op het scherm ziet. Een pijl (→) betekent: klik daarna op. **Configuratiescherm → Netwerk** betekent dus: open het Configuratiescherm en klik daarin op Netwerk.
- `Tekst in dit lettertype` typ of plak je precies zo, letter voor letter, zonder de aanhalingstekens eromheen tenzij die erbij staan.
- Menunamen in DSM kunnen per versie een klein beetje verschillen. Zie je een knop niet precies zo, zoek dan naar het woord dat er het meest op lijkt.
- Reken op anderhalf tot twee uur. Je kunt na elke stap pauzeren.

### Wat je nodig hebt

- Een **laptop of computer** die met je thuiswifi of thuisnetwerk is verbonden. Alles doe je vanuit de browser (Chrome, Edge, Safari of Firefox) op die laptop.
- De **Synology NAS**, aangezet en met een netwerkkabel aangesloten op je router.
- De **gebruikersnaam en het wachtwoord van DSM** (het account waarmee je op de NAS inlogt). Dit account moet beheerder zijn. Het account dat je bij het installeren van de NAS maakte, is dat altijd.
- De **gebruikersnaam en het wachtwoord van je router**. Die staan vaak op een sticker op de onder- of achterkant van de router, of in de papieren van je provider.
- Een **telefoon of tablet** om aan het eind te testen.

### Woordenlijst

| Woord                 | Wat het is                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NAS**               | Je Synology-apparaat: een kleine computer met harde schijven die altijd aan staat.                                                                                                                                                                   |
| **DSM**               | Het besturingssysteem van de NAS. Je bedient het via een website in je browser, met een bureaublad, vensters en een hoofdmenu, net als op een computer.                                                                                              |
| **Router**            | Het kastje van je provider (of je eigen router) dat je thuisnetwerk en wifi maakt en met internet verbindt.                                                                                                                                          |
| **IP-adres**          | Het "huisnummer" van een apparaat in je thuisnetwerk, bijvoorbeeld `192.168.1.20`. Elk apparaat heeft er een.                                                                                                                                        |
| **Poort**             | Een "deurnummer" op een apparaat. Op één NAS draaien meerdere programma's; elk luistert aan een eigen deur. DSM zelf luistert op poort `5000`, Snuffel op poort `8090`. In een adres staat de poort na een dubbele punt: `http://192.168.1.20:8090`. |
| **Container**         | Een afgesloten doos op de NAS waarin één programma draait, met alles wat het nodig heeft. Snuffel is één container.                                                                                                                                  |
| **Image**             | Het "installatiepakket" waarvan een container wordt gemaakt. De Snuffel-image staat op internet, op `ghcr.io` (een opslagplaats van GitHub).                                                                                                         |
| **Container Manager** | Het programma in DSM waarmee je containers downloadt, start en stopt.                                                                                                                                                                                |
| **Project**           | In Container Manager: een container plus de instellingen ervan, beschreven in een tekstje (het compose-bestand).                                                                                                                                     |
| **PocketBase**        | De database in de Snuffel-container. Daar staan de accounts en de voortgang. PocketBase heeft een eigen beheerscherm.                                                                                                                                |
| **DNS**               | Het "telefoonboek" van een netwerk: zet een naam (zoals `snuffel.internal`) om in een IP-adres (zoals `192.168.1.20`).                                                                                                                               |
| **Reverse proxy**     | Een "receptionist" op de NAS: hij ontvangt bezoekers voor `snuffel.internal` en stuurt ze door naar de Snuffel-container op poort `8090`. Daardoor hoef je geen poortnummer te typen.                                                                |
| **DHCP**              | De dienst in je router die elk apparaat automatisch een IP-adres geeft en vertelt welke DNS-server het moet gebruiken.                                                                                                                               |

### Gegevensblad

Neem dit blad over op papier of in een notitie en vul het in tijdens het plan. Je hebt deze gegevens later nodig. Bewaar wachtwoorden in je wachtwoordmanager.

| Gegeven                                                | Waar je het vindt       | Jouw waarde |
| ------------------------------------------------------ | ----------------------- | ----------- |
| IP-adres van de NAS                                    | stap 1                  |             |
| IP-adres van de router                                 | stap 2                  |             |
| Gebruikersnaam en wachtwoord DSM                       | heb je al               |             |
| Gebruikersnaam en wachtwoord router                    | sticker op de router    |             |
| E-mailadres en wachtwoord beheerder PocketBase         | stap 7 (bedenk je zelf) |             |
| Gebruikersnamen en wachtwoorden van jou en de kinderen | stap 8 (bedenk je zelf) |             |

**In dit plan** gebruiken we `192.168.1.20` als voorbeeld voor het IP-adres van de NAS en `192.168.1.1` voor de router. **Vervang die overal door jouw eigen adressen** van het gegevensblad.

### Hoe het straks werkt

```
1. Tablet vraagt:   "Welk adres hoort bij snuffel.internal?"   → DNS antwoordt: 192.168.1.20
2. Tablet opent:    http://snuffel.internal                    → komt binnen bij de NAS (poort 80)
3. Reverse proxy:   "Dit is voor Snuffel"                      → stuurt door naar de container (poort 8090)
```

Deel 1 en 2 zetten Snuffel op de NAS (bereikbaar op `http://192.168.1.20:8090`). Deel 3 maakt het mooie adres `http://snuffel.internal`. Deel 4 regelt back-ups en beveiliging.

## Deel 1: voorbereiden

### Stap 1. Log in op DSM en controleer of je NAS geschikt is

**Waarom.** Snuffel werkt alleen op een NAS met een Intel- of AMD-processor, DSM 7.2 of nieuwer en het pakket Container Manager.

**1a. DSM openen**

1. Open de browser op je laptop.
2. Weet je het IP-adres van de NAS niet? Typ in de adresbalk `find.synology.com` en druk op Enter. Die pagina zoekt de NAS in je thuisnetwerk en toont het IP-adres. Lukt dat niet, kijk dan in je router in de lijst met verbonden apparaten (zoek naar een naam met "DS", "Synology" of de naam die je de NAS gaf).
3. Typ in de adresbalk `http://192.168.1.20:5000` (met het IP-adres van jouw NAS) en druk op Enter.
4. Log in met je DSM-gebruikersnaam en -wachtwoord.
5. Schrijf het IP-adres op het gegevensblad.

Je ziet nu het bureaublad van DSM. Linksboven staat een knop met negen vierkantjes: dat is het **hoofdmenu**. Daarin staan alle programma's.

**1b. Versie en processor controleren**

1. Klik op het **hoofdmenu** (linksboven) → **Configuratiescherm**.
2. Klik in het Configuratiescherm op **Infocentrum** (in de linkerkolom, onder **Systeem**). Je komt op het tabblad **Algemeen**.
3. Kijk bij **DSM-versie**. Er moet `DSM 7.2` of hoger staan (bijvoorbeeld `DSM 7.2.2-72806`).
   - Staat er een lagere versie: klik in het Configuratiescherm op **Bijwerken en herstellen** → **Downloaden** en daarna **Nu bijwerken**. De NAS start daarna opnieuw op; dat duurt ongeveer tien minuten. Log daarna opnieuw in.
4. Kijk bij **CPU**. Er moet een naam van **Intel** of **AMD** staan, zoals `INTEL Celeron J4125`, `Intel Atom`, `Intel Pentium`, `AMD Ryzen R1600` of `Intel Xeon`.
   - Staat er **Realtek**, **Annapurna Labs**, **Marvell** of **ARM**: dan werkt deze versie van Snuffel niet op jouw NAS. Stop hier en meld het; de image moet dan eerst ook voor jouw processor worden gebouwd.

**1c. Container Manager installeren**

1. **Hoofdmenu** → **Pakketcentrum**.
2. Typ in het zoekveld linksboven `Container Manager`.
3. Staat bij Container Manager de knop **Openen**? Dan is hij al geïnstalleerd; ga naar de controle.
4. Staat er **Installeren**? Klik erop. Vraagt DSM op welk volume: kies `Volume 1` en klik op **Volgende** → **Gereed**. DSM maakt daarbij zelf een gedeelde map `docker`.

**Controle:** in het **hoofdmenu** staat **Container Manager**. Klik erop: het venster opent zonder foutmelding, met links de onderdelen **Overzicht**, **Project**, **Container**, **Image**, **Register**, **Netwerk** en **Logboek**.

### Stap 2. Geef de NAS een vast IP-adres

**Waarom.** De router geeft apparaten automatisch een IP-adres, en dat adres kan na een herstart veranderen. Straks wijst `snuffel.internal` naar het IP-adres van de NAS. Verandert dat adres, dan werkt Snuffel niet meer. Daarom vertel je de router dat de NAS altijd hetzelfde adres krijgt (een "DHCP-reservering").

**2a. Het MAC-adres van de NAS opzoeken**

Elk netwerkapparaat heeft een vast serienummer, het MAC-adres (zoiets als `00:11:32:AB:CD:EF`). Daarmee herkent de router de NAS.

1. In DSM: **Configuratiescherm → Netwerk** → tabblad **Netwerkinterface**.
2. Klik op het pijltje naast **LAN 1** (of de verbinding met de status **Verbonden**). Je ziet het **IP-adres** en het **MAC-adres**. Schrijf beide op.

**2b. Inloggen op de router**

1. Het IP-adres van de router vind je zo: **Windows**: druk op de Windows-toets, typ `cmd` en druk op Enter. Typ in het zwarte venster `ipconfig` en druk op Enter. Het adres achter **Standaardgateway** is je router. **Mac**: **Systeeminstellingen → Wifi → Details** naast je netwerk → **TCP/IP** → **Router**.
2. Schrijf het op het gegevensblad.
3. Typ het adres in de adresbalk van de browser, bijvoorbeeld `http://192.168.1.1`, en log in met het wachtwoord van de router.

**2c. Het adres reserveren**

Elke router ziet er anders uit. Zoek naar een van deze woorden: **DHCP-reservering**, **Vast IP-adres**, **Statische lease**, **Adresreservering**, **Statische DHCP** of **Altijd hetzelfde IPv4-adres toekennen**. Het zit meestal onder **Netwerk**, **LAN**, **Thuisnetwerk** of **Apparaten**.

- **FRITZ!Box**: **Thuisnetwerk → Netwerk** → tabblad **Netwerkverbindingen** → het potloodje naast de NAS → vink **Dit netwerkapparaat altijd hetzelfde IPv4-adres toewijzen** aan → **OK**.
- **Andere routers**: kies de NAS in de lijst met apparaten (herken hem aan het MAC-adres uit 2a) en kies "reserveren" of "vast adres", met het huidige IP-adres van de NAS. Weet je niet waar het zit, zoek dan op internet naar `<merk en type van je router> DHCP reservering`.

Sla de instelling op (**Opslaan**, **Toepassen** of **OK**).

**Controle:**

1. Start de NAS opnieuw: in DSM rechtsboven op het **poppetje** → **Opnieuw opstarten** → **Ja**. Wacht ongeveer vijf minuten.
2. Open `http://192.168.1.20:5000` opnieuw. Kun je weer inloggen op hetzelfde adres, dan is het gelukt.

**Als het niet lukt:** ga naar `find.synology.com` om het nieuwe adres te vinden en controleer de reservering in de router (klopt het MAC-adres?).

### Stap 3. Maak de map voor de gegevens van Snuffel

**Waarom.** Alles wat Snuffel bewaart (accounts, voortgang, back-ups van PocketBase) komt in één map op de NAS. Zo blijft het bewaard als de container wordt vervangen door een nieuwe versie, en kun je het meenemen in je back-up.

1. **Hoofdmenu** → **File Station**.
2. In de linkerkolom staan de gedeelde mappen. Klik op **docker**.
   - Staat `docker` er niet: **Configuratiescherm → Gedeelde map → Maken → Gedeelde map maken**. Naam `docker`, locatie `Volume 1`, verder alles standaard. Klik steeds op **Volgende** en tot slot **Toepassen**. Ga dan terug naar File Station.
3. Klik in de map `docker` bovenaan op **Maken → Map maken**. Typ `snuffel` en klik op **OK**.
4. Dubbelklik op de nieuwe map `snuffel` om erin te gaan.
5. Klik opnieuw op **Maken → Map maken**. Typ `pb_data` (kleine letters, met een liggend streepje) en klik op **OK**.

**Controle:** bovenaan File Station staat het pad `docker > snuffel`, en daarin staat de map `pb_data`. Het volledige pad op de NAS is `/volume1/docker/snuffel/pb_data`. Dit pad heb je in stap 3a en 5 nodig.

### Stap 3a. Geef de container schrijfrechten op `pb_data`

**Waarom.** Elk programma op de NAS draait als een "gebruiker" met een nummer. Om veiligheidsredenen draait Snuffel niet als beheerder, maar als gebruiker nummer **`1000`** in groep nummer **`1000`**. De map `pb_data` die je net maakte, is van jouw DSM-gebruiker. Gebruiker `1000` mag er dus nog niet in schrijven, en dan stopt Snuffel bij het starten met de fout `permission denied` ("toegang geweigerd").

**Wat je gaat doen.** Je maakt gebruiker `1000` eigenaar van de map `pb_data`, met dit commando:

```sh
chown -R 1000:1000 /volume1/docker/snuffel/pb_data
```

- `chown` betekent "change owner": verander de eigenaar.
- `-R` betekent: ook van alles wat erin staat.
- `1000:1000` is de nieuwe eigenaar: gebruiker `1000` en groep `1000`.
- `/volume1/docker/snuffel/pb_data` is de map uit stap 3.

Via **File Station → Eigenschappen → Machtiging** gaat dit niet: daar kun je alleen DSM-gebruikers kiezen, en gebruiker `1000` is geen DSM-gebruiker. Daarom laat je de **Taakplanner** van DSM het commando één keer als beheerder (`root`) uitvoeren.

**3a-1. De taak maken**

1. **Hoofdmenu** → **Configuratiescherm**.
2. Klik in de linkerkolom op **Taakplanner** (onder **Services**). Zie je hem niet, klik dan rechtsboven in het Configuratiescherm op **Geavanceerde modus**.
3. Klik bovenaan op **Maken → Geplande taak → Door gebruiker gedefinieerd script**. Er opent een venster met de tabbladen **Algemeen**, **Planning** en **Taakinstellingen**.

**3a-2. Tabblad Algemeen**

| Veld             | Wat je invult                                                                     |
| ---------------- | --------------------------------------------------------------------------------- |
| **Taak**         | `snuffel-rechten`                                                                 |
| **Gebruiker**    | kies `root` in de lijst (bovenaan). Alleen `root` mag eigenaren veranderen.       |
| **Ingeschakeld** | vinkje **uit**. De taak hoeft nooit vanzelf te draaien; je start hem met de hand. |

**3a-3. Tabblad Planning**

Laat alles staan zoals het is. Omdat de taak niet is ingeschakeld, draait hij nooit vanzelf.

**3a-4. Tabblad Taakinstellingen**

1. Laat **Meldingsinstellingen** leeg.
2. Wis het tekstvak onder **Door gebruiker gedefinieerd script** en plak precies deze twee regels:

   ```sh
   chown -R 1000:1000 /volume1/docker/snuffel/pb_data
   ls -ln /volume1/docker/snuffel > /volume1/docker/snuffel/controle-rechten.txt
   ```

   De eerste regel verandert de eigenaar. De tweede schrijft de nieuwe eigenaar op in een tekstbestand, zodat je kunt controleren dat het gelukt is.

3. Klik op **OK**. DSM waarschuwt dat de taak als `root` draait: klik op **OK** en vul als daarom gevraagd wordt je DSM-wachtwoord in.

**3a-5. De taak één keer uitvoeren**

1. De taak `snuffel-rechten` staat nu in de lijst van de Taakplanner. Klik er één keer op, zodat de regel gekleurd is.
2. Klik bovenaan op **Uitvoeren** en bevestig met **OK**. Het commando duurt minder dan een seconde.

**3a-6. Controleren**

1. Open **File Station** en ga naar `docker` → `snuffel`. Daar staat nu het bestand `controle-rechten.txt`. Zie je het niet, klik dan op het rondje met de pijl (vernieuwen) bovenaan.
2. Klik met de rechtermuisknop op het bestand → **Downloaden**. Open het gedownloade bestand op je laptop (dubbelklikken; het opent in Kladblok of Teksteditor).
3. Je ziet een regel die eindigt op `pb_data`, ongeveer zo:

   ```
   drwxrwxrwx+ 1 1000 1000 0 Oct 28 10:12 pb_data
   ```

   De twee getallen vóór de `0` (de grootte) moeten **`1000 1000`** zijn. Dan is het gelukt. De letters aan het begin, de grootte en de datum mogen anders zijn.

4. Staat er iets anders dan `1000 1000` (bijvoorbeeld `1026 100`), of is het bestand er niet: open de taak opnieuw (klik erop → **Bewerken**). Controleer op **Algemeen** dat de gebruiker `root` is en op **Taakinstellingen** dat het pad precies `/volume1/docker/snuffel/pb_data` is (kleine letters, geen spaties). Klik op **OK** en voer de taak opnieuw uit (3a-5).

**3a-7. Opruimen**

1. Verwijder in File Station het bestand `controle-rechten.txt` (rechtermuisknop → **Verwijderen** → **Ja**).
2. Klik in de Taakplanner op de taak `snuffel-rechten` en daarna bovenaan op **Verwijderen** → **Ja**. De taak is niet meer nodig: de eigenaar blijft `1000`, ook na een herstart van de NAS of een update van Snuffel.

**Controle:** `controle-rechten.txt` liet `1000 1000` zien bij `pb_data`. In stap 6 zie je het nog een keer: de container komt dan op **Gezond**.

### Stap 4. Controleer dat de NAS de Snuffel-image kan downloaden

**Waarom.** Na elke wijziging die in Snuffel wordt samengevoegd (een "merge naar `main`"), maakt GitHub automatisch een nieuwe image en zet die op `ghcr.io/versure/snuffel`. De NAS downloadt de image daarvandaan. Op het moment van schrijven is deze image **openbaar**: de NAS kan hem downloaden zonder in te loggen. Je hoeft in deze stap dus niets in te stellen; alleen te controleren.

1. Open in de browser `https://github.com/Versure/Snuffel/pkgs/container/snuffel`.
2. Zie je een pagina met de naam **snuffel** en daaronder een regel als `docker pull ghcr.io/versure/snuffel:latest`? Dan is de image openbaar. Ga door naar stap 5.
3. Zie je **404** of "Page not found" terwijl je bent ingelogd op GitHub, of mislukt het downloaden in stap 5 met `denied` of `unauthorized`? Dan is de image niet (meer) openbaar. Volg dan eerst [Bijlage A: inloggen bij ghcr.io](#bijlage-a-inloggen-bij-ghcrio).

**Controle:** de pagina uit punt 1 toont de image **snuffel**.

## Deel 2: Snuffel starten

### Stap 5. Maak het project in Container Manager

**Waarom.** Een project vertelt Container Manager welke image hij moet downloaden, op welke poort Snuffel bereikbaar is en in welke map de gegevens komen. Dat staat in een kort tekstje (het compose-bestand) dat je zo plakt.

**Wat het tekstje betekent**, regel voor regel:

| Regel                                           | Betekenis                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `image: ghcr.io/versure/snuffel:latest`         | download de nieuwste Snuffel-image                                                    |
| `container_name: snuffel`                       | noem de container `snuffel`                                                           |
| `restart: unless-stopped`                       | start Snuffel vanzelf opnieuw na een herstart van de NAS, tenzij jij hem hebt gestopt |
| `- '8090:8090'`                                 | Snuffel is bereikbaar op poort `8090` van de NAS                                      |
| `- /volume1/docker/snuffel/pb_data:/pb/pb_data` | de gegevens van Snuffel komen in de map uit stap 3                                    |
| `- TZ=Europe/Amsterdam`                         | Nederlandse tijd                                                                      |

**De stappen**

1. **Hoofdmenu** → **Container Manager** → klik links op **Project** → bovenaan op **Maken**.
2. Het venster **Project maken** opent. Vul in:
   - **Projectnaam**: `snuffel` (kleine letters).
   - **Pad**: klik op **Instellen pad**. Klik in het venster dat opent op **docker** en daarna op **snuffel** (de map, niet `pb_data`), en klik op **Selecteren**. Er staat nu `/docker/snuffel`.
   - **Bron**: kies **docker-compose.yml maken**. Er verschijnt een groot tekstvak.
3. Klik in het tekstvak, wis wat er eventueel al staat, en plak precies deze tekst (dit is [`deploy/compose.nas.yml`](../deploy/compose.nas.yml)). Let op: de spaties aan het begin van de regels zijn belangrijk; plakken neemt ze vanzelf goed over.

   ```yaml
   services:
     snuffel:
       image: ghcr.io/versure/snuffel:latest
       container_name: snuffel
       restart: unless-stopped
       ports:
         - '8090:8090' # alleen LAN; geen port forwarding op de router
       volumes:
         - /volume1/docker/snuffel/pb_data:/pb/pb_data
       environment:
         - TZ=Europe/Amsterdam
   ```

4. Klik op **Volgende**.
5. Je ziet **Instellingen webportaal** (via Web Station). Zet hier **niets** aan: het mooie adres regel je in stap 9 op een andere manier. Klik op **Volgende**.
6. Je ziet een overzicht. Zorg dat **Het project starten nadat het is gemaakt** is aangevinkt. Klik op **Gereed**.
7. Er opent een venster met tekst die voorbijrolt: Container Manager downloadt de image (ongeveer 30 MB) en start de container. Wacht tot er onderaan `Exit Code: 0` staat, en klik op **Sluiten**.

**Als het niet lukt:**

- Er staat `denied`, `unauthorized` of `pull access denied`: de image is niet openbaar. Volg [Bijlage A](#bijlage-a-inloggen-bij-ghcrio) en probeer het opnieuw via **Project** → `snuffel` → **Actie → Bouwen**.
- Er staat `no matching manifest` of `exec format error`: de NAS heeft geen Intel- of AMD-processor (stap 1b).
- Er staat `port is already allocated`: een ander programma op de NAS gebruikt poort `8090` al. Meld het; dan kiezen we een andere poort.

### Stap 6. Controleer of Snuffel draait

1. Klik in Container Manager links op **Container**. In de lijst staat `snuffel`.
2. Wacht ongeveer een halve minuut. De status wordt **Actief**, en daarna **Gezond** (een groen bolletje of het woord Gezond in de kolom Status). Klik eventueel op het vernieuwen-rondje.
3. Open op je laptop een nieuw tabblad en typ `http://192.168.1.20:8090/api/health` in de adresbalk (met het IP-adres van jouw NAS). Je ziet een regel tekst met daarin `API is healthy.`.
4. Open `http://192.168.1.20:8090`. Je ziet het inlogscherm van Snuffel met Ted.

**Controle:** de container staat op **Gezond** en beide adressen werken.

**Als het niet lukt:**

- De container staat op **Ongezond**, of op **Gestopt**: dubbelklik in de lijst op `snuffel` → tabblad **Logboek**. Staat er `permission denied` bij `pb_data`: doe stap 3a opnieuw, en daarna **Container** → `snuffel` → **Actie → Herstarten**.
- De pagina laadt niet ("Kan deze site niet bereiken"): controleer het IP-adres en dat je `http://` (niet `https://`) en `:8090` hebt getypt.

### Stap 7. Maak de beheerder van PocketBase

**Waarom.** PocketBase heeft een beheerscherm waarin jij de accounts maakt en instellingen regelt. Daarvoor heb je een beheerdersaccount nodig (in PocketBase heet dat "superuser"). Dit account is alleen voor het beheerscherm en staat los van de Snuffel-accounts waarmee jij en de kinderen inloggen. Het beheerdersaccount maak je met een commando in de container.

**7a. Een e-mailadres en wachtwoord kiezen**

- **E-mailadres**: je eigen e-mailadres. Er wordt geen mail naartoe gestuurd; het is alleen je inlognaam.
- **Wachtwoord**: minstens 12 tekens. Gebruik **alleen letters, cijfers en streepjes** (bijvoorbeeld `Fiets-Boom-Lamp-73`). Leestekens zoals `!`, `$`, `&`, `'`, `"` of spaties kunnen het commando in de war brengen.
- Schrijf beide op het gegevensblad en in je wachtwoordmanager.

**7b. De terminal van de container openen**

Een terminal is een venster waarin je commando's typt in plaats van te klikken.

1. **Container Manager** → links **Container** → dubbelklik op `snuffel`. Er opent een venster met details.
2. Klik op het tabblad **Terminal**.
3. Klik op het pijltje naast **Maken** → **Starten met opdracht**.
4. Typ `sh` en klik op **OK**.
5. Links verschijnt een regel `sh`. Klik erop. Rechts zie je een zwart vlak met een knipperend streepje of een `/pb $`. Klik in dat zwarte vlak.

**7c. Het commando typen**

Typ het volgende commando over, met in plaats van `jouw@email.nl` jouw e-mailadres en in plaats van `Fiets-Boom-Lamp-73` jouw wachtwoord. Let op de spaties tussen de onderdelen. (Plakken met Ctrl+V werkt in dit venster niet altijd; overtypen is het veiligst.)

```sh
/pb/pocketbase superuser upsert jouw@email.nl Fiets-Boom-Lamp-73 --dir /pb/pb_data
```

Druk op **Enter**. Je ziet `Successfully saved superuser "jouw@email.nl"!`.

Klik daarna op **Verbinding verbreken** (of sluit het venster).

**7d. Inloggen op het beheerscherm**

1. Open in de browser `http://192.168.1.20:8090/_/` (let op: `/_/` aan het eind: schuine streep, liggend streepje, schuine streep).
2. Log in met het e-mailadres en wachtwoord uit 7a.

**Controle:** je ziet het beheerscherm van PocketBase (Engelstalig). Links staan de **Collections**, waaronder `users`, `lesson_progress` en `quiz_attempts`.

**Als het niet lukt:**

- In de terminal staat `not found`: je hebt het commando niet precies overgetypt. Controleer vooral `/pb/pocketbase` aan het begin en probeer het opnieuw.
- Inloggen lukt niet: typ het commando uit 7c opnieuw met hetzelfde e-mailadres. `upsert` zet dan het wachtwoord opnieuw.

### Stap 8. Maak de accounts voor jou en de kinderen

**Waarom.** Snuffel heeft geen pagina om je aan te melden; alleen jij maakt accounts. Elk kind krijgt een eigen account, zodat ieder alleen de eigen voortgang ziet. Jouw eigen account krijgt de rol ouder, zodat je het ouderoverzicht ziet.

**8a. Je eigen account**

1. Klik in het beheerscherm (`http://192.168.1.20:8090/_/`) links op **users**.
2. Klik rechtsboven op **+ New record**. Rechts schuift een formulier open.
3. Vul in:

   | Veld                              | Wat je invult                                                                                  |
   | --------------------------------- | ---------------------------------------------------------------------------------------------- |
   | **email**                         | leeg laten                                                                                     |
   | **emailVisibility**, **verified** | niet aanraken                                                                                  |
   | **password**                      | jouw wachtwoord voor Snuffel, minstens 8 tekens                                                |
   | **passwordConfirm**               | hetzelfde wachtwoord nog een keer                                                              |
   | **username**                      | je inlognaam, bijvoorbeeld `jop`: 3 tot 20 tekens, alleen kleine letters, cijfers en streepjes |
   | **name**                          | de naam die Ted zegt, bijvoorbeeld `Jop` ("Hoi, Jop!")                                         |
   | **role**                          | klik op het veld en kies `parent`                                                              |

4. Klik onderaan op **Create**.

**8b. Een account per kind**

Herhaal 8a voor elk kind, met:

- **username**: bijvoorbeeld de voornaam in kleine letters (`emma`), of `kind-1`.
- **name**: de naam die Ted moet zeggen.
- **role**: `child`.
- **password**: een wachtwoord dat het kind kan onthouden en typen (minstens 8 tekens).

Schrijf alle gebruikersnamen en wachtwoorden op het gegevensblad.

**Controle:**

1. Open `http://192.168.1.20:8090` en log in met je eigen gebruikersnaam en wachtwoord. Ted begroet je met je naam, en op de startpagina staat de knop **Naar het ouderoverzicht**.
2. Log uit (knop rechtsboven) en log in met het account van elk kind. Ted begroet het kind met de naam; er staat geen knop naar het ouderoverzicht.

**Als het niet lukt:** klopt de inlognaam niet, open dan in het beheerscherm **users**, klik op het account en controleer **username** (hoofdletters tellen mee). Een wachtwoord zet je opnieuw door bij het account **password** en **passwordConfirm** in te vullen en op **Save changes** te klikken.

## Deel 3: het adres `http://snuffel.internal`

Snuffel werkt nu op `http://192.168.1.20:8090`. Dat is lastig te onthouden. In dit deel maak je `http://snuffel.internal`.

**Waarom `.internal`?** Deze naam is wereldwijd gereserveerd voor thuis- en bedrijfsnetwerken: hij bestaat nergens op internet en zal er nooit bestaan, dus hij botst nooit met een echte website. Gebruik geen `.local` (die gebruiken Apple-apparaten en printers zelf, dat botst) en geen verzonnen extensie als `.thuis` (die kan ooit een echte extensie worden). Wil je een andere naam dan `snuffel`, bijvoorbeeld `leren`, gebruik die dan overal in stap 9, 10 en 11 in plaats van `snuffel`.

Er zijn twee dingen nodig:

- **Stap 9**: de NAS moet bezoekers voor `snuffel.internal` doorsturen naar Snuffel (de reverse proxy).
- **Stap 10**: elk apparaat in huis moet weten dat `snuffel.internal` het IP-adres van de NAS is (DNS).

### Stap 9. Stel de reverse proxy van DSM in

1. **Hoofdmenu** → **Configuratiescherm** → **Aanmeldingsportal** (in de linkerkolom, onder **Systeem**).
2. Klik bovenaan op het tabblad **Geavanceerd**.
3. Klik op de knop **Reverse proxy**. Er opent een lijst (waarschijnlijk leeg).
4. Klik op **Maken**. Er opent een venster met het tabblad **Algemeen**.
5. Vul in:

   | Veld                               | Wat je invult                                                     |
   | ---------------------------------- | ----------------------------------------------------------------- |
   | **Beschrijving van reverse proxy** | `Snuffel`                                                         |
   | **Bron → Protocol**                | `HTTP`                                                            |
   | **Bron → Hostnaam**                | `snuffel.internal`                                                |
   | **Bron → Poort**                   | `80`                                                              |
   | **HSTS inschakelen**               | **uit** (geen vinkje)                                             |
   | **Toegangsbeheerprofiel**          | niet instellen                                                    |
   | **Bestemming → Protocol**          | `HTTP`                                                            |
   | **Bestemming → Hostnaam**          | `127.0.0.1` (dat betekent: "deze NAS zelf"; typ niet `localhost`) |
   | **Bestemming → Poort**             | `8090`                                                            |

6. Laat het tabblad **Aangepaste header** leeg en verander niets op **Geavanceerde instellingen**.
7. Klik op **Opslaan**. In de lijst staat nu een regel `Snuffel` met `http://snuffel.internal:80` → `http://127.0.0.1:8090`.

DSM zelf blijft gewoon bereikbaar op `http://192.168.1.20:5000`. De reverse proxy reageert alleen op de naam `snuffel.internal`.

**Controle:** de regel staat in de lijst. Of hij werkt, test je aan het eind van stap 10; de apparaten kennen de naam nog niet.

### Stap 10. Leer alle apparaten de naam `snuffel.internal` (DNS)

**Waarom.** Typt een tablet `snuffel.internal`, dan vraagt hij aan de DNS-server welk IP-adres daarbij hoort. Normaal is de router de DNS-server, en die kent `snuffel.internal` niet. Je moet dus ergens vastleggen: `snuffel.internal` = `192.168.1.20`.

**Kies één route:**

- **Route A: in je router.** Alleen als je router zelf namen kan toevoegen. Dat kunnen onder andere routers van UniFi, Asus (met eigen firmware), OpenWrt, TP-Link Omada en routers met Pi-hole of AdGuard Home. Zoek in je router naar **Lokale DNS**, **DNS-records**, **Hostnamen** of **Local DNS Records**. Vind je dat niet, neem dan route B. De routers van KPN, Ziggo en Odido en een FRITZ!Box kunnen dit **niet**.
- **Route B: met het pakket DNS Server op de NAS.** Werkt met elke router. Meer stappen, maar alles staat hieronder.

Twijfel je, kies dan route B.

#### Route A: een naam toevoegen in je router

1. Log in op de router (zie stap 2b).
2. Ga naar de instelling voor lokale DNS (zie de woorden hierboven).
3. Voeg een nieuw record toe:
   - **Naam** of **Host** of **Domein**: `snuffel.internal`
   - **Type** (als het gevraagd wordt): `A`
   - **IP-adres** of **Waarde**: `192.168.1.20` (het IP-adres van jouw NAS)
4. Klik op **Opslaan** of **Toepassen**.
5. Ga naar [Controle van stap 10](#controle-van-stap-10-route-a-en-b).

#### Route B: DNS Server op de NAS

De NAS wordt het telefoonboek van je thuisnetwerk. Hij beantwoordt zelf de vraag naar `snuffel.internal`, en alle andere vragen (zoals `nos.nl` of `youtube.com`) stuurt hij door naar je router, zoals nu ook gebeurt. Voor de rest van je internet verandert er dus niets.

**B1. DNS Server installeren**

1. **Hoofdmenu** → **Pakketcentrum**.
2. Typ in het zoekveld `DNS Server`.
3. Klik bij **DNS Server** (van Synology) op **Installeren**. Wacht tot de knop **Openen** wordt, en klik daarop.

**B2. Een "zone" maken voor alles wat op `.internal` eindigt**

1. Klik in DNS Server links op **Zones**.
2. Klik op **Maken → Master-zone**.
3. Vul in:

   | Veld                  | Wat je invult                                |
   | --------------------- | -------------------------------------------- |
   | **Domeintype**        | `Forward Zone`                               |
   | **Domeinnaam**        | `internal` (zonder punt en zonder `snuffel`) |
   | **Master-DNS-server** | `192.168.1.20` (het IP-adres van jouw NAS)   |
   | alle andere velden    | niets veranderen, geen vinkjes zetten        |

4. Klik op **OK**. In de lijst staat nu de zone `internal`.

**B3. De naam `snuffel` toevoegen**

1. Klik in de lijst één keer op de zone `internal`, zodat hij gekleurd is.
2. Klik op **Bewerken → Bronrecord**. Er opent een lijst met een paar records die DSM zelf heeft gemaakt; laat die staan.
3. Klik op **Maken → A Type**.
4. Vul in:

   | Veld         | Wat je invult                                   |
   | ------------ | ----------------------------------------------- |
   | **Naam**     | `snuffel` (DSM zet er zelf `.internal.` achter) |
   | **TTL**      | niets veranderen                                |
   | **IP-adres** | `192.168.1.20` (het IP-adres van jouw NAS)      |

5. Klik op **OK** en sluit het venster met de records.

**B4. Alle andere namen doorsturen naar de router**

1. Klik in DNS Server links op **Resolutie**.
2. Zet een vinkje bij **Resolutieservices inschakelen**.
3. Zet een vinkje bij **Doorstuurservers inschakelen**.
4. Vul bij **Doorstuurserver 1** het IP-adres van je **router** in (bijvoorbeeld `192.168.1.1`). Laat **Doorstuurserver 2** leeg.
5. Klik op **Toepassen**.

**B5. Testen vanaf je laptop, vóórdat je de router aanpast**

Je test eerst of de NAS goed antwoordt. Pas als dat zo is, vertel je de router dat iedereen de NAS moet gebruiken. Zo voorkom je dat internet thuis stopt.

1. Open de opdrachtprompt:
   - **Windows**: druk op de Windows-toets, typ `cmd` en druk op Enter.
   - **Mac**: druk op Cmd+spatiebalk, typ `Terminal` en druk op Enter.
2. Typ het volgende (met het IP-adres van jouw NAS aan het eind) en druk op Enter:

   ```bash
   nslookup snuffel.internal 192.168.1.20
   ```

   Onderaan het antwoord staat een regel `Name: snuffel.internal` en daaronder `Address: 192.168.1.20`. Dat is goed.

3. Typ daarna dit en druk op Enter:

   ```bash
   nslookup nos.nl 192.168.1.20
   ```

   Onderaan staat `Name: nos.nl` met een of meer adressen eronder. Dat is goed: de NAS stuurt gewone namen door.

4. Zie je bij een van beide `can't find`, `timed out` of `Query refused`? Ga dan **niet** verder met B6. Controleer B2 tot en met B4 (vooral de vinkjes in B4) en probeer het opnieuw.

**B6. De router vertellen dat iedereen de NAS als DNS-server gebruikt**

1. Log in op de router (zie stap 2b).
2. Zoek de instelling waarmee de router aan apparaten doorgeeft welke DNS-server ze moeten gebruiken. Die heet bijvoorbeeld **DNS-server**, **Primaire DNS**, **Lokale DNS-server** of **DNS-server voor DHCP-clients**, en zit meestal bij **LAN**, **DHCP**, **Thuisnetwerk** of **Netwerkinstellingen**.
   - **FRITZ!Box**: **Thuisnetwerk → Netwerk** → tabblad **Netwerkinstellingen** → onderaan **IPv4-instellingen** → veld **Lokale DNS-server**: `192.168.1.20` → **OK**. Ga daarna naar **IPv6-instellingen** (zelfde tabblad) en haal het vinkje weg bij **DNSv6-server ook via Router Advertisement bekendmaken** → **OK**.
   - **Andere routers**: zoek op internet naar `<merk en type van je router> DNS server DHCP wijzigen`. Lukt het niet in je router, gebruik dan de [route per apparaat](#als-je-router-dit-niet-kan-dns-per-apparaat).
3. Vul het IP-adres van de NAS in (`192.168.1.20`). Is er een veld voor een **tweede DNS-server**, laat dat dan **leeg**. Een apparaat kiest soms willekeurig de tweede, en die kent `snuffel.internal` niet; dan werkt Snuffel soms wel en soms niet.
4. Klik op **Opslaan** of **Toepassen**.
5. Apparaten krijgen de nieuwe instelling pas als ze opnieuw met de wifi verbinden. Zet op **elke** telefoon, tablet en laptop de wifi even uit en na tien seconden weer aan. (Of start het apparaat opnieuw.)

**Belangrijk om te weten bij route B.** Vanaf nu zoekt elk apparaat in huis élk adres op via de NAS. Staat de NAS uit, of is hij aan het herstarten, dan werkt internet thuis even niet (websites "kunnen niet worden gevonden"). Daarom:

- Laat de NAS altijd aan staan. Controleer in **Configuratiescherm → Hardware en energie** → tabblad **Energieschema** dat er geen tijden staan waarop de NAS uitgaat.
- Wil je het terugdraaien, of werkt internet ineens niet meer: zet in de router de DNS-instelling uit B6 terug op leeg of automatisch, en zet op de apparaten de wifi uit en aan. Alles werkt dan weer zoals vroeger (alleen `snuffel.internal` niet).

#### Als je router dit niet kan: DNS per apparaat

Kun je in je router de DNS-server niet aanpassen? Dan stel je de DNS per apparaat in, alleen op de apparaten van de kinderen en jouw laptop:

- **iPad of iPhone**: **Instellingen → Wi-Fi** → tik op het **ⓘ** naast je thuisnetwerk → helemaal onderaan **DNS configureren** → **Handmatig** → tik op het rode min-teken bij elke bestaande server en op **Verwijder** → **Voeg server toe** → `192.168.1.20` → rechtsboven **Bewaar**.
- **Windows-laptop**: **Start → Instellingen → Netwerk en internet → Wi-Fi** → klik op de naam van je thuisnetwerk (of **Eigenschappen van hardware**) → bij **DNS-servertoewijzing** op **Bewerken** → kies **Handmatig** → zet **IPv4** aan → **Voorkeurs-DNS**: `192.168.1.20` → **Opslaan**.
- **Mac**: **Systeeminstellingen → Wifi → Details** naast je thuisnetwerk → **DNS** → selecteer de bestaande servers en klik op **−** → klik op **+** → `192.168.1.20` → **OK**.
- **Android** heeft geen eenvoudige instelling hiervoor. Gebruik voor Android-apparaten B6 in de router, of route A.

#### Controle van stap 10 (route A en B)

1. Open op je laptop een **nieuwe** opdrachtprompt (zie B5) en typ `nslookup snuffel.internal` (nu zonder IP-adres erachter). Onderaan staat `Address: 192.168.1.20`.
2. Typ in de adresbalk van de browser **`http://snuffel.internal`** en druk op Enter. Typ de eerste keer echt `http://` ervoor: zonder dat denken sommige browsers dat je iets wilt zoeken en openen ze Google. Je ziet het inlogscherm van Snuffel met Ted.
3. Doe hetzelfde op een telefoon of tablet. Zorg dat die met de **thuiswifi** is verbonden (niet via 4G of 5G).
4. Open op je laptop ook een gewone website, bijvoorbeeld `nos.nl`, om te zien dat internet normaal werkt.

**Als het niet lukt:** zie [Problemen oplossen](#problemen-oplossen), de regels over `snuffel.internal`.

### Stap 11. Laat PocketBase weten dat er een reverse proxy tussen zit

**Waarom.** Alle bezoekers komen nu via de reverse proxy binnen. Zonder deze stap denkt PocketBase dat iedereen hetzelfde apparaat is (`127.0.0.1`, de NAS zelf). De bescherming tegen wachtwoord-raden (stap 13) zou dan iedereen tegelijk blokkeren als één kind een paar keer een verkeerd wachtwoord typt. De reverse proxy van DSM geeft het echte adres van elk apparaat mee in een "header" met de naam `X-Real-IP`; hier vertel je PocketBase die te gebruiken.

1. Open `http://snuffel.internal/_/` en log in als beheerder (stap 7).
2. Klik links onderaan op **Settings** (het tandwiel) → **Application**.
3. Vul bij **Application URL** in: `http://snuffel.internal`.
4. Zoek op dezelfde pagina het blok **Trusted proxy** (of **User IP proxy headers**).
   - Typ in het veld voor de headers `X-Real-IP`. Toont PocketBase eronder een lijst met gevonden headers, dan staat `X-Real-IP` daar waarschijnlijk tussen; je kunt er dan ook op klikken.
   - Laat **Use leftmost IP** uit.
5. Klik rechtsboven op **Save changes**.

**Controle:** klik links op **Logs** (het lijstje). Open Snuffel op je telefoon via `http://snuffel.internal`, ververs de logs en klik op het nieuwste verzoek. Bij **IP** staat nu het adres van je telefoon (iets als `192.168.1.34`), niet `127.0.0.1`.

**Als het niet lukt:** staat er nog steeds `127.0.0.1`, controleer dan de spelling `X-Real-IP` (hoofdletters X, R, I, P, met streepjes).

### Stap 12. Zet Snuffel op het beginscherm van elk apparaat

**Waarom.** Dan hoeft een kind nooit een adres te typen: één tik op het icoon en Snuffel opent.

Doe dit op elk apparaat van een kind, terwijl het met de thuiswifi is verbonden:

- **iPad of iPhone (Safari)**:
  1. Open Safari en typ `http://snuffel.internal`.
  2. Log in met het account van het kind.
  3. Tik op de **deelknop** (een vierkantje met een pijl omhoog; onderaan op een iPhone, rechtsboven op een iPad).
  4. Scroll omlaag en tik op **Zet op beginscherm**. Laat de naam `Snuffel` staan en tik op **Voeg toe**.
- **Android (Chrome)**:
  1. Open Chrome en typ `http://snuffel.internal`.
  2. Log in met het account van het kind.
  3. Tik rechtsboven op de **drie puntjes** (⋮) → **Toevoegen aan startscherm** → **Toevoegen**.
- **Laptop of computer**: open `http://snuffel.internal` en druk op **Ctrl+D** (Windows) of **Cmd+D** (Mac) om een bladwijzer te maken.

Een kind blijft daarna ingelogd op dat apparaat, tot het uitlogt of Snuffel een paar dagen niet opent.

**Controle:** tik op het icoon op het beginscherm. Snuffel opent en Ted begroet het kind.

## Deel 4: afmaken

### Stap 13. Back-ups en beveiliging

**Waarom.** Zonder back-up ben je alle voortgang kwijt als een schijf kapotgaat of er iets misgaat bij een update. En de beveiliging voorkomt dat iemand op je wifi eindeloos wachtwoorden probeert.

**13a. Automatische back-ups in PocketBase**

1. Open `http://snuffel.internal/_/` → **Settings** → **Backups**.
2. Zet de schakelaar bij **Enable auto backups** (of **Auto backups**) aan.
3. Vul bij **Cron expression** (het tijdstip) in: `0 3 * * *`. Dat betekent: elke nacht om 3:00 uur.
4. Vul bij **Max @auto backups to keep** in: `7`. Dan bewaart PocketBase de back-ups van de laatste zeven nachten.
5. Klik op **Save changes**.

Deze back-ups komen in de map `pb_data` op de NAS. Ze helpen bij een vergissing, maar niet als de NAS zelf kapotgaat. Daarom ook 13b.

**13b. Back-up naar een externe schijf met Hyper Backup**

Heb je al een Hyper Backup-taak naar een externe schijf of een andere plek? Voeg dan alleen de map toe: open **Hyper Backup**, klik op je taak → **Bewerken** → tabblad **Map** → vink `docker` → `snuffel` aan → **OK**.

Heb je nog geen Hyper Backup:

1. Sluit een USB-schijf aan op de NAS.
2. **Hoofdmenu** → **Pakketcentrum** → zoek `Hyper Backup` → **Installeren** → **Openen**.
3. Klik op **+** (linksonder) → **Gegevensback-uptaak**.
4. Kies **Lokale map en USB** → **Volgende** → kies de USB-schijf → **Volgende**.
5. Vink bij de mappen `docker` → `snuffel` aan (en eventueel andere mappen die je wilt bewaren) → **Volgende**.
6. Sla de toepassingen over (**Volgende**).
7. Zet **Back-upschema inschakelen** aan, bijvoorbeeld dagelijks om 04:00 (na de back-up van PocketBase) → **Volgende**.
8. Zet **Rotatie inschakelen** aan met de standaardinstellingen → **Gereed**. Kies **Ja** als gevraagd wordt of je nu een back-up wilt maken.

**13c. Bescherming tegen wachtwoord-raden**

1. Open `http://snuffel.internal/_/` → **Settings** → **Application**.
2. Zoek het blok **Rate limiting** en zet de schakelaar **Enable rate limiting** aan. De standaardregels die verschijnen zijn goed; verander ze niet.
3. Klik op **Save changes**.

**13d. Niet bereikbaar van buitenaf**

Snuffel hoort alleen thuis. Controleer in je router dat er **geen** "port forwarding" (ook: "poort doorsturen", "NAT", "virtuele server", "Portfreigaben") is ingesteld naar de NAS voor de poorten `80`, `443`, `5000`, `5001` of `8090`. Staat er niets, dan hoef je niets te doen. Zet het ook niet aan.

**Belangrijk:** verander in het beheerscherm van PocketBase **nooit** iets aan **Collections** zelf (velden, regels of nieuwe collecties). Dat gebeurt alleen via de code van Snuffel; een volgende update zou jouw wijziging anders ongedaan maken of laten vastlopen. Accounts toevoegen, wijzigen of een wachtwoord geven in **users** mag wel.

**Controle:** in **Settings → Backups** staat de schakelaar aan; na de eerste nacht staat er een back-up in de lijst. In Hyper Backup staat de taak met een groen vinkje na de eerste back-up.

### Stap 14 (mag je overslaan). Poort 8090 afsluiten

**Waarom.** Nu alles via `http://snuffel.internal` loopt, is het oude adres `http://192.168.1.20:8090` niet meer nodig. Met deze stap kan alleen de reverse proxy nog bij Snuffel. Dat is een extra slot op de deur, maar niet noodzakelijk. Twijfel je, sla hem dan over.

1. **Container Manager** → **Project** → klik op `snuffel` → **Actie → Stoppen**. Wacht tot de status **Gestopt** is.
2. Klik op het tabblad **YAML-configuratie** (bij het project) en klik op **Bewerken**.
3. Verander de regel

   ```yaml
   - '8090:8090' # alleen LAN; geen port forwarding op de router
   ```

   in

   ```yaml
   - '127.0.0.1:8090:8090' # alleen via de reverse proxy van DSM
   ```

   Laat de spaties aan het begin van de regel precies staan.

4. Klik op **Opslaan**. Vraagt Container Manager of hij het project opnieuw moet bouwen, kies **Ja** of **Bouwen**. Anders: **Actie → Bouwen**.
5. Wacht tot de container weer op **Gezond** staat (zie stap 6).

**Controle:** `http://snuffel.internal` werkt nog; `http://192.168.1.20:8090` werkt niet meer ("Kan deze site niet bereiken").

**Als het niet lukt:** werkt ook `snuffel.internal` niet meer, zet de regel dan terug op `- '8090:8090' # alleen LAN; geen port forwarding op de router` en bouw opnieuw.

Overal waar in de README `http://<nas>:8090` staat, gebruik je vanaf nu `http://snuffel.internal`.

## Klaar

Snuffel draait op je NAS, start vanzelf na een herstart van de NAS, is bereikbaar op `http://snuffel.internal`, en de gegevens worden elke nacht bewaard.

## Bijwerken naar een nieuwe versie

**Wanneer.** Elke keer dat er een wijziging in Snuffel wordt samengevoegd (bijvoorbeeld een nieuwe les), staat er binnen ongeveer tien minuten een nieuwe image klaar. Je ziet dat op GitHub bij **Actions → release**: de bovenste regel heeft een groen vinkje.

**Hoe.**

1. **Container Manager** → links **Image**.
2. Bij `ghcr.io/versure/snuffel` staat **Update beschikbaar**. Klik op die regel en daarna bovenaan op **Bijwerken** → **OK**. Container Manager downloadt de nieuwe image en start de container opnieuw.
   - Staat er geen **Update beschikbaar**: klik links op **Project** → `snuffel` → **Actie → Stoppen**, en daarna **Actie → Bouwen**. Dan downloadt hij de nieuwste versie en start hij weer.
3. Klik links op **Container** en wacht tot `snuffel` weer op **Gezond** staat.
4. Open `http://snuffel.internal` en controleer dat je kunt inloggen.

Je gegevens blijven bewaard; ze staan in `pb_data`, niet in de image. Wijzigingen in de database worden bij het starten automatisch doorgevoerd. Terug naar een eerdere versie: zie de README, "Uitrollen op de NAS", stap 9.

## Problemen oplossen

| Wat je ziet                                                                        | Wat je doet                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| De container staat op **Ongezond** of **Gestopt**                                  | **Container Manager → Container** → dubbelklik `snuffel` → tabblad **Logboek**. Staat er `permission denied` bij `pb_data`: doe stap 3a opnieuw en controleer met `controle-rechten.txt` (3a-6). Daarna **Actie → Herstarten**.                                                                                                                                                  |
| Downloaden van de image mislukt met `denied` of `unauthorized`                     | De image is niet openbaar (meer). Volg [Bijlage A](#bijlage-a-inloggen-bij-ghcrio).                                                                                                                                                                                                                                                                                              |
| Downloaden mislukt met `no matching manifest` of `exec format error`               | De NAS heeft geen Intel- of AMD-processor (stap 1b). Deze image werkt daar niet.                                                                                                                                                                                                                                                                                                 |
| `http://192.168.1.20:8090` werkt, `http://snuffel.internal` niet                   | Open een opdrachtprompt en typ `nslookup snuffel.internal`. Staat er **niet** `192.168.1.20`: de DNS klopt niet (stap 10); zet de wifi uit en aan en probeer opnieuw. Staat er **wel** `192.168.1.20`: controleer de reverse proxy (stap 9), vooral Hostnaam `snuffel.internal`, poort `80`, bestemming `127.0.0.1` en poort `8090`.                                             |
| Je komt op een pagina van DSM of ziet "Web Station is niet geïnstalleerd"          | De hostnaam in de reverse proxy (stap 9) is anders gespeld dan wat je typt. Ze moeten precies gelijk zijn: `snuffel.internal`, kleine letters.                                                                                                                                                                                                                                   |
| Een waarschuwing over een certificaat, of "Je verbinding is niet privé"            | De browser probeert `https://`. Typ `http://snuffel.internal` (zonder s) en gebruik daarna het icoon of de bladwijzer uit stap 12.                                                                                                                                                                                                                                               |
| De browser zoekt op Google in plaats van Snuffel te openen                         | Typ `http://` voor het adres: `http://snuffel.internal`.                                                                                                                                                                                                                                                                                                                         |
| Op het ene apparaat werkt `snuffel.internal` wel, op het andere niet, of af en toe | Het apparaat gebruikt nog een andere DNS-server. Zet de wifi uit en weer aan. Helpt dat niet: veel routers geven via IPv6 ook nog hun eigen DNS-server door. Zoek in de router bij **IPv6** de DNS-instelling en zet die ook op de NAS, of zet het doorgeven van DNS via IPv6 ("RDNSS", "Router Advertisement") uit. Controleer ook dat je in B6 geen tweede DNS-server invulde. |
| Na stap B6 werkt internet thuis niet meer                                          | Zet in de router de DNS-instelling uit B6 terug op leeg of automatisch en zet de wifi op je apparaten uit en aan. Internet werkt dan weer. Controleer daarna B4 (beide vinkjes, router als doorstuurserver) en doe B5 opnieuw voordat je B6 nog eens probeert.                                                                                                                   |
| Internet werkt thuis ineens niet meer (na route B)                                 | Waarschijnlijk staat de NAS uit of start hij opnieuw op. Wacht tot hij weer draait, of draai B6 terug zoals hierboven.                                                                                                                                                                                                                                                           |
| Een kind is het wachtwoord vergeten                                                | `http://snuffel.internal/_/` → **users** → klik op het account → vul **password** en **passwordConfirm** in → **Save changes**.                                                                                                                                                                                                                                                  |
| Je bent het wachtwoord van de PocketBase-beheerder vergeten                        | Doe stap 7b en 7c opnieuw met hetzelfde e-mailadres en een nieuw wachtwoord.                                                                                                                                                                                                                                                                                                     |

## Bijlage A: inloggen bij ghcr.io

Alleen nodig als stap 4 of 5 zegt dat de image niet openbaar is. De NAS moet dan met een GitHub-sleutel ("token") inloggen bij `ghcr.io`.

**A1. Een token maken op GitHub**

1. Ga naar `https://github.com` en log in.
2. Klik rechtsboven op je **profielfoto** → **Settings**.
3. Klik links helemaal onderaan op **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
4. Klik op **Generate new token** → **Generate new token (classic)**. Bevestig zo nodig met je GitHub-wachtwoord.
5. Vul in:
   - **Note**: `NAS Snuffel`
   - **Expiration**: kies **Custom** en een datum over een jaar. Zet die datum in je agenda: dan maak je een nieuw token.
   - Vink **alleen** `read:packages` aan. Niets anders.
6. Klik onderaan op **Generate token**.
7. Kopieer het token (begint met `ghp_`) meteen naar je wachtwoordmanager. Je ziet het maar één keer.

**A2. De NAS laten inloggen**

Je doet dit, net als in stap 3a, met een taak in de Taakplanner.

1. **Configuratiescherm → Taakplanner → Maken → Geplande taak → Door gebruiker gedefinieerd script**.
2. Tabblad **Algemeen**: **Taak** `ghcr-login`, **Gebruiker** `root`, **Ingeschakeld** uit.
3. Tabblad **Taakinstellingen**: plak deze regel, met in plaats van `GITHUB-GEBRUIKER` je GitHub-gebruikersnaam en in plaats van `ghp_JOUWTOKEN` het token:

   ```sh
   echo ghp_JOUWTOKEN | /usr/local/bin/docker login ghcr.io -u GITHUB-GEBRUIKER --password-stdin > /volume1/docker/snuffel/controle-login.txt 2>&1
   ```

4. **OK**, klik op de taak → **Uitvoeren** → **OK**.
5. Open in File Station `docker` → `snuffel` → `controle-login.txt` (downloaden en openen). Er moet `Login Succeeded` in staan.
6. **Ruim op**: verwijder `controle-login.txt` en verwijder de taak `ghcr-login` (daar staat je token in).
7. Ga terug naar stap 5. Bestaat het project al: **Project** → `snuffel` → **Actie → Bouwen**. Mislukt het downloaden daarna nog steeds met `unauthorized`, meld het dan: dan zoeken we samen een andere manier.

Verloopt het token na een jaar, dan mislukt een update met `unauthorized`. Maak dan een nieuw token (A1) en doe A2 opnieuw.

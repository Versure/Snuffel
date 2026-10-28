# Snuffel op de NAS installeren

Dit stappenplan zet Snuffel op je Synology NAS en maakt de app bereikbaar op **`http://snuffel.internal`**, alleen in je thuisnetwerk. Doe de stappen op volgorde; elke stap eindigt met een controle. Lukt een controle niet, ga dan niet verder maar kijk bij [Problemen oplossen](#problemen-oplossen).

Reken op ongeveer een uur. Je hebt nodig: een laptop op de thuiswifi, toegang tot DSM (de webinterface van de NAS) als beheerder, toegang tot de instellingen van je router en je GitHub-account.

**Hoe het werkt.** Snuffel is één container (de app plus PocketBase) op poort `8090` van de NAS. De reverse proxy van DSM luistert op poort `80` naar de naam `snuffel.internal` en stuurt alles door naar die container. Een DNS-server in je thuisnetwerk vertelt elk apparaat dat `snuffel.internal` het IP-adres van de NAS is. Niets hiervan is van buitenaf bereikbaar.

```
telefoon ──"snuffel.internal?"──▶ DNS (router of NAS) ──▶ 192.168.1.20
telefoon ──http://snuffel.internal (poort 80)──▶ reverse proxy DSM ──▶ container snuffel (poort 8090)
```

In dit stappenplan is `192.168.1.20` het voorbeeld-IP-adres van de NAS en `192.168.1.1` dat van de router. Vul overal je eigen adressen in.

## Deel 1: voorbereiden

### Stap 1. Controleer of je NAS geschikt is

1. Open DSM in je browser (meestal `http://<ip-van-de-nas>:5000`) en log in als beheerder.
2. Ga naar **Configuratiescherm → Infocentrum → Algemeen**. Controleer:
   - **DSM-versie**: 7.2 of nieuwer. Zo niet: **Configuratiescherm → Bijwerken en herstellen** en eerst bijwerken.
   - **CPU**: een Intel- of AMD-processor (bijvoorbeeld Celeron, Pentium, Atom, Ryzen, Xeon). De Snuffel-image is alleen gebouwd voor `linux/amd64`. Staat er Realtek of Annapurna (ARM), dan werkt deze image niet; stop hier en meld het.
3. Open **Pakketcentrum**, zoek **Container Manager** en klik op **Installeren** (staat hij er al, dan is dit klaar).

**Controle:** Container Manager staat in het hoofdmenu van DSM en opent zonder foutmelding.

### Stap 2. Geef de NAS een vast IP-adres

De naam `snuffel.internal` wijst straks naar een IP-adres. Dat adres mag dus nooit veranderen.

1. Kijk in DSM bij **Configuratiescherm → Netwerk → Netwerkinterface** welk IP-adres de NAS nu heeft (bijvoorbeeld `192.168.1.20`). Noteer het.
2. Log in op je router (meestal `http://192.168.1.1`; het adres en wachtwoord staan vaak op een sticker op de router).
3. Zoek de DHCP-instellingen. Ze heten per router anders: "DHCP-reservering", "Vast IP-adres", "Statische lease", "Adresreservering" of "Dit apparaat altijd hetzelfde IPv4-adres geven". Kies de NAS in de lijst met apparaten en reserveer het adres uit punt 1.
4. Sla op.

**Controle:** start de NAS opnieuw (**hoofdmenu → Opnieuw opstarten**) en kijk of hij hetzelfde IP-adres terugkrijgt.

### Stap 3. Maak de map voor de gegevens

Alle gegevens van Snuffel (accounts, voortgang, back-ups van PocketBase) staan in één map op de NAS.

1. Open **File Station**.
2. Ga naar de gedeelde map `docker` (bestaat die niet, dan maakte Container Manager hem bij de installatie; anders: **Configuratiescherm → Gedeelde map → Maken**, naam `docker`, op `Volume 1`).
3. Maak in `docker` een map `snuffel` en daarin een map `pb_data`. Het volledige pad is nu `/volume1/docker/snuffel/pb_data`.
4. Ga verder met stap 3a hieronder: de container moet in deze map mogen schrijven.

**Controle:** in File Station staat `/volume1/docker/snuffel/pb_data`.

### Stap 3a. Geef de container schrijfrechten op `pb_data`

**Waarom.** Elk programma op de NAS draait als een "gebruiker" met een nummer (uid). Om veiligheidsredenen draait Snuffel niet als beheerder (`root`), maar als gebruiker nummer **`1000`** in groep nummer **`1000`**. De map `pb_data` die je net maakte, is van jouw DSM-gebruiker. Gebruiker `1000` mag er dus nog niet in schrijven, en dan stopt Snuffel bij het starten met de fout `permission denied`.

**Wat je gaat doen.** Je maakt gebruiker `1000` eigenaar van de map `pb_data`, met dit commando:

```sh
chown -R 1000:1000 /volume1/docker/snuffel/pb_data
```

- `chown` betekent "change owner": verander de eigenaar.
- `-R` betekent: ook van alles wat erin staat.
- `1000:1000` is de nieuwe eigenaar: gebruiker `1000` en groep `1000`.
- `/volume1/docker/snuffel/pb_data` is de map uit stap 3.

Via **File Station → Eigenschappen → Machtiging** gaat dit niet: daar kun je alleen DSM-gebruikers kiezen, en gebruiker `1000` is geen DSM-gebruiker. Daarom laat je de Taakplanner van DSM het commando één keer als beheerder uitvoeren. Dat gaat zo:

**3a-1. De taak maken**

1. Open **Configuratiescherm** (hoofdmenu, linksboven in DSM).
2. Klik in de linkerkolom op **Taakplanner** (onder **Services**). Zie je hem niet, klik dan rechtsboven op **Geavanceerde modus**.
3. Klik op **Maken → Geplande taak → Door gebruiker gedefinieerd script**. Er opent een venster met drie tabbladen.

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

1. De taak `snuffel-rechten` staat nu in de lijst van de Taakplanner. Klik er één keer op, zodat de regel blauw is.
2. Klik bovenaan op **Uitvoeren** en bevestig met **OK**. Het commando duurt minder dan een seconde.

**3a-6. Controleren**

1. Open **File Station** en ga naar `docker` → `snuffel`. Daar staat nu het bestand `controle-rechten.txt`. (Zie je het niet, klik dan op het pijltje voor vernieuwen.)
2. Rechtsklik op het bestand → **Downloaden**, en open het op je laptop met Kladblok of Teksteditor, of open het met **Text Editor** op de NAS als je dat pakket hebt.
3. Je ziet een regel die eindigt op `pb_data`, ongeveer zo:

   ```
   drwxrwxrwx+ 1 1000 1000 0 Oct 28 10:12 pb_data
   ```

   De twee getallen vóór de grootte moeten **`1000 1000`** zijn. Dan is het gelukt. De letters aan het begin en de datum mogen anders zijn.

4. Staat er iets anders dan `1000 1000` (bijvoorbeeld `1026 100`), of is het bestand er niet: controleer in 3a-2 of de gebruiker `root` is en in 3a-4 of het pad precies `/volume1/docker/snuffel/pb_data` is (kleine letters, geen spaties). Pas de taak aan (**Bewerken**) en voer hem opnieuw uit.

**3a-7. Opruimen**

1. Verwijder in File Station het bestand `controle-rechten.txt` (rechtsklik → **Verwijderen**).
2. Klik in de Taakplanner op de taak `snuffel-rechten` en daarna op **Verwijderen**. De taak is niet meer nodig: de eigenaar blijft `1000`, ook na een herstart van de NAS of een update van Snuffel.

**Werk je liever met SSH?** Zet SSH aan (**Configuratiescherm → Terminal en SNMP → SSH-service inschakelen**), log in met `ssh <jouw-dsm-gebruiker>@192.168.1.20` en typ `sudo chown -R 1000:1000 /volume1/docker/snuffel/pb_data` (je DSM-wachtwoord als daarom gevraagd wordt). Controleer met `ls -ln /volume1/docker/snuffel`. Zet SSH daarna weer uit.

**Controle:** `controle-rechten.txt` liet `1000 1000` zien bij `pb_data`. In stap 6 zie je het ook: de container komt dan op **Gezond**.

### Stap 4. Geef de NAS toegang tot de Snuffel-image

Na elke merge naar `main` zet GitHub de nieuwste versie van Snuffel als image op `ghcr.io/versure/snuffel`. Is de repository privé, dan is de image dat ook en moet de NAS kunnen inloggen.

1. Kijk op GitHub bij de repository → rechts **Packages → snuffel**. Staat er **Public**, sla deze stap dan over.
2. Maak een token: GitHub → je profielfoto → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**.
   - **Note**: `NAS Snuffel`.
   - **Expiration**: kies een datum (bijvoorbeeld een jaar) en zet hem in je agenda; daarna maak je een nieuwe.
   - Vink **alleen** `read:packages` aan. Niets anders.
   - **Generate token** en kopieer het token (begint met `ghp_`). Je ziet het maar één keer.
3. In DSM: **Container Manager → Register → Instellingen → Toevoegen**.
   - **Registernaam**: `ghcr`
   - **Register-URL**: `https://ghcr.io`
   - Vink **Verificatie vertrouwen** aan; vul bij **Gebruikersnaam** je GitHub-gebruikersnaam in en bij **Wachtwoord** het token.
   - **Toevoegen**. Je hoeft dit register niet als standaard te gebruiken.

**Controle:** het register `ghcr` staat in de lijst zonder foutmelding.

## Deel 2: Snuffel starten

### Stap 5. Maak het project in Container Manager

1. **Container Manager → Project → Maken**.
2. Vul in:
   - **Projectnaam**: `snuffel`
   - **Pad**: kies `/docker/snuffel` (de map uit stap 3, niet `pb_data`).
   - **Bron**: **docker-compose.yml maken**.
3. Plak in het tekstvak precies dit (dit is [`deploy/compose.nas.yml`](../deploy/compose.nas.yml)):

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

4. **Volgende**. Krijg je een vraag over een webportaal via Web Station: **niet** inschakelen (dat regel je in stap 10 zelf). **Volgende → Gereed**. Container Manager haalt de image op en start hem.

### Stap 6. Controleer of Snuffel draait

1. **Container Manager → Container**. Na ongeveer een halve minuut staat `snuffel` op **Actief** met status **Gezond**.
2. Open op je laptop `http://192.168.1.20:8090/api/health`. Je ziet een regel tekst met `"message":"API is healthy."`.
3. Open `http://192.168.1.20:8090`. Je ziet het inlogscherm van Snuffel met Ted.

**Controle:** alle drie lukken. Staat de container op **Ongezond** of stopt hij meteen: zie [Problemen oplossen](#problemen-oplossen).

### Stap 7. Maak de beheerder van PocketBase

De beheerder (superuser) beheert de accounts en instellingen. Dit account is van jou en staat los van de Snuffel-accounts.

1. **Container Manager → Container → `snuffel`** → tabblad **Terminal** (of **Actie → Terminal openen**) **→ Maken → Starten met opdracht** en typ `sh`.
2. Typ, met je eigen e-mailadres en een sterk wachtwoord (minstens 12 tekens; gebruik je wachtwoordmanager):

   ```sh
   /pb/pocketbase superuser upsert jouw@email.nl JouwSterkeWachtwoord --dir /pb/pb_data
   ```

   Je ziet `Successfully saved superuser "jouw@email.nl"!`.

3. Sluit de terminal. Open `http://192.168.1.20:8090/_/` en log in met dit e-mailadres en wachtwoord.

**Controle:** je ziet het beheerscherm van PocketBase met links de collecties (`users`, `lesson_progress`, …).

### Stap 8. Maak de accounts

Snuffel heeft geen aanmeldpagina; jij maakt de accounts in het beheerscherm.

1. In `/_/`: **Collections → users → + New record**.
2. Maak eerst je eigen account:
   - `username`: bijvoorbeeld `jop` (3 tot 20 tekens: kleine letters, cijfers en streepjes). Hiermee log je in.
   - `name`: de naam die Ted gebruikt ("Hoi, Jop!").
   - `role`: `parent`.
   - `password` en `passwordConfirm`: minstens 8 tekens.
   - Een e-mailadres is niet nodig. **Create**.
3. Herhaal voor elk kind, met `role`: `child`.
4. Open `http://192.168.1.20:8090`, log in met elk account en log weer uit.

**Controle:** elk account kan inloggen; met jouw account zie je op de startpagina "Naar het ouderoverzicht".

## Deel 3: de leesbare url `snuffel.internal`

**Waarom `.internal`?** Deze naam is officieel gereserveerd voor thuis- en bedrijfsnetwerken: hij bestaat nergens op internet en zal er nooit bestaan. Gebruik geen `.local` (die is van Bonjour/AirPlay en botst) en geen verzonnen naam als `.thuis` of `.nl` (die kan echt bestaan). Wil je een andere naam dan `snuffel`, vul hem dan in stap 9 én stap 10 hetzelfde in.

Twee dingen zijn nodig: de NAS moet de naam herkennen (stap 9) en elk apparaat moet weten dat de naam bij de NAS hoort (stap 10).

### Stap 9. Stel de reverse proxy van DSM in

1. **Configuratiescherm → Aanmeldingsportal → Geavanceerd → Reverse proxy → Maken**.
2. Tabblad **Algemene instellingen**:
   - **Beschrijving**: `Snuffel`
   - **Bron**:
     - **Protocol**: `HTTP`
     - **Hostnaam**: `snuffel.internal`
     - **Poort**: `80`
     - HSTS en de toegangscontrole laat je uit.
   - **Bestemming**:
     - **Protocol**: `HTTP`
     - **Hostnaam**: `127.0.0.1` (niet `localhost`)
     - **Poort**: `8090`
3. Tabblad **Aangepaste koptekst**: niets toevoegen.
4. Tabblad **Geavanceerde instellingen**: laat de standaardwaarden staan.
5. **Opslaan**.

De reverse proxy reageert alleen op de naam `snuffel.internal`. DSM zelf blijft gewoon op poort 5000/5001.

**Controle:** dit kun je pas testen na stap 10.

### Stap 10. Zorg dat apparaten de naam kennen (DNS)

Kies **één** van de twee routes.

- **Route A** als je router zelf namen kan toevoegen ("lokale DNS", "DNS-records", "Hostnamen", "Local DNS"). Dat kunnen onder andere UniFi, Asus, OpenWrt, Omada, en routers met Pi-hole of AdGuard. De meeste routers van de provider (KPN Box, Ziggo, Odido) en een FRITZ!Box kunnen dat **niet** voor een eigen naam: neem dan route B.
- **Route B** met het pakket **DNS Server** op de NAS. Werkt met elke router.

#### Route A: lokale DNS op de router

1. Zoek in de router de lokale DNS-instelling.
2. Voeg een record toe: naam (host) `snuffel.internal`, type `A` (als het gevraagd wordt), IP-adres `192.168.1.20`.
3. Sla op. Ga verder met de controle onderaan deze stap.

#### Route B: DNS Server op de NAS

De NAS wordt dan de "adresboekhouder" van je thuisnetwerk: hij beantwoordt `snuffel.internal` zelf en stuurt alle andere vragen (zoals `nos.nl`) door naar je router, zoals nu.

**B1. DNS Server installeren**

1. **Pakketcentrum** → zoek **DNS Server** → **Installeren**. Open het pakket.

**B2. De zone `internal` maken**

1. **Zones → Maken → Master-zone**.
2. Vul in:
   - **Domeintype**: `Forward Zone`
   - **Domeinnaam**: `internal`
   - **Master-DNS-server**: `192.168.1.20`
   - De overige opties laat je uit.
3. **OK**.

**B3. De naam `snuffel` toevoegen**

1. Selecteer de zone `internal` → **Bewerken → Bronrecord** (resource record).
2. **Maken → A-type**.
   - **Naam**: `snuffel` (DSM zet er zelf `.internal.` achter)
   - **TTL**: laat de standaardwaarde staan
   - **IP-adres**: `192.168.1.20`
3. **OK**.

**B4. Andere namen doorsturen**

1. Ga naar **Resolutie**.
2. Vink **Resolutieservice inschakelen** aan.
3. Vink **Doorstuurservers inschakelen** aan; **Doorstuurserver 1**: `192.168.1.1` (je router). Laat **Doorstuurserver 2** leeg.
4. **Toepassen**.

**B5. Testen vanaf je laptop**, vóórdat je de router aanpast. Open een opdrachtprompt (Windows: Start → `cmd`; Mac: Terminal) en typ:

```bash
nslookup snuffel.internal 192.168.1.20
```

Je ziet onderaan `Address: 192.168.1.20`. Test ook dat gewone namen werken:

```bash
nslookup nos.nl 192.168.1.20
```

Je ziet een of meer adressen. Lukt een van beide niet, ga dan **niet** verder met B6 (anders werkt internet thuis niet meer); kijk bij [Problemen oplossen](#problemen-oplossen).

**B6. De router de NAS laten aanwijzen als DNS-server**

1. Log in op de router en zoek de DHCP-instellingen (soms "LAN", "Thuisnetwerk" of "Netwerkinstellingen").
2. Zet **DNS-server** (of "Primaire DNS", "DNS-server voor DHCP-clients") op `192.168.1.20`. Vul bij een tweede DNS-server **niets** in: een apparaat kiest soms willekeurig de tweede, en die kent `snuffel.internal` niet.
3. Sla op.
4. Apparaten krijgen de nieuwe instelling pas als ze opnieuw verbinden. Zet op elke telefoon, tablet en laptop wifi even uit en weer aan.

Let op: vanaf nu gaat elke naamvraag in huis via de NAS. Staat de NAS uit of start hij opnieuw op, dan werkt internet thuis even niet. Zet de NAS dus niet in slaap/uit op vaste tijden (**Configuratiescherm → Hardware en energie → Energieschema**). Wil je dat terugdraaien, zet de DNS-instelling van de router dan terug op automatisch.

Kun je de DNS van je router niet aanpassen? Dan kun je het per apparaat doen. Op een iPad of iPhone: **Instellingen → Wi-Fi → ⓘ naast je netwerk → DNS configureren → Handmatig**, verwijder de bestaande servers en voeg `192.168.1.20` toe. Op een Windows-laptop: **Instellingen → Netwerk en internet → Wi-Fi → (je netwerk) → DNS-servertoewijzing → Bewerken → Handmatig → IPv4** met `192.168.1.20`.

#### Controle (route A en B)

1. Open op je laptop een nieuwe opdrachtprompt en typ `nslookup snuffel.internal`. Je ziet `192.168.1.20`.
2. Open in de browser **`http://snuffel.internal`**. Typ de eerste keer echt `http://` ervoor; zonder dat zoekt sommige browsers op Google naar de tekst. Je ziet het inlogscherm van Snuffel.
3. Doe hetzelfde op een telefoon of tablet van een kind, verbonden met de thuiswifi (niet via 4G/5G).

### Stap 11. Laat PocketBase de reverse proxy kennen

Alle bezoekers komen nu via de reverse proxy binnen. Zonder deze stap ziet PocketBase iedereen als hetzelfde adres (`127.0.0.1`), en dan geldt de bescherming tegen wachtwoord-raden (stap 13) voor iedereen tegelijk.

1. Open `http://snuffel.internal/_/` en log in als beheerder.
2. **Settings → Application**.
3. **Application URL**: `http://snuffel.internal`.
4. Bij **User IP proxy headers** (ook "Trusted proxy"): voeg `X-Real-IP` toe. Laat **Use leftmost IP** uit.
5. **Save changes**.

**Controle:** onder **Logs** zie je bij nieuwe verzoeken het IP-adres van het apparaat (bijvoorbeeld `192.168.1.34`) in plaats van `127.0.0.1`.

### Stap 12. Zet Snuffel op het beginscherm

Op elk apparaat van een kind, ingelogd met het account van dat kind:

- **iPad/iPhone (Safari)**: open `http://snuffel.internal` → deelknop (vierkant met pijl) → **Zet op beginscherm** → naam `Snuffel` → **Voeg toe**.
- **Android (Chrome)**: open `http://snuffel.internal` → menu (⋮) → **Toevoegen aan startscherm** → **Toevoegen**.
- **Laptop**: maak een bladwijzer (Ctrl+D, op een Mac Cmd+D).

Het kind hoeft daarna nooit meer een adres te typen.

## Deel 4: afmaken

### Stap 13. Back-ups en beveiliging

1. `http://snuffel.internal/_/` → **Settings → Backups** → **Enable auto backups**: cron `0 3 * * *` (elke nacht om 3 uur), **Max auto backups to keep**: `7`. **Save changes**.
2. **Settings → Rate limiting** → **Enable rate limiting** aan (de standaardregels zijn goed). **Save changes**.
3. Als je **Hyper Backup** gebruikt: voeg de map `docker/snuffel` toe aan een back-uptaak, bij voorkeur naar een externe schijf of een tweede locatie.
4. Op de router: zet **geen** port forwarding naar de NAS voor poort 80, 8090 of 5000. Snuffel hoort alleen thuis.

Wijzig in `/_/` nooit collecties, velden of toegangsregels; dat gaat alleen via een migratie in de repo. Accounts maken en wijzigen mag wel.

### Stap 14 (optioneel). Poort 8090 dichtzetten

Nu alles via `snuffel.internal` loopt, is `http://192.168.1.20:8090` niet meer nodig. Wil je dat alleen de reverse proxy bij de container kan:

1. **Container Manager → Project → `snuffel` → Actie → Stoppen**.
2. **YAML-configuratie** (of **Bewerken**): verander de regel bij `ports` in

   ```yaml
   - '127.0.0.1:8090:8090' # alleen via de reverse proxy van DSM
   ```

3. **Opslaan → Bouwen** en het project weer starten.

**Controle:** `http://snuffel.internal` werkt nog, `http://192.168.1.20:8090` niet meer. Lukt `snuffel.internal` dan ook niet meer, zet de regel terug op `'8090:8090'`.

De beschrijvingen in de README die `http://<nas>:8090` noemen, gelden dan als `http://snuffel.internal`.

## Bijwerken naar een nieuwe versie

Na elke merge naar `main` staat binnen een paar minuten een nieuwe image klaar (GitHub → **Actions → release** moet groen zijn).

1. **Container Manager → Project → `snuffel` → Actie → Stoppen**.
2. **Container Manager → Image** → `ghcr.io/versure/snuffel` → als er **Update beschikbaar** staat: **Bijwerken**. Staat dat er niet: **Project → `snuffel` → Actie → Bouwen** haalt de nieuwste `latest` op.
3. **Project → `snuffel` → Actie → Starten**.
4. Controleer dat de container op **Gezond** komt en open `http://snuffel.internal`.

Nieuwe migraties worden bij de start automatisch toegepast. Terug naar een eerdere versie: zie de README, "Uitrollen op de NAS", stap 9.

## Problemen oplossen

| Wat je ziet                                                             | Wat je doet                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Container staat op **Ongezond** of stopt meteen                         | **Container → `snuffel` → Log**. Staat er `permission denied` bij `pb_data`: doe stap 3a opnieuw en controleer met `controle-rechten.txt` (3a-6).                                                                                                                                                |
| Image ophalen mislukt (`denied`, `unauthorized`)                        | Token verlopen of zonder `read:packages`: maak een nieuw token (stap 4) en pas het register aan.                                                                                                                                                                                                 |
| Image ophalen mislukt met `no matching manifest` of `exec format error` | De NAS heeft een ARM-processor (stap 1). Deze image werkt daar niet.                                                                                                                                                                                                                             |
| `http://192.168.1.20:8090` werkt, `http://snuffel.internal` niet        | Typ `nslookup snuffel.internal`. Geen `192.168.1.20`: DNS klopt niet (stap 10; wifi opnieuw verbinden). Wel het juiste adres: controleer de reverse proxy (stap 9, vooral hostnaam en poort `80` → `127.0.0.1:8090`).                                                                            |
| Je komt op een DSM-pagina of "Web Station is niet geïnstalleerd"        | De hostnaam in de reverse proxy (stap 9) is anders geschreven dan wat je typt. Ze moeten precies gelijk zijn.                                                                                                                                                                                    |
| Waarschuwing over een certificaat of "verbinding is niet privé"         | De browser probeert `https://`. Typ `http://snuffel.internal` en gebruik de bladwijzer of het beginschermicoon uit stap 12.                                                                                                                                                                      |
| Browser zoekt op Google in plaats van Snuffel te openen                 | Typ `http://` ervoor (stap 10, controle).                                                                                                                                                                                                                                                        |
| Op sommige apparaten werkt de naam wel, op andere niet of af en toe     | Het apparaat gebruikt nog een andere DNS-server. Zet wifi uit en aan. Helpt dat niet: veel routers geven via IPv6 hun eigen DNS-server door. Zet in de router bij IPv6 de DNS-server ook op de NAS, of zet "DNS via IPv6/RDNSS" uit. Controleer ook dat je in B6 geen tweede DNS-server invulde. |
| Na stap B6 werkt internet thuis niet meer                               | Zet in de router de DNS-instelling terug op automatisch; alles werkt dan weer zoals eerst. Controleer daarna B4 (resolutieservice en doorstuurserver aan) en B5 opnieuw.                                                                                                                         |
| Een kind is het wachtwoord vergeten                                     | `/_/` → **users** → het account → nieuw `password` en `passwordConfirm` → **Save changes**.                                                                                                                                                                                                      |

# Snuffel

Leerportaal voor thuis: korte interactieve lessen en huiswerkhulp, met Ted als gids. Angular-app met PocketBase in één container, op een Synology NAS, alleen bereikbaar op het thuisnetwerk. Geen AI en geen externe diensten in de app.

Plan en beslissingen: [docs/plan/implementatieplan.md](docs/plan/implementatieplan.md). Conventies: [CLAUDE.md](CLAUDE.md).

## Lokaal draaien

Benodigd: Node.js uit [.nvmrc](.nvmrc) (Angular 22 vereist minstens 22.22.3 of 24.15) en git.

```bash
nvm install 24.22.0
nvm use 24.22.0
npm install
npm start
```

De app draait dan op http://localhost:4200. `npm install` zet ook de git-hooks aan.

`npm start` start ook PocketBase op http://127.0.0.1:8092 (de dev-server stuurt `/api` daarheen door) en zet er testaccounts in. Je logt in met een van deze accounts:

| Gebruikersnaam | Naam   | Rol              | Wachtwoord     |
| -------------- | ------ | ---------------- | -------------- |
| `kind-a`       | Kind A | kind (`child`)   | `snuffel-test` |
| `kind-b`       | Kind B | kind (`child`)   | `snuffel-test` |
| `ouder`        | Ouder  | ouder (`parent`) | `snuffel-test` |

Het beheerscherm van deze lokale PocketBase staat op http://localhost:8092/_/ (inloggen met `dev@snuffel.test` / `snuffel-dev-admin`). De gegevens blijven tussen twee keer `npm start` bewaard in `pocketbase/pb_data/dev`; gooi die map weg om opnieuw te beginnen. Deze accounts en wachtwoorden staan in `pocketbase/seed/dev-accounts.json` en zijn alleen voor lokaal testen: ze komen niet in de image en nooit op de NAS. Ctrl+C stopt PocketBase en de dev-server samen.

| Commando                   | Wat                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm start`                | PocketBase met testaccounts (poort 8092), de inhoud met de proefles en de dev-server met herladen (poort 4200)                    |
| `npm run start:lan`        | hetzelfde als `npm start`, maar bereikbaar vanaf je telefoon op de thuiswifi (zie "Een les bekijken")                             |
| `npm run check`            | format, lint, privacycheck, tests van `tools/`, `test:pb`, `content:types:check`, `content:check`, typecheck, unit-tests en build |
| `npm run test:pb`          | integratietests van de PocketBase-toegangsregels (`pocketbase/tests/`), tegen een echte PocketBase                                |
| `npm run e2e`              | Playwright-tests (mobiel en desktop, plus de productiebuild via PocketBase); zie hieronder                                        |
| `npm run e2e:container`    | dezelfde servertests tegen de echte Docker-image op poort 8090; vraagt Docker, hoort niet bij `verify`                            |
| `npm run verify`           | `check` + `e2e`                                                                                                                   |
| `npm run serve:prod`       | productiebuild bekijken zoals op de NAS, geserveerd door PocketBase op http://localhost:8090                                      |
| `npm run content:check`    | alle inhoud controleren (schema, bronnen, quiz, leestijd, taal, links, afbeeldingen, id's tegen `main`)                           |
| `npm run content:build`    | inhoud klaarzetten voor de app in `web/public/content/`; `npm run content:build:fixtures` zet ook de proefles klaar               |
| `npm run content:types`    | TypeScript-types van de app opnieuw maken uit de schema's (na een schemawijziging)                                                |
| `npm run pocketbase:fetch` | het vastgepinde PocketBase-programma ophalen naar `pocketbase/bin/` (checksum gecontroleerd)                                      |
| `npm run format`           | alles formatteren met Prettier                                                                                                    |

Voor `npm run e2e` eenmalig `npx playwright install chromium` in `web/`. De eerste keer downloadt `npm run check` (of `npm start`, of `npm run e2e`) ook PocketBase (ongeveer 15 MB, van GitHub); daarna staat het in `pocketbase/bin/` en werkt alles zonder internet. De versie en checksums staan in `pocketbase/pocketbase.json`. Zit je achter een proxy, zet dan `NODE_USE_ENV_PROXY=1` (en zo nodig `NODE_EXTRA_CA_CERTS`).

## Een les bekijken

1. `npm start`, open http://localhost:4200 en log in als `kind-a` (of `ouder`).
2. Ga naar http://localhost:4200/leren/proefcursus/proefles. Een les staat altijd op `/leren/<cursus-id>/<les-id>`; met `#stap-<stap-id>` erachter (bijv. `#stap-quiz`) opent hij bij die stap.
3. Op je telefoon: stop `npm start` en start `npm run start:lan`. Zoek het IP-adres van je laptop (Windows: `ipconfig`) en open op je telefoon, op dezelfde wifi, `http://<ip-van-je-laptop>:4200/leren/proefcursus/proefles`. Lukt dat niet (bijvoorbeeld door de firewall van Windows), gebruik dan de telefoonweergave in Chrome (F12).

Wat je in een les doet, wordt bewaard in PocketBase, per account: welke stappen klaar zijn (het gevulde rondje bovenaan), elk antwoord in de quiz (met het aantal hints) en de vinkjes van de praktijkopdracht. Na herladen, uitloggen en weer inloggen of op een ander apparaat staat het er nog; een ander kind ziet het niet. Opnieuw beginnen kan op twee manieren: stop `npm start` en gooi de map `pocketbase/pb_data/dev` weg (dan zijn ook de testaccounts weg; `npm start` maakt ze opnieuw), of open http://localhost:8092/_/ (dev-superuser `dev@snuffel.test`, wachtwoord `snuffel-dev-admin`) en wis de records in `lesson_progress`, `quiz_attempts` en `checklist_states`.

Let op: `start:lan` zet de dev-server met de testaccounts open voor iedereen op je thuisnetwerk zolang hij draait. Gebruik hem alleen thuis en stop hem (Ctrl+C) als je klaar bent. De proefles staat alleen lokaal klaar; in de image voor de NAS zit hij nooit.

## Mappen

| Map               | Inhoud                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `web/`            | Angular-app (`src/`), Playwright-tests (`e2e/`)                                                                                                                                                                          |
| `content/`        | lessen als JSON: `courses/` (echte inhoud), `fixtures/` (de proefles en voorbeelden van `/snuffel-leren <wens> --voorbeeld`, alleen lokaal en in de e2e), `schema/v1/` (schema's en catalogus), `terms.json` (vaktermen) |
| `tools/`          | scripts voor checks (privacy, Node-versie, inhoud in `content/`), fonts en PocketBase (ophalen, starten)                                                                                                                 |
| `pocketbase/`     | vastgepinde versie (`pocketbase.json`), migraties (`pb_migrations/`), hooks (`pb_hooks/`), testaccounts voor lokaal (`seed/`), integratietests van de toegangsregels (`tests/`)                                          |
| `deploy/`         | `Dockerfile`, `compose.dev.yml` (lokaal) en `compose.nas.yml` (Synology)                                                                                                                                                 |
| `.github/`        | workflow `release.yml`: bouwt na elke merge naar `main` de image en zet hem op ghcr.io                                                                                                                                   |
| `docs/start/`     | handoff uit de ontwerpfase: stijl, Ted, referentieles                                                                                                                                                                    |
| `docs/plan/`      | implementatieplan en plan per mijlpaal                                                                                                                                                                                   |
| `.claude/`        | agents, skills en hooks voor Claude Code                                                                                                                                                                                 |
| `.husky/`         | git-hooks                                                                                                                                                                                                                |
| `huiswerk-fotos/` | jouw foto's van werkboekpagina's voor `/snuffel-leren` (huiswerk); staat in `.gitignore` en komt nooit in git                                                                                                            |

## Inhoud

Lessen staan als JSON in `content/courses/<cursus-id>/`: een `course.json` met de lessen en de bronnen, per les een bestand in `lessons/` en afbeeldingen (svg) in `assets/`. Hoe je een les schrijft, welke bloktypen, staptypen en interacties er zijn en welke regels gelden, staat in [content/schema/v1/catalogus.md](content/schema/v1/catalogus.md).

- `npm run content:check` controleert alles en meldt elke fout in het Nederlands, met het bestand, de plek in het bestand en een vaste code tussen haken:

  ```
  content:check: 1 fout
  FOUT content/fixtures/courses/proefcursus/lessons/01-proefles.json
    steps[0].blocks[1].cards[0].sourceRefs[0]: bron "svnl-roofvis-9303" staat niet in de bronnen van course.json [source-ref-missing]
  ```

  Lees `steps[0].blocks[1].cards[0]` als: eerste stap, tweede blok, eerste kaart. De codes staan in de catalogus. De check draait ook in `npm run check` en bij elke commit waarin iets onder `content/` verandert.

- Een gepubliceerde les houdt zijn id's: de check vergelijkt met `main` en weigert verdwenen of verplaatste id's en een wijziging zonder hogere `version`.
- De proefles (`content/fixtures/courses/proefcursus`) is testdata met elk onderdeel van het formaat. Je ziet hem alleen lokaal (`npm start`) en in de e2e-tests; de image voor de NAS wordt zonder fixtures gebouwd.
- `npm start` bouwt de inhoud één keer bij het starten. Wijzig je een les terwijl de dev-server draait, draai dan `npm run content:build:fixtures` opnieuw.

### Een les laten maken

Start Claude Code in de repo (op `main`, werkmap schoon) en typ `/snuffel-leren <korte wens>`, bijvoorbeeld `/snuffel-leren Ik wil dat mijn kind leert hoe je een snoek onthaakt`. De skill maakt alleen inhoud in `content/`, nooit app-code.

1. **Intake:** hoogstens zes vragen in één bericht, alleen wat de wens nog niet zegt (wie leert, waarom, wat kan diegene al, wanneer is het gelukt, hoeveel tijd, en bij huiswerk vak, niveau, methode en hoofdstuk). Namen en andere gegevens van de kinderen komen nooit in de les, een commit of de PR; de intake bepaalt alleen niveau en toon.
2. **Bronnen:** de agent `source-researcher` zoekt minstens drie betrouwbare bronnen en opent ze echt. Claude Code vraagt toestemming voor `WebSearch` en `WebFetch`.
3. **Leerpad:** lessen met elk één nieuw begrip. **Hier stopt de skill: jij keurt het leerpad goed** (of stuurt bij).
4. **Les schrijven, controleren en laten beoordelen:** de skill schrijft de les volgens de catalogus, draait `npm run content:check` tot die groen is en laat de agent `content-reviewer` de les tegen de bronnen controleren (hoogstens twee rondes).
5. **Pull request:** per les een branch `content/<cursus-id>-<les-id>` en een PR met de bronnen, het rapport van de reviewer en hoe je de les leest. **Daar stopt de skill: jij leest de les en merget zelf.** Zijn er na twee rondes nog blokkerende punten, dan is de PR een draft met die punten bovenaan.

Lokaal lezen: `git switch content/<cursus-id>-<les-id>`, `npm start` (een draaiende dev-server eerst stoppen), log in als `kind-a` en open http://localhost:4200/leren/<cursus-id>/<les-id>. De quiz en de checklist werken en onthouden wat je doet; het voel-spel komt in M9, huiswerkoefeningen in M10.

**Huiswerk met foto's.** Bij huiswerk kun je foto's van de pagina's uit het werkboek geven in plaats van de stof te omschrijven. Zet ze in de map `huiswerk-fotos/` in de repo (bijvoorbeeld `huiswerk-fotos/wiskunde-h3/`) en geef bij de intake het pad van de map of de bestanden; slepen in het gesprek mag ook. De skill leest vak, methode, hoofdstuk, uitleg, notatie en soort opgaven van de foto's, schrijft de uitleg in eigen woorden en bedenkt eigen opgaven van hetzelfde soort en niveau. `huiswerk-fotos/` staat in `.gitignore` en komt nooit in git of in de image: op de foto's kunnen naam, school of handschrift van een kind staan, en de pagina's zijn auteursrechtelijk beschermd. Namen en andere gegevens op de foto's neemt de skill nergens over. Maak de foto zonder naam, klas, cijfers of ander persoonlijks erop (afdekken of bijsnijden); de foto's blijven buiten git en de image, maar Claude stuurt ze wel naar Anthropic om ze te lezen. Ruim de foto's zelf op als de les klaar is.

Met `/snuffel-leren <wens> --voorbeeld` maakt de skill een voorbeeldles als fixture in `content/fixtures/courses/`, zonder commit of PR. Je leest hem lokaal op http://localhost:4200/leren/<cursus-id>/<les-id>; in de image voor de NAS zit hij nooit. Id's die met `voorbeeld-` beginnen zijn gereserveerd voor zulke voorbeelden. De voorbeeldmodus commit niets en laat dus ongecommitte bestanden achter in `content/fixtures/courses/<cursus-id>/`. Draai hem daarom op een eigen branch vanaf een schone `main` (bijvoorbeeld `git switch -c sample/<cursus-id>`), niet op `main` of op een `content/…`-branch. Weghalen: verwijder de map `content/fixtures/courses/<cursus-id>/`, of gebruik `git clean -fd content/fixtures/courses/<cursus-id>/` (eerst `git clean -nd …` om te zien wat er weggaat); daarna kun je terug naar `main` en de branch verwijderen.

## Huisstijl

- Kleuren, fonts, randen, schaduwen en radii staan als design tokens in `web/src/styles/tokens.css` (licht en donker). Componenten gebruiken alleen deze tokens.
- De fonts Bangers en Atkinson Hyperlegible komen uit de npm-pakketten `@fontsource/bangers` en `@fontsource/atkinson-hyperlegible` (SIL Open Font License). `tools/copy-fonts.mjs` kopieert ze vóór `start`, `build` en `e2e` naar `web/public/fonts/` (niet in git); de app laadt ze van de eigen server, nooit van buiten.
- Op http://localhost:4200/stijl staat een stijlpagina met alle kleuren, koppen, knoppen, de kaart, de sticker en het plakbriefje, plus een knop voor licht, donker of systeem. De pagina is nergens gelinkt.
- Ted, de mascotte, staat als sprite in `web/public/assets/ted.svg` (een kopie van `docs/start/assets/ted.svg`, alleen het commentaar bovenin is aangepast zodat de browser het bestand als los bestand accepteert). Hij heeft vier stemmingen: stoer (`cool`), blij (`happy`), nadenkend (`thinking`) en oeps (`oops`). Gebruik `<snf-ted mood="happy">` voor Ted alleen, `<snf-speech-bubble tail="left">` (of `tail="bottom"`) voor een tekstballon en `<snf-ted-says mood="cool">tekst</snf-ted-says>` voor Ted met een ballon. Met `wiggle` wiebelt Ted zachtjes; staat "beweging beperken" aan op het apparaat, dan staat hij stil. Alles staat ook op `/stijl` onder "Ted".

## Werkwijze

- Nooit direct op `main`: elke mijlpaal krijgt een branch `feat/mNN-<slug>` en een pull request. Jop merget.
- Git-hooks:
  - `pre-commit`: weigert commits op `main`, formatteert en lint de gewijzigde bestanden;
  - `commit-msg`: Conventional Commits (`feat(lesson): …`);
  - `pre-push`: weigert pushen naar `main`, draait `npm run verify`.
- Claude Code: `/mijlpaal-uitvoeren M2` voert een mijlpaal uit met de agents `planner`, `implementer`, `tester` en `reviewer`, en stopt bij de pull request. Zie [.claude/](.claude).
- Claude Code: `/snuffel-leren <wens>` maakt een les als alleen inhoud, met de agents `source-researcher` (zoekt en opent bronnen, alleen lezen plus web) en `content-reviewer` (controleert de les tegen de bronnen, verandert niets), en stopt bij het leerpad en bij de pull request. Zie "Een les laten maken".

## Lokaal de echte image draaien

Met Docker (Desktop) draai je precies de image die ook op de NAS komt:

```bash
docker compose -f deploy/compose.dev.yml up --build
```

Open http://localhost:8090 (en http://localhost:8090/stijl). Stoppen met Ctrl+C. De data blijft in een Docker-volume staan; wissen doe je met `docker compose -f deploy/compose.dev.yml down -v`.

Elke pagina krijgt een Content-Security-Policy (`pocketbase/pb_hooks/security.pb.js`): de browser weigert zelf alles van een ander domein. Het beheerscherm `/_/` en `/api/` vallen daarbuiten.

`npm run e2e:container` bouwt en start de image op dezelfde manier en test hem (gezond, niet als root, `linux/amd64`, juiste PocketBase-versie, CSP, inloggen). Het maakt daarvoor in het lokale Docker-volume de dev-beheerder en de testaccounts aan; de image zelf bevat ze niet. Moet de build extra instellingen hebben, bijvoorbeeld een proxy, zet dan in `SNUFFEL_COMPOSE_OVERRIDE` het pad naar een extra compose-bestand; dat wordt met `-f` meegegeven.

## Uitrollen op de NAS

Na elke merge naar `main` bouwt GitHub Actions de image en zet hem op `ghcr.io/versure/snuffel` met de tags `latest` en `sha-<kort>` (de eerste 7 tekens van de commit). Onder Actions → release kun je hem ook met de hand starten.

1. **Benodigd.** DSM 7.2 of nieuwer met Container Manager. Maak in File Station de map `/volume1/docker/snuffel/pb_data`.

   De container draait niet als root, maar als gebruiker `1000`. Die moet in de map kunnen schrijven. Geef de map daarom één keer aan uid 1000, met hetzelfde commando op één van deze twee manieren:
   - via SSH: `sudo chown -R 1000:1000 /volume1/docker/snuffel/pb_data`;
   - via DSM → Configuratiescherm → Taakplanner → Maken → Geplande taak → Door gebruiker gedefinieerd script, gebruiker `root`, met als script `chown -R 1000:1000 /volume1/docker/snuffel/pb_data`. Voer de taak één keer uit en verwijder hem daarna.

   Wil je de map liever van je eigen DSM-gebruiker laten? Zet dan in de compose bij `snuffel` de regel `user: "<jouw uid>:<jouw gid>"` (uid en gid zie je via SSH met `id`).

2. **Eenmalig: toegang tot ghcr.io.** Maak op GitHub (Settings → Developer settings → Personal access tokens → Tokens (classic)) een token met alleen `read:packages`. Voeg in Container Manager onder Register → Instellingen → Toevoegen het register `ghcr.io` toe, met je GitHub-gebruikersnaam en dit token als wachtwoord.

3. **Project maken.** Container Manager → Project → Maken. Naam `snuffel`, pad `/volume1/docker/snuffel`, bron "docker-compose.yml maken", en plak de inhoud van [`deploy/compose.nas.yml`](deploy/compose.nas.yml). Start het project. Na ongeveer een halve minuut staat de container op "Gezond".

4. **Openen.** Op je telefoon, verbonden met de thuiswifi: `http://<ip-van-de-nas>:8090`. Zet **geen** port forwarding op de router: Snuffel hoort alleen op het thuisnetwerk.

5. **Eerste keer: beheerder aanmaken.** Container Manager → Container → `snuffel` → Terminal → Maken (`sh`) en voer uit:

   ```sh
   /pb/pocketbase superuser upsert <e-mail> <wachtwoord> --dir /pb/pb_data
   ```

   Log daarna in op `http://<nas>:8090/_/`. Iedereen op de wifi ziet dit inlogscherm, dus kies een sterk wachtwoord. Afschermen kan later met de firewall van DSM of een reverse proxy.

6. **Accounts aanmaken.** Snuffel heeft geen aanmeldpagina: jij maakt de accounts. In `http://<nas>:8090/_/` → Collections → `users` → New record vul je in:
   - `username`: 3 tot 20 tekens, kleine letters, cijfers en streepjes (bijvoorbeeld `jop` of `kind-1`); hiermee log je in;
   - `name`: de naam die Ted gebruikt ("Hoi, …!");
   - `role`: `parent` voor jezelf, `child` voor een kind;
   - `password` en `passwordConfirm`: minstens 8 tekens. Een e-mailadres is niet nodig.

   Maak eerst je eigen ouderaccount, daarna de kinderen. Log met elk account één keer in op `http://<nas>:8090` om te controleren dat het werkt. Je blijft daarna ingelogd op dat apparaat tot je uitlogt of Snuffel een paar dagen niet opent. Wachtwoord vergeten: zet in `/_/` bij dat record een nieuw wachtwoord. Wil je een apparaat echt buitensluiten, wijzig dan het wachtwoord: uitloggen wist alleen de sessie op dat ene apparaat.

   Wat een kind mag, staat in de toegangsregels van de collectie (migratie in `pocketbase/pb_migrations/`): een kind ziet alleen zichzelf en kan alleen zijn naam en (met het oude wachtwoord) zijn wachtwoord wijzigen; de ouder ziet en beheert alle accounts.

7. **Back-ups en beveiliging.** In `/_/` → Settings → Backups: zet automatische back-ups aan, dagelijks (bijvoorbeeld `0 3 * * *`) en 7 bewaren. Neem daarnaast de map `/volume1/docker/snuffel` mee in Hyper Backup. Zet in `/_/` → Settings → Rate limiting de ingebouwde limieten aan; dan kan niemand op de wifi eindeloos wachtwoorden proberen.

   Collecties, velden en toegangsregels wijzig je **nooit** in `/_/` op de NAS, alleen via een migratie in de repo (de volgende update zou het anders terugdraaien of laten botsen). Records aanmaken en wijzigen in `/_/`, zoals accounts, mag wel.

8. **Bijwerken.** Na een merge: Container Manager → Project → `snuffel` → Actie → Bouwen (of Image → `ghcr.io/versure/snuffel` → Bijwerken) en het project opnieuw starten. Nieuwe migraties worden bij de start automatisch toegepast.

9. **Terugzetten.** Zet in de compose van het project `image: ghcr.io/versure/snuffel:sha-<kort>` met de tag van een eerdere versie (zie GitHub → Packages → snuffel) en bouw en start opnieuw. Terug naar de nieuwste: weer `:latest`. Let op: PocketBase-migraties lopen alleen vooruit. Heeft de update het datamodel gewijzigd, zet dan ook de back-up van `pb_data` van vóór de update terug.

10. **Problemen.** Blijft de container op "Ongezond" staan of stopt hij meteen, kijk dan bij Container → `snuffel` → Log. Meestal staat er iets als `permission denied` bij `pb_data`: dan mist de map de schrijfrechten uit stap 1.

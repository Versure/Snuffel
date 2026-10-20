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

| Commando                   | Wat                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm start`                | dev-server met herladen                                                                                |
| `npm run check`            | format, lint, privacycheck, tests van `tools/`, typecheck, unit-tests en build                         |
| `npm run e2e`              | Playwright-tests (mobiel en desktop, plus de productiebuild via PocketBase); zie hieronder             |
| `npm run e2e:container`    | dezelfde servertests tegen de echte Docker-image op poort 8090; vraagt Docker, hoort niet bij `verify` |
| `npm run verify`           | `check` + `e2e`                                                                                        |
| `npm run serve:prod`       | productiebuild bekijken zoals op de NAS, geserveerd door PocketBase op http://localhost:8090           |
| `npm run pocketbase:fetch` | het vastgepinde PocketBase-programma ophalen naar `pocketbase/bin/` (checksum gecontroleerd)           |
| `npm run format`           | alles formatteren met Prettier                                                                         |

Voor `npm run e2e` eenmalig `npx playwright install chromium` in `web/`. De eerste keer downloadt `npm run e2e` ook PocketBase (ongeveer 15 MB, van GitHub); daarna staat het in `pocketbase/bin/` en werkt alles zonder internet. De versie en checksums staan in `pocketbase/pocketbase.json`. Zit je achter een proxy, zet dan `NODE_USE_ENV_PROXY=1` (en zo nodig `NODE_EXTRA_CA_CERTS`).

## Mappen

| Map           | Inhoud                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------- |
| `web/`        | Angular-app (`src/`), Playwright-tests (`e2e/`)                                           |
| `tools/`      | scripts voor checks (privacy, Node-versie), fonts en PocketBase (ophalen, starten)        |
| `pocketbase/` | vastgepinde versie (`pocketbase.json`), migraties (`pb_migrations/`), hooks (`pb_hooks/`) |
| `deploy/`     | `Dockerfile`, `compose.dev.yml` (lokaal) en `compose.nas.yml` (Synology)                  |
| `.github/`    | workflow `release.yml`: bouwt na elke merge naar `main` de image en zet hem op ghcr.io    |
| `docs/start/` | handoff uit de ontwerpfase: stijl, Ted, referentieles                                     |
| `docs/plan/`  | implementatieplan en plan per mijlpaal                                                    |
| `.claude/`    | agents, skills en hooks voor Claude Code                                                  |
| `.husky/`     | git-hooks                                                                                 |

Later komt erbij: `content/` (lessen als JSON).

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

## Lokaal de echte image draaien

Met Docker (Desktop) draai je precies de image die ook op de NAS komt:

```bash
docker compose -f deploy/compose.dev.yml up --build
```

Open http://localhost:8090 (en http://localhost:8090/stijl). Stoppen met Ctrl+C. De data blijft in een Docker-volume staan; wissen doe je met `docker compose -f deploy/compose.dev.yml down -v`.

Elke pagina krijgt een Content-Security-Policy (`pocketbase/pb_hooks/security.pb.js`): de browser weigert zelf alles van een ander domein. Het beheerscherm `/_/` en `/api/` vallen daarbuiten.

`npm run e2e:container` bouwt en start de image op dezelfde manier en test hem (gezond, niet als root, `linux/amd64`, juiste PocketBase-versie, CSP). Moet de build extra instellingen hebben, bijvoorbeeld een proxy, zet dan in `SNUFFEL_COMPOSE_OVERRIDE` het pad naar een extra compose-bestand; dat wordt met `-f` meegegeven.

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

6. **Back-ups.** In `/_/` → Settings → Backups: zet automatische back-ups aan, dagelijks (bijvoorbeeld `0 3 * * *`) en 7 bewaren. Neem daarnaast de map `/volume1/docker/snuffel` mee in Hyper Backup.

7. **Bijwerken.** Na een merge: Container Manager → Project → `snuffel` → Actie → Bouwen (of Image → `ghcr.io/versure/snuffel` → Bijwerken) en het project opnieuw starten. Nieuwe migraties worden bij de start automatisch toegepast.

8. **Terugzetten.** Zet in de compose van het project `image: ghcr.io/versure/snuffel:sha-<kort>` met de tag van een eerdere versie (zie GitHub → Packages → snuffel) en bouw en start opnieuw. Terug naar de nieuwste: weer `:latest`.

9. **Problemen.** Blijft de container op "Ongezond" staan of stopt hij meteen, kijk dan bij Container → `snuffel` → Log. Meestal staat er iets als `permission denied` bij `pb_data`: dan mist de map de schrijfrechten uit stap 1.

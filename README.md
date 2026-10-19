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

| Commando         | Wat                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `npm start`      | dev-server met herladen                                                                    |
| `npm run check`  | format, lint, privacycheck, typecheck, unit-tests en build                                 |
| `npm run e2e`    | Playwright-tests (mobiel en desktop); eenmalig `npx playwright install chromium` in `web/` |
| `npm run verify` | `check` + `e2e`                                                                            |
| `npm run format` | alles formatteren met Prettier                                                             |

## Mappen

| Map           | Inhoud                                                |
| ------------- | ----------------------------------------------------- |
| `web/`        | Angular-app (`src/`), Playwright-tests (`e2e/`)       |
| `tools/`      | scripts voor checks (privacy, Node-versie) en fonts   |
| `docs/start/` | handoff uit de ontwerpfase: stijl, Ted, referentieles |
| `docs/plan/`  | implementatieplan en plan per mijlpaal                |
| `.claude/`    | agents, skills en hooks voor Claude Code              |
| `.husky/`     | git-hooks                                             |

Later komen erbij: `content/` (lessen als JSON), `pocketbase/` (migraties, hooks, tests) en `deploy/` (Dockerfile en compose-bestanden).

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

## Uitrollen op de NAS

Volgt in mijlpaal M4 (container-image via ghcr.io, compose-project in Container Manager).

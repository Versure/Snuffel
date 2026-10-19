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

## Werkwijze

- Nooit direct op `main`: elke mijlpaal krijgt een branch `feat/mNN-<slug>` en een pull request. Jop merget.
- Git-hooks:
  - `pre-commit`: weigert commits op `main`, formatteert en lint de gewijzigde bestanden;
  - `commit-msg`: Conventional Commits (`feat(lesson): …`);
  - `pre-push`: weigert pushen naar `main`, draait `npm run verify`.
- Claude Code: `/mijlpaal-uitvoeren M2` voert een mijlpaal uit met de agents `planner`, `implementer`, `tester` en `reviewer`, en stopt bij de pull request. Zie [.claude/](.claude).

## Uitrollen op de NAS

Volgt in mijlpaal M4 (container-image via ghcr.io, compose-project in Container Manager).

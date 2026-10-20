# Snuffel

Leerportaal voor de kinderen van Jop: korte interactieve lessen en huiswerkhulp, met Ted als mascotte. Angular-app in `web/`, PocketBase in één container, draait op een Synology NAS en is alleen bereikbaar op het thuisnetwerk.

- Plan en mijlpalen: `docs/plan/implementatieplan.md`; plan per mijlpaal: `docs/plan/mijlpalen/mNN.md`.
- Ontwerpbeslissingen, stijl en Ted: `docs/start/HANDOFF.md`, `docs/start/reference/les-01-roofvissen.html`, `docs/start/assets/ted.svg`. `docs/start/` blijft ongewijzigd.

## Commando's

Node-versie staat in `.nvmrc` (Angular 22 vereist ≥ 22.22.3 of ≥ 24.15).

| Commando         | Wat                                                                  |
| ---------------- | -------------------------------------------------------------------- |
| `npm start`      | dev-server op http://localhost:4200                                  |
| `npm run check`  | format, lint, privacy, typecheck, unit-tests, build: moet groen zijn |
| `npm run e2e`    | Playwright (mobiel + desktop), start zelf een dev-server             |
| `npm run verify` | `check` + `e2e`; draait ook in de pre-push-hook                      |
| `npm run format` | Prettier op alles                                                    |

## Taal

- Engels: code, identifiers, bestandsnamen, codecommentaar, commitberichten, branchnamen, PR-titels.
- Nederlands: alle tekst die een gebruiker ziet (UI, lesinhoud, Ted), docs voor Jop, PR-beschrijvingen.
- Geen i18n-framework; de app is eentalig Nederlands. `<html lang="nl">`.

## Angular

- Standalone components, zoneless, `ChangeDetectionStrategy.OnPush` overal (lint dwingt dit af).
- Signals: `input()`, `output()`, `model()`, `computed()`, `signal()`; `effect()` alleen voor bijwerkingen buiten Angular. Geen `@Input`/`@Output`-decorators.
- `inject()` in plaats van constructor-injectie. Nieuwe control flow (`@if`, `@for`, `@switch`, `@defer`). Geen `any`; TypeScript strict en `strictTemplates`.
- Selector-prefix `snf-`. Eén component per map: `name.ts`, `name.html`, `name.css`, `name.spec.ts`. Klasse zonder `Component`-achtervoegsel (`Ted`, `SpeechBubble`), zoals de Angular-CLI genereert.
- Mappen: `core/` (services, guards, één instantie), `shared/` (herbruikbare UI en lesonderdelen), `interactions/` (registry + spellen), `features/` (pagina's, lazy geladen).

## Naamgeving

- Bestanden en mappen kebab-case; klassen en types PascalCase; variabelen en functies camelCase.
- PocketBase-collecties en -velden snake_case (`lesson_progress.content_version`).
- Inhoud-id's kebab-case en **nooit wijzigen** na publicatie (voortgang hangt eraan).
- CSS-variabelen Engels met prefix (`--snf-color-yellow`); waarden exact uit de handoff.

## Stijl en toegankelijkheid

- Alleen design tokens uit `web/src/styles/tokens.css`; geen losse kleurwaarden in componenten.
- Tikvlakken minimaal 44 × 44 px, zichtbare focus, contrast volgens WCAG AA.
- Elke animatie heeft een variant voor `prefers-reduced-motion: reduce`.
- Afbeeldingen en svg's die iets betekenen hebben een tekstalternatief; decoratie krijgt `aria-hidden="true"`.

## Privacy (harde regel)

- Geen enkele externe URL in app-code, CSS, `index.html` of assets: geen Google Fonts, CDN's, analytics of externe afbeeldingen. Fonts en assets staan in `web/public/`. `npm run privacy` en de e2e-fixture (`web/e2e/fixtures.ts`) controleren dit.
- Externe links horen alleen in lesinhoud (bronnen), en openen met `rel="noopener noreferrer"`.
- Geen AI-API's of andere diensten aanroepen vanuit de app. Hints en uitleg zijn statische inhoud.

## PocketBase

- Elke wijziging aan collecties of regels via een **nieuwe** migratie in `pocketbase/pb_migrations/`; bestaande migraties nooit aanpassen.
- Toegangsregels: een kind leest en schrijft alleen eigen records en kan `user` en `role` niet wijzigen; de ouder leest alles. Elke regel heeft een integratietest (kind A, kind B, ouder).
- Gebruik skill `pb-collectie-toevoegen` voor een nieuwe collectie.

## Tests

- Elke component en service heeft een unit-test (`*.spec.ts`, Vitest via `ng test`).
- Elk punt van de definition of done van een mijlpaal heeft een e2e-test in `web/e2e/`. Importeer `test` en `expect` uit `./fixtures`, niet rechtstreeks uit `@playwright/test`.
- Nooit tests overslaan, uitzetten of versoepelen om groen te krijgen. Faalt iets en weet je niet waarom: stop en meld het.

## Git

- Nooit committen of pushen op `main`; elke mijlpaal op `feat/mNN-<slug>`, inhoud op `content/<course-id>-<lesson-id>`.
- Conventional Commits: `feat(lesson): render signal cards`, `fix(auth): …`, `chore: …`, `test: …`, `docs: …`. Klein, één logische stap per commit.
- Nooit `--no-verify`, `--force`, `git reset --hard` of `gh pr merge`. Jop merget pull requests zelf.
- Push alleen als `npm run verify` groen is (de pre-push-hook draait het ook).
- Commit als `Versure <24564489+Versure@users.noreply.github.com>` (of als Claude met `noreply@anthropic.com`); de pre-commit-hook weigert elk ander e-mailadres.

## Werkwijze

- Een mijlpaal loopt via skill `mijlpaal-uitvoeren`, met de agents `planner`, `implementer`, `tester` en `reviewer`.
- Werk vanuit het mijlpaalplan. Wijk je af, schrijf het in het plan onder "Afwijkingen" en noem het in de PR.
- Twijfel over een keuze die later moeilijk terug te draaien is (datamodel, toegangsregels, schema, stijl): vraag Jop.

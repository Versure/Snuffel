---
name: spelcomponent-bouwen
description: Bouwt een nieuwe interactiesoort (spelcomponent) voor Snuffel-lessen - schemadefinitie, Angular-component met reduced-motion-variant, registratie in de registry, opslag van resultaten, tests en uitleg in de catalogus - zodat snuffel-leren hem daarna zonder code kan gebruiken. Gebruik bij "nieuw spel", "nieuwe interactie", of als snuffel-leren een interactiesoort mist.
argument-hint: '<kind in kebab-case> <wat het kind doet>'
---

# Spelcomponent bouwen

Een interactiesoort is code die één keer gebouwd wordt; daarna gebruikt lesinhoud hem alleen via `config`. Werk op een eigen branch `feat/interaction-<kind>`, of binnen een mijlpaal.

Lees eerst: `CLAUDE.md`, hoofdstuk 2.3 van het implementatieplan, `content/schema/v1/catalogus.md` en een bestaande interactie in `web/src/app/interactions/` (bijv. `trace-game`) als voorbeeld.

## Stappen

1. **Ontwerp** (aan Jop voorleggen als het buiten een mijlpaal valt): wat ziet en doet het kind, hoe weet het of het goed is, wat zegt Ted, welke `config` is nodig, wat wordt opgeslagen (`score`, `total`, `detail`). Config moet generiek zijn: geen lesinhoud of vakkennis in de component.
2. **Schema**: definitie `interaction-<kind>` in `content/schema/v1/lesson.schema.json` (met `additionalProperties: false`), types opnieuw genereren.
3. **Component** `web/src/app/interactions/<kind>/` volgens `CLAUDE.md`:
   - input `config` (getypt), output `completed` met `{ score, total, detail }`;
   - Ted reageert via `snf-ted-says` met teksten uit de lesinhoud;
   - werkt met toetsenbord en touch, tikvlakken ≥ 44 px;
   - `prefers-reduced-motion: reduce`: geen beweging, zelfde informatie;
   - geen externe assets.
4. **Registry**: registreer `<kind>` in `web/src/app/interactions/registry.ts` (lazy geladen).
5. **Opslag**: resultaat via de bestaande `interaction_results`-collectie; geen nieuwe collectie tenzij echt nodig (dan eerst `pb-collectie-toevoegen`).
6. **Tests**: unit-tests voor de logica (scoring, rondes), e2e die de interactie in een fixture-les doorloopt, ook met reduced motion.
7. **Fixture**: voorbeeld in de testles in `content/`.
8. **Catalogus**: beschrijf in `content/schema/v1/catalogus.md` wanneer de soort didactisch past, de config met een voorbeeld, en de valkuilen. Dit leest `snuffel-leren`.
9. `npm run verify` groen, commit `feat(interactions): add <kind>`.

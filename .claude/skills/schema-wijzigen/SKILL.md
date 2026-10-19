---
name: schema-wijzigen
description: Wijzigt het inhoudsschema van Snuffel-lessen op een veilige manier - bepaalt of het een compatibele uitbreiding of een nieuwe schemaversie is, schrijft het migratiescript voor bestaande inhoud, genereert de types opnieuw en houdt de app compatibel met oude en nieuwe versie. Gebruik bij elke wijziging aan content/schema.
argument-hint: '<wat er verandert en waarom>'
---

# Inhoudsschema wijzigen

Lees eerst hoofdstuk 2 van `docs/plan/implementatieplan.md` en de huidige schema's in `content/schema/`.

## 1. Soort wijziging bepalen

- **Compatibel** (nieuw optioneel veld, nieuw bloktype, nieuwe interactiesoort): binnen de huidige versie. Bestaande inhoud blijft geldig zonder aanpassing.
- **Breekt** (veld hernoemd of verplicht, betekenis anders, veld weg): nieuwe versie `content/schema/v<N+1>/`. Leg dit eerst aan Jop voor.

## 2. Compatibele wijziging

1. Pas het schema aan; genereer de types opnieuw.
2. Renderer of check in de app bijwerken; unit-test.
3. Beschrijf het in `content/schema/v<N>/catalogus.md` als `snuffel-leren` het moet kennen.
4. `npm run verify` groen.

## 3. Nieuwe schemaversie

1. Kopieer `v<N>` naar `v<N+1>` en voer de wijziging door.
2. Schrijf `tools/migrate-content-v<N>-to-v<N+1>.ts`: zet elk inhoudsbestand om en hoogt `schemaVersion` op. Id's blijven altijd gelijk. Unit-test het script met de fixtures.
3. De app ondersteunt beide versies (loader zet v<N> bij het inlezen om of rendert beide) tot alle inhoud omgezet is.
4. Draai het script over `content/`, controleer de diff, `npm run content:check`.
5. Verwijder ondersteuning voor v<N> pas in een latere, aparte wijziging.
6. `npm run verify` groen; commit het schema, het script en de omgezette inhoud als aparte commits.

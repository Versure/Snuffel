# Snuffel: startpakket

Snuffel is een leerportaal voor de kinderen van Jop, met korte interactieve lessen en huiswerkhulp. Het eerste leertraject is roofvissen. Mascotte is Ted, gebaseerd op de boomer-pup van het gezin. Dit pakket bevat de beslissingen uit de ontwerpfase; bouw hierop verder.

## Beslissingen

- **Frontend:** Angular (recente stabiele versie, standalone components, signals). Jop kent Angular en onderhoudt het zelf.
- **Backend:** PocketBase, één container. De gebouwde Angular-app staat in `pb_public`; data in `pb_data` op een volume.
- **Hosting:** Synology DS920+ via Container Manager (compose-project). Alleen bereikbaar op het thuisnetwerk: geen port forwarding, geen reverse proxy naar buiten. Later eventueel Tailscale, zonder wijziging aan de app.
- **Geen AI-API:** hulp, hints en uitleg staan statisch in de lesinhoud.
- **Privacy:** fonts en assets zelf hosten, geen externe calls (ook niet naar Google Fonts).
- **Accounts:** een account per kind plus een ouderaccount. Een kind leest en schrijft alleen eigen voortgang; de ouder ziet alles.

## Stijl

Stripstijl in de geest van een kleurrijke poster: knalgeel vlak, paars en roze accenten, dikke zwarte lijnen, harde offset-schaduwen (geen zachte grijze), tekstballonnen, plakbriefje voor checklists, lichte rotaties op stickers. Spreekt tieners en volwassenen aan.

- Kleuren: geel `#ffd83d`, paars `#5b2bb5`, roze `#ff2e7a`, inkt `#141414`, papier `#fff6dc`, goed `#12804a` / `#d8f5e3`, fout `#c2183f` / `#ffdbe5`. Donkere modus: achtergrond `#1d1036`, vlak `#2a1a4a`, tekst `#fff6dc`, koppen geel.
- Lettertypes: Bangers voor koppen, knoppen en ballonnen; Atkinson Hyperlegible voor lopende tekst.
- Knoppen en tikvlakken minimaal 44 px, zichtbare focus, respecteer `prefers-reduced-motion`.
- Referentie: `reference/les-01-roofvissen.html` is de huidige les als losse pagina. Neem de look en de interacties over; de opslag via `window.claude` vervalt en wordt PocketBase.

## Ted

`assets/ted.svg` bevat Ted als `<symbol>` met vier stemmingen (stoer, blij, nadenkend, oeps), geschakeld met CSS-variabelen. Maak er een Angular-component van met een `stemming`-input en een optionele tekstballon. Ted reageert op goede en foute antwoorden en begroet het kind op de startpagina.

## Lessen als inhoud

Een les wordt data in plaats van een losse pagina, bijvoorbeeld JSON per les met: titel, leerdoel, uitlegblokken (tekst, signaalkaarten, regelblok, figuren), een interactie (zoals het voel-spel), quizvragen met opties, juist antwoord, uitleg en hints, een checklist "aan het water" en verder-lezen-links met bronnen. Componenten renderen die inhoud. Les 1 is de eerste om om te zetten.

## Voorgestelde eerste stappen

1. Repo-opzet: Angular-app, PocketBase-config en migraties, `docker-compose.yml` voor Container Manager, README met lokaal draaien en uitrollen op de NAS.
2. PocketBase-collecties met toegangsregels: gebruikers (rol kind/ouder), voortgang per les en stap, quizantwoorden, checklists.
3. Startpagina per kind met Ted, leertrajecten en voortgang.
4. Lescomponent plus les 1 omgezet naar het inhoudsformaat, inclusief voel-spel en quiz.

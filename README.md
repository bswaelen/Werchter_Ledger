# Werchter Ledger

Een real-time drankjes- en leeggoedtracker voor Werchter Festival 2025. Deze webapplicatie helpt groepen eenvoudig bijhouden wie voor wie een rondje heeft gegeven, en wie het meeste leeggoed heeft ingeleverd.

## Functionaliteiten

- **Realtime synchronisatie** via Firebase: alle gebruikers zien direct dezelfde stand.
- **Saldo per gebruiker**: wie is gever, ontvanger of in balans? (met duidelijke emoji's)
- **Pinten counter**: totaal aantal bestelde drankjes onderaan het scherm.
- **Coins/leeggoed**: per gebruiker wordt bijgehouden hoeveel bekers (leeggoed) zijn ingeleverd en hoeveel coins dat oplevert (0,2 coin per beker).
- **Alleen Core Members en Guests**: geen dagbezoekers meer, alleen vaste leden en gasten.
- **Responsive design**: werkt perfect op mobiel en desktop.
- **Admin-panel**:
  - Leden toevoegen/verwijderen
  - Saldo's resetten (alle transacties wissen)
  - Beheer van alle leden en transacties
- **Gebruiksvriendelijke UI**:
  - Grote knoppen voor selectie
  - Emoji's voor status (🎉 Gever, 🛑 Ontvanger, ⚖️ In balans)
  - Duidelijke counters voor drankjes en coins
  - **Twee actieknoppen in de aankoop-modal:**
    - **En gaan!** (gele knop): voor het loggen van een normaal rondje (minstens één ontvanger vereist)
    - **Enkel leeggoed** (lichtblauwe knop): voor het inleveren van alleen leeggoed (géén ontvangers, alleen bekers > 0)
  - **Nieuw: 'Report '25' knop op het hoofdscherm:**
    - Opent een uitgebreid festivalrapport met statistieken, ruwe data en een visuele eindafrekening (report25.html).

## Belangrijkste updates

- **Dubbele event handler issues opgelost:**
  - Er wordt nu per knop ("En gaan!" en "Enkel leeggoed") slechts één event handler gekoppeld, alleen wanneer de modal wordt geopend.
  - Dit voorkomt dubbele transacties of dubbele alerts bij één klik.
- **Code opgeschoond:**
  - Geen dubbele bindingen meer in `DOMContentLoaded` of `initializeApp`.
  - De logica is nu overzichtelijk en robuust.
- **Styling:**
  - De knop "Enkel leeggoed" is nu lichtblauw (`bg-blue-300 hover:bg-blue-400 text-blue-900`) en staat onder de gele "En gaan!" knop.

## Gebruik

### Voor gebruikers
- Klik op **Pinten, graaf!** om een nieuw rondje te loggen.
- Selecteer wie betaalt, het aantal bekers (leeggoed), en voor wie het rondje is.
- Gebruik **En gaan!** voor een normaal rondje (minstens één ontvanger).
- Gebruik **Enkel leeggoed** als je alleen bekers inlevert (géén ontvangers, aantal bekers > 0).
- Je saldo, aantal bestelde pinten en verdiende coins worden automatisch bijgewerkt.
- Klik op **Report '25** op het hoofdscherm voor een overzicht van alle statistieken, ruwe data en de eindafrekening van het festival.

### Voor admins
- Klik op **Admin** en voer het wachtwoord in.
- Voeg leden toe of verwijder ze.
- Gebruik de knop **Reset alle saldi** om alle transacties te wissen (iedereen weer op 0).

## Installatie & lokaal testen

1. Clone deze repository
2. Open `index.html` in je browser
3. Voor lokale ontwikkeling kun je een eenvoudige webserver gebruiken:
   ```bash
   python -m http.server 8000
   ```
   Ga dan naar `http://localhost:8000`

## Gebruikte technologieën

- HTML5
- CSS3 (Tailwind CSS)
- JavaScript
- Firebase (Realtime database)

## Licentie

MIT License 
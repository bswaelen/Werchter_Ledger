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

## Gebruik

### Voor gebruikers
- Klik op **Pinten, graaf!** om een nieuw rondje te loggen.
- Selecteer wie betaalt, het aantal bekers (leeggoed), en voor wie het rondje is.
- Je saldo, aantal bestelde pinten en verdiende coins worden automatisch bijgewerkt.

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
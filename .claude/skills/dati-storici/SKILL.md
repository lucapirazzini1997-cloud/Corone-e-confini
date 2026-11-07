---
name: dati-storici
description: Regole per scrivere, correggere o rileggere i dati storici del gioco (nazioni, sovrani, province, confini del 1300) - formato dei file in dati/, fonti ammesse, livelli di certezza, casi controversi, anacronismi da evitare, licenze delle fonti geografiche. Usala prima di toccare qualunque file in dati/ o di affermare un fatto storico nel gioco.
user-invocable: false
---

# Dati storici di Corone e Confini

La partita parte nel **1300**. I dati descrivono il mondo di quell'anno; dopo l'inizio la storia del gioco diverge e non va ricalcata su quella vera.

## Formato

Ogni insieme di dati è una cartella in `dati/` con due file. Il modello è `dati/esempio/`.

`nazioni.json`
```json
{ "anno": 1300, "nazioni": [
  { "id": "FRANCIA", "nome": "Regno di Francia", "colore": "#3b5fa8", "capitale": "parigi",
    "sovrano": { "nome": "Filippo IV il Bello", "titolo": "re", "dal": 1285, "al": 1314, "fonte": "…", "certezza": "certo" },
    "fonte": "…", "certezza": "certo" } ] }
```

`province.json`
```json
{ "limiti": { "lon": [-180, 180], "lat": [-60, 75] }, "province": [
  { "id": "parigi", "nome": "Parigi", "lon": 2.35, "lat": 48.86, "proprietario": "FRANCIA",
    "confina": ["rouen"], "terreno": "pianura", "sviluppo": 12, "fonte": "…", "certezza": "certo" } ] }
```

Regole, controllate da `strumenti/valida_dati.js` (e dall'hook dopo ogni modifica):
- `id` stabili. Nazioni: nome italiano in maiuscolo (`FRANCIA`, `VENEZIA`, `ORDA_DORO`). **Mai sigle di tre lettere**: coinciderebbero con quelle di altri giochi. Province: minuscolo senza spazi (`parigi`). I due insiemi sono separati, quindi `VENEZIA` e `venezia` possono convivere.
- Il sovrano ha `nome` e `titolo` separati (`"nome": "Pietro Gradenigo", "titolo": "doge"`).
- Una provincia senza padrone ha `"proprietario": null, "libera": true`.
- `confina` deve essere reciproco.
- Ogni nazione, sovrano e provincia ha `fonte` e `certezza`.
- `terreno` è uno tra `pianura`, `foresta`, `colline`, `montagna` (gli stessi del motore). `sviluppo` va da 1 a 20.
- **Di cosa parla `certezza`.** In una provincia riguarda solo l'esistenza e il `proprietario` nell'anno di partenza. `sviluppo`, `terreno` e `confina` sono sempre scelte di gioco, tracciate o stimate da noi: non hanno certezza storica e non abbassano quella della voce.
- Campo facoltativo `controverso`: testo che spiega il caso (vedi sotto).
- I nomi nel gioco sono in italiano quando esiste una forma italiana d'uso (Parigi, Londra, Aquisgrana); altrimenti la forma più comune.

## Fonti ammesse

In ordine di preferenza:
1. Opere di consultazione accademiche: *Dizionario Biografico degli Italiani*, Enciclopedia Treccani, Encyclopaedia Britannica, *The New Cambridge Medieval History* (voll. V-VI per il 1300), atlanti storici pubblicati.
2. Monografie e articoli di storici, con autore e titolo.
3. Wikipedia solo come punto di partenza: la voce va confrontata con una fonte del punto 1 o 2, e si cita quella.

Mai fonti derivate da altri giochi (wiki di Europa Universalis, Crusader Kings, Civilization, mod): sono semplificazioni con scelte di design, non fatti, e copiarle viola il paletto di originalità.

Come si cita: opera e voce, per esempio `"Dizionario Biografico degli Italiani, voce «Gradenigo, Pietro»"`. Se citi un libro: autore, titolo, anno. Non inventare mai una fonte: se non sei sicuro che una voce esista con quel titolo, cita l'opera in modo generico e abbassa la certezza.

## Livelli di certezza

- **`certo`**: confermato da una fonte del punto 1 e non discusso dagli storici. Esempio: Filippo IV re di Francia nel 1300.
- **`probabile`**: le fonti concordano, ma la data o il confine sono approssimati o ricostruiti. Esempio: il confine esatto di un principato rurale.
- **`semplificato`**: scelta di gioco che deforma consapevolmente la realtà: feudi sovrapposti ridotti a un solo padrone, confini tracciati da noi, sviluppo stimato. Va sempre detto cosa si è semplificato, nel campo `controverso` o nella fonte.

Nel dubbio scegli il livello più basso.

## Casi controversi

Non sceglierne uno in silenzio. Metti la scelta di gioco nei campi normali, scrivi nel campo `controverso` le alternative con le date, usa `semplificato` e segnala il caso all'utente nel riepilogo. Esempio in `dati/esempio/province.json`: Bordeaux nel 1300 è feudo del re d'Inghilterra ma occupata dai Francesi dal 1294 al 1303.

Situazioni tipiche del 1300 da trattare così: vassallaggi (Guascogna, i principi dell'Impero), titoli contesi (il "Regno di Sicilia" rivendicato sia dagli Angioini di Napoli sia dagli Aragonesi dell'isola), territori sotto tributo (i principati russi verso l'Orda d'Oro), interregni (la Scozia).

## Anacronismi da evitare nel 1300

| Da non fare | Come stanno le cose nel 1300 | Certezza |
|---|---|---|
| "Impero ottomano" come grande potenza | Esiste solo il piccolo beilicato di Osman in Bitinia, nato secondo la tradizione intorno al 1299; l'impero viene dopo | certo (la data 1299 è tradizionale, quindi probabile) |
| "Spagna" come regno unico | Castiglia (con León), Aragona (con Catalogna e Valencia), Navarra, Portogallo e l'emirato nasride di Granada | certo |
| "Ducato di Milano" | Milano è un comune governato dai Visconti come signori; il titolo di duca arriva nel 1395. Matteo Visconti viene cacciato nel 1302 | certo |
| "Granducato di Toscana", "Ducato di Savoia" | Firenze è una repubblica comunale (granducato dal 1569); i Savoia sono conti (duchi dal 1416) | certo |
| Un solo Impero mongolo | Diviso in Yuan (Cina), Ilkhanato (Persia), Orda d'Oro, khanato Chagatai | certo |
| Dinastia Ming in Cina | In Cina regnano gli Yuan (imperatore Temür); i Ming arrivano nel 1368 | certo |
| Stati crociati in Terrasanta | Acri cade nel 1291: la costa è dei Mamelucchi d'Egitto. Il titolo di re di Gerusalemme resta solo ai re di Cipro | certo |
| Alberto I d'Asburgo "imperatore" | È re dei Romani (dal 1298) ma non viene mai incoronato imperatore | certo |
| "Arciducato d'Austria" | È un ducato; il titolo di arciduca è più tardo (XV secolo) | certo |
| Un Regno di Polonia autonomo | Nel 1300 Venceslao II di Boemia viene incoronato re di Polonia a Gniezno | certo |
| "Russia" o "Granducato di Mosca" | Principati russi tributari dell'Orda d'Oro; Mosca è un principato minore (Daniele, morto nel 1303), il titolo di gran principe arriva ai suoi successori più tardi | certo (le date del titolo: probabile) |
| Impero Mughal o regni hindu dominanti nel nord dell'India | Sultanato di Delhi, dinastia Khalji (Ala ud-Din, dal 1296) | certo |
| Impero azteco o impero inca | Tenochtitlan viene fondata (secondo la tradizione) nel 1325; gli Inca sono un piccolo regno attorno a Cuzco fino al XV secolo | certo (le date: probabile) |
| Shogunato Tokugawa o Ashikaga | Shogunato di Kamakura, con il potere reale nelle mani dei reggenti Hōjō | certo |
| "Regno Unito", "Gran Bretagna" | Inghilterra (con il Galles conquistato nel 1283) e Scozia separate; in Scozia nel 1300 non c'è un re regnante (Balliol ha abdicato nel 1296) | certo |
| Mansa Musa sovrano del Mali | Il Mali esiste ed è potente, ma Musa regna più tardi (circa dal 1312) | probabile |

Regola generale: prima di usare uno stato, un titolo o un sovrano, controlla che esista **in quell'anno** e con **quel titolo**. Un titolo dell'epoca successiva è il tipo di errore più frequente.

## Licenze delle fonti geografiche

- **Natural Earth** (coste, fiumi, rilievo): pubblico dominio. Si può usare e distribuire liberamente. Lo redistribuisce il pacchetto npm `world-atlas` (licenza ISC, citare Mike Bostock), scaricabile da `registry.npmjs.org`.
- **historical-basemaps** di André Ourednik (`github.com/aourednik/historical-basemaps`, file `geojson/world_1300.geojson`, circa 1 MB): licenza **GPL-3.0**, verificata leggendo il file `LICENSE` del repository il 7 novembre 2026. Cosa comporta (lettura prudente, non è un parere legale):
  - Se il gioco include confini presi o ricavati da quei file, i dati ricavati sono GPL-3.0. La strada sicura è rilasciare l'intero gioco con licenza GPL-3.0: codice pubblico, chiunque può copiarlo e modificarlo.
  - Va bene per un gioco gratuito e per la pubblicazione sul web o sul Play Store. Su App Store di Apple la compatibilità con la GPL è storicamente discussa.
  - Se invece si vuole un gioco chiuso o a pagamento, quei file si possono usare al massimo come confronto, non come base da cui ricavare i confini.
  - **La scelta spetta all'utente** (decisione aperta 3 in `CLAUDE.md`): non importare quei dati finché non ha deciso.

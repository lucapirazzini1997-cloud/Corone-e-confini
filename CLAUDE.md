# Corone e Confini

Gioco di grande strategia per telefono: il mondo nel 1300, qualunque nazione giocabile, partita che può arrivare ai giorni nostri attraverso epoche tecnologiche. Gira nel browser ed è installabile come app (PWA). Oggi è un prototipo con una mappa inventata di 9 nazioni.

## Paletti
- **Originale.** Genere simile a Europa Universalis IV, ma niente nomi, testi, grafica, mappe, icone o dati presi da quel gioco o da altri giochi. La storia reale si usa: è di tutti.
- **Prima il telefono.** Ogni schermata va provata a 412×915 (Pixel 7) col tocco: dita, non mouse. Bersagli toccabili di almeno 40 px.
- **Niente librerie finché non servono davvero.** Oggi zero dipendenze: HTML, CSS e JavaScript puri. Una libreria entra solo con un motivo scritto nel commit (per esempio WebGL per la mappa mondiale).
- **Più semplice di EU4.** Una regola nuova entra solo se cambia le scelte del giocatore.
- In italiano: commenti, documentazione, testi del gioco, messaggi di commit.

## File
| File | Contenuto |
|---|---|
| `motore.js` | stato, regole, IA, generazione della mappa. Niente DOM: gira nel browser e in Node. Parla con l'esterno solo tramite `EVENTI` |
| `interfaccia.js` | disegno su canvas, tocchi, pannelli, salvataggio in `localStorage`. Usa le funzioni globali del motore |
| `index.html`, `stile.css` | pagina e stile |
| `manifest.webmanifest`, `sw.js`, `icona.svg` | installazione come app. Se aggiungi un file del gioco, aggiungilo a `FILES` in `sw.js` e cambia il nome della cache |
| `strumenti/simula.js` | partite senza grafica e riassunto della loro salute |
| `strumenti/valida_dati.js` | controllo dei file in `dati/` |
| `dati/` | dati storici (nazioni, province). Ancora vuota, salvo l'esempio |

La casualità del gioco dipende dal seme (`G.rs`): stesso seme, stessa partita. Non usare `Math.random` nel motore.

## Come si prova
- **Nel browser:** `python3 -m http.server 8000`, poi apri `http://localhost:8000`.
- **Salute del motore:** `node strumenti/simula.js --anni 30 --seme 123 --partite 5` (oppure `/simula`). Esce con 1 se c'è un'eccezione.
- **Dati:** `node strumenti/valida_dati.js dati/` (oppure `node strumenti/valida_dati.js <file>`).
- Gli hook in `.claude/settings.json` lanciano questi controlli da soli dopo ogni modifica a un `.js` o a un file in `dati/`.

## Dati storici
Prima di scrivere o correggere dati storici segui la skill `dati-storici`: formato, fonti, livelli di certezza (`certo`, `probabile`, `semplificato`), anacronismi da evitare, licenze. Ogni voce ha `fonte` e `certezza`. Per rileggerli usa il subagente `revisore-storico`; per i ritocchi numerici il subagente `bilanciatore`.

## Decisioni prese
1. **IA: solo avversari gestiti dal computer.** Niente modelli linguistici per ora: il gioco deve funzionare offline e senza chiavi. Un modello linguistico potrà arrivare dopo, come opzione facoltativa con un server intermedio, mai come requisito.
3. **Confini del 1300: dati nostri.** Coste da Natural Earth (pubblico dominio, via il pacchetto npm `world-atlas`); province costruite attorno a città reali; proprietari assegnati con fonti enciclopediche secondo la skill `dati-storici`. I confini sono un'approssimazione dichiarata (`semplificato`). *historical-basemaps* (GPL-3.0) **non si usa**, nemmeno come base da ricalcare: lascerebbe la licenza aperta.

## Decisioni ancora aperte (non prenderle senza l'utente)
2. **Disegno della mappa mondiale** (600-1000 province): proposta di partenza, poligoni su canvas ridisegnati solo quando la carta cambia; WebGL solo se le misure su un telefono reale lo richiedono.
4. **Epoche**: proposta di 6 (Tardo Medioevo 1300-1450, Scoperte 1450-1600, Assolutismo 1600-1750, Rivoluzioni 1750-1850, Industria e imperi 1850-1914, Contemporanea dal 1914), da realizzare prima le prime due.
5. **Contenere le valanghe di conquiste** (per esempio coalizioni contro chi si espande troppo): dopo la correzione dell'oro, 1 partita su 20 supera il 50% delle province in 30 anni.

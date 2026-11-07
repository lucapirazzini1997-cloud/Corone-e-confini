# Corone e Confini

Prototipo di gioco di grande strategia per telefono, originale (nomi, mappa e grafica non vengono da altri giochi). Separato dal progetto Pokémon Romagna: non tocca `build.py`.

## Provarlo

```sh
cd corone && python3 -m http.server 8000
```
Apri `http://localhost:8000` sul telefono (stessa rete) o sul computer. Pubblicato su un hosting HTTPS (GitHub Pages, Netlify…) si installa come app: "Aggiungi a schermata Home". Dopo la prima apertura funziona anche offline (`sw.js`).

## Cosa c'è

- Continente generato da un seme (~110 province, terreni, coste), 9 nazioni.
- Tempo continuo a giorni con pausa e 3 velocità; economia mensile (oro, uomini, punti).
- Sviluppo, fortezze, reclutamento, colonizzazione delle terre libere.
- Eserciti con morale, battaglie con bonus del terreno, ritirate, assedi.
- Guerre con alleati chiamati alle armi, punteggio di guerra, trattati di pace a province, tregue.
- IA che recluta, colonizza, si allea, dichiara guerra, assedia e fa la pace.
- Modalità mappa: politica, rapporti, terreno, sviluppo. Salvataggio in `localStorage`.

## File

| File | Contenuto |
|---|---|
| `index.html` | pagina e interfaccia |
| `gioco.js` | generazione della mappa, simulazione, IA, disegno, comandi |
| `stile.css` | stile |
| `manifest.webmanifest`, `sw.js`, `icona.svg` | installazione come app (PWA) |

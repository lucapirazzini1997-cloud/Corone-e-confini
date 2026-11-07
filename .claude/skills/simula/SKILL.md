---
name: simula
description: Simula N anni di partita senza grafica e riassume in italiano cosa è sano e cosa no (eccezioni, guerre bloccate, nazioni sparite, economia, valanga di conquiste).
disable-model-invocation: true
argument-hint: "[--anni 30] [--seme 123] [--partite 5] [--giocatore N]"
---

# Simulazione della salute del gioco

1. Lancia dalla radice del repository:
   ```sh
   node strumenti/simula.js $ARGUMENTS
   ```
   Senza argomenti usa `--anni 30 --seme 123 --partite 5`. Se l'utente ha dato solo alcuni argomenti, completa gli altri con questi valori.

2. Riassumi in italiano, in poche righe, separando **sano** da **da guardare**. Le soglie qui sotto sono una scelta di progetto (opinioni, non fatti): dillo se una conclusione dipende da una soglia.

   | Cosa | Segnale di problema |
   |---|---|
   | Eccezioni | anche una sola: è un difetto, riporta la traccia e il seme |
   | Guerre bloccate da più di 10 anni | anche una: di solito una pace che nessuno può firmare |
   | Nazioni sparite | prima dell'anno 10, oppure più di metà sparite in 30 anni |
   | Oro medio | sopra 500: l'IA accumula invece di spendere |
   | Bilancio mensile negativo | più di un terzo delle nazioni |
   | Quota della nazione più grande | sopra il 50% entro 30 anni: valanga di conquiste |
   | Tempo | sopra 2 secondi per 30 anni di una partita: il motore va reso più veloce prima della mappa mondiale |

3. Per ogni problema indica i semi che lo mostrano, così si può ripetere la stessa partita (stesso seme, stessa partita).

4. Non modificare il codice. Se servono ritocchi numerici, proponi di passare i risultati al subagente `bilanciatore`; per un difetto, descrivi dove sospetti che sia e quanto ne sei sicuro.

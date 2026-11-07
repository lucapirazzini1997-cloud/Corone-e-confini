#!/usr/bin/env node
'use strict';
/* Simula partite senza grafica e riassume se il gioco è sano.

   Uso:  node strumenti/simula.js --anni 30 --seme 123 --partite 5 [--giocatore N] [--json]

   --seme      seme della prima partita; le successive usano seme+1, seme+2, ...
               (lo stesso seme dà sempre la stessa partita)
   --giocatore nazione del giocatore umano (0-8). Senza, tutte le nazioni sono del computer.
               REGOLA DICHIARATA per il giocatore: resta passivo (i suoi eserciti non si muovono)
               e a ogni finestra sceglie il primo pulsante, cioè accetta ogni proposta di pace,
               ogni cessione richiesta ed entra in ogni guerra a cui un alleato lo chiama.
   --json      stampa il riassunto in JSON (per altri strumenti) invece che in testo.

   Esce con codice 1 se una partita lancia un'eccezione. */

const path = require('path');
const M = require(path.join(__dirname, '..', 'motore.js'));

function argomenti(argv) {
  const a = { anni: 30, seme: 123, partite: 1, giocatore: -1, json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--json') a.json = true;
    else if (['--anni', '--seme', '--partite', '--giocatore'].includes(k)) {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v)) { console.error(`Valore non valido per ${k}: ${argv[i]}`); process.exit(2); }
      a[k.slice(2)] = v;
    } else { console.error(`Argomento sconosciuto: ${k}`); process.exit(2); }
  }
  if (a.anni < 1 || a.partite < 1) { console.error('--anni e --partite devono essere almeno 1'); process.exit(2); }
  if (a.giocatore >= M.NAZ.length) { console.error(`--giocatore va da 0 a ${M.NAZ.length - 1}`); process.exit(2); }
  return a;
}

function unaPartita(seme, anni, giocatore) {
  const r = { seme, eccezione: null, finita: null, sparite: [], quota: {}, giorni: 0 };
  M.EVENTI.chiedi = m => m.buttons[0].fn();
  M.EVENTI.fine = vinto => { r.finita = vinto ? 'vittoria del giocatore' : 'sconfitta del giocatore'; };
  try {
    M.newGame(seme);
    const G = M.G; G.player = giocatore;
    const vive = new Set(G.n.filter(n => n.alive).map(n => n.id));
    const totale = G.p.length;
    for (let d = 1; d <= anni * 360; d++) {
      M.tick(); r.giorni = d;
      if (d % 30 === 0) for (const id of [...vive]) if (!G.n[id].alive) { vive.delete(id); r.sparite.push({ nazione: G.n[id].name, anno: M.ANNO0 + Math.floor(d / 360) }); }
      if (d % 3600 === 0 || d === anni * 360) {
        const max = Math.max(...G.n.map(n => M.ownedProvs(n.id).length));
        r.quota[d / 360] = Math.round(max / totale * 100);
      }
      if (r.finita) break;
    }
    r.bloccate = G.wars.filter(w => G.day - w.start > 3600).map(w => ({ attaccante: G.n[w.att[0]].name, difensore: G.n[w.def[0]].name, anni: Math.floor((G.day - w.start) / 360), punteggio: M.warScore(w) }));
    r.aperte = G.wars.length;
    const vivi = G.n.filter(n => n.alive);
    r.oroMedio = Math.round(vivi.reduce((s, n) => s + n.gold, 0) / vivi.length);
    r.inDeficit = vivi.filter(n => M.income(n.id) - M.upkeep(n.id) < 0).map(n => n.name);
    r.oroNegativo = vivi.filter(n => n.gold < 0).map(n => n.name);
  } catch (e) {
    r.eccezione = (e && e.stack) || String(e);
  }
  return r;
}

function main() {
  const a = argomenti(process.argv.slice(2));
  const t0 = Date.now(), esiti = [];
  for (let i = 0; i < a.partite; i++) esiti.push(unaPartita(a.seme + i, a.anni, a.giocatore));
  const ms = Date.now() - t0;
  const errori = esiti.filter(r => r.eccezione).length;
  if (a.json) {
    console.log(JSON.stringify({ argomenti: a, ms, partite: esiti }, null, 1));
  } else {
    console.log(`Simulazione: ${a.partite} partite da ${a.anni} anni, semi ${a.seme}-${a.seme + a.partite - 1}, ${a.giocatore >= 0 ? 'giocatore passivo ' + M.NAZ[a.giocatore][0] : 'solo computer'}`);
    for (const r of esiti) {
      console.log(`\n— seme ${r.seme}${r.finita ? ` (${r.finita} dopo ${Math.floor(r.giorni / 360)} anni)` : ''}`);
      if (r.eccezione) { console.log(`  ECCEZIONE dopo ${r.giorni} giorni:\n  ${r.eccezione.split('\n').slice(0, 4).join('\n  ')}`); continue; }
      console.log(`  guerre aperte alla fine: ${r.aperte}; bloccate da più di 10 anni: ${r.bloccate.length ? r.bloccate.map(b => `${b.attaccante} contro ${b.difensore} (${b.anni} anni, ${b.punteggio}%)`).join('; ') : 'nessuna'}`);
      console.log(`  nazioni sparite: ${r.sparite.length ? r.sparite.map(s => `${s.nazione} (${s.anno})`).join(', ') : 'nessuna'}`);
      console.log(`  oro medio: ${r.oroMedio}; con bilancio mensile negativo: ${r.inDeficit.length ? r.inDeficit.join(', ') : 'nessuna'}; con oro sotto zero: ${r.oroNegativo.length ? r.oroNegativo.join(', ') : 'nessuna'}`);
      console.log(`  quota di province della nazione più grande: ${Object.entries(r.quota).map(([y, q]) => `anno ${y}: ${q}%`).join(', ')}`);
    }
    console.log(`\nTempo: ${ms} ms. Eccezioni: ${errori}.`);
  }
  process.exit(errori ? 1 : 0);
}
main();

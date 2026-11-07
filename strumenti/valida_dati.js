#!/usr/bin/env node
'use strict';
/* Controlla i dati storici di una cartella (nazioni.json + province.json).

   Uso:  node strumenti/valida_dati.js <cartella o file>
         con un file, controlla l'intera cartella che lo contiene (le regole legano i due file).
         Con dati/ controlla ogni sottocartella che contiene dati (per esempio dati/esempio/).

   Controlli:
   - JSON leggibile e struttura attesa;
   - ogni provincia ha un proprietario che esiste, oppure è dichiarata libera ("proprietario": null, "libera": true);
   - le confinanze sono reciproche e puntano a province esistenti;
   - nessun id e nessun nome duplicati (separatamente per nazioni e province);
   - le coordinate sono dentro i limiti della mappa;
   - ogni voce storica (nazione, sovrano, provincia) ha "fonte" non vuota e "certezza" tra certo, probabile, semplificato.

   Esce con 1 se trova errori, 0 se è tutto a posto. */

const fs = require('fs');
const path = require('path');

const CERTEZZE = ['certo', 'probabile', 'semplificato'];

function leggi(file, errori) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { errori.push(`${path.basename(file)}: non è JSON valido (${e.message})`); return null; }
}

function controllaVoce(v, dove, errori) {
  if (typeof v.fonte !== 'string' || !v.fonte.trim()) errori.push(`${dove}: manca "fonte"`);
  if (!CERTEZZE.includes(v.certezza)) errori.push(`${dove}: "certezza" deve essere una tra ${CERTEZZE.join(', ')} (trovato ${JSON.stringify(v.certezza)})`);
}

function duplicati(lista, campo, tipo, errori) {
  const visti = new Set();
  for (const x of lista) {
    const v = x[campo]; if (v === undefined) continue;
    const chiave = typeof v === 'string' ? v.toLowerCase() : v;
    if (visti.has(chiave)) errori.push(`${tipo}: ${campo} duplicato "${v}"`);
    visti.add(chiave);
  }
}

function validaCartella(dir) {
  const errori = [];
  const fN = path.join(dir, 'nazioni.json'), fP = path.join(dir, 'province.json');
  if (!fs.existsSync(fN) || !fs.existsSync(fP)) { errori.push(`servono sia nazioni.json sia province.json`); return errori; }
  const N = leggi(fN, errori), P = leggi(fP, errori);
  if (!N || !P) return errori;
  if (!Array.isArray(N.nazioni)) { errori.push('nazioni.json: manca la lista "nazioni"'); return errori; }
  if (!Array.isArray(P.province)) { errori.push('province.json: manca la lista "province"'); return errori; }
  const lim = P.limiti || {};
  if (!Array.isArray(lim.lon) || !Array.isArray(lim.lat)) errori.push('province.json: mancano "limiti.lon" e "limiti.lat" ([min, max])');

  // nazioni
  duplicati(N.nazioni, 'id', 'nazioni', errori); duplicati(N.nazioni, 'nome', 'nazioni', errori);
  const idN = new Set(N.nazioni.map(n => n.id));
  for (const n of N.nazioni) {
    const dove = `nazione ${n.id || '(senza id)'}`;
    if (!n.id || !n.nome) errori.push(`${dove}: servono "id" e "nome"`);
    if (n.colore && !/^#[0-9a-fA-F]{6}$/.test(n.colore)) errori.push(`${dove}: colore non valido "${n.colore}"`);
    controllaVoce(n, dove, errori);
    if (n.sovrano) controllaVoce(n.sovrano, `${dove}, sovrano`, errori);
  }

  // province
  duplicati(P.province, 'id', 'province', errori); duplicati(P.province, 'nome', 'province', errori);
  const perId = new Map(P.province.map(p => [p.id, p]));
  for (const p of P.province) {
    const dove = `provincia ${p.id || '(senza id)'}`;
    if (!p.id || !p.nome) errori.push(`${dove}: servono "id" e "nome"`);
    if (p.proprietario === null || p.proprietario === undefined) {
      if (p.libera !== true) errori.push(`${dove}: senza proprietario deve avere "libera": true`);
    } else if (!idN.has(p.proprietario)) errori.push(`${dove}: proprietario "${p.proprietario}" non esiste tra le nazioni`);
    if (typeof p.lon !== 'number' || typeof p.lat !== 'number') errori.push(`${dove}: servono "lon" e "lat" numerici`);
    else if (Array.isArray(lim.lon) && Array.isArray(lim.lat) && (p.lon < lim.lon[0] || p.lon > lim.lon[1] || p.lat < lim.lat[0] || p.lat > lim.lat[1]))
      errori.push(`${dove}: coordinate (${p.lon}, ${p.lat}) fuori dai limiti della mappa`);
    for (const c of p.confina || []) {
      const q = perId.get(c);
      if (!q) errori.push(`${dove}: confina con "${c}", che non esiste`);
      else if (!(q.confina || []).includes(p.id)) errori.push(`${dove}: confina con "${c}", ma "${c}" non confina con "${p.id}"`);
    }
    controllaVoce(p, dove, errori);
  }
  for (const n of N.nazioni) if (n.capitale && !perId.has(n.capitale)) errori.push(`nazione ${n.id}: capitale "${n.capitale}" non esiste tra le province`);
  return errori;
}

function cartelleDa(arg) {
  const st = fs.statSync(arg);
  if (st.isFile()) return [path.dirname(arg)];
  const sotto = fs.readdirSync(arg, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(arg, d.name));
  const tutte = [arg, ...sotto].filter(d => fs.existsSync(path.join(d, 'nazioni.json')) || fs.existsSync(path.join(d, 'province.json')));
  return tutte;
}

function main() {
  const arg = process.argv[2];
  if (!arg) { console.error('Uso: node strumenti/valida_dati.js <cartella o file>'); process.exit(2); }
  if (!fs.existsSync(arg)) { console.error(`Non esiste: ${arg}`); process.exit(2); }
  const cartelle = cartelleDa(arg);
  if (!cartelle.length) { console.log(`Nessun file di dati in ${arg}.`); process.exit(0); }
  let tot = 0;
  for (const d of cartelle) {
    const e = validaCartella(d); tot += e.length;
    if (e.length) { console.error(`${d}: ${e.length} errori`); for (const x of e) console.error(`  - ${x}`); }
    else console.log(`${d}: dati validi`);
  }
  process.exit(tot ? 1 : 0);
}
main();

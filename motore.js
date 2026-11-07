'use strict';
/* Corone e Confini — MOTORE.
   Stato, regole, intelligenza artificiale. Nessun accesso a DOM, canvas o window:
   gira uguale nel browser (script classico, le funzioni restano globali per interfaccia.js)
   e in Node (require('./motore.js') restituisce le stesse funzioni).
   Il motore parla all'esterno solo attraverso EVENTI, che l'interfaccia collega. */

// ---------- collegamento con l'esterno ----------
// Di base non fanno nulla: in Node la simulazione gira senza interfaccia.
const EVENTI = {
  nota: (testo, tipo) => {},       // notizia per il giocatore ('good', 'bad' o '')
  chiedi: finestra => {},          // scelta per il giocatore: { title, body, buttons: [{ t, fn, cls }] }
  cambiata: () => {},              // la carta va ridisegnata
  fineAnno: () => {},              // è passato un anno (l'interfaccia salva)
  fine: vinto => {},               // partita finita per il giocatore
};
function note(txt, cls = '') {
  if (!G) return;
  G.log.unshift(`${dateStr()}: ${txt}`); if (G.log.length > 40) G.log.length = 40;
  if (G.player >= 0) EVENTI.nota(txt, cls);
}
const ask = m => EVENTI.chiedi(m);
const segnaCambio = () => EVENTI.cambiata();
function endGame(win) { G.over = true; G.speed = 0; EVENTI.fine(win); }

// ---------- costanti ----------
const S = 6, W = 170, H = 112, MW = W * S, MH = H * S;
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const ANNO0 = 1420;
const TERR = {
  pianura: { n: 'Pianura', def: 0, mv: 0, col: [156, 170, 104] },
  foresta: { n: 'Foresta', def: .25, mv: 3, col: [78, 112, 66] },
  colline: { n: 'Colline', def: .3, mv: 3, col: [170, 146, 98] },
  montagna: { n: 'Montagna', def: .5, mv: 6, col: [132, 124, 116] },
};
const NAZ = [
  ['Regno di Valdoria', '#b8473b'], ['Ducato di Morvenna', '#3f6fb5'], ['Repubblica di Seralta', '#d29a2e'],
  ['Impero di Kastrov', '#5f8f45'], ['Principato di Lunaria', '#8a4fa3'], ['Lega di Brennmark', '#2f9c9a'],
  ['Sultanato di Azhar', '#c96f9a'], ['Contea di Aurelia', '#8c8a2e'], ['Marca di Thorne', '#a8683a'],
];
const COSTO_RECLUTA = 10, COSTO_COLONIA = 25, COSTO_RELAZIONI = 20, TREGUA = 1800;
const VEL = [0, 2, 5, 12]; // giorni al secondo

// ---------- utilità ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
// casualità di gioco: mulberry32 con lo stato dentro G, così una partita salvata o simulata con lo stesso seme si ripete uguale
function rnd() { let t = G.rs = (G.rs + 0x6D2B79F5) | 0; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const pick = (arr, r = rnd) => arr[Math.floor(r() * arr.length)];
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const k = n => (n / 1000).toFixed(1) + 'k';
const f1 = n => (Math.round(n * 10) / 10).toFixed(1);

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(p, v) { const a = this.a; a.push([p, v]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
    return top;
  }
}

function noise(rng, gs) {
  const gw = Math.ceil(W / gs) + 2, gh = Math.ceil(H / gs) + 2, v = new Float32Array(gw * gh);
  for (let i = 0; i < v.length; i++) v[i] = rng();
  return (x, y) => {
    const fx = x / gs, fy = y / gs, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = v[iy * gw + ix], b = v[iy * gw + ix + 1], c = v[(iy + 1) * gw + ix], d = v[(iy + 1) * gw + ix + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

// ---------- generazione della mappa ----------
const SY1 = ['Val', 'Mor', 'Bel', 'Cas', 'Ter', 'Ros', 'Dun', 'Ver', 'Lan', 'Sar', 'Bri', 'Cor', 'Fal', 'Gor', 'Hal', 'Kel', 'Lor', 'Mar', 'Nor', 'Ost', 'Pal', 'Ran', 'Sel', 'Tor', 'Ul', 'Var', 'Zel', 'Ard', 'Brun', 'Cal', 'Dor', 'Eld', 'Fen', 'Gal', 'Ister', 'Mir', 'Quen', 'Tal', 'Vos', 'Aster'];
const SY2 = ['', '', 'a', 'e', 'i', 'o', 'an', 'en', 'ar', 'or', 'el', 'is'];
const SY3 = ['ina', 'ora', 'esco', 'ia', 'ano', 'burgo', 'stad', 'mont', 'vale', 'ford', 'gard', 'ona', 'ella', 'ice', 'ac', 'und', 'wick', 'heim', 'enza', 'ara', 'osa', 'ino'];

function genMap(seed) {
  const rng = mulberry32(seed);
  const n1 = noise(rng, 30), n2 = noise(rng, 13), n3 = noise(rng, 6), nm = noise(rng, 10), nf = noise(rng, 9), nc = noise(rng, 4);
  const N = W * H, val = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W * .5), dy = (y - H / 2) / (H * .5), d = dx * dx + dy * dy;
    val[y * W + x] = .55 * n1(x, y) + .3 * n2(x, y) + .15 * n3(x, y) - .6 * d;
  }
  const thr = Float32Array.from(val).sort()[Math.floor(N * .55)];
  const land = new Uint8Array(N);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) land[y * W + x] = val[y * W + x] > thr ? 1 : 0;
  // tiene solo il continente più grande
  const comp = new Int32Array(N).fill(-1); let best = -1, bestSize = 0, cid = 0;
  for (let i = 0; i < N; i++) if (land[i] && comp[i] < 0) {
    const st = [i]; comp[i] = cid; let sz = 0;
    while (st.length) { const c = st.pop(); sz++; const x = c % W, y = (c / W) | 0; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { const j = ny * W + nx; if (land[j] && comp[j] < 0) { comp[j] = cid; st.push(j); } } }
    if (sz > bestSize) { bestSize = sz; best = cid; } cid++;
  }
  for (let i = 0; i < N; i++) if (land[i] && comp[i] !== best) land[i] = 0;
  // i laghi interni diventano terra
  const sea = new Uint8Array(N), st = [0]; sea[0] = 1;
  while (st.length) { const c = st.pop(), x = c % W, y = (c / W) | 0; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (!land[j] && !sea[j]) { sea[j] = 1; st.push(j); } } }
  for (let i = 0; i < N; i++) if (!sea[i]) land[i] = 1;
  // semi delle province
  const landCells = []; for (let i = 0; i < N; i++) if (land[i]) landCells.push(i);
  const minD = Math.sqrt(landCells.length / 110) * .86, seeds = [];
  const order = landCells.slice(); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const c of order) { const x = c % W, y = (c / W) | 0; if (seeds.every(s => { const sx = s % W, sy = (s / W) | 0; return (sx - x) ** 2 + (sy - y) ** 2 >= minD * minD; })) seeds.push(c); }
  // crescita delle province con costi irregolari: confini organici
  const cells = new Int16Array(N).fill(-1), dist = new Float32Array(N).fill(1e9), hp = new Heap();
  seeds.forEach((c, i) => { dist[c] = 0; hp.push(0, [c, i]); });
  while (hp.size) {
    const [d, [c, id]] = hp.pop(); if (cells[c] >= 0) continue; cells[c] = id;
    const x = c % W, y = (c / W) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { const j = ny * W + nx; if (!land[j] || cells[j] >= 0) continue; const nd = d + 1 + 4 * nc(nx, ny) ** 2; if (nd < dist[j]) { dist[j] = nd; hp.push(nd, [j, id]); } }
  }
  // dati di provincia
  const provs = seeds.map((s, id) => ({ id, n: 0, sx: 0, sy: 0, adj: new Set(), coastal: false }));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, id = cells[i]; if (id < 0) continue; const p = provs[id]; p.n++; p.sx += x; p.sy += y;
    for (const j of [i + 1, i + W, i - 1, i - W]) { const o = cells[j]; if (o < 0) p.coastal = true; else if (o !== id) { p.adj.add(o); provs[o].adj.add(id); } }
  }
  const names = new Set();
  for (const p of provs) {
    const ax = p.sx / p.n, ay = p.sy / p.n; let bd = 1e9, bc = 0;
    for (let y = Math.max(0, Math.floor(ay - 12)); y < Math.min(H, ay + 12); y++) for (let x = Math.max(0, Math.floor(ax - 12)); x < Math.min(W, ax + 12); x++) { if (cells[y * W + x] !== p.id) continue; const d = (x - ax) ** 2 + (y - ay) ** 2; if (d < bd) { bd = d; bc = y * W + x; } }
    p.cx = bc % W; p.cy = (bc / W) | 0; p.wx = p.cx * S + S / 2; p.wy = p.cy * S + S / 2;
    const m = nm(p.cx, p.cy), fo = nf(p.cx, p.cy);
    p.terrain = m > .64 ? 'montagna' : m > .56 ? 'colline' : fo > .58 ? 'foresta' : 'pianura';
    let nm2; do { nm2 = pick(SY1, rng) + pick(SY2, rng) + pick(SY3, rng); nm2 = nm2[0] + nm2.slice(1).toLowerCase(); } while (names.has(nm2)); names.add(nm2);
    p.name = nm2; p.adj = [...p.adj]; delete p.sx; delete p.sy;
  }
  // distanza dalla costa per sfumare il mare
  const seaD = new Uint8Array(N).fill(255), q = [];
  for (let i = 0; i < N; i++) if (land[i]) { seaD[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) { const c = q[h], x = c % W, y = (c / W) | 0; if (seaD[c] >= 12) continue; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (seaD[j] === 255) { seaD[j] = seaD[c] + 1; q.push(j); } } }
  const jit = new Int8Array(N); for (let i = 0; i < N; i++) jit[i] = Math.floor(rng() * 11) - 5;
  return { cells, provs, seaD, jit, rng };
}

// ---------- stato ----------
let MAP = null, G = null;
const P = i => G.p[i], NA = i => G.n[i], MP = i => MAP.provs[i];

function newGame(seed) {
  MAP = genMap(seed);
  const rng = MAP.rng, np = MAP.provs.length, NN = NAZ.length;
  G = { v: 1, seed, rs: seed ^ 0x2545F491, day: 0, player: -1, speed: 0, nid: 1, armies: [], wars: [], rel: new Array(NN * NN).fill(0), over: false, log: [] };
  G.p = MAP.provs.map(() => ({ owner: -1, ctrl: -1, dev: 1 + Math.floor(rng() * 3), fort: 0, sg: 0 }));
  // capitali lontane tra loro (campionamento del punto più lontano)
  const caps = [Math.floor(rng() * np)];
  while (caps.length < NN) {
    let bi = 0, bd = -1;
    for (let i = 0; i < np; i++) { const p = MP(i); const d = Math.min(...caps.map(c => (MP(c).cx - p.cx) ** 2 + (MP(c).cy - p.cy) ** 2)) * (0.7 + rng() * .6); if (d > bd) { bd = d; bi = i; } }
    caps.push(bi);
  }
  G.n = NAZ.map(([name, color], id) => ({ id, name, color, gold: 30, mp: 0, pts: 40, alive: true, capital: caps[id], allies: [], truce: {}, colony: null }));
  const targets = G.n.map(() => 4 + Math.floor(rng() * 4));
  caps.forEach((c, id) => { P(c).owner = P(c).ctrl = id; P(c).dev = 10; P(c).fort = 1; });
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of G.n) {
      const own = G.p.map((p, i) => p.owner === n.id ? i : -1).filter(i => i >= 0);
      if (own.length >= targets[n.id]) continue;
      const fr = [...new Set(own.flatMap(i => MP(i).adj))].filter(i => P(i).owner < 0 && !MP(i).adj.some(j => P(j).owner >= 0 && P(j).owner !== n.id));
      if (!fr.length) continue;
      const t = pick(fr, rng); P(t).owner = P(t).ctrl = n.id; P(t).dev = 3 + Math.floor(rng() * 5); grew = true;
    }
  }
  for (let a = 0; a < NN; a++) for (let b = a + 1; b < NN; b++) setRel(a, b, Math.floor(rng() * 60) - 30);
  for (const n of G.n) {
    n.mp = Math.floor(maxMp(n.id) * .6);
    const men = (3 + Math.floor(ownedProvs(n.id).length / 2)) * 1000;
    G.armies.push({ id: G.nid++, o: n.id, p: n.capital, men, max: men, mor: 1, path: [], prog: 0, ret: false, arr: 0, inb: false });
  }
}

// ---------- domande sullo stato ----------
const rel = (a, b) => G.rel[a * NAZ.length + b];
function setRel(a, b, v) { v = clamp(Math.round(v), -200, 200); G.rel[a * NAZ.length + b] = v; G.rel[b * NAZ.length + a] = v; }
const addRel = (a, b, d) => setRel(a, b, rel(a, b) + d);
const isAlly = (a, b) => NA(a).allies.includes(b);
const hasTruce = (a, b) => (NA(a).truce[b] || 0) > G.day;
const warBetween = (a, b) => G.wars.find(w => (w.att.includes(a) && w.def.includes(b)) || (w.def.includes(a) && w.att.includes(b)));
const hostile = (a, b) => a >= 0 && b >= 0 && a !== b && !!warBetween(a, b);
const warsOf = a => G.wars.filter(w => w.att.includes(a) || w.def.includes(a));
const sideOf = (w, a) => w.att.includes(a) ? 'att' : w.def.includes(a) ? 'def' : null;
const other = s => s === 'att' ? 'def' : 'att';
const ownedProvs = n => { const r = []; for (let i = 0; i < G.p.length; i++) if (G.p[i].owner === n) r.push(i); return r; };
const totalDev = n => ownedProvs(n).reduce((s, i) => s + P(i).dev, 0);
const maxMp = n => 3000 + totalDev(n) * 300;
const armiesOf = n => G.armies.filter(a => a.o === n);
const menOf = n => armiesOf(n).reduce((s, a) => s + a.men, 0);
const forceLimit = n => 4 + Math.floor(totalDev(n) / 8);
const regsOf = n => armiesOf(n).reduce((s, a) => s + a.max, 0) / 1000;
const income = n => ownedProvs(n).reduce((s, i) => s + (P(i).ctrl === n ? P(i).dev * .1 : 0), 0) + 1;
const upkeep = n => regsOf(n) * .15 + ownedProvs(n).reduce((s, i) => s + P(i).fort * .5, 0);
const devCost = i => 30 + P(i).dev * 6;
const fortCost = i => 60 + P(i).fort * 40;
const isCapital = i => P(i).owner >= 0 && NA(P(i).owner).capital === i;
const neighborsOf = n => { const s = new Set(); for (const i of ownedProvs(n)) for (const j of MP(i).adj) { const o = P(j).owner; if (o >= 0 && o !== n) s.add(o); } return [...s]; };
const enemyArmiesAt = (pid, n) => G.armies.filter(a => a.p === pid && hostile(a.o, n));
const power = n => menOf(n) + NA(n).allies.reduce((s, a) => s + menOf(a) * .6, 0);
function dateStr(d = G.day) { const y = Math.floor(d / 360), m = Math.floor((d % 360) / 30); return `${d % 30 + 1} ${MESI[m]} ${ANNO0 + y}`; }

function canEnter(n, pid) {
  const p = P(pid);
  if (p.owner < 0 || p.owner === n || isAlly(n, p.owner)) return true;
  return hostile(n, p.owner) || hostile(n, p.ctrl);
}
function travel(pid) { return 7 + TERR[MP(pid).terrain].mv; }
function dijkstra(n, start) {
  const np = G.p.length, dist = new Array(np).fill(Infinity), prev = new Array(np).fill(-1), hp = new Heap();
  dist[start] = 0; hp.push(0, start);
  while (hp.size) {
    const [d, c] = hp.pop(); if (d > dist[c]) continue;
    for (const j of MP(c).adj) { if (!canEnter(n, j)) continue; const nd = d + travel(j); if (nd < dist[j]) { dist[j] = nd; prev[j] = c; hp.push(nd, j); } }
  }
  return { dist, prev };
}
function pathTo(dj, t) { if (dj.dist[t] === Infinity) return null; const p = []; for (let c = t; dj.prev[c] >= 0; c = dj.prev[c]) p.unshift(c); return p; }
function order(a, t) { if (a.p === t) { a.path = []; return true; } const p = pathTo(dijkstra(a.o, a.p), t); if (!p) return false; a.path = p; a.prog = 0; return true; }

// ---------- guerra ----------
function warScore(w) { // punto di vista dell'attaccante
  let dD = 0, oD = 0, dA = 0, oA = 0;
  for (let i = 0; i < G.p.length; i++) {
    const p = G.p[i]; if (p.owner < 0) continue; const v = p.dev * (isCapital(i) ? 2 : 1);
    if (w.def.includes(p.owner)) { dD += v; if (w.att.includes(p.ctrl)) oD += v; }
    else if (w.att.includes(p.owner)) { dA += v; if (w.def.includes(p.ctrl)) oA += v; }
  }
  return clamp(Math.round((dD ? oD / dD * 100 : 0) - (dA ? oA / dA * 100 : 0) + w.bs), -100, 100);
}
const scoreFor = (w, n) => sideOf(w, n) === 'def' ? -warScore(w) : warScore(w);
function provCost(w, pid) {
  const losers = w[other(sideOf(w, P(pid).ctrl))];
  const tot = losers.reduce((s, n) => s + ownedProvs(n).reduce((t, i) => t + P(i).dev * (isCapital(i) ? 2 : 1), 0), 0) || 1;
  return Math.max(1, Math.ceil(P(pid).dev * (isCapital(pid) ? 2 : 1) / tot * 100));
}
function occupiedBy(w, side) { // province dei nemici occupate dal lato indicato
  const r = []; for (let i = 0; i < G.p.length; i++) { const p = G.p[i]; if (w[other(side)].includes(p.owner) && w[side].includes(p.ctrl)) r.push(i); } return r;
}
function greedyDemand(w, side, budget) {
  const occ = occupiedBy(w, side).sort((a, b) => P(b).dev - P(a).dev), out = []; let c = 0;
  for (const i of occ) { const pc = provCost(w, i); if (c + pc <= budget) { out.push(i); c += pc; } }
  return out;
}

function declareWar(a, b) {
  if (a === b || isAlly(a, b) || hasTruce(a, b) || warBetween(a, b)) return null;
  const w = { id: G.nid++, att: [a], def: [b], bs: 0, start: G.day, lastOffer: G.day };
  G.wars.push(w); addRel(a, b, -100);
  note(`${NA(a).name} dichiara guerra a ${NA(b).name}`, a === G.player || b === G.player ? 'bad' : '');
  for (const al of NA(b).allies.slice()) callToArms(w, 'def', al, b);
  for (const al of NA(a).allies.slice()) callToArms(w, 'att', al, a);
  segnaCambio(); return w;
}
function callToArms(w, side, al, leader) {
  if (!G.wars.includes(w) || sideOf(w, al) || !NA(al).alive) return;
  const foes = w[other(side)];
  if (foes.some(f => isAlly(al, f) || hasTruce(al, f))) return;
  const join = () => { if (!G.wars.includes(w) || sideOf(w, al)) return; w[side].push(al); note(`${NA(al).name} entra in guerra al fianco di ${NA(leader).name}`); segnaCambio(); };
  if (al === G.player) {
    ask({
      title: 'Chiamata alle armi', body: `<p>Il tuo alleato <b>${esc(NA(leader).name)}</b> ti chiede di entrare in guerra contro <b>${esc(NA(w[other(side)][0]).name)}</b>.</p><p class="muted">Se rifiuti, l'alleanza si scioglie.</p>`,
      buttons: [{ t: 'Entra in guerra', fn: join, cls: 'pri' }, { t: 'Rifiuta', fn: () => breakAlliance(al, leader) }],
    });
    return;
  }
  const r = rel(al, leader), p = side === 'def' ? (r >= 0 ? .85 : .5) : (r >= 50 ? .7 : .3);
  if (rnd() < p) join(); else { breakAlliance(al, leader); }
}
function breakAlliance(a, b) {
  NA(a).allies = NA(a).allies.filter(x => x !== b); NA(b).allies = NA(b).allies.filter(x => x !== a);
  addRel(a, b, -60); note(`L'alleanza tra ${NA(a).name} e ${NA(b).name} è sciolta`);
}
function makeAlliance(a, b) { if (!isAlly(a, b)) { NA(a).allies.push(b); NA(b).allies.push(a); addRel(a, b, 20); note(`${NA(a).name} e ${NA(b).name} firmano un'alleanza`, a === G.player || b === G.player ? 'good' : ''); } }

function makePeace(w, winSide, provList) {
  if (!G.wars.includes(w)) return;
  const winners = w[winSide], losers = w[other(winSide)];
  const pl = G.player, plSide = sideOf(w, pl);
  for (const pid of provList) {
    const p = P(pid); if (!losers.includes(p.owner)) continue;
    transfer(pid, winners.includes(p.ctrl) ? p.ctrl : winners[0]);
  }
  G.wars = G.wars.filter(x => x !== w);
  for (const p of G.p) if (p.ctrl !== p.owner && !hostile(p.owner, p.ctrl)) { p.ctrl = p.owner; p.sg = 0; }
  for (const a of winners) for (const b of losers) { NA(a).truce[b] = NA(b).truce[a] = G.day + TREGUA; }
  for (const a of G.armies) if (!canEnter(a.o, a.p)) { a.p = NA(a.o).capital; a.path = []; a.ret = false; }
  const txt = provList.length ? `${provList.length} province passano di mano` : 'pace bianca';
  note(`Pace tra ${NA(w.att[0]).name} e ${NA(w.def[0]).name}: ${txt}`, plSide ? (plSide === winSide && provList.length ? 'good' : provList.length ? 'bad' : '') : '');
  checkElimination(); segnaCambio();
}
function transfer(pid, n) {
  const p = P(pid), old = p.owner; p.owner = p.ctrl = n; p.sg = 0;
  if (old >= 0 && NA(old).capital === pid) relocateCapital(old);
  for (const x of G.n) if (x.colony && x.colony.p === pid) x.colony = null;
}
function relocateCapital(n) { const own = ownedProvs(n); if (own.length) NA(n).capital = own.reduce((b, i) => P(i).dev > P(b).dev ? i : b, own[0]); }
function checkElimination() {
  for (const n of G.n) {
    if (!n.alive || ownedProvs(n.id).length) continue;
    n.alive = false; note(`${n.name} è scomparso dalla carta`, 'bad');
    G.armies = G.armies.filter(a => a.o !== n.id);
    for (const x of G.n) x.allies = x.allies.filter(y => y !== n.id);
    for (const w of G.wars.slice()) {
      w.att = w.att.filter(x => x !== n.id); w.def = w.def.filter(x => x !== n.id);
      if (!w.att.length || !w.def.length) { G.wars = G.wars.filter(x => x !== w); }
    }
    for (const p of G.p) if (p.ctrl !== p.owner && !hostile(p.owner, p.ctrl)) p.ctrl = p.owner;
    if (n.id === G.player) endGame(false);
  }
}

// ---------- simulazione giornaliera ----------
function tick() {
  G.day++;
  for (const a of G.armies) {
    if (a.inb && !a.ret) continue;
    if (!a.path.length) continue;
    const nx = a.path[0];
    if (!canEnter(a.o, nx)) { a.path = []; continue; }
    if (++a.prog >= travel(nx)) { a.p = nx; a.path.shift(); a.prog = 0; a.arr = G.day; if (!a.path.length) a.ret = false; }
  }
  for (const a of G.armies) a.inb = false;
  battles();
  sieges();
  for (const a of G.armies) if (!a.inb) a.mor = Math.min(1, a.mor + .02);
  for (const n of G.n) if (n.alive && n.colony) {
    const c = n.colony; if (P(c.p).owner >= 0) { n.colony = null; continue; }
    c.prog += 1 / 360;
    if (c.prog >= 1) { P(c.p).owner = P(c.p).ctrl = n.id; P(c.p).dev = 2; n.colony = null; segnaCambio(); note(`${n.name} fonda una colonia a ${MP(c.p).name}`, n.id === G.player ? 'good' : ''); }
  }
  for (const a of G.armies) if (a.o !== G.player && !a.inb && !a.ret && !a.path.length && (G.day + a.id) % 3 === 0) aiArmy(a);
  if (G.day % 30 === 0) monthly();
}

const BTL = new Map();
function battles() {
  const by = new Map();
  for (const a of G.armies) { if (a.ret) continue; if (!by.has(a.p)) by.set(a.p, []); by.get(a.p).push(a); }
  for (const [pid, list] of by) {
    if (list.length < 2) { BTL.delete(pid); continue; }
    const owners = [...new Set(list.map(a => a.o))]; let pair = null;
    for (let i = 0; i < owners.length && !pair; i++) for (let j = i + 1; j < owners.length; j++) if (hostile(owners[i], owners[j])) { pair = [owners[i], owners[j]]; break; }
    if (!pair) { BTL.delete(pid); continue; }
    const B = list.filter(a => hostile(a.o, pair[0])), A = list.filter(a => !B.includes(a) && B.some(b => hostile(a.o, b.o)));
    if (A.length && B.length) fight(pid, A, B); else BTL.delete(pid);
  }
}
function fight(pid, A, B) {
  const t = TERR[MP(pid).terrain], sum = l => l.reduce((s, a) => s + a.men, 0);
  const menA = sum(A), menB = sum(B), defA = Math.min(...A.map(a => a.arr)) <= Math.min(...B.map(a => a.arr));
  let dA = menB * .015 * (.6 + rnd() * .8), dB = menA * .015 * (.6 + rnd() * .8);
  if (defA) dA /= 1 + t.def; else dB /= 1 + t.def;
  const st = BTL.get(pid) || { la: 0, lb: 0, d: 0 }; st.la += dA; st.lb += dB; st.d++; BTL.set(pid, st);
  const hit = (L, dmg, tot) => { for (const a of L) { a.men = Math.max(0, a.men - dmg * a.men / tot); a.mor -= dmg / tot * 7 + .03; a.inb = true; } };
  hit(A, dA, menA); hit(B, dB, menB);
  const mor = L => L.reduce((s, a) => s + a.mor * a.men, 0) / Math.max(1, sum(L));
  const mA = mor(A), mB = mor(B);
  if (mA > 0 && mB > 0 && sum(A) > 150 && sum(B) > 150) return;
  const aLost = mA - (sum(A) <= 150 ? 9 : 0) <= mB - (sum(B) <= 150 ? 9 : 0);
  const losers = aLost ? A : B, winners = aLost ? B : A, lLo = aLost ? st.la : st.lb, lWi = aLost ? st.lb : st.la;
  const w = warBetween(winners[0].o, losers[0].o);
  if (w) { const v = clamp(Math.round((lLo - lWi) / 1000 * 1.5 + 3), 1, 12); w.bs = clamp(w.bs + (sideOf(w, winners[0].o) === 'att' ? v : -v), -40, 40); }
  for (const a of losers) { a.men *= .85; a.mor = Math.min(a.mor, 0); retreat(a); }
  G.armies = G.armies.filter(a => a.men >= 250 || !losers.includes(a));
  BTL.delete(pid);
  const pl = G.player, involved = [...A, ...B].some(a => a.o === pl);
  if (involved) {
    const won = winners.some(a => a.o === pl);
    note(`Battaglia di ${MP(pid).name}: ${won ? 'vittoria' : 'sconfitta'} (perdite ${k(won ? lWi : lLo)} contro ${k(won ? lLo : lWi)})`, won ? 'good' : 'bad');
  }
}
function retreat(a) {
  const dj = dijkstra(a.o, a.p); let best = -1, bd = Infinity;
  for (let i = 0; i < G.p.length; i++) {
    if (i === a.p || dj.dist[i] >= bd) continue;
    const p = P(i); if (!(p.ctrl === a.o || (p.ctrl >= 0 && isAlly(a.o, p.ctrl)))) continue;
    if (enemyArmiesAt(i, a.o).length) continue; bd = dj.dist[i]; best = i;
  }
  if (best < 0) { a.men = 0; return; }
  a.path = pathTo(dj, best); a.prog = 0; a.ret = true;
}
function sieges() {
  for (let i = 0; i < G.p.length; i++) {
    const p = G.p[i]; if (p.owner < 0) { p.sg = 0; continue; }
    const bs = G.armies.filter(a => a.p === i && !a.ret && !a.inb && !a.path.length && hostile(a.o, p.ctrl));
    if (!bs.length || enemyArmiesAt(i, bs[0].o).length) { if (p.sg && !bs.length) p.sg = 0; continue; }
    const men = bs.reduce((s, a) => s + a.men, 0);
    p.sg += Math.sqrt(men / 1000) / (18 * (1 + 1.5 * p.fort));
    if (p.sg >= 1) {
      const occ = bs[0].o, before = p.ctrl; p.sg = 0;
      p.ctrl = hostile(occ, p.owner) ? occ : p.owner; segnaCambio();
      if (occ === G.player) note(`${MP(i).name} è ${p.ctrl === p.owner ? 'liberata' : 'occupata'}`, 'good');
      else if (p.owner === G.player || before === G.player) note(`Il nemico prende ${MP(i).name}`, 'bad');
    }
  }
}

// ---------- mese ----------
function monthly() {
  for (const n of G.n) {
    if (!n.alive) continue;
    n.gold += income(n.id) - upkeep(n.id);
    const mx = maxMp(n.id); n.mp = Math.min(mx, n.mp + mx / 60);
    n.pts += 5;
    for (const a of armiesOf(n.id)) {
      const p = P(a.p); if (a.inb || p.ctrl !== n.id || n.gold < 0) continue;
      const add = Math.min(a.max - a.men, a.max * .15, n.mp); a.men += add; n.mp -= add;
    }
  }
  for (let a = 0; a < NAZ.length; a++) for (let b = a + 1; b < NAZ.length; b++) {
    let r = rel(a, b); if (Math.abs(r) > 40) r -= Math.sign(r); r += Math.round((rnd() - .5) * 4); setRel(a, b, r);
  }
  for (const n of G.n) if (n.alive && n.id !== G.player) aiMonthly(n);
  if (G.player >= 0 && rnd() < .04) randomEvent();
  if (G.day % 360 === 0) { EVENTI.fineAnno(); checkVictory(); }
  segnaCambio();
}
function randomEvent() {
  const n = NA(G.player), own = ownedProvs(G.player); if (!own.length) return;
  const p = pick(own), r = rnd();
  if (r < .3) { n.gold += 15; note(`Buon raccolto a ${MP(p).name}: +15 oro`, 'good'); }
  else if (r < .5) { n.pts += 25; note('Un erudito arriva a corte: +25 punti', 'good'); }
  else if (r < .75) { n.gold -= 10; note(`Briganti sulle strade di ${MP(p).name}: −10 oro`, 'bad'); }
  else if (P(p).dev > 1) { P(p).dev--; note(`Pestilenza a ${MP(p).name}: −1 sviluppo`, 'bad'); }
}
function checkVictory() {
  if (G.over || G.player < 0) return;
  const land = G.p.length, mine = ownedProvs(G.player).length;
  if (mine >= land * .5) endGame(true);
}

// ---------- intelligenza artificiale ----------
function aiMonthly(n) {
  const id = n.id, own = ownedProvs(id); if (!own.length) return;
  for (let t = 0; t < 2; t++) {
    if (n.gold >= COSTO_RECLUTA + 5 && n.mp >= 1000 && regsOf(id) < forceLimit(id)) {
      const where = P(n.capital).ctrl === id && !enemyArmiesAt(n.capital, id).length ? n.capital : own.find(i => P(i).ctrl === id && !enemyArmiesAt(i, id).length);
      if (where !== undefined) recruit(id, where);
    }
  }
  if (n.pts >= 60) { const i = pick(own); if (n.pts >= devCost(i)) { n.pts -= devCost(i); P(i).dev++; } }
  if (n.gold > 120 && P(n.capital).fort < 2 && P(n.capital).ctrl === id) { n.gold -= fortCost(n.capital); P(n.capital).fort++; }
  // a fine espansione l'oro non avrebbe più usi: sopra 200 l'IA lo trasforma in sviluppo (stesso prezzo che paga il giocatore)
  for (let t = 0; t < 2 && n.gold > 200; t++) {
    const mie = own.filter(i => P(i).ctrl === id); if (!mie.length) break;
    const i = pick(mie); if (n.gold - devCost(i) < 100) break;
    n.gold -= devCost(i); P(i).dev++;
  }
  if (!n.colony && n.gold >= COSTO_COLONIA + 10) {
    const fr = [...new Set(own.flatMap(i => MP(i).adj))].filter(i => P(i).owner < 0 && !G.n.some(x => x.colony && x.colony.p === i));
    if (fr.length) { n.gold -= COSTO_COLONIA; n.colony = { p: pick(fr), prog: 0 }; }
  }
  if (n.allies.length < 2 && rnd() < .03) {
    const c = G.n.filter(m => m.alive && m.id !== id && m.id !== G.player && !isAlly(id, m.id) && !hostile(id, m.id) && rel(id, m.id) >= 10 && m.allies.length < 3);
    if (c.length) makeAlliance(id, pick(c).id);
  }
  // pace
  for (const w of warsOf(id)) {
    const side = sideOf(w, id); if (w[side][0] !== id) continue;
    const foe = w[other(side)][0], sc = scoreFor(w, id), age = G.day - w.start;
    if (sc >= 20) {
      let dem = greedyDemand(w, side, Math.min(sc, 60)); // al massimo il 60% per trattato...
      if (!dem.length) { // ...ma se nessuna provincia ci sta (per esempio l'ultima, che vale più del 60%) si chiede la più economica che il punteggio copre
        const ok = occupiedBy(w, side).filter(i => provCost(w, i) <= sc).sort((x, y) => provCost(w, x) - provCost(w, y));
        if (ok.length) dem = [ok[0]];
      }
      if (!dem.length) continue;
      if (foe === G.player) {
        if (G.day - w.lastOffer >= 180) { w.lastOffer = G.day; offerToPlayer(w, side, dem); }
      } else makePeace(w, side, dem);
    } else if (age > 1080 && Math.abs(sc) < 15) {
      if (foe === G.player) { if (G.day - w.lastOffer >= 360) { w.lastOffer = G.day; offerToPlayer(w, side, []); } }
      else makePeace(w, side, []);
    }
  }
  // dichiarazione di guerra
  if (!warsOf(id).length && G.day > 540 && rnd() < .07) {
    const my = power(id);
    const c = neighborsOf(id).filter(o => NA(o).alive && (o !== G.player || G.day > 1080) && !isAlly(id, o) && !hasTruce(id, o) && rel(id, o) < 50 && my > power(o) * 1.4);
    if (c.length) declareWar(id, c.reduce((b, o) => power(o) < power(b) ? o : b, c[0]));
  }
}
function offerToPlayer(w, side, dem) {
  const foe = w[side][0];
  const list = dem.map(i => `<li>${esc(MP(i).name)} <span class="muted">(sviluppo ${P(i).dev})</span></li>`).join('');
  ask({
    title: dem.length ? 'Richiesta di pace' : 'Proposta di pace bianca',
    body: dem.length ? `<p><b>${esc(NA(foe).name)}</b> propone la pace in cambio di:</p><ul>${list}</ul><p class="muted">Punteggio di guerra per loro: ${scoreFor(w, foe)}%</p>` : `<p><b>${esc(NA(foe).name)}</b> propone di chiudere la guerra senza cessioni.</p>`,
    buttons: [{ t: 'Accetta', fn: () => makePeace(w, side, dem), cls: dem.length ? 'bad' : 'pri' }, { t: 'Rifiuta', fn: () => {} }],
  });
}
function aiArmy(a) {
  const n = a.o, foes = G.n.filter(x => x.alive && hostile(n, x.id)).map(x => x.id);
  if (!foes.length) { if (P(a.p).owner !== n) order(a, NA(n).capital); return; }
  const dj = dijkstra(n, a.p), go = t => { const p = pathTo(dj, t); if (p) { a.path = p; a.prog = 0; } };
  const nearest = test => { let b = -1, bd = Infinity; for (let i = 0; i < G.p.length; i++) if (dj.dist[i] < bd && test(i)) { bd = dj.dist[i]; b = i; } return b; };
  if (a.mor < .5 || a.men < .4 * a.max) {
    if (P(a.p).ctrl === n) return;
    const t = nearest(i => P(i).ctrl === n && !enemyArmiesAt(i, n).length); if (t >= 0) go(t); return;
  }
  if (hostile(n, P(a.p).ctrl) && !enemyArmiesAt(a.p, n).length) return; // sta assediando
  const t1 = nearest(i => { const e = enemyArmiesAt(i, n); return e.length && dj.dist[i] < 60 && e.reduce((s, x) => s + x.men, 0) <= a.men * 1.1; });
  if (t1 >= 0) return go(t1);
  const t2 = nearest(i => P(i).owner === n && hostile(n, P(i).ctrl));
  if (t2 >= 0) return go(t2);
  const busy = new Set(G.armies.filter(x => x !== a && !hostile(x.o, n)).map(x => x.path.length ? x.path[x.path.length - 1] : x.p));
  const t3 = nearest(i => foes.includes(P(i).owner) && hostile(n, P(i).ctrl) && !busy.has(i));
  if (t3 >= 0) return go(t3);
  const t4 = nearest(i => foes.includes(P(i).owner) && hostile(n, P(i).ctrl));
  if (t4 >= 0) go(t4);
}

// ---------- azioni ----------
function recruit(n, pid) {
  const N = NA(n);
  if (N.gold < COSTO_RECLUTA || N.mp < 1000 || P(pid).owner !== n || P(pid).ctrl !== n || enemyArmiesAt(pid, n).length) return false;
  N.gold -= COSTO_RECLUTA; N.mp -= 1000;
  const ex = G.armies.find(a => a.o === n && a.p === pid && !a.path.length && !a.ret);
  if (ex) { ex.men += 1000; ex.max += 1000; }
  else G.armies.push({ id: G.nid++, o: n, p: pid, men: 1000, max: 1000, mor: .5, path: [], prog: 0, ret: false, arr: G.day, inb: false });
  return true;
}

// ---------- caricamento ----------
// Ricostruisce la mappa dal seme e adotta lo stato salvato. Restituisce false se i dati non sono validi.
function caricaStato(g) {
  if (!g || g.v !== 1) return false;
  MAP = genMap(g.seed); G = g; G.speed = 0;
  if (typeof G.rs !== 'number') G.rs = g.seed ^ 0x2545F491; // salvataggi precedenti alla casualità riproducibile
  return true;
}

// ---------- uso da Node ----------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EVENTI, newGame, caricaStato, tick, NAZ, ANNO0,
    get G() { return G; }, get MAP() { return MAP; },
    ownedProvs, totalDev, income, upkeep, menOf, warsOf, warScore, scoreFor, sideOf, dateStr, makePeace,
  };
}

'use strict';
/* Corone e Confini — gioco di grande strategia per telefono.
   Mappa generata da un seme, tempo continuo con pausa, economia mensile,
   eserciti, battaglie, assedi, guerre con punteggio e trattati di pace. */

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
const rnd = Math.random;
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
  G = { v: 1, seed, day: 0, player: -1, speed: 0, nid: 1, armies: [], wars: [], rel: new Array(NN * NN).fill(0), over: false, log: [] };
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
  dirty = true; return w;
}
function callToArms(w, side, al, leader) {
  if (!G.wars.includes(w) || sideOf(w, al) || !NA(al).alive) return;
  const foes = w[other(side)];
  if (foes.some(f => isAlly(al, f) || hasTruce(al, f))) return;
  const join = () => { if (!G.wars.includes(w) || sideOf(w, al)) return; w[side].push(al); note(`${NA(al).name} entra in guerra al fianco di ${NA(leader).name}`); dirty = true; };
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
  checkElimination(); dirty = true;
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
    if (c.prog >= 1) { P(c.p).owner = P(c.p).ctrl = n.id; P(c.p).dev = 2; n.colony = null; dirty = true; note(`${n.name} fonda una colonia a ${MP(c.p).name}`, n.id === G.player ? 'good' : ''); }
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
      p.ctrl = hostile(occ, p.owner) ? occ : p.owner; dirty = true;
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
  if (G.day % 360 === 0) { save(true); checkVictory(); }
  dirty = true;
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
      const dem = greedyDemand(w, side, Math.min(sc, 60)); if (!dem.length) continue; // al massimo il 60% per trattato
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

// ---------- salvataggio ----------
const SAVE_KEY = 'corone_e_confini_v1';
function save(quiet) {
  if (!G || G.player < 0) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); if (!quiet) note('Partita salvata', 'good'); }
  catch (e) { if (!quiet) note('Salvataggio non riuscito: la memoria del browser non è disponibile', 'bad'); }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function load(data) {
  try {
    const g = data || JSON.parse(localStorage.getItem(SAVE_KEY)); if (!g || g.v !== 1) return false;
    MAP = genMap(g.seed); G = g; G.speed = 0; return true;
  } catch (e) { return false; }
}

// =====================================================================
// ---------- disegno ----------
const cv = document.getElementById('map'), ctx = cv.getContext('2d');
const base = document.createElement('canvas'); base.width = MW; base.height = MH;
const bctx = base.getContext('2d');
let dirty = true, mode = 'politica', selProv = -1, selArmy = -1, previewNation = -1;
const cam = { x: 0, y: 0, z: 1 };
let vw = 0, vh = 0, dpr = 1;
const SEA_N = [58, 98, 112], SEA_F = [20, 42, 56];

function provFill(i) {
  const p = P(i);
  if (mode === 'terreno') return TERR[MP(i).terrain].col;
  if (mode === 'sviluppo') { const t = clamp((p.dev - 1) / 14, 0, 1); return [Math.round(70 + 170 * t), Math.round(80 + 120 * t), Math.round(70 - 30 * t)]; }
  if (mode === 'diplomazia' && G.player >= 0) {
    const o = p.owner, pl = G.player;
    if (o < 0) return [120, 114, 96];
    if (o === pl) return [201, 162, 74];
    if (hostile(o, pl)) return [190, 70, 52];
    if (isAlly(o, pl)) return [70, 120, 190];
    if (hasTruce(o, pl)) return [200, 130, 60];
    const r = rel(o, pl); return r > 50 ? [110, 160, 120] : r < -50 ? [140, 90, 90] : [110, 110, 104];
  }
  if (p.owner < 0) return [128, 121, 100];
  return hexRgb(NA(p.owner).color);
}
function renderBase() {
  const img = bctx.createImageData(MW, MH), d = img.data, cells = MAP.cells, np = G.p.length;
  const fills = [], stripes = [];
  for (let i = 0; i < np; i++) {
    let f = provFill(i);
    if (previewNation >= 0 && P(i).owner !== previewNation) f = f.map(c => Math.round(c * .45 + 30));
    if (i === selProv) f = f.map(c => Math.min(255, Math.round(c * 1.25 + 20)));
    fills.push(f);
    const p = P(i); stripes.push(mode === 'politica' && p.ctrl >= 0 && p.ctrl !== p.owner ? hexRgb(NA(p.ctrl).color) : null);
  }
  for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
    const ci = cy * W + cx, id = cells[ci];
    if (id < 0) {
      const t = Math.min(MAP.seaD[ci], 10) / 10, j = MAP.jit[ci] * .4;
      const r = SEA_N[0] + (SEA_F[0] - SEA_N[0]) * t + j, g = SEA_N[1] + (SEA_F[1] - SEA_N[1]) * t + j, b = SEA_N[2] + (SEA_F[2] - SEA_N[2]) * t + j;
      for (let py = 0; py < S; py++) { let o = ((cy * S + py) * MW + cx * S) * 4; for (let px = 0; px < S; px++, o += 4) { d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255; } }
      continue;
    }
    const L = cx > 0 ? cells[ci - 1] : -1, R = cx < W - 1 ? cells[ci + 1] : -1, U = cy > 0 ? cells[ci - W] : -1, D = cy < H - 1 ? cells[ci + W] : -1;
    const own = P(id).owner, f = fills[id], s = stripes[id], j = MAP.jit[ci];
    for (let py = 0; py < S; py++) {
      let o = ((cy * S + py) * MW + cx * S) * 4;
      for (let px = 0; px < S; px++, o += 4) {
        const gx = cx * S + px, gy = cy * S + py;
        let c = s && ((gx + gy) & 7) < 3 ? s : f, m = 1;
        let ot = id;
        if (px === 0) ot = L; else if (px === S - 1) ot = R;
        if (ot === id) { if (py === 0) ot = U; else if (py === S - 1) ot = D; }
        if (ot !== id) {
          if (ot < 0) m = .42;
          else if (P(ot).owner !== own) m = .38;
          else if (px === S - 1 || py === S - 1) m = .78;
        }
        if (id === selProv && ot !== id) { d[o] = 250; d[o + 1] = 240; d[o + 2] = 210; d[o + 3] = 255; continue; }
        d[o] = clamp(c[0] * m + j, 0, 255); d[o + 1] = clamp(c[1] * m + j, 0, 255); d[o + 2] = clamp(c[2] * m + j, 0, 255); d[o + 3] = 255;
      }
    }
  }
  bctx.putImageData(img, 0, 0);
  computeNationLabels();
  dirty = false;
}
let nationLabels = [];
function computeNationLabels() {
  nationLabels = [];
  for (const n of G.n) {
    if (!n.alive) continue; const own = ownedProvs(n.id); if (!own.length) continue;
    let sx = 0, sy = 0, cells = 0, x0 = 1e9, x1 = -1e9;
    for (const i of own) { const m = MP(i); sx += m.wx * m.n; sy += m.wy * m.n; cells += m.n; x0 = Math.min(x0, m.wx); x1 = Math.max(x1, m.wx); }
    const short = n.name.split(' ').slice(-1)[0].toUpperCase();
    nationLabels.push({ x: sx / cells, y: sy / cells, t: short, w: Math.max(x1 - x0, Math.sqrt(cells) * S * 1.3) });
  }
}
const toScreen = (wx, wy) => [(wx - cam.x) * cam.z, (wy - cam.y) * cam.z];
let armyHits = [];
function draw() {
  if (dirty) renderBase();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = `rgb(${SEA_F})`; ctx.fillRect(0, 0, vw, vh);
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, -cam.x * cam.z * dpr, -cam.y * cam.z * dpr);
  ctx.imageSmoothingEnabled = cam.z < 1;
  ctx.drawImage(base, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const z = cam.z;
  // nomi delle nazioni o delle province
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (z < 1.7) {
    for (const l of nationLabels) {
      const [x, y] = toScreen(l.x, l.y), fs = clamp(l.w * z / (l.t.length * .9), 9, 30);
      ctx.font = `${fs}px "IM Fell English SC", Georgia, serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(fs * .18)}px`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(15,18,22,.55)'; ctx.strokeText(l.t, x, y);
      ctx.fillStyle = 'rgba(250,244,228,.92)'; ctx.fillText(l.t, x, y);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  } else {
    ctx.font = `600 ${clamp(z * 4.2, 10, 14)}px "Alegreya Sans", system-ui, sans-serif`;
    for (let i = 0; i < G.p.length; i++) {
      const [x, y0] = toScreen(MP(i).wx, MP(i).wy), y = y0 - 24; if (x < -50 || y < -20 || x > vw + 50 || y > vh + 20) continue;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(15,18,22,.6)'; ctx.strokeText(MP(i).name, x, y);
      ctx.fillStyle = '#f4ecd8'; ctx.fillText(MP(i).name, x, y);
    }
  }
  // assedi e colonie
  for (let i = 0; i < G.p.length; i++) {
    const p = P(i); if (!p.sg) continue; const [x, y] = toScreen(MP(i).wx, MP(i).wy);
    ctx.beginPath(); ctx.arc(x, y, 15, -Math.PI / 2, -Math.PI / 2 + p.sg * Math.PI * 2); ctx.strokeStyle = '#e6c46a'; ctx.lineWidth = 3; ctx.stroke();
  }
  for (const n of G.n) if (n.alive && n.colony) {
    const [x, y] = toScreen(MP(n.colony.p).wx, MP(n.colony.p).wy);
    ctx.fillStyle = n.color; ctx.fillRect(x - 1, y - 14, 2, 14); ctx.fillRect(x + 1, y - 14, 9, 6);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 8, y + 2, 16, 3); ctx.fillStyle = '#e6c46a'; ctx.fillRect(x - 8, y + 2, 16 * n.colony.prog, 3);
  }
  // percorsi
  const sa = G.armies.find(a => a.id === selArmy);
  for (const a of G.armies) {
    if (!a.path.length || (a.o !== G.player && a !== sa)) continue;
    ctx.beginPath(); let [x, y] = toScreen(MP(a.p).wx, MP(a.p).wy); ctx.moveTo(x, y);
    for (const s of a.path) { [x, y] = toScreen(MP(s).wx, MP(s).wy); ctx.lineTo(x, y); }
    ctx.setLineDash([6, 5]); ctx.lineWidth = a === sa ? 2.5 : 1.5; ctx.strokeStyle = a.ret ? 'rgba(220,120,100,.9)' : 'rgba(240,226,180,.9)'; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fillStyle = 'rgba(240,226,180,.9)'; ctx.fill();
  }
  // eserciti
  armyHits = [];
  const byP = new Map(); for (const a of G.armies) { if (!byP.has(a.p)) byP.set(a.p, []); byP.get(a.p).push(a); }
  ctx.font = `700 11px "Alegreya Sans", system-ui, sans-serif`;
  if (G.player < 0) byP.clear(); // nella schermata iniziale si vedono solo i confini
  for (const [pid, list] of byP) {
    const m = MP(pid); let [x, y] = toScreen(m.wx, m.wy);
    if (x < -60 || y < -40 || x > vw + 60 || y > vh + 40) continue;
    if (list.some(a => a.inb)) { ctx.font = '18px serif'; ctx.fillStyle = '#f2d27a'; ctx.fillText('⚔', x, y - 22); ctx.font = `700 11px "Alegreya Sans", system-ui, sans-serif`; }
    list.forEach((a, idx) => {
      let ax = x + (idx - (list.length - 1) / 2) * 40, ay = y;
      if (a.path.length && !a.inb) { const nx = toScreen(MP(a.path[0]).wx, MP(a.path[0]).wy), t = a.prog / travel(a.path[0]) * .5; ax += (nx[0] - x) * t; ay += (nx[1] - y) * t; }
      const w = 36, h = 18;
      ctx.fillStyle = 'rgba(10,12,16,.55)'; ctx.fillRect(ax - w / 2 + 2, ay - h / 2 + 2, w, h);
      ctx.fillStyle = NA(a.o).color; ctx.fillRect(ax - w / 2, ay - h / 2, w, h);
      ctx.lineWidth = a.id === selArmy ? 2.5 : 1; ctx.strokeStyle = a.id === selArmy ? '#fffbe8' : 'rgba(15,18,22,.85)'; ctx.strokeRect(ax - w / 2, ay - h / 2, w, h);
      ctx.fillStyle = '#fffaf0'; ctx.fillText((a.men / 1000).toFixed(1), ax, ay + 1);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(ax - w / 2, ay + h / 2, w, 3);
      ctx.fillStyle = a.mor > .5 ? '#7fc77a' : a.mor > .2 ? '#e6c46a' : '#d0573f'; ctx.fillRect(ax - w / 2, ay + h / 2, w * clamp(a.mor, 0, 1), 3);
      if (a.o === G.player) { ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.moveTo(ax, ay - h / 2 - 6); ctx.lineTo(ax - 4, ay - h / 2 - 1); ctx.lineTo(ax + 4, ay - h / 2 - 1); ctx.fill(); }
      armyHits.push({ id: a.id, x: ax, y: ay });
    });
  }
}

// ---------- telecamera e tocchi ----------
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2.5); vw = cv.clientWidth; vh = cv.clientHeight;
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); clampCam();
}
function clampCam() {
  cam.z = clamp(cam.z, Math.min(vw / MW, vh / MH) * .9, 6);
  const mx = vw / cam.z, my = vh / cam.z;
  // con la mappa più piccola dello schermo i due limiti si scambiano: si usa l'intervallo che li contiene entrambi
  const lx = -mx * .25, hx = MW - mx * .75, ly = -my * .25, hy = MH - my * .75;
  cam.x = clamp(cam.x, Math.min(lx, hx, MW - mx), Math.max(lx, hx, 0)); cam.y = clamp(cam.y, Math.min(ly, hy, MH - my), Math.max(ly, hy, 0));
}
function centerOn(wx, wy, z) { if (z) cam.z = z; cam.x = wx - vw / 2 / cam.z; cam.y = wy - vh / 2 / cam.z; clampCam(); }
function zoomAt(sx, sy, f) { const wx = cam.x + sx / cam.z, wy = cam.y + sy / cam.z; cam.z = clamp(cam.z * f, Math.min(vw / MW, vh / MH) * .9, 6); cam.x = wx - sx / cam.z; cam.y = wy - sy / cam.z; clampCam(); }
const ptr = new Map(); let gesture = null;
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (ptr.size === 1) gesture = { t: performance.now(), x: e.offsetX, y: e.offsetY, moved: false };
  else gesture = { pinch: true, moved: true };
});
cv.addEventListener('pointermove', e => {
  if (!ptr.has(e.pointerId)) return; const old = ptr.get(e.pointerId), cur = { x: e.offsetX, y: e.offsetY };
  if (ptr.size === 1) {
    if (gesture && Math.hypot(cur.x - gesture.x, cur.y - gesture.y) > 8) gesture.moved = true;
    if (gesture && gesture.moved) { cam.x -= (cur.x - old.x) / cam.z; cam.y -= (cur.y - old.y) / cam.z; clampCam(); }
  } else if (ptr.size === 2) {
    const [a, b] = [...ptr.entries()].map(([id, p]) => id === e.pointerId ? cur : p);
    const [a0, b0] = [...ptr.values()];
    const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y), d1 = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mx0 = (a0.x + b0.x) / 2, my0 = (a0.y + b0.y) / 2;
    cam.x -= (mx - mx0) / cam.z; cam.y -= (my - my0) / cam.z;
    if (d0 > 10) zoomAt(mx, my, d1 / d0);
  }
  ptr.set(e.pointerId, cur);
});
const endPtr = e => {
  ptr.delete(e.pointerId);
  if (ptr.size === 0 && gesture && !gesture.moved && !gesture.pinch && performance.now() - gesture.t < 500) tap(e.offsetX, e.offsetY);
  if (ptr.size === 0) gesture = null;
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', e => { ptr.delete(e.pointerId); gesture = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });

function provAt(sx, sy) {
  const cx = Math.floor((cam.x + sx / cam.z) / S), cy = Math.floor((cam.y + sy / cam.z) / S);
  if (cx < 0 || cy < 0 || cx >= W || cy >= H) return -1; return MAP.cells[cy * W + cx];
}
function tap(sx, sy) {
  if (!G || G.player < 0) return;
  const hit = armyHits.filter(h => Math.abs(h.x - sx) < 22 && Math.abs(h.y - sy) < 16).sort((a, b) => Math.hypot(a.x - sx, a.y - sy) - Math.hypot(b.x - sx, b.y - sy))[0];
  const sa = G.armies.find(a => a.id === selArmy);
  if (hit && (!sa || hit.id !== selArmy)) {
    const a = G.armies.find(x => x.id === hit.id);
    if (a && (a.o === G.player || !sa)) { selArmy = a.id; selProv = -1; dirty = true; showArmy(); return; }
  }
  const pid = provAt(sx, sy);
  if (sa && sa.o === G.player) {
    if (pid < 0) return;
    if (sa.ret) { note('L\'esercito è in ritirata e non accetta ordini', 'bad'); return; }
    if (order(sa, pid)) { note(pid === sa.p ? 'Esercito fermo' : `In marcia verso ${MP(pid).name}`); showArmy(); }
    else note(`Non puoi entrare in territorio di ${NA(P(pid).owner).name}: non siete in guerra né alleati`, 'bad');
    return;
  }
  selArmy = -1;
  if (pid < 0) { selProv = -1; dirty = true; closeSheet(); return; }
  selProv = pid; dirty = true; showProvince();
}

// =====================================================================
// ---------- interfaccia ----------
const $ = s => document.querySelector(s);
const sheet = $('#sheet'), sheetBody = $('#sheetBody');
function openSheet(html) { sheetBody.innerHTML = html; sheet.hidden = false; }
function closeSheet() { sheet.hidden = true; sheetView = null; }
let sheetView = null, peaceSel = new Set(), peaceWar = -1;
function refreshSheet() { if (sheet.hidden || !sheetView) return; const sc = sheetBody.scrollTop; sheetView(); sheetBody.scrollTop = sc; }

function chip(n) { return `<span class="dot" style="background:${NA(n).color}"></span>${esc(NA(n).name)}`; }
function statusWith(o) {
  const pl = G.player;
  if (o === pl) return '<span class="pill gold">Tu</span>';
  if (hostile(o, pl)) return '<span class="pill bad">In guerra</span>';
  if (isAlly(o, pl)) return '<span class="pill blue">Alleato</span>';
  if (hasTruce(o, pl)) return `<span class="pill warn">Tregua fino al ${dateStr(NA(o).truce[pl])}</span>`;
  return '';
}
function btn(act, label, ok = true, cls = '') { return `<button class="b ${cls}" data-act="${act}" ${ok ? '' : 'disabled'}>${label}</button>`; }

function showProvince() {
  sheetView = showProvince;
  const i = selProv; if (i < 0) return closeSheet();
  const p = P(i), m = MP(i), pl = G.player, me = NA(pl);
  let h = `<div class="sh-head"><div><h2>${esc(m.name)}</h2><div class="muted">${TERR[m.terrain].n}${m.coastal ? ' · costiera' : ''}${isCapital(i) ? ' · capitale' : ''}</div></div>${btn('close', '✕', true, 'x')}</div>`;
  h += '<dl class="kv">';
  h += `<dt>Proprietario</dt><dd>${p.owner >= 0 ? chip(p.owner) + ' ' + statusWith(p.owner) : 'Terra libera'}</dd>`;
  if (p.ctrl !== p.owner && p.ctrl >= 0) h += `<dt>Occupata da</dt><dd>${chip(p.ctrl)}</dd>`;
  h += `<dt>Sviluppo</dt><dd>${p.dev}</dd><dt>Fortezza</dt><dd>${p.fort ? 'livello ' + p.fort : 'nessuna'}</dd>`;
  h += `<dt>Difesa del terreno</dt><dd>+${Math.round(TERR[m.terrain].def * 100)}%</dd>`;
  if (p.sg) h += `<dt>Assedio</dt><dd>${Math.round(p.sg * 100)}%</dd>`;
  const col = G.n.find(n => n.alive && n.colony && n.colony.p === i); if (col) h += `<dt>Colonia</dt><dd>${chip(col.id)} · ${Math.round(col.colony.prog * 100)}%</dd>`;
  h += '</dl><div class="acts">';
  if (p.owner === pl && p.ctrl === pl) {
    h += btn('dev', `Sviluppa <small>${devCost(i)} punti</small>`, me.pts >= devCost(i));
    h += btn('fort', p.fort >= 3 ? 'Fortezza al massimo' : `Fortezza ${p.fort + 1} <small>${fortCost(i)} oro</small>`, p.fort < 3 && me.gold >= fortCost(i));
    const why = enemyArmiesAt(i, pl).length ? 'nemici in provincia' : me.mp < 1000 ? 'pochi uomini' : me.gold < COSTO_RECLUTA ? 'poco oro' : '';
    h += btn('rec', `Recluta 1000 uomini <small>${why || COSTO_RECLUTA + ' oro'}</small>`, !why);
    if (!isCapital(i)) h += btn('cap', 'Sposta qui la capitale <small>50 punti</small>', me.pts >= 50);
  } else if (p.owner < 0) {
    const adj = m.adj.some(j => P(j).owner === pl);
    if (col) h += `<p class="muted">Colonia in corso.</p>`;
    else h += btn('col', `Fonda una colonia <small>${adj ? COSTO_COLONIA + ' oro, circa 1 anno' : 'serve un confine'}</small>`, adj && !me.colony && me.gold >= COSTO_COLONIA);
    if (me.colony && !col) h += `<p class="muted">Hai già una colonia in corso a ${esc(MP(me.colony.p).name)}.</p>`;
  } else if (p.owner !== pl) {
    h += btn('nat:' + p.owner, `Diplomazia con ${esc(NA(p.owner).name)}`);
  }
  h += '</div>';
  openSheet(h);
}
function showArmy() {
  sheetView = showArmy;
  const a = G.armies.find(x => x.id === selArmy); if (!a) { selArmy = -1; return closeSheet(); }
  const mine = a.o === G.player, here = G.armies.filter(x => x.o === a.o && x.p === a.p && x !== a);
  let h = `<div class="sh-head"><div><h2>Esercito ${mine ? 'tuo' : 'di ' + esc(NA(a.o).name)}</h2><div class="muted">a ${esc(MP(a.p).name)}${a.ret ? ' · in ritirata' : a.inb ? ' · in battaglia' : a.path.length ? ' · verso ' + esc(MP(a.path[a.path.length - 1]).name) : ''}</div></div>${btn('close', '✕', true, 'x')}</div>`;
  h += `<dl class="kv"><dt>Uomini</dt><dd>${Math.round(a.men).toLocaleString('it-IT')} / ${a.max.toLocaleString('it-IT')}</dd><dt>Morale</dt><dd>${Math.round(clamp(a.mor, 0, 1) * 100)}%</dd></dl>`;
  if (mine) {
    h += `<p class="hint">Tocca una provincia per marciare. Le battaglie partono quando incontri un nemico; fermo su una provincia nemica la assedi.</p><div class="acts">`;
    h += btn('stop', 'Fermati', !!a.path.length && !a.ret);
    h += btn('split', 'Dividi a metà', a.max >= 2000 && !a.inb);
    h += btn('merge', `Unisci (${here.length})`, here.length > 0 && !a.inb);
    h += btn('disband', 'Congeda', !a.inb, 'bad');
    h += '</div>';
  }
  openSheet(h);
}
function showNation(n) {
  sheetView = () => showNation(n);
  const N = NA(n), pl = G.player, me = NA(pl), own = ownedProvs(n);
  let h = `<div class="sh-head"><div><h2>${chip(n)}</h2><div class="muted">${statusWith(n)}</div></div>${btn('close', '✕', true, 'x')}</div>`;
  h += `<dl class="kv"><dt>Province</dt><dd>${own.length}</dd><dt>Sviluppo</dt><dd>${totalDev(n)}</dd><dt>Esercito</dt><dd>${k(menOf(n))}</dd>`;
  if (n !== pl) h += `<dt>Rapporti con te</dt><dd class="${rel(n, pl) >= 0 ? 'good' : 'bad'}">${rel(n, pl) > 0 ? '+' : ''}${rel(n, pl)}</dd>`;
  h += `<dt>Alleati</dt><dd>${N.allies.map(chip).join(', ') || 'nessuno'}</dd></dl>`;
  if (n !== pl && N.alive) {
    const shares = own.some(i => MP(i).adj.some(j => P(j).owner === pl));
    const allyOk = !isAlly(n, pl) && !hostile(n, pl) && me.allies.length < 3 && N.allies.length < 3;
    h += '<div class="acts">';
    h += btn('rel:' + n, `Migliora i rapporti <small>${COSTO_RELAZIONI} punti, +30</small>`, me.pts >= COSTO_RELAZIONI && rel(n, pl) < 150);
    if (isAlly(n, pl)) h += btn('unally:' + n, 'Rompi l\'alleanza', true, 'bad');
    else h += btn('ally:' + n, `Proponi un'alleanza <small>chiede rapporti ≥ 30</small>`, allyOk);
    const warOk = !hostile(n, pl) && !isAlly(n, pl) && !hasTruce(n, pl);
    h += btn('war:' + n, `Dichiara guerra${shares ? '' : ' <small>nessun confine comune</small>'}`, warOk, 'bad');
    h += '</div>';
  }
  openSheet(h);
}
function showDiplomacy() {
  sheetView = showDiplomacy;
  let h = `<div class="sh-head"><div><h2>Diplomazia</h2><div class="muted">Tocca una nazione</div></div>${btn('close', '✕', true, 'x')}</div><div class="list">`;
  for (const N of G.n) {
    if (!N.alive) continue; const n = N.id;
    h += `<button class="row" data-act="nat:${n}"><span class="rname">${chip(n)}</span><span class="rmeta">${ownedProvs(n).length} prov · ${k(menOf(n))} ${n !== G.player ? `· <span class="${rel(n, G.player) >= 0 ? 'good' : 'bad'}">${rel(n, G.player)}</span>` : ''} ${statusWith(n)}</span></button>`;
  }
  h += '</div>'; openSheet(h);
}
function showWars() {
  sheetView = showWars;
  const pl = G.player, mine = warsOf(pl);
  let h = `<div class="sh-head"><div><h2>Guerre</h2><div class="muted">${mine.length ? 'Le tue guerre' : 'Sei in pace'}</div></div>${btn('close', '✕', true, 'x')}</div>`;
  for (const w of mine) {
    const side = sideOf(w, pl), sc = scoreFor(w, pl), lead = w[side][0] === pl, foe = w[other(side)][0];
    h += `<div class="war"><div class="wtitle">${w[side].map(chip).join(', ')} <span class="muted">contro</span> ${w[other(side)].map(chip).join(', ')}</div>`;
    h += `<div class="meter"><span style="left:50%;width:${Math.abs(sc) / 2}%;${sc < 0 ? 'transform:translateX(-100%);background:var(--danger)' : ''}"></span></div><div class="muted">Punteggio di guerra: <b class="${sc >= 0 ? 'good' : 'bad'}">${sc > 0 ? '+' : ''}${sc}%</b> · dal ${dateStr(w.start)}</div>`;
    if (lead) {
      if (peaceWar === w.id) {
        const occ = occupiedBy(w, side); let cost = 0;
        h += '<p>Scegli le province da chiedere (solo quelle occupate dalla tua parte):</p><div class="list">';
        if (!occ.length) h += '<p class="muted">Non occupi ancora province nemiche.</p>';
        for (const i of occ) { const c = provCost(w, i); if (peaceSel.has(i)) cost += c; h += `<label class="row chk"><input type="checkbox" id="pc${i}" data-act="ps:${i}" ${peaceSel.has(i) ? 'checked' : ''}> <span class="rname">${esc(MP(i).name)} <span class="muted">sv. ${P(i).dev}</span></span><span class="rmeta">${c}%</span></label>`; }
        h += `</div><p>Costo: <b>${cost}%</b> su ${Math.max(0, sc)}% disponibile. ${cost <= sc && cost > 0 ? '<span class="good">Accetteranno.</span>' : cost > 0 ? '<span class="bad">Rifiuteranno.</span>' : ''}</p>`;
        h += `<div class="acts">${btn('send:' + w.id, 'Invia la proposta', cost > 0, 'pri')}${btn('pcancel', 'Annulla')}</div>`;
      } else {
        h += `<div class="acts">${btn('peace:' + w.id, 'Chiedi province', true, 'pri')}${btn('white:' + w.id, 'Proponi pace bianca')}${btn('yield:' + w.id, 'Arrenditi', true, 'bad')}</div>`;
      }
    } else h += `<p class="muted">Guida la guerra ${esc(NA(w[side][0]).name)}: decide lei la pace. Nemico principale: ${esc(NA(foe).name)}.</p>`;
    h += '</div>';
  }
  const others = G.wars.filter(w => !sideOf(w, pl));
  if (others.length) { h += '<h3>Altre guerre nel mondo</h3>'; for (const w of others) h += `<div class="row static"><span class="rname">${chip(w.att[0])} <span class="muted">contro</span> ${chip(w.def[0])}</span><span class="rmeta">${warScore(w) > 0 ? '+' : ''}${warScore(w)}%</span></div>`; }
  openSheet(h);
}
function showRanking() {
  sheetView = showRanking;
  const list = G.n.filter(n => n.alive).map(n => ({ n, dev: totalDev(n.id), pr: ownedProvs(n.id).length, men: menOf(n.id) })).sort((a, b) => b.dev - a.dev);
  let h = `<div class="sh-head"><div><h2>Classifica</h2><div class="muted">Per sviluppo totale · vinci con metà delle province (${Math.ceil(G.p.length / 2)})</div></div>${btn('close', '✕', true, 'x')}</div><div class="list">`;
  list.forEach((r, ix) => { h += `<button class="row" data-act="nat:${r.n.id}"><span class="rname"><b class="rank">${ix + 1}</b> ${chip(r.n.id)}</span><span class="rmeta">${r.dev} sv · ${r.pr} prov · ${k(r.men)}</span></button>`; });
  h += '</div>'; openSheet(h);
}
function showMenu() {
  sheetView = null;
  openSheet(`<div class="sh-head"><div><h2>Menu</h2><div class="muted">${esc(dateStr())}</div></div>${btn('close', '✕', true, 'x')}</div>
  <div class="acts col">${btn('save', 'Salva la partita', true, 'pri')}${btn('help', 'Come si gioca')}${btn('newgame', 'Nuova partita', true, 'bad')}</div>
  <p class="muted">La partita si salva da sola ogni anno nella memoria di questo browser.</p>`);
}
function showHelp() {
  sheetView = null;
  openSheet(`<div class="sh-head"><div><h2>Come si gioca</h2></div>${btn('close', '✕', true, 'x')}</div><div class="help">
  <p><b>Tempo.</b> Il gioco scorre a giorni. Metti in pausa o accelera con i tasti in alto. Ogni mese incassi l'oro delle province e paghi soldati e fortezze.</p>
  <p><b>Province.</b> Toccane una per vederla. Nelle tue puoi spendere punti per lo sviluppo (più oro e più uomini), oro per le fortezze (assedi più lunghi) e oro e uomini per reclutare.</p>
  <p><b>Eserciti.</b> Tocca il tuo esercito (il riquadro col triangolo bianco), poi la provincia di destinazione. Il numero è in migliaia di uomini, la barretta è il morale. Chi perde il morale si ritira.</p>
  <p><b>Assedi.</b> Un esercito fermo in una provincia nemica senza difensori la assedia. Il cerchio dorato mostra l'avanzamento.</p>
  <p><b>Pace.</b> Le province occupate e le battaglie vinte fanno salire il punteggio di guerra. Con il punteggio paghi le province che chiedi nel trattato.</p>
  <p><b>Colonie.</b> Le terre libere grigie confinanti si colonizzano in circa un anno, una alla volta.</p>
  <p><b>Vittoria.</b> Possiedi metà delle province del continente. Perdi se perdi tutte le tue.</p></div>`);
}

sheet.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const [act, arg] = el.dataset.act.split(':'), x = arg !== undefined ? +arg : null, pl = G.player, me = NA(pl);
  switch (act) {
    case 'close': selProv = -1; selArmy = -1; dirty = true; closeSheet(); return;
    case 'dev': if (me.pts >= devCost(selProv)) { me.pts -= devCost(selProv); P(selProv).dev++; dirty = mode === 'sviluppo'; } break;
    case 'fort': if (me.gold >= fortCost(selProv) && P(selProv).fort < 3) { me.gold -= fortCost(selProv); P(selProv).fort++; } break;
    case 'rec': if (recruit(pl, selProv)) note(`1000 uomini reclutati a ${MP(selProv).name}`, 'good'); break;
    case 'cap': if (me.pts >= 50) { me.pts -= 50; me.capital = selProv; note(`La capitale è ora ${MP(selProv).name}`); } break;
    case 'col': if (me.gold >= COSTO_COLONIA && !me.colony) { me.gold -= COSTO_COLONIA; me.colony = { p: selProv, prog: 0 }; note(`Coloni in viaggio verso ${MP(selProv).name}`); } break;
    case 'nat': selProv = -1; dirty = true; showNation(x); return;
    case 'rel': if (me.pts >= COSTO_RELAZIONI) { me.pts -= COSTO_RELAZIONI; addRel(x, pl, 30); } break;
    case 'ally': {
      const r = rel(x, pl), ok = r >= 30 && rnd() < .5 + r / 300;
      if (ok) makeAlliance(pl, x); else { note(`${NA(x).name} rifiuta l'alleanza${r < 30 ? ': rapporti troppo freddi' : ''}`, 'bad'); addRel(x, pl, -5); }
      break;
    }
    case 'unally': breakAlliance(pl, x); break;
    case 'war': confirmWar(x); return;
    case 'peace': peaceWar = x; peaceSel = new Set(); break;
    case 'pcancel': peaceWar = -1; break;
    case 'ps': if (peaceSel.has(x)) peaceSel.delete(x); else peaceSel.add(x); break;
    case 'send': {
      const w = G.wars.find(v => v.id === x); if (!w) break; const side = sideOf(w, pl);
      const sel = [...peaceSel].filter(i => occupiedBy(w, side).includes(i)), cost = sel.reduce((s, i) => s + provCost(w, i), 0);
      if (cost <= scoreFor(w, pl)) makePeace(w, side, sel); else note(`${NA(w[other(side)][0]).name} rifiuta: chiedi troppo`, 'bad');
      peaceWar = -1; break;
    }
    case 'white': {
      const w = G.wars.find(v => v.id === x); if (!w) break; const side = sideOf(w, pl), foeSc = -scoreFor(w, pl);
      if (foeSc <= 0 || (foeSc < 10 && G.day - w.start > 720)) makePeace(w, side, []); else note(`${NA(w[other(side)][0]).name} rifiuta la pace bianca: sta vincendo (${foeSc}%)`, 'bad');
      break;
    }
    case 'yield': {
      const w = G.wars.find(v => v.id === x); if (!w) break; const side = sideOf(w, pl);
      ask({ title: 'Arrendersi?', body: `<p>Cedi tutte le province che il nemico occupa (${occupiedBy(w, other(side)).length}).</p>`, buttons: [{ t: 'Arrenditi', cls: 'bad', fn: () => makePeace(w, other(side), occupiedBy(w, other(side))) }, { t: 'Annulla', fn: () => {} }] });
      break;
    }
    case 'stop': { const a = G.armies.find(v => v.id === selArmy); if (a) a.path = []; break; }
    case 'split': {
      const a = G.armies.find(v => v.id === selArmy); if (!a) break; const half = Math.floor(a.max / 2000) * 1000, ratio = half / a.max;
      const b = { id: G.nid++, o: a.o, p: a.p, men: a.men * ratio, max: half, mor: a.mor, path: [], prog: 0, ret: false, arr: a.arr, inb: false };
      a.men -= b.men; a.max -= half; G.armies.push(b); break;
    }
    case 'merge': {
      const a = G.armies.find(v => v.id === selArmy); if (!a) break;
      for (const b of G.armies.filter(v => v.o === a.o && v.p === a.p && v !== a && !v.inb)) { a.mor = (a.mor * a.men + b.mor * b.men) / (a.men + b.men); a.men += b.men; a.max += b.max; G.armies = G.armies.filter(v => v !== b); }
      a.path = []; break;
    }
    case 'disband': G.armies = G.armies.filter(v => v.id !== selArmy); selArmy = -1; closeSheet(); return;
    case 'save': save(false); return;
    case 'help': showHelp(); return;
    case 'newgame': ask({ title: 'Nuova partita?', body: '<p>La partita in corso va persa se non l\'hai salvata.</p>', buttons: [{ t: 'Ricomincia', cls: 'bad', fn: () => { closeSheet(); startScreen(); } }, { t: 'Annulla', fn: () => {} }] }); return;
  }
  refreshSheet(); updateTop();
});
function confirmWar(n) {
  const pl = G.player, foes = [n, ...NA(n).allies.filter(a => a !== pl)];
  ask({
    title: `Guerra a ${NA(n).name}?`,
    body: `<p>Potrebbero difenderla: ${foes.map(chip).join(', ')}.</p><p>La loro forza: <b>${k(foes.reduce((s, f) => s + menOf(f), 0))}</b>. La tua: <b>${k(menOf(pl))}</b>${NA(pl).allies.length ? ` più gli alleati (${NA(pl).allies.map(chip).join(', ')})` : ''}.</p>`,
    buttons: [{ t: 'Dichiara guerra', cls: 'bad', fn: () => { declareWar(pl, n); showWars(); } }, { t: 'Annulla', fn: () => {} }],
  });
}

// ---------- finestre e notizie ----------
const modalQ = []; let modalOpen = false, curModal = null;
function ask(m) { modalQ.push(m); if (!modalOpen) nextModal(); }
function nextModal() {
  const m = modalQ.shift(), box = $('#modal'); curModal = m || null;
  if (!m) { box.hidden = true; modalOpen = false; return; }
  modalOpen = true; box.hidden = false;
  $('#modalBox').innerHTML = `<h2>${esc(m.title)}</h2>${m.body}<div class="acts">${m.buttons.map((b, i) => `<button class="b ${b.cls || ''}" data-i="${i}">${esc(b.t)}</button>`).join('')}</div>`;
  $('#modalBox').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; m.buttons[+b.dataset.i].fn(); dirty = true; nextModal(); refreshSheet(); updateTop(); };
}
function note(txt, cls = '') {
  if (!G || G.player < 0) return;
  G.log.unshift(`${dateStr()}: ${txt}`); G.log.length = Math.min(G.log.length, 40);
  if (!cls && !/^(In marcia|Esercito|Coloni|1000|Partita|La capitale)/.test(txt)) return; // le notizie neutre del mondo restano nel registro
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = txt;
  const box = $('#toasts'); box.prepend(t); while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => t.classList.add('out'), 3800); setTimeout(() => t.remove(), 4400);
}
function endGame(win) {
  G.over = true; G.speed = 0;
  ask({ title: win ? 'Vittoria' : 'La tua corona è caduta', body: win ? `<p>Nel ${ANNO0 + Math.floor(G.day / 360)} ${esc(NA(G.player).name)} domina metà del continente.</p>` : '<p>Hai perso l\'ultima provincia.</p>', buttons: [{ t: 'Nuova partita', cls: 'pri', fn: () => startScreen() }, { t: 'Guarda la mappa', fn: () => {} }] });
}

// ---------- barra in alto ----------
function updateTop() {
  if (!G || G.player < 0) return; const pl = G.player, n = NA(pl), net = income(pl) - upkeep(pl);
  $('#tNation').innerHTML = chip(pl); $('#tDate').textContent = dateStr();
  $('#rGold').innerHTML = `${Math.floor(n.gold)} <small class="${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? '+' : ''}${f1(net)}</small>`;
  $('#rMp').textContent = k(n.mp); $('#rPts').textContent = Math.floor(n.pts);
  $('#rArmy').textContent = `${f1(regsOf(pl))}/${forceLimit(pl)}`;
  const wn = warsOf(pl).length; $('#bWars').classList.toggle('alert', wn > 0); $('#bWarsN').textContent = wn ? wn : '';
  document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === G.speed));
}
document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { if (G && !G.over) { G.speed = +b.dataset.speed; updateTop(); } }));
$('#bDip').onclick = () => showDiplomacy();
$('#bWars').onclick = () => { peaceWar = -1; showWars(); };
$('#bRank').onclick = () => showRanking();
$('#bMenu').onclick = () => showMenu();
const MODES = ['politica', 'diplomazia', 'terreno', 'sviluppo'], MODE_N = { politica: 'Politica', diplomazia: 'Rapporti', terreno: 'Terreno', sviluppo: 'Sviluppo' };
$('#bMode').onclick = () => { mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]; $('#bModeL').textContent = MODE_N[mode]; dirty = true; };
$('#bHome').onclick = () => { if (G && G.player >= 0) centerOn(MP(NA(G.player).capital).wx, MP(NA(G.player).capital).wy, Math.max(cam.z, 1.6)); };
document.addEventListener('keydown', e => { if (e.code === 'Space' && G && G.player >= 0 && !modalOpen) { e.preventDefault(); G.speed = G.speed ? 0 : 2; updateTop(); } });

// ---------- schermata iniziale ----------
function startScreen(seed) {
  seed = seed || (Math.floor(Math.random() * 1e9) + 1);
  newGame(seed); G.player = -1; selProv = -1; selArmy = -1; previewNation = -1; mode = 'politica'; dirty = true;
  closeSheet(); resize();
  cam.z = Math.min(vw / MW, vh * .4 / MH); cam.x = MW / 2 - vw / 2 / cam.z; cam.y = MH / 2 - vh * .2 / cam.z; // continente nella parte libera sopra il pannello
  const st = $('#start'); st.hidden = false; $('#app').classList.add('choosing');
  const list = G.n.map(n => ({ n, pr: ownedProvs(n.id).length, dev: totalDev(n.id) })).sort((a, b) => b.dev - a.dev);
  $('#nations').innerHTML = list.map(r => `<button class="row" data-n="${r.n.id}"><span class="rname">${chip(r.n.id)}</span><span class="rmeta">${r.pr} province · sviluppo ${r.dev}</span></button>`).join('');
  $('#bContinue').hidden = !hasSave();
  $('#bPlay').disabled = true;
}
$('#nations').addEventListener('click', e => {
  const r = e.target.closest('[data-n]'); if (!r) return; previewNation = +r.dataset.n; dirty = true;
  document.querySelectorAll('#nations .row').forEach(x => x.classList.toggle('sel', x === r));
  $('#bPlay').disabled = false; $('#bPlay').textContent = `Gioca come ${NA(previewNation).name.split(' ').slice(-1)[0]}`;
});
$('#bReroll').onclick = () => startScreen();
$('#bPlay').onclick = () => { if (previewNation < 0) return; beginAs(previewNation); };
$('#bContinue').onclick = () => { if (load()) { begin(); note('Partita caricata', 'good'); } };
function beginAs(n) { G.player = n; previewNation = -1; begin(); note(`Regni su ${NA(n).name}. Tocca il tuo esercito per muoverlo.`, 'good'); }
function begin() {
  $('#start').hidden = true; $('#app').classList.remove('choosing'); dirty = true; closeSheet();
  const c = MP(NA(G.player).capital); resize(); centerOn(c.wx, c.wy, 1.9); updateTop();
}

// ---------- ciclo principale ----------
let last = performance.now(), acc = 0, uiAcc = 0;
function loop(t) {
  const dt = Math.min(.25, (t - last) / 1000); last = t;
  if (G && G.player >= 0 && G.speed && !modalOpen && !G.over) {
    acc += dt * VEL[G.speed];
    let n = 0; while (acc >= 1 && n < 8) { tick(); acc -= 1; n++; }
    uiAcc += dt; if (uiAcc > .25) { uiAcc = 0; updateTop(); refreshSheet(); }
  } else acc = 0;
  if (G) draw();
  requestAnimationFrame(loop);
}
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.player >= 0 && !G.over) { G.speed = 0; save(true); updateTop(); } });
window.claude?.hot?.snapshot?.(() => (G && G.player >= 0 ? { g: JSON.parse(JSON.stringify(G)) } : {}));
function start(data) {
  resize();
  if (data && data.g && load(data.g)) begin(); else startScreen();
  requestAnimationFrame(loop);
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { dirty = true; });
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.claude) navigator.serviceWorker.register('sw.js').catch(() => {});

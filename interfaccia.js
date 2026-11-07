'use strict';
/* Corone e Confini — INTERFACCIA.
   Disegno della carta, tocchi, pannelli, salvataggio nel browser.
   Usa le funzioni globali di motore.js, che va caricato prima. */

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
    return caricaStato(data || JSON.parse(localStorage.getItem(SAVE_KEY)));
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
function apriFinestra(m) { modalQ.push(m); if (!modalOpen) nextModal(); }
function nextModal() {
  const m = modalQ.shift(), box = $('#modal'); curModal = m || null;
  if (!m) { box.hidden = true; modalOpen = false; return; }
  modalOpen = true; box.hidden = false;
  $('#modalBox').innerHTML = `<h2>${esc(m.title)}</h2>${m.body}<div class="acts">${m.buttons.map((b, i) => `<button class="b ${b.cls || ''}" data-i="${i}">${esc(b.t)}</button>`).join('')}</div>`;
  $('#modalBox').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; m.buttons[+b.dataset.i].fn(); dirty = true; nextModal(); refreshSheet(); updateTop(); };
}
function mostraNotizia(txt, cls = '') {
  if (!cls && !/^(In marcia|Esercito|Coloni|1000|Partita|La capitale)/.test(txt)) return; // le notizie neutre del mondo restano nel registro
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = txt;
  const box = $('#toasts'); box.prepend(t); while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => t.classList.add('out'), 3800); setTimeout(() => t.remove(), 4400);
}
function mostraFine(win) {
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

// ---------- collegamento al motore ----------
EVENTI.nota = mostraNotizia;
EVENTI.chiedi = apriFinestra;
EVENTI.cambiata = () => { dirty = true; };
EVENTI.fineAnno = () => save(true);
EVENTI.fine = mostraFine;

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

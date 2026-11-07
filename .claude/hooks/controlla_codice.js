#!/usr/bin/env node
'use strict';
/* Hook PostToolUse: dopo ogni modifica a un .js del gioco controlla la sintassi del file
   e fa girare 5 anni di simulazione. Se qualcosa fallisce esce con 2 e spiega il motivo su stderr,
   così Claude lo vede e lo corregge. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..', '..');
let ev = {};
try { ev = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (e) { process.exit(0); }
const file = (ev.tool_input || {}).file_path || '';
if (!file.endsWith('.js')) process.exit(0);
const rel = path.relative(RADICE, path.resolve(file));
if (rel.startsWith('..') || rel.startsWith('node_modules')) process.exit(0); // fuori dal gioco

function esegui(args, cosa) {
  try { execFileSync(process.execPath, args, { cwd: RADICE, timeout: 12000, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) {
    const out = `${e.stdout || ''}${e.stderr || ''}`.trim().split('\n').slice(-25).join('\n');
    process.stderr.write(`Controllo non superato (${cosa}) dopo la modifica a ${rel}:\n${out || e.message}\n`);
    process.exit(2);
  }
}
if (fs.existsSync(file)) esegui(['--check', file], 'Controllo della sintassi');
esegui([path.join('strumenti', 'simula.js'), '--anni', '5', '--partite', '1'], 'Simulazione di 5 anni');
process.exit(0);

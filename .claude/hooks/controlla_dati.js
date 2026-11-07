#!/usr/bin/env node
'use strict';
/* Hook PostToolUse: dopo ogni modifica a un file in dati/ controlla la sua cartella con strumenti/valida_dati.js.
   Se trova errori esce con 2 e li elenca su stderr. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..', '..');
let ev = {};
try { ev = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (e) { process.exit(0); }
const file = (ev.tool_input || {}).file_path || '';
const rel = path.relative(RADICE, path.resolve(file || '.'));
if (!file || !rel.startsWith('dati' + path.sep) || !rel.endsWith('.json')) process.exit(0);
try {
  execFileSync(process.execPath, [path.join('strumenti', 'valida_dati.js'), path.resolve(file)], { cwd: RADICE, timeout: 12000, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  process.stderr.write(`Dati non validi dopo la modifica a ${rel}:\n${`${e.stdout || ''}${e.stderr || ''}`.trim() || e.message}\n`);
  process.exit(2);
}
process.exit(0);

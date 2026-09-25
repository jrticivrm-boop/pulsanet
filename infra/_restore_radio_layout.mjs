import { execSync } from 'child_process';
import fs from 'fs';

const curPath = 'frontend/src/styles.css';
let cur = fs.readFileSync(curPath, 'utf8');
const head = execSync('git show HEAD:frontend/src/styles.css', {
  encoding: 'utf8',
  maxBuffer: 20e6,
});

function extract(src, startPat, endPat) {
  const s = src.indexOf(startPat);
  if (s < 0) throw new Error('start not found: ' + startPat.slice(0, 60));
  const e = src.indexOf(endPat, s + 1);
  if (e < 0) throw new Error('end not found after ' + startPat.slice(0, 40));
  return { s, e, chunk: src.slice(s, e) };
}

const aStart = '.cc-main .radio-ops--embedded .radio-ops-grid {';
const aEnd = '/* —— Inbox unificado';
const aH = extract(head, aStart, aEnd);
const aC = extract(cur, aStart, aEnd);
cur = cur.slice(0, aC.s) + aH.chunk + cur.slice(aC.e);

const bStart = '.radio-ops-deck {';
const bEnd = '/* Dual columna Escuchar | Hablar */';
const bH = extract(head, bStart, bEnd);
const bC = extract(cur, bStart, bEnd);

const archive = `
/* ===== PttVoiceBar (archivado — no montado en Radio; listo para reactivar) ===== */
[data-theme='light'] {
  --ptt-voice-edge: #7cb83a;
  --ptt-voice-mid: #20b2aa;
  --ptt-voice-core: #e0b44a;
}
[data-theme='verde'] {
  --ptt-voice-edge: #e0b84a;
  --ptt-voice-mid: #c6f04a;
  --ptt-voice-core: #6ed0ff;
}
[data-theme='obscuro'] {
  --ptt-voice-edge: #f472b6;
  --ptt-voice-mid: #22d3ee;
  --ptt-voice-core: #818cf8;
}
.ptt-voice-bar {
  width: 100%;
  height: 3.85rem;
  margin: 0;
  border: 0;
  background: transparent;
  pointer-events: none;
}
.ptt-voice-bar.is-idle { display: none !important; }
.ptt-voice-bar.is-live { display: block; background: transparent; }
.ptt-voice-bar-canvas { display: block; width: 100%; height: 100%; background: transparent; }

`;

cur = cur.slice(0, bC.s) + bH.chunk + archive + cur.slice(bC.e);

// Remove leftover controls-top rules
cur = cur.replace(/\n\.radio-ops-grid--controls-top\{[^}]*\}/g, '');
cur = cur.replace(/\n\.radio-ops-grid--controls-top [^{]*\{[^}]*\}/g, '');
cur = cur.replace(
  /\n  \.radio-ops-grid--controls-top \{[\s\S]*?\n  \}/g,
  ''
);
cur = cur.replace(
  /\n  \.radio-ops-grid--controls-top\.radio-ops-grid--quad \{[\s\S]*?\n  \}/g,
  ''
);
cur = cur.replace(
  /\n\.radio-ops-grid--controls-top\.radio-ops-grid--quad \{[\s\S]*?\n\}/g,
  ''
);
cur = cur.replace(
  /\n\.radio-ops-grid--controls-top \{[\s\S]*?\n\}/g,
  ''
);
cur = cur.replace(
  /\n\/\* Radio: columnas a pantalla completa[\s\S]*?\n\.radio-ops-grid--controls-top \.channel-dual-list \{[\s\S]*?\n\}/g,
  ''
);
cur = cur.replace(
  /\n\.radio-ops-grid--controls-top \.channel-dual-list \{[\s\S]*?\n\}/g,
  ''
);

fs.writeFileSync(curPath, cur);
console.log('ok', cur.length);
console.log('controls-top left?', cur.includes('controls-top'));
console.log('radio-ops-primary classic?', cur.includes('repeat(4, minmax(0, 1fr)) auto'));
console.log('PttVoiceBar file exists?', fs.existsSync('frontend/src/PttVoiceBar.jsx'));

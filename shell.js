// The page around the game: canvas sizing, the frame clock, keyboard and touch input.
// game.js supplies Game.tick() (one original frame) and Game.draw(g, k) (k = 0..1 between ticks).

const VW = 256, VH = 160;   // the view in game pixels: 16 x 10 tiles (the original showed 13 x 10)

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 4;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 1024;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(w * dpr * VH / VW);
  scale = canvas.width / VW;
}

// ---------- input ----------
// keys[] holds what is down now; pressed[] latches a key until the game reads it, so a tap shorter
// than one game frame still counts.

const keys = {}, pressed = {};
const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  ControlLeft: 'jump', ControlRight: 'jump', KeyZ: 'jump', 'v-jump': 'jump',
  AltLeft: 'fire', AltRight: 'fire', KeyX: 'fire', 'v-fire': 'fire', Space: 'fire',
  Enter: 'enter', NumpadEnter: 'enter', Escape: 'esc', KeyP: 'pause', KeyM: 'mute',
  Equal: 'faster', NumpadAdd: 'faster', Minus: 'slower', NumpadSubtract: 'slower',
  KeyY: 'yes', KeyN: 'no', F10: 'restart',
};

function keyName(e) {
  return KEYMAP[e.code] || null;
}

window.addEventListener('keydown', (e) => {
  Sound.init();
  const k = keyName(e);
  if (Game.onKey(e)) { e.preventDefault(); return; }
  if (!k) return;
  if (!keys[k]) pressed[k] = true;
  keys[k] = true;
  e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  const k = keyName(e);
  if (!k) return;
  keys[k] = false;
  e.preventDefault();
});
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function take(k) {
  const v = pressed[k];
  pressed[k] = false;
  return !!v;
}

document.querySelectorAll('.pad button').forEach((b) => {
  const k = KEYMAP[b.dataset.key];
  const down = (e) => { e.preventDefault(); Sound.init(); if (!keys[k]) pressed[k] = true; keys[k] = true; };
  const up = (e) => { e.preventDefault(); keys[k] = false; };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
});
canvas.addEventListener('pointerdown', () => { Sound.init(); canvas.focus(); });

// ---------- clock ----------

let last = 0, acc = 0;
function frame(now) {
  const step = 1000 / Game.fps();
  if (!last) last = now;
  acc += Math.min(250, now - last);
  last = now;
  let n = 0;
  while (acc >= step && n < 8) {
    Game.tick();
    acc -= step;
    n++;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  Game.draw(ctx, acc / step);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();

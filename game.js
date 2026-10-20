// Duke Nukem, Episode 1 "Shrapnel City", rebuilt from the original 1991 program.
// The rules follow analysis/player.md, read from DN1.EXE; addresses like 0097:1e69 point there.
// Duke keeps the original's screen-relative state (camX in 8-px half-tiles, camRow, x, y) so the
// camera, falling and shot rules come out the same. Drawing is wider (16 tiles, not 13) and smooth.

const MW = 128, MH = 90;
const FPS_BASE = 1193182 / 8273;             // the original's reprogrammed timer, 144.23 Hz

// Level order: odd indexes are the hallway between levels (0097 table at DS:0x3a4).
const LEVEL_FILES = ['1', '2', '3', '2', '4', '2', '5', '2', '6', '2', '7', '2', '8', '2', '9', '2', 'A', '2', 'B'];
const LEVEL_NAMES = {
  0: 'Level 1', 2: 'Level 2', 4: 'Level 3', 6: 'Level 4', 8: 'Level 5', 10: 'Level 6',
  12: 'Level 7', 14: 'Level 8', 16: 'Level 9', 18: 'Level 10',
};

// Duke's jump table, DS:0x613 (normal) and DS:0x61f (boots): pixels up per rising frame.
const JUMP = [[13, 11, 9, 7, 5, 3, 0, 0, 0], [15, 13, 11, 9, 7, 5, 3, 1, 0]];


const G = {
  mode: 'title',          // title, play, box, end
  speed: 0,               // SPEED.DN1: frame = 9 + speed timer ticks
  level: 0,
  map: null,
  frame: 0,
  phase: 0,               // background animation phase [0x437]: 0, 0x20, 0x40, 0x60
  camX: 0, camRow: 0,
  // Duke, as the original keeps him
  x: 16, y: 64,
  onGround: 0, falling: 0, jumpStep: 0, hanging: 0, swing: 0,
  facing: 4, poseSub: 0, flip: 0, flipCount: 0,
  hurt: 0, invul: 0, dying: 0, camReq: 0, jumpLatch: 0, prevFire: 0,
  pose: 13,
  inDoor: 0,              // [0x4ed2], the exit door sequence
  levelDone: 0,
  // what Duke carries
  health: 9, firepower: 1, score: 0,
  boots: 0, hooks: 0, robohand: 0, card: 0, keys: [0, 0, 0, 0],
  inventory: [],          // pickup order, for the HUD
  noDamage: 1,            // [0xd247], lost on the first hit
  shots: [],
  dust: [],
  saved: null,            // the hallway auto-save (SAVEDT.DN1)
  box: null,              // a message box waiting for Enter
  hints: true,
  hintsSeen: {},
  cheated: false,
  shake: 0,
  prev: null,             // last tick's positions, for drawing between ticks
};

function fps() {
  return FPS_BASE / (9 + G.speed);
}

// ---------- the map ----------

function decodeMap(L) {
  const bin = atob(MAPS[L]);
  const m = new Uint16Array(MW * MH);
  for (let i = 0; i < m.length; i++) m[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
  return m;
}

function tileAt(col, row) {
  if (col < 0 || row < 0 || col >= MW || row >= MH) return 0x2000;
  return G.map[row * MW + col];
}
function setTile(col, row, v) {
  if (col < 0 || row < 0 || col >= MW || row >= MH) return;
  G.map[row * MW + col] = v;
}
const solid = (w) => w > 0x17ff;

// ---------- Duke's map tests (0097:1239 .. 0097:1430) ----------

function absX() { return G.x + G.camX; }

function rowsBeside() {
  const r = [G.camRow + ((G.y - 16) >> 4), G.camRow + ((G.y - 16) >> 4) - 1];
  if ((G.y >> 3) & 1) r.push(G.camRow + (G.y >> 4));
  return r;
}
function canLeft() {
  const c = (absX() - 3) >> 1;
  return rowsBeside().every((r) => !solid(tileAt(c, r)) && !Actors.blocks(c, r));
}
function canRight() {
  const c = absX() >> 1;
  return rowsBeside().every((r) => !solid(tileAt(c, r)) && !Actors.blocks(c, r));
}
function boxCols() {
  const X = absX();
  const c = [(X - 2) >> 1];
  if (X & 1) c.push(c[0] + 1);
  return c;
}
const clingable = (w) => w >= 0x2ee0 || (w >= 0x1b80 && w <= 0x1ca0);

// 0097:1344: returns true when the way up is free; may grab hooks or bump the head
function ceiling() {
  const row = G.camRow + ((G.y - 40) >> 4);
  const ws = boxCols().map((c) => tileAt(c, row));
  if (ws.some(clingable)) {
    if (G.swing || G.falling) return false;
    if (!G.hanging) G.poseSub = 0;
    if (G.hooks) {
      if (!G.hanging) Sound.play(SND.hooks);
      G.hanging = 1;
      G.camReq = 1;
    } else {
      Sound.play(SND.bump);
    }
    return false;
  }
  G.hanging = 0;
  if (ws.some(solid) || boxCols().some((c) => Actors.blocks(c, row))) {
    Sound.play(SND.bump);
    return false;
  }
  return true;
}
// 0097:1430: true when there is nothing under the feet
function floor() {
  if (G.swing) return false;
  const row = G.camRow + (G.y >> 4);
  return boxCols().every((c) => !solid(tileAt(c, row)) && !Actors.blocks(c, row)) && !Actors.standOn();
}

function land() {
  G.onGround = 1;
  G.falling = 0;
  G.jumpStep = 0;
  G.camReq = 1;
  G.y &= ~15;
  G.flip = 0;
  G.flipCount = 0;
  spawnDust();
  Sound.play(SND.land);
}

function spawnDust() {
  if (G.dust.length >= 7) return;
  G.dust.push({ X: absX(), row: G.camRow + ((G.y - 16) >> 4), t: 0 });
}

// ---------- horizontal camera (0097:2195, 0097:2259) ----------

function camLeft() {
  if (G.x === 11 && G.camX > 0) { G.camX--; G.x++; }
  else if (G.x <= 10 && G.camX > 1) {
    G.camX -= 2; G.x += 2;
    if (G.camX === 1) { G.camX = 0; G.x++; }
  }
}
function camRight() {
  if (G.x === 17 && G.camX < 230) { G.camX++; G.x--; }
  else if (G.x >= 18 && G.camX < 230) {
    G.camX += 2; G.x -= 2;
    if (G.camX === 229) { G.camX = 230; G.x--; }
  }
}
// keeps x in 12..16 after a big move (teleports, conveyors)
function camFollow() {
  for (let i = 0; i < 300 && G.x < 12 && G.camX > 0; i++) camLeft();
  for (let i = 0; i < 300 && G.x > 16 && G.camX < 230; i++) camRight();
}

// 0097:2901, start of each frame: one row toward y 100..112 while asked
function camVertical() {
  if (!G.camReq || G.cutscene) return;
  if (G.y < 100 && G.camRow > 0) {
    G.camRow--; G.y += 16;
    if (G.y >= 100) G.camReq = 0;
  } else if (G.y > 112) {
    G.camRow++; G.y -= 16;
    if (G.y <= 112) G.camReq = 0;
  }
}

// Move Duke to an absolute half-tile and feet row (teleporters, the elevator), keeping the camera rules.
function placeDuke(X, feetRow) {
  G.x = X - G.camX;
  G.y = (feetRow - G.camRow) * 16;
  camFollow();
  while (G.y > 112) { G.camRow++; G.y -= 16; }
  while (G.y < 100 && G.camRow > 0) { G.camRow--; G.y += 16; }
}

// ---------- Duke, once per frame (0097:1e69) ----------

const NOKEYS = {};

function updateDuke() {
  // inside the exit door and during Dr. Proton's escape the keys are ignored, physics still runs
  const k = G.inDoor || G.cutscene ? NOKEYS : keys;
  if (G.hurt && G.invul) G.hurt = 0;
  if (G.dying) return;
  const phase = G.phase;
  if (floor() && G.onGround) { G.onGround = 0; G.falling = 1; }
  if (!G.onGround && !G.hanging) {
    if (G.flip) G.flipCount++;
    if (G.flipCount === 14) { G.flipCount = 0; G.flip = 0; }
    if (!ceiling() && G.flip) { G.flip = 0; G.flipCount = 0; }
    if (!G.falling && G.jumpStep < 9 && ceiling()) {
      G.y -= JUMP[G.boots][G.jumpStep];
      G.jumpStep++;
      G.camReq = 0;
      if (!floor()) land();
    } else {
      G.falling = 1;
    }
    if (G.falling) {
      if (!floor()) land();
      else {
        G.y += 8;
        if (!floor()) land();
        else if (G.y >= 0x84) {
          G.y += 8;
          G.camReq = 1;
          if (!floor()) land();
        }
      }
    }
  }
  if (k.up && G.hanging && !G.swing) {
    G.y -= 16;
    if (ceiling()) {
      G.y -= 16;
      if (ceiling()) { G.swing = 3; G.hanging = 0; }
      else { G.hanging = 1; }
      G.y += 16;
    } else {
      G.hanging = 1;
    }
    G.y += 16;
  }
  if (k.down && G.hanging) { G.poseSub = 0; G.hanging = 0; }
  const blockMove = (G.hanging && k.fire) || G.swing;
  if (k.left && !k.right && !blockMove) {
    if (G.facing === 0 && canLeft()) G.x--;
    if (G.facing !== 0) { G.facing = 0; G.poseSub = 0; G.flip = 0; }
    else if (phase === 0 || phase === 0x40) {
      if (!floor()) Sound.play(SND.walk);
      G.poseSub = G.poseSub < 3 ? G.poseSub + 1 : 0;
    }
  }
  camLeft();
  if (k.right && !k.left && !blockMove) {
    if (G.facing === 4 && canRight()) G.x++;
    if (G.facing !== 4) { G.facing = 4; G.poseSub = 0; G.flip = 0; }
    else if (phase === 0 || phase === 0x40) {
      if (!floor()) Sound.play(SND.walk);
      G.poseSub = G.poseSub < 3 ? G.poseSub + 1 : 0;
    }
  }
  camRight();
  if (G.hanging) {
    G.y &= ~15;
    G.falling = 1;
    G.onGround = 0;
    ceiling();
  }
  if (k.jump && G.onGround && !G.jumpLatch && !G.hanging && !G.swing) {
    G.onGround = 0;
    G.jumpStep = 0;
    G.falling = 0;
    if (G.boots && phase === 0) {
      if (k.left && canLeft()) G.flip = 1;
      if (k.right && canRight()) G.flip = 2;
    }
    Sound.play(SND.jump);
  }
  G.jumpLatch = k.jump && !G.hanging ? 1 : 0;
}

// The pose drawn this frame (0097:238b-2808); also runs the swing-up steps.
function poseDuke() {
  const k = keys;
  if (G.swing) {
    G.swing--;
    G.y -= 16;
    if (G.swing === 0) { land(); }
    return (G.facing === 0 ? 40 : 43) - G.swing;
  }
  if (G.hurt && !G.invul) return G.facing === 0 ? 44 : 45;
  if (G.hanging) {
    if (k.fire) return G.facing === 0 ? 36 : 37;
    if ((k.left || k.right) && !(k.left && k.right)) {
      if (G.phase === 0x20 || G.phase === 0x60) Sound.play(SND.hooks);
    }
    if (G.poseSub > 3) return G.facing === 0 ? 36 : 37;
    return (G.facing === 0 ? 28 : 32) + G.poseSub;
  }
  if (G.flip) {
    const f = Math.min(6, G.flipCount >> 1);
    return (G.flip === 1 ? 14 : 21) + f;
  }
  const standing = (G.onGround && !G.falling) || !floor();
  if (standing) {
    if (!k.left && !k.right) {
      G.poseSub = k.fire ? 3 : (G.facing === 0 ? 12 : 9);
    }
    return G.facing + G.poseSub;
  }
  if (!G.falling) return G.facing === 0 ? 8 : 9;
  return G.facing === 0 ? 10 : 11;
}

// MAN0..MAN3 back to back, 48 tiles each: frame f is 4 tiles from 4f.
function dukeTiles(f) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const t = f * 4 + i;
    out.push('MAN' + Math.floor(t / 48) + ':' + (t % 48));
  }
  return out;
}

// ---------- Duke's shots (0097:18c6, 0097:1925) ----------

function spawnShot() {
  if (G.shots.filter((s) => s.alive).length >= G.firepower) return;
  G.shots.push({ dir: G.facing === 0 ? -1 : 1, X: absX(), row: G.camRow + ((G.y - 29) >> 4), first: 2, alive: 1 });
  Sound.play(SND.gun);
}

function updateShots() {
  for (const s of G.shots) {
    if (!s.alive) continue;
    s.pX = s.X;
    s.X += 2 * s.dir;
    if (s.first) s.first--;   // drawn as the muzzle flash on the frame it is fired
    // 0097:3670 the map: breakable walls, then anything solid
    const col = s.dir < 0 ? ((s.X + 1) >> 1) - 1 : (s.X >> 1) - 1;
    let hit = false;
    for (const r of [s.row, s.row + 1]) {
      if (tileAt(col, r) === 0x1800) {
        setTile(col, r, 0x17e0);
        Effects.debris(col * 16 + 8, r * 16 + 8, 'grey');
        Sound.play(SND.breaker);
        addScore(10, col * 16, r * 16, false);
        hit = true;
        break;
      }
    }
    if (!hit && (tileAt(col, s.row) & 0xffff) > 0x17ff && tileAt(col, s.row) < 0x8000) hit = true;
    if (hit) {
      Effects.spark(s.X * 8 - 8, s.row * 16 + 11);
      s.alive = 0;
      continue;
    }
    // 0097:3260 out of view (widened to the drawn view)
    if (s.X < G.camX - 3 || s.X >= G.camX + 32 || s.row < G.camRow || s.row >= G.camRow + 10) s.alive = 0;
  }
  G.shots = G.shots.filter((s) => s.alive);
}

// 0097:3505: is Duke touching a 1-tile thing at half-tile objX, row?
function touchesDuke(objX, row) {
  if (G.dying) return false;
  const top = G.camRow + ((G.y - 32) >> 4);
  return Math.abs(absX() - objX) < 2 && (row === top || row === top + 1);
}
// Duke's box against a box in world pixels
function dukeOverlaps(px, py, pw, ph) {
  if (G.dying) return false;
  const l = absX() * 8 - 16, t = G.camRow * 16 + G.y - 32;
  return l < px + pw && l + 16 > px && t < py + ph && t + 32 > py;
}
function hurtDuke() { if (!G.dying) G.hurt = 1; }
function killDuke() { if (!G.dying) { G.health = 0; } }

// ---------- score ----------

function addScore(n, px, py, pop = true) {
  G.score += n;
  if (pop && px !== undefined) Effects.points(n, px, py);
}

function heal(n = 1) {
  G.health = Math.min(9, G.health + n);
}

// ---------- levels ----------

// ---------- episodes ----------
// Episode 1 is the original's. Episode 2 is new levels made for this rebuild (levels/ep2, built into ep2.js);
// it plays by the same rules, with the original hallway between levels.

const LEVEL_SUBS = {};
const EPISODES = {
  1: {
    title: 'Episode One: Shrapnel City',
    files: LEVEL_FILES.slice(), names: Object.assign({}, LEVEL_NAMES), subs: {},
    messages: Object.assign({}, MESSAGES), drops: Object.assign({}, LEVEL_DROPS),
    intro: [
      ['So you\'re the pitiful hero they sent\nto stop me. I, Dr. Proton,\nwill soon rule the world!', 'proton', 'proton'],
      ['You\'re wrong, Proton breath.\nI\'ll be done with you and still\nhave time to watch Oprah!', 'note', 'duke'],
      ['Get ready Duke,\nyou\'re going in!!', 'note', null],
    ],
  },
};
if (typeof EP2_LEVELS !== 'undefined') {
  const e = {
    title: 'Episode Two: Lunar Fortress',
    files: [], names: {}, subs: {}, messages: {}, drops: {},
    intro: [
      ['Duke! You followed me all the way\nto the Moon? My fortress has\nten levels of pain waiting for you.', 'proton', 'proton'],
      ['Ten levels? I\'ll take the stairs.\nSee you at the top, Proton.', 'note', 'duke'],
      ['Duke lands on the Moon.\nFind your way into the fortress!', 'note', null],
    ],
  };
  EP2_LEVELS.forEach((lv, n) => {
    const i = 2 * n;
    if (n > 0) {
      e.files.push('2');
      e.messages[i - 1] = lv.hallway || 'The next level is through this door.\nGood luck, Duke!';
      e.drops[i - 1] = EP2_LEVELS[n - 1].drops;
    }
    MAPS['E2' + lv.key] = lv.map;
    e.files.push('E2' + lv.key);
    e.names[i] = 'Level ' + (n + 1);
    e.subs[i] = lv.name;
    if (lv.message) e.messages[i] = lv.message;
    e.drops[i] = lv.drops;
  });
  EPISODES[2] = e;
}

function setEpisode(n) {
  const e = EPISODES[n] || EPISODES[1];
  G.episode = EPISODES[n] ? n : 1;
  LEVEL_FILES.length = 0;
  LEVEL_FILES.push(...e.files);
  for (const t of [LEVEL_NAMES, LEVEL_SUBS, MESSAGES, LEVEL_DROPS]) for (const k in t) delete t[k];
  Object.assign(LEVEL_NAMES, e.names);
  Object.assign(LEVEL_SUBS, e.subs);
  Object.assign(MESSAGES, e.messages);
  Object.assign(LEVEL_DROPS, e.drops);
}

function newGame(episode = G.episode || 1) {
  setEpisode(episode);
  Object.assign(G, {
    level: 0, score: 0, health: 9, firepower: 1, boots: 0, hooks: 0, robohand: 0, card: 0,
    keys: [0, 0, 0, 0], inventory: [], x: 16, saved: null, hintsSeen: {}, cheated: false,
  });
  startLevel(0);
  G.saved = snapshot();
  Sound.play(SND.start);
  // the opening exchange on Dr. Proton's monitor
  const lines = EPISODES[G.episode].intro;
  const show = (k) => {
    if (k >= lines.length) return;
    const [text, kind, face] = lines[k];
    showBox(text, k + 1 < lines.length ? () => show(k + 1) : null, kind, face);
  };
  show(0);
}

function snapshot() {
  return {
    level: G.level, score: G.score, health: G.health, firepower: G.firepower, boots: G.boots,
    hooks: G.hooks, robohand: G.robohand, inventory: G.inventory.slice(), x: G.x,
  };
}

function restoreSave() {
  const s = G.saved;
  Object.assign(G, {
    score: s.score, health: s.health, firepower: s.firepower, boots: s.boots, hooks: s.hooks,
    robohand: s.robohand, inventory: s.inventory.slice(), x: s.x,
  });
  startLevel(s.level);
}

function startLevel(i) {
  G.level = i;
  G.map = decodeMap(LEVEL_FILES[i]);
  G.mode = 'play';
  G.box = null;
  G.keys = [0, 0, 0, 0];
  G.card = 0;
  G.shots = [];
  G.dust = [];
  G.onGround = 0; G.falling = 1; G.jumpStep = 0; G.hanging = 0; G.swing = 0;
  G.facing = 4; G.poseSub = 0; G.flip = 0; G.flipCount = 0;
  G.hurt = 0; G.invul = 21; G.dying = 0; G.inDoor = 0; G.levelDone = 0;
  G.noDamage = 1;
  G.cutscene = 0;
  G.frame = 0;
  G.phase = 0;
  G.shake = 0;
  Effects.clear();
  Actors.load();          // replaces active codes with the tile to their left, finds the start
  G.camReq = 1;
  G.prev = null;
  G.title = LEVEL_NAMES[i] ? { text: LEVEL_NAMES[i], sub: LEVEL_SUBS[i], t: LEVEL_SUBS[i] ? 52 : 40 } : null;
}

// 0097:d7a7, the start marker: camX = 2*col - 14, camY = row - 3, y = 64; x carries over
function placeStart(col, row) {
  G.camX = 2 * col - 14;
  G.camRow = row - 3;
  G.y = 64;
  G.x = 2 * col + 2 - G.camX;  // keeps the start tile under Duke whatever x was
  if (G.camX < 0) { G.x += G.camX; G.camX = 0; }
  if (G.camRow < 0) { G.y += 16 * G.camRow; G.camRow = 0; }
}

function finishLevel() {
  const from = G.level;
  const next = from + 1;
  if (next >= LEVEL_FILES.length) return;
  if (next % 2 === 1) {
    // arriving in a hallway: the level's secret bonuses, then the auto-save
    const bonuses = Actors.bonuses();
    bonuses.forEach((b) => { G.score += 10000; });
    G.x = 16;
    startLevel(next);
    G.saved = snapshot();
    if (bonuses.length) {
      showBox('Secret bonus!\n\n' + bonuses.map((b) => b + '   +10,000').join('\n'), null, 'bonus');
      Sound.play(SND.bonus);
    }
  } else {
    G.x = 16;
    startLevel(next);
  }
}

// ---------- message boxes ----------

function showBox(text, then, kind = 'note', face = null) {
  G.box = { text, then, kind, t: 0, face };
}

function hint(id, text) {
  if (!G.hints || G.hintsSeen[id]) return;
  G.hintsSeen[id] = 1;
  showBox('Secret Tip: ' + text, null, 'hint');
}

// ---------- the frame ----------

function savePrev() {
  G.prev = {
    camX: G.camX, camRow: G.camRow, dx: absX() * 8 - 24, dy: G.camRow * 16 + G.y - 32,
  };
  Actors.savePrev();
  for (const s of G.shots) s.pX = s.X;
}

function tick() {
  G.anim = (G.anim || 0) + 1;
  if (G.mode === 'title') { Title.tick(); return; }
  if (G.mode === 'end') { Ending.tick(); return; }
  if (G.box) {
    G.box.t++;
    if (G.box.kind !== 'ask' && G.box.t > 4 && (take('enter') || (take('fire') && G.box.kind !== 'note'))) {
      const then = G.box.then;
      G.box = null;
      if (then) then();
    }
    return;
  }
  if (G.paused) { if (take('pause') || take('enter')) G.paused = false; return; }
  if (take('pause')) { G.paused = true; return; }
  if (take('esc')) { Menu.open(); return; }
  if (take('faster')) G.speed = Math.max(0, G.speed - 1);
  if (take('slower')) G.speed = Math.min(9, G.speed + 1);
  if (take('restart') && G.level % 2 === 0) {
    showBox('Restart the level?\n\nEnter = yes, Esc = no', () => { G.health = 0; G.dying = 29; }, 'ask');
    return;
  }
  savePrev();
  G.frame++;
  camVertical();
  updateDuke();
  G.phase = (G.phase + 0x20) & 0x7f;
  Actors.singles();
  if (!G.dying) {
    G.pose = poseDuke();
    if (keys.fire && !G.prevFire && !G.hurt && !G.cutscene && G.inDoor === 0) spawnShot();
    if (keys.fire && G.hanging) G.poseSub = G.facing ? 5 : 8;
    G.prevFire = keys.fire ? 1 : 0;
    if (G.invul > 0) G.invul--;
    if (G.hurt && !G.invul) {
      G.noDamage = 0;
      G.health--;
      Sound.play(SND.hit);
      G.jumpStep = 0; G.onGround = 0; G.hanging = 0; G.falling = 1; G.flip = 0; G.flipCount = 0;
      G.invul = 21;
      G.shake = 4;
      G.hurtFlash = 3;
    }
    G.hurt = 0;
  }
  Effects.update();
  for (const d of G.dust) d.t++;
  G.dust = G.dust.filter((d) => d.t < 5);
  updateShots();
  Actors.update();
  if (G.levelDone) { finishLevel(); return; }
  if (G.health <= 0 && !G.dying) {
    G.dying = 1;
    Sound.play(SND.death);
  }
  if (G.dying) dyingStep();
  if (G.endGame) { G.endGame = 0; Ending.start(); }
  G.prevUp = keys.up ? 1 : 0;
}

function dyingStep() {
  G.dying++;
  const X = absX(), Rl = G.camRow + ((G.y - 16) >> 4);
  if (G.dying < 15) Sound.play(SND.boxExplode);
  if (G.dying >= 2 && G.dying <= 19 && G.dying % 2 === 0) {
    Effects.debris(X * 8 - 8 + (Math.random() - 0.5) * 24, Rl * 16 + (Math.random() - 0.5) * 24, 'duke');
  }
  if (G.dying === 30) {
    if (G.level === 0) {
      showBox('You have died.\nStarting the level again.', () => { G.health = 9; newGameKeep(); });
    } else {
      showBox('You have died.\nBringing you back to the\nlast main hallway.', () => restoreSave());
    }
  }
}

function newGameKeep() {
  const hints = G.hintsSeen;
  newGame();
  G.hintsSeen = hints;
  G.box = null;
}

// ---------- drawing ----------

const lerp = (a, b, k) => a + (b - a) * k;

function viewOrigin(k) {
  // the original's view left edge in world pixels is 8*camX; ours is 24 px wider each side
  let cx = G.camX * 8, cy = G.camRow * 16;
  if (G.prev) {
    cx = lerp(G.prev.camX * 8, cx, k);
    cy = lerp(G.prev.camRow * 16, cy, k);
  }
  // keep the wider view inside the map
  return [Math.max(0, Math.min(MW * 16 - VW, cx - 24)), Math.max(0, Math.min(MH * 16 - VH, cy))];
}

function draw(g, k) {
  if (G.mode === 'title') { Title.draw(g, k); return; }
  if (G.mode === 'end') { Ending.draw(g, k); return; }
  if (!G.map) return;
  const [ox0, oy0] = viewOrigin(G.box || G.paused ? 1 : k);
  let ox = ox0, oy = oy0;
  if (G.shake > 0) {
    ox += (Math.random() - 0.5) * G.shake;
    oy += (Math.random() - 0.5) * G.shake;
  }
  drawBackdrop(g, ox, oy);
  g.save();
  g.translate(-ox, -oy);
  SNAP.s = scale; SNAP.ox = ox; SNAP.oy = oy;
  drawMap(g, ox, oy);
  Actors.drawBack(g, k);
  drawDust(g);
  drawDuke(g, k);
  drawShots(g, k);
  Actors.draw(g, k);
  Effects.draw(g, k);
  Actors.drawFront(g, k);
  g.restore();
  SNAP.ox = 0; SNAP.oy = 0;
  g.setTransform(1, 0, 0, 1, 0, 0);
  Items.drawWater(g, ox, oy);
  g.setTransform(scale, 0, 0, scale, 0, 0);
  drawLight(g);
  drawHud(g);
  if (G.title && G.title.t > 0) drawLevelTitle(g);
  if (G.box) drawBox(g);
  if (G.paused) drawCentered(g, 'Paused', 'Press P to carry on');
  Menu.draw(g);
}

function drawBackdrop(g, ox, oy) {
  const drop = Actors.backdrop();
  const c = backdropCanvas(drop);
  // the painted backdrop fills the view's height and slides sideways at a third of the scroll speed
  const bw = c.width / 4, bh = 160;
  const px = ((ox / 3) % bw + bw) % bw;
  for (let x = -px; x < VW; x += bw) g.drawImage(c, x, 0, bw + 0.5, bh);
  // map tile 0x0020 shows the second backdrop
  const d2 = Actors.backdrop2();
  if (d2 === drop) return;
  const c0 = Math.floor(ox / 16), r0 = Math.floor(oy / 16);
  g.save();
  g.beginPath();
  let any = false;
  for (let r = r0; r <= r0 + 11; r++) {
    for (let cc = c0; cc <= c0 + 17; cc++) {
      if (tileAt(cc, r) === 0x20) { g.rect(cc * 16 - ox - 0.25, r * 16 - oy - 0.25, 16.5, 16.5); any = true; }
    }
  }
  if (any) {
    g.clip();
    const c2 = backdropCanvas(d2);
    const bw2 = c2.width / 4, px2 = ((ox / 3) % bw2 + bw2) % bw2;
    for (let x = -px2; x < VW; x += bw2) g.drawImage(c2, x, 0, bw2 + 0.5, bh);
  }
  g.restore();
}

function drawMap(g, ox, oy) {
  const c0 = Math.floor(ox / 16), r0 = Math.floor(oy / 16);
  const p = G.phase >> 5;
  for (let r = r0; r <= r0 + 11; r++) {
    for (let c = c0; c <= c0 + 17; c++) {
      const w = tileAt(c, r);
      if (r < 0 || c < 0 || r >= MH || c >= MW) continue;
      if (w >= 0x3000) continue;
      let t = w >> 5;
      if (t <= 1) continue;                // 0x0000 and 0x0020 show backdrop 1 and 2
      t = Actors.flasher(t, p, c, r);
      drawTile(g, staticKey(t), c * 16, r * 16);
    }
  }
}

function dukeDrawPos(k) {
  const dx = absX() * 8 - 24, dy = G.camRow * 16 + G.y - 32;
  if (!G.prev) return [dx, dy];
  return [lerp(G.prev.dx, dx, k), lerp(G.prev.dy, dy, k)];
}

function drawDuke(g, k) {
  if (G.dying || G.inDoor >= 4 || G.cutscene) return;
  if (G.invul > 0 && G.invul % 2 === 1 && G.invul < 21) return;
  const [x, y] = dukeDrawPos(k);
  const t = dukeTiles(G.pose);
  g.save();
  g.shadowColor = 'rgba(0,0,0,0)';
  drawTile(g, t[0], x, y);
  drawTile(g, t[1], x + 16, y);
  drawTile(g, t[2], x, y + 16);
  drawTile(g, t[3], x + 16, y + 16);
  if (G.hurtFlash > 0) {
    G.hurtFlash--;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5;
    drawTile(g, t[0], x, y); drawTile(g, t[1], x + 16, y); drawTile(g, t[2], x, y + 16); drawTile(g, t[3], x + 16, y + 16);
  }
  g.restore();
}

function drawShots(g, k) {
  for (const s of G.shots) {
    if (!s.alive) continue;
    const X = s.pX === undefined ? s.X : lerp(s.pX, s.X, k);
    const x = X * 8 - 16, y = s.row * 16 + 3;
    glow(g, x + 8, y + 8, 14, s.first ? 'rgba(255, 120, 80, A)' : 'rgba(140, 255, 170, A)', 0.5);
    if (s.first) drawTile(g, s.dir < 0 ? 'OBJECT0:46' : 'OBJECT0:47', x, y);
    else drawTile(g, s.dir < 0 ? 'OBJECT0:' + (6 + (G.frame & 1)) : 'OBJECT0:' + (8 + (G.frame & 1)), x, y);
  }
}

function drawDust(g) {
  for (const d of G.dust) drawTile(g, 'OBJECT0:' + (19 + d.t), d.X * 8 - 16, d.row * 16, false, 0.9);
}

// soft vignette and the hit flash
function drawLight(g) {
  const v = g.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VW * 0.65);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = v;
  g.fillRect(0, 0, VW, VH);
  if (G.shake > 0) {
    g.fillStyle = `rgba(255, 40, 30, ${G.shake * 0.05})`;
    g.fillRect(0, 0, VW, VH);
    G.shake--;
  }
  if (G.health === 1 && !G.dying && (G.anim >> 2) & 1) {
    g.strokeStyle = 'rgba(255, 50, 40, 0.55)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, VW - 3, VH - 3);
  }
}

const FONT = '"Rubik", system-ui, sans-serif';
const TITLE_FONT = '"Black Ops One", "Rubik", system-ui, sans-serif';

function panel(g, x, y, w, h, r = 4) {
  g.fillStyle = 'rgba(8, 10, 22, 0.72)';
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
  g.strokeStyle = 'rgba(120, 140, 200, 0.35)';
  g.lineWidth = 0.6;
  g.stroke();
}

function drawHud(g) {
  // left: score and health
  panel(g, 4, 4, 104, 21);
  g.font = `600 5px ${FONT}`;
  g.fillStyle = '#8e98b8';
  g.textBaseline = 'top';
  g.fillText('SCORE', 8, 7);
  g.font = `700 9px ${FONT}`;
  g.fillStyle = '#ffd94e';
  g.fillText(String(G.score).padStart(8, '0'), 8, 13);
  // health: 8 bars, full when i < health-1
  for (let i = 0; i < 8; i++) {
    const full = i < G.health - 1;
    g.fillStyle = full ? (G.health <= 3 ? '#ff5a52' : '#5aff8a') : 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.roundRect(62 + i * 5, 12, 3.6, 10, 1);
    g.fill();
  }
  g.font = `600 5px ${FONT}`;
  g.fillStyle = '#8e98b8';
  g.fillText('HEALTH', 62, 7);
  // right: firepower, keys, items
  const rx = VW - 4 - 104;
  panel(g, rx, 4, 104, 21);
  g.fillStyle = '#8e98b8';
  g.fillText('FIREPOWER', rx + 4, 7);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i < G.firepower ? '#ffe680' : 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.roundRect(rx + 4 + i * 8, 14, 6, 6, 1.5);
    g.fill();
  }
  const keyCol = ['#ff4a4a', '#4aff6a', '#4a8aff', '#ff4aff'];
  for (let i = 0; i < 4; i++) {
    if (G.keys[i]) drawTile(g, 'OBJECT2:' + (24 + i), rx + 40 + i * 9, 7, false);
    else {
      g.strokeStyle = keyCol[i];
      g.globalAlpha = 0.3;
      g.lineWidth = 0.6;
      g.strokeRect(rx + 43 + i * 9, 10, 6, 10);
      g.globalAlpha = 1;
    }
  }
  let ix = rx + 78;
  for (const it of G.inventory) {
    drawTile(g, it, ix, 6, false);
    ix += 9;
  }
}

function drawLevelTitle(g) {
  G.title.t--;
  const a = Math.min(1, G.title.t / 10);
  g.globalAlpha = a;
  g.font = `28px ${TITLE_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillText(G.title.text, VW / 2 + 1.5, VH / 2 - 20 + 1.5);
  g.fillStyle = '#ffd94e';
  g.fillText(G.title.text, VW / 2, VH / 2 - 20);
  if (G.title.sub) {
    g.font = `600 9px ${FONT}`;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillText(G.title.sub, VW / 2 + 1, VH / 2 + 3);
    g.fillStyle = '#e8ebf3';
    g.fillText(G.title.sub, VW / 2, VH / 2 + 2);
  }
  g.textAlign = 'left';
  g.globalAlpha = 1;
}

function wrapLines(text) {
  return text.split('\n');
}

function drawBox(g) {
  const lines = wrapLines(G.box.text);
  g.font = `500 7px ${FONT}`;
  const face = G.box.face && PICS[G.box.face];
  const fw = face ? 70 : 0;
  const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 24 + fw;
  const h = Math.max(face ? 64 : 0, lines.length * 10 + 26);
  const x = (VW - w) / 2, y = (VH - h) / 2;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, VW, VH);
  g.fillStyle = 'rgba(14, 18, 40, 0.94)';
  g.beginPath();
  g.roundRect(x, y, w, h, 5);
  g.fill();
  g.strokeStyle = G.box.kind === 'hint' ? '#5aff8a' : G.box.kind === 'proton' ? '#ff5a52' : '#ffd94e';
  g.lineWidth = 1;
  g.stroke();
  if (face) {
    const fh = h - 8, fwid = fh * face.width / face.height;
    g.save();
    g.beginPath();
    g.roundRect(x + 4, y + 4, Math.min(fw - 6, fwid), fh, 3);
    g.clip();
    g.fillStyle = G.box.face === 'proton' ? '#2a0c10' : '#0c1630';
    g.fill();
    g.drawImage(face, x + 4 + (Math.min(fw - 6, fwid) - fwid) / 2, y + 4, fwid, fh);
    g.restore();
  }
  g.fillStyle = '#e8ebf3';
  g.textBaseline = 'top';
  g.textAlign = 'center';
  const tx = x + fw + (w - fw) / 2, ty = y + (h - lines.length * 10 - 14) / 2;
  lines.forEach((l, i) => g.fillText(l, tx, ty + i * 10));
  g.font = `600 5.5px ${FONT}`;
  g.fillStyle = '#8e98b8';
  if ((G.anim >> 3) & 1 || G.box.kind === 'ask') {
    g.fillText(G.box.kind === 'ask' ? '' : 'Press Enter', tx, y + h - 12);
  }
  g.textAlign = 'left';
}

function drawCentered(g, a, b) {
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(0, 0, VW, VH);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `24px ${TITLE_FONT}`;
  g.fillStyle = '#ffd94e';
  g.fillText(a, VW / 2, VH / 2 - 8);
  g.font = `500 7px ${FONT}`;
  g.fillStyle = '#e8ebf3';
  g.fillText(b, VW / 2, VH / 2 + 14);
  g.textAlign = 'left';
}

// ---------- game API for shell.js ----------

const Game = {
  fps,
  tick,
  draw,
  onKey(e) {
    if (G.box && G.box.kind === 'ask') {
      if (e.code === 'Enter' || e.code === 'KeyY') { const t = G.box.then; G.box = null; if (t) t(); return true; }
      if (e.code === 'Escape' || e.code === 'KeyN') { G.box = null; return true; }
      return false;
    }
    if (e.code === 'KeyM') { Sound.on = !Sound.on; if (!Sound.on) Sound.stop(); }
    if (Menu.onKey(e)) return true;
    // the original's cheat: Backspace + keypad 3 (PgDn) together gives all keys and full firepower
    if (G.mode === 'play' && ((e.code === 'Backspace' && keysDown.PageDown) || (e.code === 'PageDown' && keysDown.Backspace))) {
      G.keys = [1, 1, 1, 1];
      G.firepower = 4;
      G.cheated = true;
      Sound.play(SND.cheat);
      showBox('You are now cheating.\nYou have full fire power\nand all the keys. Have fun!');
    }
  },
};
const keysDown = {};
window.addEventListener('keydown', (e) => { keysDown[e.code] = true; });
window.addEventListener('keyup', (e) => { keysDown[e.code] = false; });

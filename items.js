// Boxes, pickups, doors, keys and the level's machines, following analysis/items.md.
// Registered into the same TYPES table as the enemies in actors.js, so they run in the original's order.

const HINTS = {
  lock: 'Find the key that goes here\nand press the UP ARROW.',
  note: 'Press the UP ARROW\nto read the notes.',
  elevator: 'Press the UP ARROW\nto activate the ELEVATORS.',
  soda: 'Drink soda to\nincrease your health!',
  turkey: 'Eat turkey to\nincrease your health!',
  molecule: 'The nuclear molecule\nincreases your health to maximum!',
  door: 'Press the UP ARROW\nto open the DOOR.',
  robohand: 'Press the UP ARROW here\nafter you have found the ROBOHAND.',
  card: 'Find the ACCESS CARD\nand press the UP ARROW here.',
  teleport: 'Press the UP ARROW\nto activate the TRANSPORTER.',
  noCard: 'Find the ACCESS CARD first\nand then insert it in here.',
  noKey: 'You need the correct key\nbefore you can use this lock.',
};
function tip(id, again = false) {
  if (!G.hints || (!again && G.hintsSeen[id])) return;
  G.hintsSeen[id] = 1;
  Sound.play(SND.cheat);
  showBox('Secret Tip: ' + HINTS[id], null, 'hint');
}

// Messages by level index: hallways (odd) on the note screen, levels (even) from Dr. Proton's monitor.
const MESSAGES = {
  1: 'You are entering the next level.\nNow is a good time to SAVE your game.',
  2: 'Surprise Duke, I\'ll be tracking\nyour every move with my\nsecurity camera system!',
  3: 'On the next level you\'ll need to\nfind a special access card that\nlooks like a computer board.',
  5: 'If you find the boots on the next\nlevel you\'ll be able to jump higher!',
  6: 'I see you\'re still trying Duke.\nNever mind, my robot drones\nwill soon be the end of you!',
  7: 'The next level is very tough,\nbut there\'s also a secret shortcut!',
  8: 'Hmmm... I see you\'ve survived\nmy Maze of Madness. I might\nhave underestimated you.',
  9: 'You are doing quite well so far...\nlet\'s see if you can keep it up.',
  10: 'Duke, in spite of your persistence,\nmy plan to rule Earth will not\nbe stopped. Ah, ha, ha!',
  11: 'Find the GRAPPLING HOOKS to beat\nthe next level. Use them to grab\non to special grated ceilings.',
  12: 'Why bother Duke? Not even\nCommander Keen could survive\nthe perils of my Mercury Mines!',
  13: 'There are several secret bonuses\nyou can earn on each level!',
  14: 'I hate heroes! Your luck is about\nto run out. Perhaps now would be\na good time to flee, Duke!',
  15: 'Secret Bonus Hint: Collect the\nletters D, U, K, E in order\nto earn bonus number five.',
  16: 'Duke, join me now and live, or\ncontinue this foolishness and\nI\'ll squash you myself!',
  17: 'You are about to enter the secret\nBubble City fortress of Dr. Proton.\nThere\'s no turning back!',
  18: 'I\'m coming down to crush you, Duke.\nIt\'s just you and me now.',
};

// two backdrops per level, table DS:0x0b47; the hallway keeps the last level's
Object.assign(LEVEL_DROPS, {
  0: ['DROP0', 'DROP3'], 2: ['DROP0', 'DROP3'], 4: ['DROP7', 'DROP3'], 6: ['DROP3', 'DROP5'], 8: ['DROP7', 'DROP7'],
  10: ['DROP2', 'DROP2'], 12: ['DROP1', 'DROP2'], 14: ['DROP3', 'DROP3'], 16: ['DROP5', 'DROP2'], 18: ['DROP0', 'DROP11'],
});
for (let i = 1; i < 19; i += 2) LEVEL_DROPS[i] = LEVEL_DROPS[i - 1];

function upEdge() { return keys.up && !G.prevUp; }
function invAdd(key) { if (!G.inventory.includes(key)) G.inventory.push(key); }
function invDel(key) { G.inventory = G.inventory.filter((k) => k !== key); }
function pop(n, y, x) { Effects.points(n, PX(x), PY(y) - 4); }

// ---------- boxes and what is in them (1.1 - 1.5) ----------

const GREY = 'OBJECT0:0', RED = 'OBJECT2:1', BLUE = 'OBJECT2:0';
const BOX = {
  0x3000: { box: GREY, item: null },
  0x3006: { box: GREY, item: 'OBJECT0:10', pts: 1000, snd: SND.special, get() { G.boots = 1; invAdd('OBJECT0:10'); } },
  0x3008: { box: GREY, item: 'OBJECT0:18', pts: 1000, get() { G.hooks = 1; invAdd('OBJECT0:18'); } },
  0x300f: { box: GREY, item: 'OBJECT0:43', pts: 1000, snd: SND.special, get() { if (G.firepower < 4) G.firepower++; } },
  0x3020: { box: GREY, item: 'OBJECT1:13', pts: 1000, snd: SND.special, get() { G.robohand = 1; invAdd('OBJECT1:13'); } },
  0x3029: { box: GREY, item: 'molecule', pts: 1000, snd: SND.powerup, get() { G.health = 9; tip('molecule'); } },
  0x3033: { box: GREY, item: 'OBJECT1:14', pts: 1000, snd: SND.special, get() { G.card = 1; invAdd('OBJECT1:14'); } },
  0x3037: { box: GREY, item: 'OBJECT2:18', letter: 'D' },
  0x3038: { box: GREY, item: 'OBJECT2:19', letter: 'U' },
  0x3039: { box: GREY, item: 'OBJECT2:20', letter: 'K' },
  0x303a: { box: GREY, item: 'OBJECT2:21', letter: 'E' },
  0x301d: { box: BLUE, item: 'OBJECT1:8', pts: 100, snd: SND.bonus },
  0x3050: { box: null, item: 'OBJECT1:8', pts: 100, snd: SND.bonus },
  0x301e: { box: BLUE, item: 'OBJECT1:9', pts: 2000, snd: SND.bonus },
  0x3054: { box: null, item: 'OBJECT1:9', pts: 2000, snd: SND.bonus },
  0x301f: { box: BLUE, item: 'OBJECT1:10', pts: 5000, snd: SND.bonus },
  0x3053: { box: null, item: 'OBJECT1:10', pts: 5000, snd: SND.bonus },
  0x302d: { box: BLUE, item: 'flag', random: true },
  0x3055: { box: null, item: 'flag', random: true },
  0x302e: { box: BLUE, item: 'radio', random: true },
  0x3056: { box: null, item: 'radio', random: true },
};
const RANDOM_PTS = { 0: 100, 0x20: 500, 0x40: 2000, 0x60: 5000 };

defType(Object.keys(BOX).map(Number), {
  n: 0,
  spawn(col, row, code) { return { code, s: BOX[code].box ? 1 : 2, x: 2 * col + 2, y: row << 7 }; },
  update() {
    this.n++;
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      const d = BOX[a.code];
      if (!SOLID(a.x, a.y + 0x80)) a.y += 0x80;
      if (a.s === 2) {
        if (TOUCH(a.x, a.y)) this.get(a, d);
      } else if (SHOT(a.y, a.x)) {
        DEBRIS(a.y, a.x);
        a.s = 2;
        if (!SOLID(a.x, a.y + 0x80)) { addScore(500); pop(500, a.y, a.x); }
        if (!d.item) a.dead = 1;
      }
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  get(a, d) {
    a.dead = 1;
    if (d.letter) {
      Sound.play(SND.bonus);
      const L = Items.letters;
      if (d.letter === 'E' && L.join('') === 'DUK') {
        addScore(10000); pop(10000, a.y, a.x);
        Actors.flags.duke = 1;
        Sound.play(SND.duke);
      } else {
        addScore(500); pop(500, a.y, a.x);
        if (d.letter !== 'E') L.push(d.letter);
      }
      return;
    }
    const pts = d.random ? RANDOM_PTS[phase()] : d.pts;
    addScore(pts);
    pop(pts, a.y, a.x);
    if (d.snd !== undefined) Sound.play(d.snd);
    else if (d.random) Sound.play(SND.bonus);
    if (d.get) d.get();
  },
  draw(g, k) {
    for (const a of this.list) {
      const d = BOX[a.code];
      if (a.s === 1) { tileA(g, d.box, a, k); continue; }
      let key = d.item;
      if (key === 'molecule') key = 'OBJECT1:' + (24 + this.n % 9);
      else if (key === 'flag') key = 'OBJECT1:' + (47 + this.n % 3);
      else if (key === 'radio') key = 'OBJECT2:' + (2 + this.n % 3);
      tileA(g, key, a, k);
      if (d.pts >= 1000 || d.letter || key.startsWith('OBJECT1:2')) {
        const [x, y] = apos(a, k);
        g.globalCompositeOperation = 'lighter';
        glow(g, x + 8, y + 8, 12, 'rgba(255, 240, 160, A)', 0.18 + 0.1 * Math.sin(G.anim * 0.4));
        g.globalCompositeOperation = 'source-over';
      }
    }
  },
});

// soda (3015 boxed, 3052 loose)
defType([0x3015, 0x3052], {
  c: 0,
  spawn(col, row, code) { return { s: code === 0x3015 ? 1 : 2, x: 2 * col + 2, y: row << 7 }; },
  update() {
    if (phase() === 0) this.c = (this.c + 1) & 3;
    for (const a of this.list) {
      if (a.s === 3) {
        if (OFF(a.y, a.x)) { a.dead = 1; continue; }
        if (phase() !== 0) a.y -= 0x40;
        if (SOLID(a.x, a.y - 0x40)) { EXPLODE(a.y, a.x, 1); a.dead = 1; continue; }
        if (TOUCH(a.x, a.y)) { addScore(1000); pop(1000, a.y, a.x); Sound.play(SND.bonus); a.dead = 1; }
        continue;
      }
      if (OFF(a.y, a.x)) continue;
      if (!SOLID(a.x, a.y + 0x80)) a.y += 0x80;
      if (a.s === 2 && TOUCH(a.x, a.y)) {
        addScore(200); pop(200, a.y, a.x); heal(1); Sound.play(SND.food); a.dead = 1; tip('soda');
        continue;
      }
      if (SHOT(a.y, a.x)) {
        if (a.s === 1) { DEBRIS(a.y, a.x); a.s = 2; if (!SOLID(a.x, a.y + 0x80)) { addScore(500); pop(500, a.y, a.x); } }
        else { a.s = 3; Sound.play(SND.cokeHit); }
      }
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) {
      if (a.s === 1) tileA(g, RED, a, k);
      else if (a.s === 2) tileA(g, 'ANIM2:' + (32 + this.c), a, k);
      else {
        tileA(g, 'ANIM2:' + (36 + this.c), a, k);
        const [x, y] = apos(a, k);
        g.globalCompositeOperation = 'lighter';
        glow(g, x + 8, y + 16, 8, 'rgba(255, 200, 120, A)', 0.5);
        g.globalCompositeOperation = 'source-over';
      }
    }
  },
});

// turkey (3018 boxed, 3051 loose): shooting the drumstick roasts it
defType([0x3018, 0x3051], {
  spawn(col, row, code) { return { s: code === 0x3018 ? 1 : 2, x: 2 * col + 2, y: row << 7 }; },
  update() {
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      if (!SOLID(a.x, a.y + 0x80)) a.y += 0x80;
      if (a.s >= 2 && TOUCH(a.x, a.y)) {
        const roast = a.s === 3;
        addScore(roast ? 200 : 100); pop(roast ? 200 : 100, a.y, a.x);
        heal(roast ? 2 : 1);
        Sound.play(SND.food);
        a.dead = 1;
        tip('turkey');
        continue;
      }
      if (a.s === 1 && SHOT(a.y, a.x)) { DEBRIS(a.y, a.x); a.s = 2; if (!SOLID(a.x, a.y + 0x80)) { addScore(500); pop(500, a.y, a.x); } }
      else if (a.s === 2 && SHOT(a.y, a.x)) { a.s = 3; Effects.list.push({ type: 'flash', x: PX(a.x), y: PY(a.y), t: 0, life: 3, r: 14 }); }
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) tileA(g, a.s === 1 ? RED : a.s === 2 ? 'OBJECT0:44' : 'OBJECT0:45', a, k);
  },
});

// balloon (3023): rises once its box is shot; touch the string for 10000
defType([0x3023], {
  c: 0,
  spawn(col, row) { return { s: 1, x: 2 * col + 2, y: row << 7 }; },
  update() {
    if (phase() === 0) this.c = (this.c + 1) % 3;
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      if (a.s === 1) {
        if (!SOLID(a.x, a.y + 0x80)) a.y += 0x40;
        if (SHOT(a.y, a.x)) { DEBRIS(a.y, a.x); a.s = 2; if (!SOLID(a.x, a.y + 0x80)) { addScore(500); pop(500, a.y, a.x); } }
        continue;
      }
      if (!SOLID(a.x, a.y - 0x80)) a.y -= 8;
      if (SHOT(a.y - 0x80, a.x) || SOLID(a.x, a.y - 0x80)) {
        Effects.list.push({ type: 'anim', tiles: ['OBJECT1:23'], x: PX(a.x) - 8, y: PY(a.y - 0x80) - 8, t: 0, life: 2 });
        SMOKE(a.y - 0x80, a.x);
        a.dead = 1;
        continue;
      }
      if (TOUCH(a.x, a.y)) { addScore(10000); pop(10000, a.y, a.x); Sound.play(SND.balloon); a.dead = 1; }
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) {
      if (a.s === 1) { tileA(g, BLUE, a, k); continue; }
      tileA(g, 'OBJECT1:19', a, k, 0, -1);
      tileA(g, 'OBJECT1:' + (20 + this.c), a, k, 0, 0);
    }
  },
});

// dynamite box (3012): after it is shot the fuse burns, then fire spreads along the floor
defType([0x3012], {
  spawn(col, row) { return { s: 1, x: 2 * col + 2, y: row << 7, c: 0, L: 1, R: 1 }; },
  update() {
    for (const a of this.list) {
      if (a.s === 1) {
        if (OFF(a.y, a.x)) continue;
        if (!SOLID(a.x, a.y + 0x80)) a.y += 0x80;
        if (SHOT(a.y, a.x)) { DEBRIS(a.y, a.x); a.s = 2; a.c = 1; if (!SOLID(a.x, a.y + 0x80)) { addScore(500); pop(500, a.y, a.x); } }
        continue;
      }
      a.c++;
      if (a.c === 14) { EXPLODE(a.y, a.x, 2); Sound.play(SND.bomb); G.shake = 4; }
      if (a.c >= 17 && a.c <= 23 && a.c % 2 === 1) {
        const n = (a.c - 15) / 2;
        for (const side of [-1, 1]) {
          const key = side < 0 ? 'L' : 'R';
          if (!a[key]) continue;
          const cx = a.x + side * 2 * n;
          if (!WALL(cx, a.y) && SOLID(cx, a.y + 0x80)) EXPLODE(a.y, cx, 2);
          else a[key] = 0;
        }
      }
      if (a.c >= 24) a.dead = 1;
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) {
      if (a.s === 1) { tileA(g, GREY, a, k); continue; }
      if (a.c < 12) {
        tileA(g, 'ANIM2:16', a, k);
        if (a.c & 1) {
          tileA(g, 'ANIM2:17', a, k);
          const [x, y] = apos(a, k);
          g.globalCompositeOperation = 'lighter';
          glow(g, x + 10, y + 2, 8, 'rgba(255, 220, 120, A)', 0.8);
          g.globalCompositeOperation = 'source-over';
        }
      }
    }
  },
});

// ---------- purple rabbit 303B (1.6) ----------

defType([0x303b], {
  spawn(col, row) { Actors.flags.hadRabbits = 1; return { s: 1, x: 2 * col + 2, y: row << 7, st: 0, f: 6 }; },
  frameKey(f, top) {
    if (f <= 2) return 'ANIM2:' + (18 + 2 * f + (top ? 0 : 1));
    return 'ANIM4:' + (36 + 2 * (f - 3) + (top ? 0 : 1));
  },
  update() {
    const tickP = phase() === 0 || phase() === 0x40;
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      if (a.s >= 3) {
        a.f = [0, 6, 3, 7][(a.s - 3) % 4];
        a.s++;
        if (a.s >= 20) {
          for (let i = 0; i < 6; i++) SMOKE(a.y - (i % 2) * 0x80, a.x + (i % 3) - 1);
          addScore(5000); pop(5000, a.y, a.x);
          Sound.play(SND.rabbit);
          a.dead = 1;
        }
        continue;
      }
      if (!SOLID(a.x, a.y + 0x80)) { a.y += 0x40; continue; }
      if (a.st === 0) { if (tickP) a.st = 1; }
      else if (tickP) {
        a.st = a.st >= 5 ? 1 : a.st + 1;
        if (a.s === 1) { if (WALL(a.x - 1, a.y)) a.s = 2; else a.x--; }
        else { if (WALL(a.x + 2, a.y)) a.s = 1; else a.x++; }
      }
      if (a.st === 0) a.f = a.s === 1 ? 6 : 7;
      else a.f = a.s === 1 ? (a.st < 3 ? a.st : 5 - a.st) : (a.st < 3 ? a.st + 2 : 8 - a.st);
      if (SHOT(a.y, a.x)) {
        for (let i = 0; i < 6; i++) SMOKE(a.y - (i % 2) * 0x80, a.x + (i % 3) - 1);
        Sound.play(SND.smallDeath);
        addScore(200); pop(200, a.y, a.x);
        a.dead = 1;
        continue;
      }
      if (TOUCH(a.x, a.y)) { HURT(); Sound.play(SND.rabbit); a.s = 3; }
    }
    this.list = this.list.filter((a) => !a.dead);
    if (Actors.flags.hadRabbits && !this.list.length) Actors.flags.rabbits = 1;
  },
  draw(g, k) {
    for (const a of this.list) {
      tileA(g, this.frameKey(a.f, true), a, k, 0, -1);
      tileA(g, this.frameKey(a.f, false), a, k, 0, 0);
    }
  },
});

// ---------- elevator 3001 (2.1), run inside Duke's update ----------

defType([0x3001], {
  single: true,
  spawn(col, row) {
    return { h: 1, x: 2 * col + 2, y: row << 7, col, saved: tileAt(col, row - 1), keep: 1 };
  },
  after(a) { setTile(a.col, a.y >> 7, 0x1ae0); },
  update() {
    for (const a of this.list) {
      const on = !OFF(a.y, a.x) && DX() === a.x && (() => { const d = DFEET() - (a.y - 0x20) + 2; return d > 0 && d < 0x180; })();
      if (!on) {
        if (a.h > 1) { a.h--; setTile(a.col, a.y >> 7, a.saved); a.y += 0x80; }
        continue;
      }
      tip('elevator');
      if (!G.hanging && keys.up && !keys.down && ceiling()) {
        a.h++;
        a.y -= 0x80;
        setTile(a.col, a.y >> 7, 0x1ae0);
        G.y -= 16;
        Sound.play(SND.elevator);
        if (G.y <= 0x40) G.camReq = 1;
      }
    }
  },
  draw(g, k) {
    for (const a of this.list) tileA(g, 'OBJECT0:5', a, k);
  },
});

// ---------- conveyors 3002-3005 (2.2) ----------

defType([0x3002, 0x3004], {
  f: 0,
  spawn(col, row, code) {
    const endCode = code === 0x3002 ? 0x3003 : 0x3005;
    let e = col + 1;
    while (e < MW && G.map[row * MW + e] !== endCode) e++;
    if (e >= MW) return null;
    G.map[row * MW + e] = 0x1820;
    return { sc: col, ec: e, row, right: code === 0x3004, x: 2 * col + 2, y: row << 7, keep: 1 };
  },
  after(a) { setTile(a.sc, a.row, 0x1820); },
  update() {
    this.f = (this.f + 1) & 3;
    const f = this.f;
    for (const a of this.list) {
      for (let c = a.sc + 1; c < a.ec; c++) setTile(c, a.row, 0x1c00 + (f & 1) * 0x20);
      if (a.right) { setTile(a.sc, a.row, 0x1b80 + f * 0x20); setTile(a.ec, a.row, 0x1c40 + f * 0x20); }
      else { setTile(a.sc, a.row, 0x1be0 - f * 0x20); setTile(a.ec, a.row, 0x1ca0 - f * 0x20); }
      const L = DX() - 2;
      const over = L + 1 >= 2 * a.sc && L <= 2 * a.ec + 1;
      if (!over || G.dying) continue;
      const fr = DFEET() >> 7;
      let dir = 0;
      if (fr === a.row && !G.hanging) dir = a.right ? 1 : -1;
      else if (G.hanging && fr - a.row >= 1 && fr - a.row <= 3) dir = a.right ? -1 : 1;
      if (dir < 0 && canLeft()) G.x--;
      if (dir > 0 && canRight()) G.x++;
    }
  },
  draw() {},
});

// ---------- rocket 3007 (2.3) ----------

defType([0x3007], {
  bg: { 0x3007: 'above' },
  spawn(col, row) { Actors.flags.hadRockets = 1; return { s: 1, x: 2 * col + 2, y: row << 7, col }; },
  update() {
    for (const a of this.list) {
      const r = a.y >> 7;
      if (a.s === 1) {
        if (OFF(a.y, a.x) && OFF(a.y - 0x180, a.x)) continue;
        if (SHOT(a.y, a.x)) {
          a.s = 2; Sound.play(SND.rocket); addScore(200); pop(200, a.y - 0x100, a.x);
        }
      } else if (a.s >= 2 && a.s < 10) {
        a.s++;
        if (a.s === 3) EXPLODE(a.y + 0x80, a.x, 3);
        if (a.s === 9) { setTile(a.col, r + 1, tileAt(a.col, r + 2)); DEBRIS(a.y + 0x80, a.x); }
      } else if (a.s === 10) {
        a.y -= 0x80;
        if (a.y >> 7 & 1) SMOKE(a.y + 0x100, a.x);
        if (SOLID(a.x, a.y - 0x200)) {
          for (const [dx, dy] of [[0, -0x200], [-1, -0x180], [1, -0x180], [-2, -0x100], [2, -0x100]]) DEBRIS(a.y + dy, a.x + dx);
          const nr = (a.y >> 7) - 4;
          setTile(a.col, nr, tileAt(a.col, nr + 1));
          G.shake = 5;
          Sound.play(SND.bomb);
          a.s = 0;
        }
      }
    }
    if (Actors.flags.hadRockets && this.list.every((a) => a.s === 0)) Actors.flags.bonus4 = 1;
  },
  draw(g, k) {
    for (const a of this.list) {
      if (a.s === 0) continue;
      tileA(g, 'OBJECT0:11', a, k, 0, -3);
      tileA(g, 'OBJECT0:12', a, k, 0, -2);
      tileA(g, 'OBJECT0:12', a, k, 0, -1);
      tileA(g, 'OBJECT0:13', a, k, 0, 0);
      tileA(g, 'OBJECT0:14', a, k, -2, 0);
      tileA(g, 'OBJECT0:15', a, k, 2, 0);
      const [x, y] = apos(a, k);
      if (a.s >= 2 && a.s < 10 && (a.s & 1)) tileA(g, 'OBJECT0:17', a, k, 0, 1);
      if (a.s === 10) {
        tileA(g, 'OBJECT0:16', a, k, 0, 1);
        tileA(g, 'OBJECT0:17', a, k, 0, 2);
        g.globalCompositeOperation = 'lighter';
        glow(g, x + 8, y + 28, 30, 'rgba(255, 150, 50, A)', 0.7);
        g.globalCompositeOperation = 'source-over';
      }
    }
  },
});

// ---------- teleporters 302F / 3030 (2.4) ----------

defType([0x302f, 0x3030], {
  single: true,
  c: 0,
  spawn(col, row, code) { return { x: 2 * col + 2, y: row << 7, b: code === 0x3030, timer: 0, arrive: 0 }; },
  update() {
    for (const a of this.list) {
      const other = this.list.find((o) => o !== a);
      if (a.arrive > 0) a.arrive--;
      const press = TOUCH(a.x + 2, a.y);
      if (press) tip('teleport');
      if (a.timer === 1 && other) {
        a.timer = 0;
        const sx = G.x;
        G.camX = other.x - sx + 2;
        G.camRow = (other.y >> 7) - 6;
        G.prev = null;
        keys.up = false;
        G.camReq = 1;
        other.arrive = 8;
        for (let i = 0; i < 12; i++) Effects.list.push({ type: 'bit', x: PX(other.x + 2), y: PY(other.y) - 8, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 5, t: 0, life: 8, c: '#74f1ff', s: 1.2, rot: 0 });
      } else if (a.timer > 0) a.timer--;
      else if (press && keys.up && !keys.left && !keys.right && !keys.jump && other) { a.timer = 8; Sound.play(SND.teleport); }
    }
  },
  draw(g, k) {
    for (const a of this.list) {
      const fr = a.arrive > 0 ? a.arrive % 4 : a.timer % 4;
      this.c = (this.c + 1) % 3;
      const mid = fr === 1 ? 29 : fr === 3 ? 30 : 21;
      tileA(g, 'ANIM4:20', a, k, 0, -2); tileA(g, 'ANIM4:' + mid, a, k, 2, -2); tileA(g, 'ANIM4:22', a, k, 4, -2);
      const pair = [[24, 25], [32, 34], [33, 35]][this.c];
      tileA(g, 'ANIM4:23', a, k, 0, -1); tileA(g, 'ANIM4:' + pair[0], a, k, 2, -1); tileA(g, 'ANIM4:' + pair[1], a, k, 4, -1);
      tileA(g, 'ANIM4:26', a, k, 0, 0); tileA(g, 'ANIM4:27', a, k, 2, 0); tileA(g, 'ANIM4:28', a, k, 4, 0);
      if (a.timer || a.arrive) {
        const [x, y] = apos(a, k);
        g.globalCompositeOperation = 'lighter';
        glow(g, x + 24, y - 4, 30, 'rgba(120, 240, 255, A)', 0.6);
        g.globalCompositeOperation = 'source-over';
      }
    }
  },
});

// ---------- access card slot 3034 (2.5) ----------

defType([0x3034], {
  single: true,
  n: 0,
  spawn(col, row) { return { x: 2 * col + 2, y: row << 7, used: 0 }; },
  update() {
    this.n = (this.n + 1) % 8;
    for (const a of this.list) {
      if (a.used || !TOUCH(a.x, a.y)) continue;
      tip('card');
      if (keys.up) {
        if (G.card) {
          for (const f of TYPES[0x3021].list) f.on = 0;
          a.used = 1;
          G.card = 0;
          invDel('OBJECT1:14');
          Sound.play(SND.keyDoor);
        } else if (upEdge()) tip('noCard', true);
      }
    }
  },
  draw(g, k) { for (const a of this.list) tileA(g, 'OBJECT2:' + (a.used ? 13 : 5 + this.n), a, k); },
});

// ---------- robohand slot 3035 and girder 3036 (2.6) ----------

defType([0x3035], {
  single: true,
  spawn(col, row) { return { x: 2 * col + 2, y: row << 7, col, used: 0, spark: 0 }; },
  update() {
    for (const a of this.list) {
      if (a.spark && !a.used) {
        if (OFF(a.y, a.x)) a.spark = 0;
        else if (phase() === 0) BULLET(a.y - 0x24, a.x + 2, 1);
        else if (phase() === 0x40) BULLET(a.y - 0x24, a.x - 2, 2);
      }
      if (a.used || !TOUCH(a.x, a.y)) continue;
      tip('robohand');
      if (keys.up) {
        if (G.robohand) {
          a.used = 1;
          a.spark = 0;
          Sound.play(SND.bridge);
          for (const gd of TYPES[0x3036].list) gd.on = 1;
        } else a.spark = 1;
      }
    }
  },
  draw(g, k) {
    for (const a of this.list) {
      tileA(g, 'OBJECT2:16', a, k, -2);
      tileA(g, 'OBJECT2:' + (a.used ? 15 : phase() === 0 ? 14 : 15), a, k);
      tileA(g, 'OBJECT2:17', a, k, 2);
    }
  },
});

defType([0x3036], {
  spawn(col, row) { return { x: 2 * col + 2, y: row << 7, col, row, X: 2 * col + 2, on: 0, done: 0, keep: 1 }; },
  after(a) { setTile(a.col, a.row, 0x2fe0); },
  update() {
    for (const a of this.list) {
      if (!a.on || a.done) continue;
      SMOKE(a.y, a.X + 2);
      const c = a.X >> 1;
      if (tileAt(c, a.row) === 0x2fe0 || c >= MW) a.done = 1;
      else { setTile(c, a.row, 0x2fe0); a.X += 2; Effects.spark(c * 16 + 8, a.row * 16 + 8); }
    }
  },
  draw() {},
});

// ---------- keys, locks and doors (2.7) ----------

const KEY_COL = ['#ff4a4a', '#4aff6a', '#4a8aff', '#ff4aff'];
defType([0x3044, 0x3045, 0x3046, 0x3047], {
  spawn(col, row, code) { return { x: 2 * col + 2, y: row << 7, i: code - 0x3044 }; },
  update() {
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      if (TOUCH(a.x, a.y)) {
        G.keys[a.i] = 1;
        addScore(1000); pop(1000, a.y, a.x);
        Sound.play(SND.key);
        a.dead = 1;
      }
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) {
      const [x, y] = apos(a, k);
      g.globalCompositeOperation = 'lighter';
      glow(g, x + 8, y + 8, 12, 'rgba(255, 255, 255, A)', 0.12 + 0.08 * Math.sin(G.anim * 0.5));
      g.globalCompositeOperation = 'source-over';
      tileA(g, 'OBJECT2:' + (24 + a.i), a, k);
    }
  },
});

defType([0x3048, 0x3049, 0x304a, 0x304b], {
  single: true,
  c: 0,
  spawn(col, row, code) { return { x: 2 * col + 2, y: row << 7, i: code - 0x3048, used: 0 }; },
  update() {
    if (phase() === 0) this.c++;
    for (const a of this.list) {
      if (a.used || !TOUCH(a.x, a.y)) continue;
      tip('lock');
      if (keys.up) {
        if (G.keys[a.i]) {
          for (const d of TYPES[0x304c].list) {
            if (d.i === a.i && !d.opening) { d.opening = 1; setTile(d.col, d.row, tileAt(d.col - 1, d.row)); }
          }
          G.keys[a.i] = 0;
          a.used = 1;
          Sound.play(SND.keyDoor);
          addScore(1000);
        } else if (upEdge()) tip('noKey', true);
      }
    }
  },
  draw(g, k) {
    for (const a of this.list) tileA(g, 'OBJECT2:' + (a.used || (this.c & 1) ? 37 + a.i : 36), a, k);
  },
});

defType([0x304c, 0x304d, 0x304e, 0x304f], {
  spawn(col, row, code) { return { x: 2 * col + 2, y: row << 7, col, row, i: code - 0x304c, v: code - 0x304b, opening: 0, keep: 1 }; },
  after(a) { setTile(a.col, a.row, 0x1820); },
  update() {
    for (const a of this.list) {
      if (!a.opening) continue;
      if (phase() === 0 || phase() === 0x40) a.v++;
      if (a.v >= 9) a.dead = 1;
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) tileA(g, 'OBJECT2:' + (a.opening ? 27 + a.v : 28), a, k);
  },
});

// ---------- exit door 3011 (2.8) ----------

defType([0x3011], {
  single: true,
  spawn(col, row) { return { x: 2 * col + 2, y: (row << 7) + 2, s: 0 }; },
  update() {
    for (const a of this.list) {
      const touch = TOUCH(a.x + 1, a.y) || TOUCH(a.x + 1, a.y - 0x80);
      if (touch && G.level % 2 === 0) tip('door');
      if (a.s === 0) {
        if (touch && keys.up && !keys.left && !keys.right && !keys.jump && !G.dying) {
          a.s = 1;
          keys.up = false;
          if (G.level % 2 === 1) Sound.play(SND.door);
          G.inDoor = 1;
        }
        continue;
      }
      a.s++;
      G.inDoor = a.s;
      if (a.s === 3 && G.level % 2 === 0) Sound.play(SND.levelDone);
      if (a.s >= 8) G.levelDone = 1;
    }
  },
  draw(g, k) {
    for (const a of this.list) {
      const f = [0, 0, 1, 2, 3, 2, 1, 0, 0][a.s] || 0;
      const y = a.y & ~0x7f;
      const b = { x: a.x, y, px: a.x, py: y };
      tileA(g, 'ANIM2:' + 4 * f, b, k, 0, -1); tileA(g, 'ANIM2:' + (4 * f + 1), b, k, 2, -1);
      tileA(g, 'ANIM2:' + (4 * f + 2), b, k, 0, 0); tileA(g, 'ANIM2:' + (4 * f + 3), b, k, 2, 0);
      // Duke walking into the dark doorway
      if (a.s >= 1 && a.s < 4) {
        const [x, yy] = apos(b, k);
        g.fillStyle = `rgba(0,0,0,${0.15 * a.s})`;
        g.fillRect(x + 4, yy - 12, 24, 28);
      }
    }
  },
});

// ---------- message point 3040 and Dr. Proton's screen 3041 (2.9) ----------

defType([0x3040], {
  single: true,
  spawn(col, row) { return { x: 2 * col + 2, y: row << 7 }; },
  update() {
    for (const a of this.list) {
      if (!TOUCH(a.x, a.y)) continue;
      tip('note');
      if (upEdge() && MESSAGES[G.level]) { Sound.play(SND.note); showBox(MESSAGES[G.level], null, 'note'); }
    }
  },
  draw(g, k) {
    for (const a of this.list) {
      tileA(g, 'OBJECT2:23', a, k);
      const [x, y] = apos(a, k);
      g.globalCompositeOperation = 'lighter';
      glow(g, x + 8, y + 8, 12, 'rgba(120, 240, 255, A)', 0.25);
      g.globalCompositeOperation = 'source-over';
    }
  },
});

defType([0x3041], {
  single: true,
  idle: 0,
  spawn(col, row) { return { x: 2 * col + 2, y: row << 7, on: 0, spent: 0 }; },
  update() {
    this.idle = (this.idle + 1) % 3;
    if (G.level === 0 && G.episode !== 2) return;     // the original's rule; the new episode talks on level 1
    for (const a of this.list) {
      if (OFF(a.y, a.x)) { a.on = 0; continue; }
      let go = false;
      if (!a.on && !a.spent && (TOUCH(a.x - 6, a.y) || TOUCH(a.x + 8, a.y))) go = true;
      if (upEdge() && (TOUCH(a.x, a.y) || TOUCH(a.x + 2, a.y))) go = true;
      if (go && MESSAGES[G.level]) {
        a.on = 1;
        a.spent = 1;
        Sound.play(SND.monitor);
        showBox(MESSAGES[G.level], null, 'proton', 'proton');
      }
    }
  },
  draw(g, k) {
    const D = DX();
    for (const a of this.list) {
      let f = this.idle;
      if (a.on) f = D < a.x - 1 ? 3 : D > a.x + 3 ? 5 : 4;
      tileA(g, 'ANIM5:' + (18 + 2 * f), a, k, 0, -1);
      tileA(g, 'ANIM5:' + (19 + 2 * f), a, k, 2, -1);
      tileA(g, 'ANIM5:16', a, k, 0, 0);
      tileA(g, 'ANIM5:17', a, k, 2, 0);
    }
  },
});

// ---------- decorations (2.11) and water (2.10) ----------

const DECOR = {
  0x3025: ['ANIM4:11', 'above'], 0x3026: ['ANIM4:12', 'left'], 0x3027: ['ANIM4:13', 'right'], 0x3028: ['ANIM4:14', 'zero'],
  0x303d: ['ANIM5:12', 'zero'], 0x303e: ['ANIM5:13', 'zero'], 0x303f: ['ANIM5:14', 'zero'],
};
defType(Object.keys(DECOR).map(Number), {
  single: true,
  bg: { 0x3025: 'above', 0x3027: 'right' },
  spawn(col, row, code) { return { x: 2 * col + 2, y: row << 7, key: DECOR[code][0], zero: DECOR[code][1] === 'zero', col, row, keep: 1 }; },
  after(a) { if (a.zero) setTile(a.col, a.row, 0); },
  update() {},
  draw(g, k) { for (const a of this.list) tileA(g, a.key, a, k); },
});

defType([0x3014], {
  single: true,
  spawn(col, row) { return { x: 2 * col + 2, y: row << 7, col, row }; },
  update() {},
  draw() {},
});

// ---------- the Items layer used by actors.js and game.js ----------

const Items = {
  letters: [],
  reset() { this.letters = []; },
  blocks() { return false; },
  standOn() { return false; },
  singles() {},
  savePrev() {},
  drawBack() {},
  draw() {},
  drawFront() {},
  flasher(t, p) {
    if (t > 1 && t < 47) return t + p;
    return t;
  },
  // 3014: a squashed, shimmering reflection of the 60 px above each water tile, copied from the
  // frame itself, drawn over the 30 px from 2 px below the tile's top (items.md 2.10)
  drawWater(g, ox, oy) {
    const list = TYPES[0x3014].list;
    if (!list.length) return;
    const s = scale;
    const src = g.canvas;
    const t = (G.anim || 0) * 0.35;
    for (const a of list) {
      const wx = a.col * 16 - ox, wy = a.row * 16 - oy;
      if (wx < -16 || wx > VW || wy < -30 || wy - 60 > VH) continue;
      const dx = Math.round(wx * s), dw = Math.round(16 * s);
      const top = wy + 2;
      for (let r = 0; r < 30; r += 2) {
        const sy = wy - 1 - r * 2 - 4;     // two source rows for every row drawn, mirrored
        if (sy < 0) break;
        const wobble = Math.sin(t + r * 0.7 + a.col) * 0.6 * s;
        g.save();
        g.translate(0, Math.round((top + r) * s));
        g.scale(1, -1);
        g.drawImage(src, dx, Math.round(sy * s), dw, Math.round(4 * s), dx + wobble, -Math.round(2 * s), dw, Math.round(2 * s));
        g.restore();
      }
      const gr = g.createLinearGradient(0, top * s, 0, (top + 30) * s);
      gr.addColorStop(0, 'rgba(60, 140, 255, 0.22)');
      gr.addColorStop(1, 'rgba(20, 60, 160, 0.5)');
      g.fillStyle = gr;
      g.fillRect(dx, Math.round(top * s), dw, Math.round(30 * s));
    }
  },
};

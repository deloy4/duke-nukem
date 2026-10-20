// Everything in a level that isn't map tiles: enemies, hazards, boxes, pickups, doors and machines.
// The rules follow analysis/enemies.md and analysis/items.md. Actors keep the original's units:
// x in 8-px half-tiles with the +2 border (x = 2*col + 2, map column (x >> 1) - 1), y in 1/8 pixels
// (one tile = 0x80, map row y >> 7). An actor's anchor is its bottom-left tile.

const TYPES = {};          // code -> type
const typeOrder = [];      // types in the order the level scan first met them (that is the run order)

// ---------- helpers the original shares between actors (enemies.md section 3) ----------

const DX = () => G.x + G.camX;
const DFEET = () => (G.camRow + (G.y >> 4)) * 0x80;
const CAMY = () => G.camRow * 0x80;

// 0097:3260, widened to the drawn view (3 half-tiles more on each side)
function OFF(y, x) {
  return x < G.camX - 3 || x >= G.camX + 0x1d + 3 || y < CAMY() - 0x40 || y >= CAMY() + 0x500;
}
function mapAt(x, y) { return tileAt((x >> 1) - 1, y >> 7); }
// 0097:3706: either column under x
function SOLID(x, y) {
  if (mapAt(x, y) >= 0x1800) return true;
  if (x & 1) return tileAt(x >> 1, y >> 7) >= 0x1800;
  return false;
}
// 0097:3670: the single column
function WALL(x, y) { return mapAt(x, y) >= 0x1800; }
// 0097:3505
function TOUCH(x, y) {
  if (G.dying || G.inDoor >= 4) return false;
  const dy = DFEET() - y + 2;
  return Math.abs(DX() - x) < 2 && dy > 0x10 && dy < 0x180;
}
// 0097:354a: uses the shot up; 1 = it was flying left, 2 = right
function SHOT(y, x) {
  for (const s of G.shots) {
    if (!s.alive) continue;
    const d = s.row * 0x80 - y;
    if (Math.abs(s.X - x) < 2 && d > -0x81 && d < 0x80) {
      s.alive = 0;
      return s.dir < 0 ? 1 : 2;
    }
  }
  return 0;
}
const HURT = () => hurtDuke();
const phase = () => G.phase;   // [0x437] as the actors see it (already advanced this frame)

// centre of a tile at actor coords, in world pixels
const PX = (x) => x * 8 - 16 + 8;
const PY = (y) => (y >> 3) + 8;

function EXPLODE(y, x, kind = 1) {
  if (Actors.explosions.length >= 8) return;
  Actors.explosions.push({ x, y, kind, t: 1 });
  if (kind === 3) Effects.list.push({ type: 'flash', x: PX(x), y: PY(y), t: 0, life: 3, r: 22 });
  else Effects.list.push({ type: 'flash', x: PX(x), y: PY(y), t: 0, life: 4, r: 18 });
}
function DEBRIS(y, x) {
  Effects.debris(PX(x) + 4, PY(y), 'metal');
  Sound.play(SND.boxExplode);
}
function SMOKE(y, x) { Effects.smoke(PX(x), PY(y)); }
function SPARKLE(y, x) { Effects.list.push({ type: 'anim', tiles: ['OBJECT0:19', 'OBJECT0:20', 'OBJECT0:21', 'OBJECT0:22', 'OBJECT0:23'], x: PX(x) - 8, y: PY(y) - 8, t: 0, life: 5 }); }
function RUBBLE(y, x) { Effects.rubble(PX(x) - 8, (y >> 3)); }
function SCORE(n, y, x, pop = true) { addScore(n, pop ? PX(x) : undefined, pop ? PY(y) : undefined); }

// Enemy bullets, 0097:1b7c / 0097:1be8: three at most, 8 px per frame.
function BULLET(y, x, dir) {
  if (Actors.bullets.length >= 3) return;
  Actors.bullets.push({ x, y, dir, first: 1 });
  if (!OFF(y, x)) Sound.play(SND.enemyShot);
}

// ---------- type registry ----------

function defType(codes, def) {
  def.list = [];
  def.codes = codes;
  for (const c of codes) TYPES[c] = def;
  return def;
}

// draw position of an actor between ticks
function apos(a, k) {
  const x = a.px === undefined ? a.x : a.px + (a.x - a.px) * k;
  const y = a.py === undefined ? a.y : a.py + (a.y - a.py) * k;
  return [x * 8 - 16, y / 8];
}
// draw tile `key` at actor coordinates (x, y), offset by whole tiles
function tileA(g, key, a, k, dx = 0, drow = 0, flip = false) {
  const [x, y] = apos(a, k);
  drawTile(g, key, x + dx * 8, y + drow * 16, flip);
}

// ---------- 3009 / 300A flamethrowers (5.1) ----------

defType([0x3009, 0x300a], {
  bg: { 0x3009: 'right', 0x300a: 'left' },
  spawn(col, row, code) { return { t: 1, x: 2 * col + 2, y: row << 7, right: code === 0x3009 }; },
  update() {
    for (const a of this.list) {
      a.t++;
      if (a.t === 15 && !OFF(a.y, a.x)) Sound.play(SND.torch);
      if (a.t >= 25 && a.t <= 44) {
        const s = a.right ? 1 : -1;
        if (!OFF(a.y, a.x) && !OFF(a.y, a.x + 6 * s)) {
          if (TOUCH(a.x, a.y) || TOUCH(a.x + 2 * s, a.right ? a.y - 0x20 : a.y) || TOUCH(a.x + 4 * s, a.y)) HURT();
        }
      }
      if (a.t >= 66) a.t = 1;
    }
  },
  draw(g, k) {
    for (const a of this.list) {
      const s = a.right ? 1 : -1;
      if (a.t >= 15 && a.t <= 24 && a.t % 2 === 1) {
        tileA(g, 'OBJECT0:' + (a.right ? 24 : 29), a, 0);
        glow(g, PX(a.x), PY(a.y), 10, 'rgba(255, 180, 80, A)', 0.5);
      }
      if (a.t >= 25 && a.t <= 44) {
        const b = a.right ? 25 : 30, e = a.right ? 27 : 32, f = a.t % 2;
        tileA(g, 'OBJECT0:' + (b + f), a, 0, 0);
        tileA(g, 'OBJECT0:' + (b + f), a, 0, 2 * s);
        tileA(g, 'OBJECT0:' + (e + f), a, 0, 4 * s);
        g.globalCompositeOperation = 'lighter';
        glow(g, PX(a.x + 2 * s), PY(a.y), 34, 'rgba(255, 140, 40, A)', 0.45);
        g.globalCompositeOperation = 'source-over';
      }
    }
  },
});

// ---------- 300B floating robot with antenna (5.2) ----------

const ARC_FE = [[0, -64], [1, -32], [1, -16], [0, -1], [0, 0], [1, 12], [1, 24], [0, 46], [1, 128], [0, 128], [1, 256]];
const ARC_FF = [[0, -64], [-1, -32], [-1, -16], [0, -1], [0, 0], [-1, 12], [-1, 24], [0, 46], [-1, 128], [-1, 128]];

defType([0x300b], {
  c5a8: 0, c5a6: 0,
  spawn(col, row) { return { s: 1, x: 2 * col + 2, y: row << 7, arc: 0 }; },
  update() {
    this.c5a8 = (this.c5a8 + 1) % 10;
    this.c5a6 = (this.c5a6 + 1) & 3;
    for (const a of this.list) {
      if (a.s >= 0xfe) {
        if (SOLID(a.x, a.y + 0x80)) { DEBRIS(a.y, a.x); EXPLODE(a.y, a.x, 1); a.dead = 1; continue; }
        const T = a.s === 0xfe ? ARC_FE : ARC_FF;
        if (a.arc < T.length) { a.x += T[a.arc][0]; a.y += T[a.arc][1]; a.arc++; }
        else a.y += 0x80;
        if (OFF(a.y, a.x)) { a.dead = 1; continue; }
        SMOKE(a.y - 0x80, a.x);
        continue;
      }
      if (OFF(a.y, a.x) || OFF(a.y - 0x80, a.x)) continue;
      if (SHOT(a.y - 0x80, a.x) || TOUCH(a.x, a.y - 0x80)) {
        if (TOUCH(a.x, a.y)) HURT();
        a.s = (phase() === 0 || phase() === 0x20) ? 0xfe : 0xff;
        a.arc = 0;
        EXPLODE(a.y, a.x, 1);
        SCORE(200, a.y - 0x80, a.x);
        Sound.play(SND.smallDeath);
        continue;
      }
      if (!SOLID(a.x, a.y + 0x80)) a.y += 8;
      if (SOLID(a.x, a.y + 0x80)) {
        a.y -= 8;
        if (!SOLID(a.x, a.y + 0x80) && this.c5a6 === 0) SPARKLE(a.y, a.x);
      }
      if (this.c5a6 === 0) {
        const D = DX();
        if (a.x > D) {
          if (a.s < 2) {
            if (!WALL(a.x - 1, a.y - 5)) {
              a.x--;
              if (this.c5a8 === 0) BULLET(a.y - 0xa0, a.x - 1, 1);
            }
          } else a.s--;
        }
        if (a.x < D) {
          if (a.s < 6) a.s++;
          else if (!WALL(a.x + 2, a.y - 5)) {
            a.x++;
            if (this.c5a8 === 0) BULLET(a.y - 0xa0, a.x + 1, 2);
          }
        }
      }
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) {
      if (a.s >= 0xfe) {
        tileA(g, 'ANIM0:6', a, k);
        tileA(g, 'ANIM0:' + (a.s === 0xfe ? 0 : 5), a, k, 0, -1);
        continue;
      }
      if (OFF(a.y, a.x) && OFF(a.y - 0x80, a.x)) continue;
      tileA(g, 'ANIM0:' + (6 + this.c5a6), a, k);
      tileA(g, 'ANIM0:' + (a.s - 1), a, k, 0, -1);
      const [x, y] = apos(a, k);
      g.globalCompositeOperation = 'lighter';
      glow(g, x + 8, y + 14, 9, 'rgba(120, 200, 255, A)', 0.35);
      g.globalCompositeOperation = 'source-over';
    }
  },
});

// ---------- 300C jumping robot (5.3) ----------

const JR_FRAMES = [
  [null, [10, 11], [12, 13]], [null, [10, 11], [14, 15]], [[16, 17], [18, 19], [20, 21]],
  [null, [22, 23], [24, 25]], [null, [22, 23], [26, 27]], [[28, 29], [30, 31], [32, 33]],
];
const JR_J = [[1, 256], [2, 128], [0, 64], [1, 32], [0, 16], [1, 8], [0, 4], [1, 2], [0, 1], [1, -1], [0, -2], [1, -4], [0, -8]];

defType([0x300c], {
  spawn(col, row) { return { s: 1, x: 2 * col + 2, y: row << 7, dir: 0, hits: 0, f: 0 }; },
  frame(a, f) {
    a.f = f;
    if (TOUCH(a.x + 1, a.y) || TOUCH(a.x + 1, a.y - 0x80)) HURT();
  },
  update() {
    for (const a of this.list) {
      if (!OFF(a.y, a.x) && a.dir === 0) a.dir = 1;
      if (!a.s || !a.dir) continue;
      for (let loop = 0; loop < 2; loop++) {
        if (SHOT(a.y - 0x80, a.x + 1) || SHOT(a.y, a.x + 1)) a.hits++;
        if (a.hits >= 3) {
          DEBRIS(a.y - 0x100, a.x + 1); DEBRIS(a.y - 0x80, a.x); DEBRIS(a.y, a.x + 2);
          EXPLODE(a.y - 0x80, a.x + 1); EXPLODE(a.y - 0x40, a.x + 2); EXPLODE(a.y - 0x80, a.x + 2); EXPLODE(a.y, a.x + 1);
          if (phase() === 0) RUBBLE(a.y, a.x);
          SCORE(2000, a.y - 0x80, a.x + 1);
          a.dead = 1;
          break;
        }
        if (phase() === 0) {
          if (a.hits === 1) SMOKE(a.y - 0xc0, a.x);
          if (a.hits === 2) { SMOKE(a.y - 0xc0, a.x + 2); SMOKE(a.y - 0xc0, a.x); }
        }
        if (a.s <= 24) {
          if (!SOLID(a.x + 1, a.y + 0x80)) {
            this.frame(a, a.x > DX() - 3 ? 2 : 5);
            a.y += 0x80;
            break;
          }
          if (a.x > DX() - 3) { a.dir = 1; this.frame(a, 0); }
          else { a.dir = 2; this.frame(a, 3); }
          a.s++;
          a.y = (a.y >> 7) << 7;
          if (a.s === 13) {
            if (a.dir === 1) { BULLET(a.y - 0x50, a.x - 1, 1); this.frame(a, 1); }
            else { BULLET(a.y - 0x50, a.x + 3, 2); this.frame(a, 4); }
            a.s++;
          }
          break;
        }
        if (a.s < 50) {
          const j = a.s - 25;
          if (a.dir === 1) {
            if (SOLID(a.x + 1, a.y - 0x100)) { a.y = (a.y >> 7) << 7; this.frame(a, 2); a.s = 1; break; }
            if (!WALL(a.x - 1, a.y)) a.x -= JR_J[j >> 1][0];
            a.y -= JR_J[j >> 1][1];
            this.frame(a, 2);
          } else {
            if (SOLID(a.x + 1, a.y - 0x100)) { a.y = (a.y >> 7) << 7; this.frame(a, 5); a.s = 1; break; }
            if (!WALL(a.x + 4, a.y)) a.x += JR_J[j >> 1][0];
            a.y -= JR_J[j >> 1][1];
            this.frame(a, 5);
          }
          a.s += 2;
          break;
        }
        a.s = 1;
      }
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) {
      if (!a.dir) { this.drawFrame(g, a, k, 0); continue; }
      this.drawFrame(g, a, k, a.f);
    }
  },
  drawFrame(g, a, k, f) {
    const fr = JR_FRAMES[f];
    fr.forEach((pair, i) => {
      if (!pair) return;
      tileA(g, 'ANIM0:' + pair[0], a, k, 0, i - 2);
      tileA(g, 'ANIM0:' + pair[1], a, k, 2, i - 2);
    });
  },
});

// ---------- 300D wheeled robot (5.4) ----------

defType([0x300d], {
  c6de: 0, c6dc: 0, n: 0,
  spawn(col, row) { return { s: 1, x: 2 * col + 2, y: row << 7, hits: 0, f: 0, dx: 0 }; },
  update() {
    this.n++;
    this.c6de = this.n & 1;
    this.c6dc = (this.n >> 1) & 1;
    for (const a of this.list) {
      a.dx = 0;
      if (SHOT(a.y, a.x) || SHOT(a.y, a.x + 2)) a.hits++;
      if (a.hits >= 2) {
        DEBRIS(a.y, a.x + 2); DEBRIS(a.y, a.x); EXPLODE(a.y, a.x + 1, 1);
        SCORE(2500, a.y, a.x + 1);
        Sound.play(SND.smallDeath);
        a.dead = 1;
        continue;
      }
      if (a.hits === 1 && phase() === 0) SMOKE(a.y - 0x40, a.x + 2);
      if (!SOLID(a.x, a.y + 0x80)) { a.y += 0x20; a.f = 0; }
      else {
        if (a.s === 1) {
          if (!WALL(a.x, a.y) && WALL(a.x, a.y + 0x80)) {
            if (this.c6de === 0) a.x--;
            a.f = this.c6dc;
          } else {
            a.s = 2;
            BULLET(a.y - 0x40, a.x + 4, 2);
          }
        }
        if (a.s === 2) {
          if (!WALL(a.x + 4, a.y) && WALL(a.x + 4, a.y + 0x80)) {
            if (this.c6de === 0) a.x++;
            a.f = 2 + this.c6dc;
          } else {
            a.s = 1;
            BULLET(a.y - 0x40, a.x - 2, 1);
            a.f = 2 + this.c6dc;
            a.dx = -1;
          }
        }
      }
      if (TOUCH(a.x, a.y) || TOUCH(a.x + 2, a.y)) HURT();
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) {
      tileA(g, 'ANIM0:' + (34 + 2 * a.f), a, k, a.dx);
      tileA(g, 'ANIM0:' + (35 + 2 * a.f), a, k, a.dx + 2);
    }
  },
});

// ---------- 300E rotating wheel with flames (5.5) ----------

defType([0x300e], {
  c5b0: 0, c5ae: 0,
  spawn(col, row) { return { s: 1, x: 2 * col + 2, y: row << 7, hits: 0 }; },
  update() {
    this.c5b0 = (this.c5b0 + 1) % 60;
    this.c5ae++;
    this.c5ae = this.c5b0 < 25 ? this.c5ae & 3 : 4 + (this.c5ae & 3);
    for (const a of this.list) {
      if ((SHOT(a.y, a.x) || SHOT(a.y, a.x + 2)) && this.c5b0 < 25) a.hits++;
      if (a.hits >= 2) {
        DEBRIS(a.y, a.x + 2); DEBRIS(a.y, a.x); SMOKE(a.y - 0x80, a.x + 2);
        EXPLODE(a.y, a.x + 1); EXPLODE(a.y - 0x80, a.x + 1); EXPLODE(a.y - 0x80, a.x);
        SCORE(5000, a.y - 0x80, a.x + 1);
        a.dead = 1;
        continue;
      }
      if (a.hits === 1 && phase() === 0) SMOKE(a.y - 0x40, a.x + 2);
      if (!SOLID(a.x + 1, a.y + 0x80)) a.y += 0x80;
      else if (a.s === 1) {
        if (WALL(a.x, a.y + 0x80) && !WALL(a.x, a.y)) { if (phase() === 0 || phase() === 0x40) a.x--; }
        else a.s = 2;
      } else {
        if (!WALL(a.x + 3, a.y + 0x80) || WALL(a.x + 3, a.y)) a.s = 1;
        else if (phase() === 0 || phase() === 0x40) a.x++;
      }
      if (TOUCH(a.x + 1, a.y) || TOUCH(a.x + 1, a.y - 0x40)) HURT();
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    const f = this.c5ae;
    for (const a of this.list) {
      tileA(g, 'ANIM1:' + (4 * f), a, k, 0, -1);
      tileA(g, 'ANIM1:' + (4 * f + 1), a, k, 2, -1);
      tileA(g, 'ANIM1:' + (4 * f + 2), a, k, 0, 0);
      tileA(g, 'ANIM1:' + (4 * f + 3), a, k, 2, 0);
      if (f >= 4) {
        const [x, y] = apos(a, k);
        g.globalCompositeOperation = 'lighter';
        glow(g, x + 16, y, 26, 'rgba(255, 120, 30, A)', 0.5);
        g.globalCompositeOperation = 'source-over';
      }
    }
  },
});

// ---------- 3010 small robot (5.6) ----------

defType([0x3010], {
  c6e0: 0,
  spawn(col, row) { return { s: 1, x: 2 * col + 2, y: row << 7 }; },
  update() {
    this.c6e0 = (this.c6e0 + 1) % 3;
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      let r;
      if (a.s < 3 && (r = SHOT(a.y, a.x))) {
        a.x += r === 1 ? -1 : 1;
        Sound.play(SND.smallDeath);
        a.s = 3;
      }
      if (!SOLID(a.x, a.y + 0x80)) a.y += 0x80;
      if (a.s === 1) {
        if (!WALL(a.x - 1, a.y) && WALL(a.x - 1, a.y + 0x80)) { if (this.c6e0 === 0) a.x--; }
        else a.s = 2;
      } else if (a.s === 2) {
        if (!WALL(a.x + 2, a.y) && WALL(a.x + 2, a.y + 0x80)) { if (this.c6e0 === 0) a.x++; }
        else a.s = 1;
      } else {
        a.s++;
        if (a.s >= 11) { EXPLODE(a.y, a.x, 1); SCORE(100, a.y, a.x); a.dead = 1; continue; }
      }
      if (a.s <= 2 && TOUCH(a.x, a.y)) HURT();
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      tileA(g, 'ANIM1:' + (a.s <= 2 ? 32 + this.c6e0 : 35 + Math.min(6, a.s - 4)), a, k);
    }
  },
});

// ---------- 3013 flying orb monster (5.7) ----------

const ORB_DX = [0, -1, -1, -2, -2, -2, -1, -1, 0, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 0, -1, -1, -2, -2, -2, -1, 0, 0, 0, 0, 0, 0, 0, 0];
const ORB_DY = [1, 1, 1, 1, 0, -1, -1, -1, -2, -1, -1, -1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, -1, -1, -2, -1, -1, -1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];

defType([0x3013], {
  spawn(col, row) {
    if (this.list.length) return null;
    const X = [], Y = [], alive = [];
    for (let k = 0; k <= 9; k++) { X.push(2 * col + 2 * k); Y.push(row * 0x80 + 2); alive.push(k > 0 ? 1 : 0); }
    return { X, Y, alive, p: 0, on: 1, pic: 0, pX: X.slice(), pY: Y.slice() };
  },
  update() {
    for (const a of this.list) {
      if (!a.on) continue;
      a.pX = a.X.slice(); a.pY = a.Y.slice();
      for (let i = 1; i <= 9; i++) { a.X[i - 1] = a.X[i]; a.Y[i - 1] = a.Y[i]; }
      if (!a.alive.some((v) => v)) {
        a.on = 0;
        SCORE(10000, a.Y[9], a.X[9]);
        Actors.flags.orbs = 1;
        continue;
      }
      a.X[9] += ORB_DX[a.p];
      a.Y[9] += ORB_DY[a.p] * 64;
      a.pics = [];
      for (let i = 1; i <= 9; i++) {
        a.pics[i] = a.pic;
        if (a.alive[i] && !OFF(a.Y[i], a.X[i]) && TOUCH(a.X[i], a.Y[i])) HURT();
        if (phase() !== 0) a.pic = (a.pic + 1) % 7;
        if (a.alive[i] && SHOT(a.Y[i] - 0x80, a.X[i])) {
          EXPLODE(a.Y[i], a.X[i], 3);
          SCORE(1000, a.Y[i], a.X[i]);
          Sound.play(SND.boxExplode);
          DEBRIS(a.Y[i] - 0x80, a.X[i]);
          a.alive[i] = 0;
        }
      }
      a.p = (a.p + 1) % 39;
    }
  },
  draw(g, k) {
    for (const a of this.list) {
      if (!a.on) continue;
      for (let i = 1; i <= 9; i++) {
        if (!a.alive[i]) continue;
        const x = (a.pX[i] + (a.X[i] - a.pX[i]) * k) * 8 - 16, y = (a.pY[i] + (a.Y[i] - a.pY[i]) * k) / 8;
        g.globalCompositeOperation = 'lighter';
        glow(g, x + 8, y + 8, 12, 'rgba(90, 160, 255, A)', 0.35);
        g.globalCompositeOperation = 'source-over';
        drawTile(g, 'ANIM2:' + (24 + ((a.pics && a.pics[i]) || 0)), x, y);
      }
    }
  },
});

// ---------- 3016 / 3017 wall-climbing creatures (5.8) ----------

defType([0x3016, 0x3017], {
  bg: { 0x3016: 'right', 0x3017: 'left' },
  n: 0,
  spawn(col, row, code) { return { s: code === 0x3016 ? 1 : 3, x: 2 * col + 2, y: row << 7 }; },
  update() {
    this.n = (this.n + 1) & 3;
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      const side = a.s <= 2 ? -2 : 2;
      if (a.s === 1 || a.s === 3) {
        a.y -= 8;
        if (!SOLID(a.x + side, a.y) || SOLID(a.x, a.y)) a.s++;
      } else {
        a.y += 8;
        if (!SOLID(a.x + side, a.y + 0x80) || SOLID(a.x, a.y + 0x80)) a.s--;
      }
      if (SHOT(a.y, a.x)) {
        EXPLODE(a.y, a.x, 1); SMOKE(a.y - 0x40, a.x); SCORE(100, a.y, a.x); Sound.play(SND.smallDeath);
        a.dead = 1;
        continue;
      }
      if (TOUCH(a.x, a.y)) HURT();
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      const up = a.s === 1 || a.s === 3;
      const f = up ? this.n : 3 - this.n;
      tileA(g, 'ANIM2:' + ((a.s <= 2 ? 40 : 44) + f), a, k);
    }
  },
});

// ---------- 3019 exploding bridge (5.9) ----------

defType([0x3019], {
  spawn(col, row) {
    if (this.list.length) return null;
    // the bridge is pairs of solid map tiles going right while the next pair's far tile is open
    let L = 0;
    let c = col;
    while (c + 1 < MW && !solid(tileAt(c + 1, row)) && L < 60) {
      setTile(c, row, 0x21a0);
      setTile(c + 1, row, 0x21c0);
      c += 2;
      L += 2;
    }
    return { col, row, L, state: 0, on: 1, keep: 1 };
  },
  after(a) { setTile(a.col, a.row, 0x21a0); },
  update() {
    for (const a of this.list) {
      if (!a.on) continue;
      const D = DX(), c = a.row * 0x80 - 0x20, dy = DFEET() - c + 2;
      const on = D > 2 * a.col && D < 2 * a.col + 2 * a.L + 2 && dy > 0 && dy < 0x180;
      if (on && a.state === 2) {
        for (let i = 0; i < a.L; i++) {
          setTile(a.col + i, a.row, tileAt(a.col + i, a.row - 1));
          if (i & 1) DEBRIS(a.row * 0x80, 2 * (a.col + 1 + i) + 2);
          else EXPLODE(a.row * 0x80, 2 * (a.col + 1 + i) + 2, 1);
        }
        Sound.play(SND.bridge);
        a.on = 0;
      } else if (on) a.state = 1;
      else if (a.state === 1) a.state = 2;
    }
  },
  draw() {},
});

// ---------- 301A horizontal force field (5.10) ----------

defType([0x301a], {
  bg: { 0x301a: 'above' },
  n: 0,
  spawn(col, row) { return { x: 2 * col + 2, y: row << 7, on: 1, lit: 0 }; },
  update() {
    this.n = (this.n + 1) & 3;
    let hum = false;
    for (const a of this.list) {
      a.lit = 0;
      if (!a.on || OFF(a.y, a.x)) continue;
      hum = true;
      if (TOUCH(a.x, a.y)) { a.lit = 1; HURT(); }
    }
    if (hum && this.n === 0) Sound.play(SND.forcefield);
  },
  draw(g, k) {
    for (const a of this.list) {
      if (!a.on) continue;
      tileA(g, 'OBJECT1:' + ((a.lit ? 4 : 0) + this.n), a, k);
      g.globalCompositeOperation = 'lighter';
      glow(g, PX(a.x), PY(a.y), 12, 'rgba(90, 140, 255, A)', 0.3);
      g.globalCompositeOperation = 'source-over';
    }
  },
});

// ---------- 3021 vertical force field (5.11) ----------

defType([0x3021], {
  n: 0,
  spawn(col, row) { return { x: 2 * col + 2, y: row << 7, on: 1 }; },
  update() {
    this.n = (this.n + 1) & 3;
    let hum = false;
    for (const a of this.list) {
      if (!a.on || OFF(a.y, a.x)) continue;
      hum = true;
      SHOT(a.y, a.x);
      if (TOUCH(a.x + 1, a.y) && keys.left && canRight()) G.x++;
      if (TOUCH(a.x - 1, a.y) && keys.right && canLeft()) G.x--;
    }
    if (hum && this.n === 0) Sound.play(SND.forcefield);
  },
  draw(g, k) {
    for (const a of this.list) {
      if (!a.on) continue;
      tileA(g, 'OBJECT1:' + (15 + this.n), a, k);
      g.globalCompositeOperation = 'lighter';
      glow(g, PX(a.x), PY(a.y), 12, 'rgba(180, 220, 255, A)', 0.3);
      g.globalCompositeOperation = 'source-over';
    }
  },
});

// ---------- 301B / 301C fans (5.12) ----------

defType([0x301b, 0x301c], {
  bg: { 0x301b: 'left', 0x301c: 'right' },
  spawn(col, row, code) { return { s: code === 0x301b ? 1 : 2, x: 2 * col + 2, y: row << 7, pic: 0 }; },
  update() {
    for (const a of this.list) {
      if ([1, 2, 3, 5, 9, 15, 25].includes(a.s)) a.pic = (a.pic + 1) & 3;
      if (OFF(a.y, a.x) && OFF(a.y - 0x80, a.x)) continue;
      if (SHOT(a.y, a.x) || SHOT(a.y - 0x80, a.x)) {
        if (a.s === 1 || a.s === 2) SCORE(1000, a.y - 0x80, a.x);
        a.s = 3;
        Sound.play(SND.smallDeath);
        SMOKE(a.y - 0xc0, a.x);
      }
      if (a.s > 2) { a.s++; if (a.s >= 26) a.s = 0; }
      if (a.s === 1) {
        if ((TOUCH(a.x - 2, a.y - 0x40) || TOUCH(a.x - 4, a.y - 0x40) || TOUCH(a.x - 6, a.y - 0x40)) && canLeft()) { G.x--; camLeft(); }
      } else if (a.s === 2) {
        if ((TOUCH(a.x + 2, a.y - 0x40) || TOUCH(a.x + 4, a.y - 0x40) || TOUCH(a.x + 6, a.y - 0x40)) && canRight()) { G.x++; camRight(); }
      }
    }
  },
  draw(g, k) {
    for (const a of this.list) {
      tileA(g, 'ANIM3:' + (12 + 2 * a.pic), a, k, 0, -1);
      tileA(g, 'ANIM3:' + (13 + 2 * a.pic), a, k, 0, 0);
      if (a.s === 1 || a.s === 2) {
        // air streaks
        const [x, y] = apos(a, k);
        const dir = a.s === 1 ? -1 : 1;
        g.strokeStyle = 'rgba(200, 230, 255, 0.25)';
        g.lineWidth = 0.6;
        for (let i = 0; i < 4; i++) {
          const o = ((G.anim * 5 + i * 13) % 44);
          const sx = dir < 0 ? x - o : x + 16 + o;
          g.beginPath();
          g.moveTo(sx, y - 12 + i * 7);
          g.lineTo(sx + dir * 6, y - 12 + i * 7);
          g.stroke();
        }
      }
    }
  },
});

// ---------- 3022 helicopter (5.13) ----------

defType([0x3022], {
  n: 0,
  spawn(col, row) { return { face: 1, x: 2 * col + 2, y: row << 7, lift: 0, hp: 4, dive: 0 }; },
  update() {
    this.n ^= 1;
    for (const a of this.list) {
      if (!OFF(a.y, a.x) && a.lift === 0) a.lift = SOLID(a.x + 3, a.y + 0x80) ? 0x18 : 1;
      if (a.lift === 0) continue;
      if (a.lift > 2) { a.lift--; a.y -= 0x10; }
      if (a.dive > 1 && a.lift < 3) {
        a.y += 0x10;
        a.dive++;
        if (a.dive > 0x17 || SOLID(a.x + 3, a.y + 0x80)) { a.lift = 0x18; a.dive = 0; }
      }
      const D = DX(), ph = phase();
      if (a.hp > 0) {
        if (D < a.x + 3) {
          a.face = 2;
          if ((ph === 0 || ph === 0x40) && !WALL(a.x - 2, a.y)) a.x--;
        } else if (a.x + 3 < D) {
          a.face = 3;
          if ((ph === 0 || ph === 0x40) && !WALL(a.x + 8, a.y)) a.x++;
        } else {
          a.face = 1;
          if (a.lift < 3 && a.dive === 0) a.dive = 2;
        }
      }
      if (SHOT(a.y, a.x) || SHOT(a.y, a.x + 8) || SHOT(a.y - 0x80, a.x + 4)) { if (a.hp > 0) a.hp--; }
      if (a.hp < 4 && ph === 0) SMOKE(a.y - 0x60, a.x + 3);
      if (a.hp < 3 && ph === 0x20) SMOKE(a.y - 0x60, a.x);
      if (a.hp < 2 && ph === 0x40) SMOKE(a.y - 0x80, a.x + 2);
      if (a.hp === 0) {
        if (!SOLID(a.x, a.y + 0x80) && !SOLID(a.x + 8, a.y + 0x80)) a.y += 0x20;
        else {
          DEBRIS(a.y, a.x); DEBRIS(a.y - 0x40, a.x + 2); DEBRIS(a.y, a.x + 4); DEBRIS(a.y - 0x40, a.x + 6); DEBRIS(a.y, a.x + 8);
          RUBBLE(a.y - 0x20, a.x + 1); RUBBLE(a.y - 0x80, a.x + 5);
          EXPLODE(a.y - 0x20, a.x + 1); EXPLODE(a.y - 0x40, a.x + 7); EXPLODE(a.y - 0x80, a.x + 2);
          EXPLODE(a.y - 0x80, a.x + 3); EXPLODE(a.y - 0x20, a.x + 5);
          SCORE(5000, a.y - 0x80, a.x + 4);
          G.shake = 5;
          a.dead = 1;
          continue;
        }
      }
      if (!a.dead && (TOUCH(a.x + 2, a.y - 0x40) || TOUCH(a.x + 4, a.y - 0x40))) HURT();
      if (!OFF(a.y, a.x + 6) && this.n) Sound.play(SND.walk);
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) {
      const r = a.face === 1 ? 2 + this.n : a.face === 2 ? this.n : 4 + this.n;
      const b = a.face === 1 ? 1 : a.face === 2 ? 0 : 2;
      for (let i = 0; i < 4; i++) {
        const gi = 176 + 4 * r + i;
        tileA(g, 'ANIM' + Math.floor(gi / 48) + ':' + (gi % 48), a, k, 2 * i, -1);
        tileA(g, 'ANIM3:' + (20 + 4 * b + i), a, k, 2 * i, 0);
      }
    }
  },
});

// ---------- 3024 security camera (5.14), runs inside Duke's update ----------

defType([0x3024], {
  bg: { 0x3024: 'below' },
  single: true,
  spawn(col, row) { Actors.flags.hasCameras = 1; return { x: 2 * col + 2, y: row << 7 }; },
  update() {
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      if (SHOT(a.y, a.x)) {
        SCORE(100, a.y, a.x);
        EXPLODE(a.y, a.x, 1);
        Sound.play(SND.smallDeath);
        a.dead = 1;
      }
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    const D = DX();
    for (const a of this.list) {
      const f = a.x - 2 > D ? 8 : a.x + 2 < D ? 10 : 9;
      tileA(g, 'ANIM4:' + f, a, k);
      // a red recording light
      if ((G.anim >> 2) & 1) {
        const [x, y] = apos(a, k);
        g.globalCompositeOperation = 'lighter';
        glow(g, x + 8, y + 6, 4, 'rgba(255, 60, 40, A)', 0.8);
        g.globalCompositeOperation = 'source-over';
      }
    }
  },
});

// ---------- 302A loose ACME sign (5.15) ----------

defType([0x302a], {
  spawn(col, row) { Actors.flags.hadSigns = 1; return { s: 1, x: 2 * col + 2, y: row << 7 }; },
  update() {
    for (const a of this.list) {
      if (OFF(a.y, a.x)) { if (a.s >= 16) a.dead = 1; continue; }
      if (a.s > 1) {
        if (SOLID(a.x + 1, a.y + 0x80)) { DEBRIS(a.y, a.x + 1); SMOKE(a.y, a.x + 1); G.shake = 3; a.dead = 1; continue; }
        a.s++;
      }
      const D = DX(), F = DFEET();
      if (a.s < 2 && D >= a.x - 1 && D <= a.x + 3 && F > a.y && F - a.y < 0x400) a.s = 2;
      if (a.s === 16) Sound.play(SND.sign);
      if (a.s >= 16) {
        a.y += 0x60;
        if (TOUCH(a.x, a.y) || TOUCH(a.x + 2, a.y)) HURT();
        if (SHOT(a.y - 0x40, a.x) || SHOT(a.y - 0x40, a.x + 2)) {
          DEBRIS(a.y, a.x + 1); SMOKE(a.y, a.x + 1); EXPLODE(a.y, a.x + 1, 1);
          SCORE(500, a.y, a.x + 1);
          a.dead = 1;
        }
      }
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) {
    for (const a of this.list) {
      const shake = a.s >= 2 && a.s <= 14 && (a.s & 1) ? 1 : 0;
      const [x, y] = apos(a, k);
      drawTile(g, 'OBJECT1:33', x, y + shake);
      drawTile(g, 'OBJECT1:34', x + 16, y + shake);
    }
  },
});

// ---------- 302B reactor (5.16) ----------

const REACTOR_SCRIPT = {
  2: [['E', -1, 0]], 8: [['E', -2, -0x80]], 10: [['E', 1, 0x100]],
  13: [['E', 0, 0x80], ['E', -1, 0x180], ['E', 0, -0x180], ['F', 2, 0], ['F', 0, 0x80]],
  15: [['E', 2, -0x80]],
  17: [['E', 1, 0x100], ['E', 2, 0], ['E', -3, -0x100], ['D', -1, 0]],
  18: [['D', 3, -0x100], ['E', 1, 0x100]],
  23: [['R', 0, 0x40], ['R', -1, -0x40], ['F', 0, 0x80], ['D', 2, 0], ['D', -1, 0x180], ['E', -1, 0x180], ['F', 0, -0x180], ['F', 2, -0x80], ['E', 1, 0x100]],
  24: [['D', 1, 0x80], ['D', -2, -0x100], ['E', 2, 0], ['F', -3, -0x100], ['D', -1, 0], ['D', 3, -0x100], ['E', -1, 0], ['F', -2, -0x80], ['E', 1, 0x100]],
  29: [['R', 3, -0x80], ['R', 2, 0x100], ['E', 0, 0x80], ['D', 2, 0], ['D', -1, 0x180], ['F', -1, 0x180], ['E', 0, -0x180], ['F', 2, -0x80], ['E', 1, 0x100]],
  31: [['R', -2, -0x180], ['D', 1, 0x80], ['D', 0, 0], ['F', 2, 0], ['F', -3, -0x100], ['D', -1, 0], ['D', 3, -0x100], ['E', -1, 0], ['E', -2, -0x80], ['F', 1, 0x100]],
};

defType([0x302b], {
  n: 0,
  spawn(col, row) {
    if (this.list.length) return null;
    return { x: 2 * col + 2, y: row << 7, seq: 1, hp: 10, gone: 0, flash: 0 };
  },
  fieldsOff() { for (const f of TYPES[0x301a].list) f.on = 0; },
  update() {
    this.n = (this.n + 1) % 5;
    for (const a of this.list) {
      a.flash = 0;
      if (OFF(a.y, a.x)) {
        if (a.seq >= 2) { a.seq = 0; this.fieldsOff(); }
        continue;
      }
      if (a.gone && a.seq === 0) continue;
      if (!a.gone) {
        for (const dy of [0, -0x80, -0x100]) {
          if (SHOT(a.y + dy, a.x)) {
            a.hp--;
            DEBRIS(a.y + dy, a.x);
            a.flash = 1;
            Sound.play(SND.boxExplode);
            if (a.hp <= 0) { a.gone = 1; a.seq = 1; }
          }
        }
      }
      if (!a.gone) {
        Sound.play(SND.reactor);
        if (TOUCH(a.x, a.y - 0x40) && G.health > 0) killDuke();
        continue;
      }
      a.seq++;
      if (phase() === 0) SMOKE(a.y, a.x - 1);
      if (phase() === 0x40) SMOKE(a.y, a.x + 1);
      if (a.seq >= 0x20) {
        a.seq = 0;
        this.fieldsOff();
        SCORE(20000, a.y - 0x80, a.x);
        Sound.play(SND.hitReactor);
        G.shake = 6;
      } else if (phase() !== 0 && REACTOR_SCRIPT[a.seq]) {
        for (const [t, dx, dy] of REACTOR_SCRIPT[a.seq]) {
          if (t === 'E') EXPLODE(a.y + dy, a.x + dx, 1);
          else if (t === 'F') EXPLODE(a.y + dy, a.x + dx, 3);
          else if (t === 'D') DEBRIS(a.y + dy, a.x + dx);
          else RUBBLE(a.y + dy, a.x + dx);
        }
        G.shake = 3;
      }
    }
  },
  draw(g, k) {
    for (const a of this.list) {
      if (a.gone && a.seq === 0) { for (let i = 0; i < 3; i++) tileA(g, 'OBJECT1:40', a, k, 0, -i); continue; }
      const key = a.flash ? 'ANIM5:15' : 'OBJECT1:' + (a.gone ? 40 : 40 + this.n);
      for (let i = 0; i < 3; i++) tileA(g, key, a, k, 0, -i);
      if (!a.gone) {
        const [x, y] = apos(a, k);
        g.globalCompositeOperation = 'lighter';
        glow(g, x + 8, y - 8, 30 + Math.sin(G.anim * 0.7) * 4, 'rgba(80, 220, 255, A)', 0.35);
        g.globalCompositeOperation = 'source-over';
      }
    }
  },
});

// ---------- 302C spike that pokes up, 3058 / 3059 fixed spikes (5.17, 5.18) ----------

defType([0x302c], {
  bg: { 0x302c: 'above' },
  spawn(col, row) { return { x: 2 * col + 2, y: row << 7, up: 0 }; },
  update() {
    for (const a of this.list) {
      a.up = 0;
      if (OFF(a.y, a.x)) continue;
      if (TOUCH(a.x, a.y)) { a.up = 1; HURT(); }
    }
  },
  draw(g, k) { for (const a of this.list) tileA(g, 'OBJECT1:' + (a.up ? 46 : 45), a, k); },
});

defType([0x3058, 0x3059], {
  bg: { 0x3058: 'above', 0x3059: 'below' },
  spawn(col, row, code) { return { x: 2 * col + 2, y: row << 7, up: code === 0x3058 }; },
  update() {
    for (const a of this.list) if (!OFF(a.y, a.x) && TOUCH(a.x, a.y)) HURT();
  },
  draw(g, k) { for (const a of this.list) tileA(g, 'OBJECT2:' + (a.up ? 48 : 49), a, k); },
});

// ---------- 3031 bouncing bomb, 3057 stationary bomb (5.19, 5.20) ----------

const BOUNCE = [128, 96, 64, 32, 8, 4, 1, -1, -4, -8, -32, -64, -96, -128];
defType([0x3031], {
  spawn(col, row) { return { p: -6, x: 2 * col + 2, y: row << 7 }; },
  update() {
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      a.y -= BOUNCE[a.p + 6];
      a.p++;
      if (a.p >= 8) { a.p = -6; Sound.play(SND.mine); }
      if (TOUCH(a.x, a.y)) HURT();
      SHOT(a.y, a.x);
    }
  },
  draw(g, k) { for (const a of this.list) tileA(g, 'ANIM4:31', a, k); },
});

defType([0x3057], {
  spawn(col, row) { return { x: 2 * col + 2, y: row << 7 }; },
  update() {
    for (const a of this.list) {
      if (OFF(a.y, a.x)) continue;
      if (!SOLID(a.x, a.y + 0x80)) a.y += 0x40;
      if (TOUCH(a.x, a.y)) {
        a.dead = 1;
        HURT();
        EXPLODE(a.y, a.x, 2);
        Sound.play(SND.bomb);
        G.shake = 4;
      }
    }
    this.list = this.list.filter((a) => !a.dead);
  },
  draw(g, k) { for (const a of this.list) tileA(g, 'ANIM4:31', a, k); },
});

// ---------- 303C fire monster (5.21) ----------

defType([0x303c], {
  c700: 0,
  spawn(col, row) { return { s: 1, x: 2 * col + 2, y: row << 7 }; },
  update() {
    if (phase() === 0 || phase() === 0x40) this.c700 = (this.c700 + 1) % 3;
    for (const a of this.list) {
      if (!SOLID(a.x, a.y + 0x80)) a.y += 0x40;
      if (WALL(a.x - 1, a.y) || !SOLID(a.x - 2, a.y + 0x80)) a.s = 2;
      if (WALL(a.x + 2, a.y) || !SOLID(a.x + 2, a.y + 0x80)) a.s = 1;
      if (phase() === 0 || phase() === 0x40) a.x += a.s === 1 ? -1 : 1;
      SHOT(a.y, a.x);
      if (TOUCH(a.x, a.y)) HURT();
    }
  },
  draw(g, k) {
    for (const a of this.list) {
      const f = (a.s === 1 ? 0 : 3) + this.c700;
      tileA(g, 'ANIM5:' + (2 * f), a, k, 0, -1);
      tileA(g, 'ANIM5:' + (2 * f + 1), a, k, 0, 0);
      const [x, y] = apos(a, k);
      g.globalCompositeOperation = 'lighter';
      glow(g, x + 8, y, 20, 'rgba(255, 120, 40, A)', 0.45);
      g.globalCompositeOperation = 'source-over';
    }
  },
});

// ---------- 3042 / 3043 Dr. Proton (5.22) ----------

const HOP = [128, 92, 64, 32, 16, 8, -8, -16, -32, -64, -92, -128];
defType([0x3042, 0x3043], {
  spawn(col, row, code) {
    if (this.list.length) return null;
    return { x: 2 * col + 2, y: row << 7, mode: 1, escapes: code === 0x3043, hp: 10, wait: 0, waitLen: 10, step: 0, hopping: 0, hdir: 1, tog: 0, t5002: 0, crashed: 0 };
  },
  update() {
    for (const a of this.list) {
      if (a.crashed) { a.crashed++; if (a.crashed === 10) G.endGame = 1; continue; }
      a.tog ^= 1;
      const D = DX();
      if (a.mode === 1) {
        if (!a.hopping) {
          a.wait++;
          if (a.wait === a.waitLen) {
            if (D - 2 < a.x) BULLET(a.y - 0x20, a.x, 1);
            else BULLET(a.y - 0x20, a.x + 3, 2);
          }
          if (a.wait > a.waitLen) { a.wait = 0; a.step = 0; a.hopping = 1; a.hdir = D - 2 < a.x ? 1 : 0; }
        } else {
          a.y += HOP[a.step];
          if (a.hdir === 1 && !WALL(a.x - 1, a.y - 0x40)) a.x--;
          if (a.hdir === 0 && !WALL(a.x + 3, a.y - 0x40)) a.x++;
          a.step++;
          if (a.step >= 12) { a.hopping = 0; a.waitLen = phase() + 1; }
        }
        if (TOUCH(a.x, a.y)) HURT();
        if (SHOT(a.y - 0x40, a.x + 1)) { EXPLODE(a.y - 0x5c, a.x + 2, 3); a.hp--; Sound.play(SND.smallDeath); }
        if (phase() !== 0) {
          if (a.hp < 10) SMOKE(a.y - 0x20, a.x + 2);
          if (a.hp < 6) SMOKE(a.y - 0x40, a.x + 1);
          if (a.hp < 2) SMOKE(a.y - 0x40, a.x + 3);
        }
        if (a.hp === 1 && a.escapes) a.mode = 0;
        if (a.hp <= 0 && !a.escapes) a.mode = 2;
      } else if (a.mode === 0) {
        if (!a.t5002 && !OFF(a.y, a.x)) {
          a.t5002 = 1;
          Sound.play(SND.badGoUp);
          G.cutscene = 1;
          for (const kk of ['up', 'down', 'left', 'right', 'jump', 'fire']) keys[kk] = false;
        } else if (a.t5002) {
          a.t5002++;
          if (a.y > 0x100 && G.camRow > 2) { a.y -= 0x80; G.camRow--; G.y += 16; }
          if (a.t5002 > 0x1e) G.endGame = 1;
        }
      } else if (a.mode === 2) {
        a.y += 0x20;
        const p = phase();
        if (p === 0) DEBRIS(a.y, a.x + 2);
        else if (p === 0x20) EXPLODE(a.y, a.x + 2, 1);
        else if (p === 0x40) DEBRIS(a.y, a.x);
        else EXPLODE(a.y, a.x + 2, 3);
        if (SOLID(a.x + 1, a.y)) { Sound.play(SND.badDead); a.crashed = 1; }
      }
    }
  },
  draw(g, k) {
    for (const a of this.list) {
      const f = (DX() - 2 < a.x ? 0 : 2) + a.tog;
      tileA(g, 'ANIM5:' + (f < 2 ? 30 : 36), a, k, 0, -1);
      tileA(g, 'ANIM5:' + (f < 2 ? 31 : 37), a, k, 2, -1);
      const bottom = [[32, 33], [34, 35], [38, 39], [40, 41]][f];
      tileA(g, 'ANIM5:' + bottom[0], a, k, 0, 0);
      tileA(g, 'ANIM5:' + bottom[1], a, k, 2, 0);
      if (a.mode === 0 && a.t5002) {
        const [x, y] = apos(a, k);
        g.globalCompositeOperation = 'lighter';
        glow(g, x + 16, y + 18, 22, 'rgba(255, 170, 60, A)', 0.8);
        g.globalCompositeOperation = 'source-over';
      }
    }
  },
});

// ---------- the actor layer ----------

const Actors = {
  explosions: [],
  bullets: [],
  flags: {},
  drop: 'DROP0',

  load() {
    for (const t of typeOrder) t.list = [];
    typeOrder.length = 0;
    for (const c in TYPES) TYPES[c].list = [];
    this.explosions = [];
    this.bullets = [];
    this.flags = {};
    if ((typeof Items !== "undefined")) Items.reset();
    let start = null;
    const after = [];
    const m = G.map;
    // first pass: which word each active code turns into (decided from the original neighbours)
    for (let r = 0; r < MH; r++) {
      for (let c = 0; c < MW; c++) {
        const w = m[r * MW + c];
        if (w < 0x3000 || w > 0x3059) continue;
        if (w === 0x3032) { start = [c, r]; }
        const t = TYPES[w];
        const bg = (t && t.bg && t.bg[w]) || (t && t.bgAll) || 'left';
        let nb;
        if (bg === 'right') nb = m[r * MW + c + 1];
        else if (bg === 'above') nb = m[(r - 1) * MW + c];
        else if (bg === 'below') nb = m[(r + 1) * MW + c];
        else nb = c > 0 ? m[r * MW + c - 1] : 0;
        if (nb >= 0x3000) nb = 0;
        m[r * MW + c] = nb;
        if (t) {
          const a = t.spawn(c, r, w);
          if (a) {
            a.code = w;
            t.list.push(a);
            if (!typeOrder.includes(t)) typeOrder.push(t);
            if (t.after) after.push([t, a]);
          }
        }
      }
    }
    for (const [t, a] of after) t.after(a);
    if (start) placeStart(start[0], start[1]);
    this.drop = LEVEL_DROPS[G.level] || ['DROP3', 'DROP3'];
  },

  // things that stop Duke like walls (closed doors, the elevator)
  blocks(col, row) { return (typeof Items !== "undefined") ? Items.blocks(col, row) : false; },
  standOn() { return (typeof Items !== "undefined") ? Items.standOn() : false; },

  // run from inside Duke's update: cameras, notes, the door, the Proton screen
  singles() {
    for (const t of typeOrder) if (t.single) t.update();
    if ((typeof Items !== "undefined")) Items.singles();
  },

  update() {
    this.updateBullets();
    for (const t of typeOrder) if (!t.single) t.update();
    this.updateExplosions();
  },

  updateBullets() {
    for (const b of this.bullets) {
      b.px = b.x; b.py = b.y;
      if (TOUCH(b.x, b.y)) {
        if (!G.hurt && !G.invul) {
          if (b.dir === 1 && canLeft()) G.x--;
          if (b.dir === 2 && canRight()) G.x++;
        }
        HURT();
        b.dead = 1;
        continue;
      }
      b.x += b.dir === 1 ? -1 : 1;
      if (b.first) b.first = 0;
      const wx = b.dir === 1 ? b.x : b.x + 1;
      if (WALL(wx, b.y) || WALL(wx, b.y + 0x40) || OFF(b.y, b.x)) b.dead = 1;
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  },

  updateExplosions() {
    for (const e of this.explosions) {
      if (OFF(e.y, e.x)) { e.dead = 1; continue; }
      if (e.kind === 2 && TOUCH(e.x, e.y)) HURT();
      e.t++;
      if ((e.kind === 3 && e.t >= 5) || e.t >= 8) e.dead = 1;
    }
    this.explosions = this.explosions.filter((e) => !e.dead);
  },

  savePrev() {
    for (const t of typeOrder) for (const a of t.list) { a.px = a.x; a.py = a.y; }
    for (const b of this.bullets) { b.px = b.x; b.py = b.y; }
    if ((typeof Items !== "undefined")) Items.savePrev();
  },

  // the things the original draws before Duke (decorations, cameras, doors, screens, machines)
  drawBack(g, k) {
    for (const t of typeOrder) if (t.single) t.draw(g, k);
  },
  // and the ones its handlers draw after him
  draw(g, k) {
    for (const t of typeOrder) if (!t.single) t.draw(g, k);
  },

  drawFront(g, k) {
    for (const b of this.bullets) {
      const x = (b.px === undefined ? b.x : b.px + (b.x - b.px) * k) * 8 - 16, y = b.y / 8 + 3;
      g.globalCompositeOperation = 'lighter';
      glow(g, x + 8, y + 8, 10, 'rgba(255, 90, 60, A)', 0.6);
      g.globalCompositeOperation = 'source-over';
      const key = b.first ? (b.dir === 1 ? 'OBJECT0:48' : 'OBJECT0:49') : 'OBJECT0:' + ((b.dir === 1 ? 39 : 41) + (G.frame & 1));
      drawTile(g, key, x, y);
    }
    for (const e of this.explosions) {
      const x = e.x * 8 - 16, y = e.y / 8;
      if (e.kind === 3) {
        if (e.t === 2) drawTile(g, 'ANIM4:15', x, y);
        if (e.t === 4) {
          drawTile(g, 'ANIM4:16', x - 8, y - 8); drawTile(g, 'ANIM4:17', x + 8, y - 8);
          drawTile(g, 'ANIM4:18', x - 8, y + 8); drawTile(g, 'ANIM4:19', x + 8, y + 8);
        }
        continue;
      }
      g.globalCompositeOperation = 'lighter';
      glow(g, x + 8, y + 8, 22, e.kind === 2 ? 'rgba(255, 90, 30, A)' : 'rgba(255, 170, 60, A)', 0.7 * (1 - (e.t - 1) / 7));
      g.globalCompositeOperation = 'source-over';
      drawTile(g, (e.kind === 2 ? 'ANIM1:' : 'ANIM0:') + (40 + Math.min(7, e.t)), x, y);
    }
  },

  bonuses() {
    const out = [];
    const f = this.flags;
    if (G.noDamage) out.push('Bonus 2: no damage taken');
    if (f.hasCameras && TYPES[0x3024].list.length === 0) out.push('Bonus 1: every camera destroyed');
    if (TYPES[0x302a].list.length === 0 && f.hadSigns) out.push('Bonus 3: every ACME sign down');
    if (f.bonus4) out.push('Bonus 4');
    if (f.duke) out.push('Bonus 5: D, U, K, E in order');
    if (f.orbs) out.push('Bonus 6: the whole orb monster');
    if (f.rabbits) out.push('Bonus 7');
    return out;
  },

  backdrop() { return this.drop[0]; },
  backdrop2() { return this.drop[1]; },
  flasher(t, p) { return (typeof Items !== "undefined") ? Items.flasher(t, p) : t; },
};

// Backdrops per level index, from the table at DS:0xb47 (filled in from items.md).
const LEVEL_DROPS = {};

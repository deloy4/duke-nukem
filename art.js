// Art for the rebuild. Level tiles and sprites come from atlas.png, the original 16 x 16 EGA tiles
// remastered at 4x by tools/remaster.py. The backdrops behind the levels are painted here with canvas
// paths, one for each of the original's backdrop pictures, and tile horizontally.

const TS = 16;            // the original tile, in game pixels
const AS = 64;            // the same tile in the atlas

let atlasImg = null;
const PICS = {};   // remastered full-screen pictures: duke, proton, city (tools/portraits.py)
function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}
function loadAtlas() {
  for (const n of ['duke', 'proton', 'city']) loadImage(n + '.png').then((im) => { PICS[n] = im; }, () => {});
  return loadImage('atlas.png').then((im) => { atlasImg = im; });
}

// Tiles are drawn on whole device pixels so neighbours meet without seams. SNAP holds the device
// scale and the view offset the caller translated by.
const SNAP = { s: 1, ox: 0, oy: 0 };
const snapX = (x) => Math.round((x - SNAP.ox) * SNAP.s) / SNAP.s + SNAP.ox;
const snapY = (y) => Math.round((y - SNAP.oy) * SNAP.s) / SNAP.s + SNAP.oy;

// Draw atlas tile `key` ("ANIM0:12") with its top-left at game pixel (x, y). flip mirrors it.
function drawTile(g, key, x, y, flip = false, alpha = 1) {
  const k = ATLAS.tiles[key];
  if (k === undefined) return;
  const sx = (k % ATLAS.cols) * ATLAS.cell + 1, sy = Math.floor(k / ATLAS.cols) * ATLAS.cell + 1;
  const x0 = snapX(x), y0 = snapY(y), w = snapX(x + TS) - x0, h = snapY(y + TS) - y0;
  if (alpha !== 1) g.globalAlpha = alpha;
  if (flip) {
    g.save();
    g.translate(x0 + w, y0);
    g.scale(-1, 1);
    g.drawImage(atlasImg, sx, sy, AS, AS, 0, 0, w, h);
    g.restore();
  } else {
    g.drawImage(atlasImg, sx, sy, AS, AS, x0, y0, w, h);
  }
  if (alpha !== 1) g.globalAlpha = 1;
}

// The static map tiles: word / 32 picks one of 384 tiles from BACK0-3 then SOLID0-3, 48 per file.
const STATIC_FILES = ['BACK0', 'BACK1', 'BACK2', 'BACK3', 'SOLID0', 'SOLID1', 'SOLID2', 'SOLID3'];
function staticKey(i) {
  return STATIC_FILES[Math.floor(i / 48)] + ':' + (i % 48);
}

// Small deterministic hash so painted detail doesn't shimmer between redraws.
function hash(x, y, k = 0) {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function grad(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
}

// ---------- backdrops ----------
// Each painter fills a W x H canvas (game pixels x 4) that repeats left to right.

const BD_W = 208 * 4, BD_H = 160 * 4;

function stars(g, W, H, n, seed, maxY = 1) {
  for (let i = 0; i < n; i++) {
    const x = hash(i, seed) * W, y = hash(i, seed + 1) * H * maxY;
    const r = 0.6 + hash(i, seed + 2) ** 3 * 2.4;
    g.fillStyle = `rgba(${200 + hash(i, seed + 3) * 55 | 0}, ${210 + hash(i, seed + 4) * 45 | 0}, 255, ${0.35 + hash(i, seed + 5) * 0.65})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (r > 2.2) {
      g.strokeStyle = 'rgba(190, 220, 255, 0.5)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(x - r * 3, y); g.lineTo(x + r * 3, y);
      g.moveTo(x, y - r * 3); g.lineTo(x, y + r * 3);
      g.stroke();
    }
  }
}

function skyline(g, W, base, seed, minH, maxH, body, lit, step = 26) {
  let x = -10;
  let i = 0;
  while (x < W + 10) {
    const w = step * (0.6 + hash(i, seed) * 1.2);
    const h = minH + hash(i, seed + 1) * (maxH - minH);
    g.fillStyle = body;
    g.fillRect(x, base - h, w, h + 400);
    // antenna or stepped top on some
    if (hash(i, seed + 2) < 0.3) g.fillRect(x + w / 2 - 1.5, base - h - 24, 3, 24);
    if (hash(i, seed + 3) < 0.35) g.fillRect(x + w * 0.2, base - h - 12, w * 0.6, 12);
    // lit windows
    for (let wy = base - h + 8; wy < base - 6; wy += 9) {
      for (let wx = x + 4; wx < x + w - 6; wx += 7) {
        const r = hash(wx | 0, wy | 0, seed);
        if (r < 0.32) {
          g.fillStyle = r < 0.05 ? '#ffe7a8' : lit;
          g.fillRect(wx, wy, 3.5, 4.5);
        }
      }
    }
    x += w + 2;
    i++;
  }
}

const BACKDROPS = {
  // DROP0: the city across the bay at night, a road along the shore
  city(g, W, H) {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#050818'], [0.45, '#14204a'], [0.62, '#2b2a5c'], [1, '#0a1030']]);
    g.fillRect(0, 0, W, H);
    stars(g, W, H, 220, 11, 0.45);
    // milky band
    g.fillStyle = 'rgba(140, 170, 255, 0.06)';
    g.beginPath();
    g.ellipse(W * 0.5, H * 0.18, W * 0.7, 30, -0.08, 0, Math.PI * 2);
    g.fill();
    skyline(g, W, H * 0.6, 3, 40, 120, '#16365a', 'rgba(110, 230, 255, 0.55)', 30);
    skyline(g, W, H * 0.6, 7, 20, 80, '#0f2340', 'rgba(255, 210, 120, 0.6)', 22);
    // water
    g.fillStyle = grad(g, 0, H * 0.6, 0, H * 0.86, [[0, '#0f2a78'], [1, '#081440']]);
    g.fillRect(0, H * 0.6, W, H * 0.26);
    for (let i = 0; i < 90; i++) {
      const x = hash(i, 21) * W, y = H * 0.61 + hash(i, 22) * H * 0.24;
      g.fillStyle = `rgba(120, 220, 255, ${0.08 + hash(i, 23) * 0.2})`;
      g.fillRect(x, y, 10 + hash(i, 24) * 40, 1.5);
    }
    // shore road and lamps
    g.fillStyle = '#3a2412';
    g.fillRect(0, H * 0.86, W, H * 0.14);
    g.fillStyle = '#5b3a1c';
    g.fillRect(0, H * 0.86, W, 6);
    g.fillStyle = '#1b1b22';
    g.fillRect(0, H * 0.9, W, 18);
    for (let x = 30; x < W; x += 210) {
      g.fillStyle = '#9aa4b2';
      g.fillRect(x, H * 0.8, 3, H * 0.1);
      g.fillRect(x, H * 0.8, 16, 3);
      const l = g.createRadialGradient(x + 16, H * 0.8 + 4, 0, x + 16, H * 0.8 + 4, 40);
      l.addColorStop(0, 'rgba(255, 230, 160, 0.7)');
      l.addColorStop(1, 'rgba(255, 230, 160, 0)');
      g.fillStyle = l;
      g.fillRect(x - 30, H * 0.8 - 40, 92, 90);
    }
  },
  // DROP1: a red-veined cavern under a glass-domed city
  cave(g, W, H) {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#120c10'], [1, '#2a1214']]);
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      const x = hash(i, 31) * W, y = hash(i, 32) * H;
      g.strokeStyle = `rgba(255, ${60 + hash(i, 33) * 60 | 0}, 60, ${0.15 + hash(i, 34) * 0.35})`;
      g.lineWidth = 1 + hash(i, 35) * 2;
      g.beginPath();
      g.moveTo(x, y);
      let px = x, py = y;
      for (let k = 0; k < 5; k++) {
        px += (hash(i, 40 + k) - 0.5) * 60;
        py += hash(i, 50 + k) * 30;
        g.lineTo(px, py);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, W, H);
  },
  // DROP2: the reactor hall, a glowing core on a blue grid floor
  lab(g, W, H) {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#06070c'], [0.55, '#10142a'], [0.56, '#1a2a9a'], [1, '#0b1550']]);
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(120, 160, 255, 0.45)';
    g.lineWidth = 1.5;
    const hy = H * 0.56;
    for (let i = -20; i <= 20; i++) {
      g.beginPath();
      g.moveTo(W / 2 + i * 14, hy);
      g.lineTo(W / 2 + i * 120, H);
      g.stroke();
    }
    for (let k = 0; k < 9; k++) {
      const y = hy + (H - hy) * (k / 9) ** 1.8;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    // wall panels
    g.strokeStyle = 'rgba(160, 170, 200, 0.18)';
    for (let x = 0; x < W; x += 104) { g.strokeRect(x + 4, 20, 96, hy - 40); }
    g.fillStyle = '#c8a020';
    for (let x = 0; x < W; x += 40) { g.fillRect(x, hy - 16, 20, 6); }
    // the core
    const cx = W / 2, cy = H * 0.42;
    const halo = g.createRadialGradient(cx, cy, 10, cx, cy, 220);
    halo.addColorStop(0, 'rgba(160, 120, 255, 0.55)');
    halo.addColorStop(1, 'rgba(160, 120, 255, 0)');
    g.fillStyle = halo;
    g.fillRect(cx - 240, cy - 240, 480, 480);
    const rods = ['#ff4a8a', '#58e0ff', '#ffe066', '#9a6bff', '#5aff9a'];
    rods.forEach((c, i) => {
      const x = cx - 40 + i * 20;
      g.fillStyle = grad(g, x, 0, x + 10, 0, [[0, c], [0.5, '#ffffff'], [1, c]]);
      g.fillRect(x, cy - 150 + Math.abs(i - 2) * 30, 10, 170 - Math.abs(i - 2) * 30);
    });
    g.fillStyle = grad(g, cx - 70, 0, cx + 70, 0, [[0, '#5a6070'], [0.5, '#d8dee8'], [1, '#5a6070']]);
    g.fillRect(cx - 70, cy + 20, 140, 26);
    g.fillRect(cx - 40, cy + 46, 80, hy - cy - 30);
  },
  // DROP3: deep space with nothing but faint stars
  dark(g, W, H) {
    g.fillStyle = '#04050a';
    g.fillRect(0, 0, W, H);
    stars(g, W, H, 90, 61);
  },
  // DROP5: teal mountains over a city at dusk
  mountains(g, W, H) {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#030616'], [0.5, '#0e1838'], [1, '#1a1a2a']]);
    g.fillRect(0, 0, W, H);
    stars(g, W, H, 160, 71, 0.5);
    const ridge = (base, amp, seed, c1, c2) => {
      g.fillStyle = grad(g, 0, base - amp, 0, base + 60, [[0, c1], [1, c2]]);
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const t = x / W * Math.PI * 2;
        const y = base - amp * (0.5 + 0.3 * Math.sin(t * 2 + seed) + 0.2 * Math.sin(t * 5 + seed * 2) + 0.08 * Math.sin(t * 13 + seed));
        g.lineTo(x, y);
      }
      g.lineTo(W, H);
      g.fill();
    };
    ridge(H * 0.62, 190, 1.3, '#4ad6c8', '#0f5a5c');
    ridge(H * 0.7, 110, 4.1, '#2a8a86', '#0b3438');
    ridge(H * 0.78, 50, 2.2, '#9a5a2a', '#4a2410');
    skyline(g, W, H, 9, 30, 110, '#1a2430', 'rgba(120, 240, 230, 0.5)', 18);
  },
  // DROP7: the open starfield with a pale band of the galaxy
  stars(g, W, H) {
    g.fillStyle = grad(g, 0, 0, W, H, [[0, '#02030c'], [1, '#070b22']]);
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(-0.55);
    const band = g.createLinearGradient(0, -80, 0, 80);
    band.addColorStop(0, 'rgba(90, 120, 255, 0)');
    band.addColorStop(0.5, 'rgba(110, 140, 255, 0.16)');
    band.addColorStop(1, 'rgba(90, 120, 255, 0)');
    g.fillStyle = band;
    g.fillRect(-W, -80, W * 2, 160);
    g.restore();
    stars(g, W, H, 420, 81);
  },
  // DROP9: grey moon rocks under a blue earth
  moon(g, W, H) {
    g.fillStyle = '#03040a';
    g.fillRect(0, 0, W, H);
    stars(g, W, H, 150, 91, 0.6);
    const ex = W * 0.2, ey = H * 0.2;
    g.fillStyle = grad(g, ex - 60, ey - 60, ex + 60, ey + 60, [[0, '#7ac0ff'], [0.6, '#1a50c0'], [1, '#081a50']]);
    g.beginPath(); g.arc(ex, ey, 60, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(80, 200, 100, 0.8)';
    g.beginPath(); g.ellipse(ex - 15, ey - 10, 22, 14, 0.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = grad(g, 0, H * 0.4, 0, H, [[0, '#8a8e9a'], [1, '#3a3e48']]);
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) g.lineTo(x, H * 0.55 - Math.sin(x / W * Math.PI * 4) * 70 - hash(x, 9) * 12);
    g.lineTo(W, H);
    g.fill();
  },
  // DROP11: a hangar bay with a parked shuttle
  hangar(g, W, H) {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#0e3438'], [0.6, '#145058'], [0.61, '#5a6068'], [1, '#8a9098']]);
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < W; x += 52) g.fillRect(x, 0, 4, H * 0.6);
    g.fillStyle = '#e8c020';
    for (let x = 0; x < W; x += 30) g.fillRect(x, H * 0.6, 15, 6);
  },
  // DROP13: daytime sky with clouds and flying saucers
  sky(g, W, H) {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#3a5ad8'], [1, '#9ab8ff']]);
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) {
      const x = hash(i, 131) * W, y = hash(i, 132) * H, s = 20 + hash(i, 133) * 40;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.arc(x + (k - 2) * s * 0.7, y + Math.abs(k - 2) * s * 0.15, s * (0.7 - Math.abs(k - 2) * 0.12), 0, Math.PI * 2);
        g.fill();
      }
    }
  },

  // ----- Episode Two (new): the Moon -----
  // lunar: a black sky, one Earth, two ridges of crater rims; painted twice as wide so the Earth shows once
  lunar(g, W, H) {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#010208'], [0.7, '#060a1c'], [1, '#0c1024']]);
    g.fillRect(0, 0, W, H);
    stars(g, W, H, 380, 141, 0.7);
    const ex = W * 0.2, ey = H * 0.22, er = 70;
    const halo = g.createRadialGradient(ex, ey, er * 0.9, ex, ey, er * 1.5);
    halo.addColorStop(0, 'rgba(90, 160, 255, 0.35)');
    halo.addColorStop(1, 'rgba(90, 160, 255, 0)');
    g.fillStyle = halo;
    g.fillRect(ex - er * 2, ey - er * 2, er * 4, er * 4);
    g.save();
    g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.clip();
    g.fillStyle = grad(g, ex - er, ey - er, ex + er, ey + er, [[0, '#6ab8ff'], [0.55, '#1c58c8'], [1, '#06143c']]);
    g.fillRect(ex - er, ey - er, er * 2, er * 2);
    g.fillStyle = 'rgba(70, 170, 90, 0.85)';
    for (const [dx, dy, rx, ry, a] of [[-22, -14, 26, 16, 0.6], [18, 12, 18, 26, -0.3], [-8, 30, 14, 9, 0.2]]) {
      g.beginPath(); g.ellipse(ex + dx, ey + dy, rx, ry, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.ellipse(ex - er + hash(i, 151) * er * 2, ey - er + hash(i, 152) * er * 2, 14 + hash(i, 153) * 18, 3, hash(i, 154) - 0.5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(0, 0, 20, 0.55)';
    g.beginPath(); g.arc(ex + er * 0.45, ey + er * 0.35, er * 1.05, 0, Math.PI * 2); g.fill();
    g.restore();
    const ridge = (base, amp, seed, top, bottom) => {
      g.fillStyle = grad(g, 0, base - amp, 0, H, [[0, top], [1, bottom]]);
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) {
        const t = x / W * Math.PI * 2;
        g.lineTo(x, base - amp * (0.55 + 0.25 * Math.sin(t * 2 + seed) + 0.15 * Math.sin(t * 7 + seed * 3) + 0.05 * Math.sin(t * 19 + seed)));
      }
      g.lineTo(W, H);
      g.fill();
    };
    ridge(H * 0.66, 90, 0.7, '#8e94a4', '#3c404c');
    // craters on the far plain
    for (let i = 0; i < 14; i++) {
      const x = hash(i, 161) * W, y = H * 0.72 + hash(i, 162) * H * 0.08, r = 10 + hash(i, 163) * 34;
      g.fillStyle = 'rgba(30, 32, 40, 0.45)';
      g.beginPath(); g.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(210, 215, 230, 0.35)';
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y + 1, r, r * 0.28, 0, 0.1, Math.PI - 0.1); g.stroke();
    }
    ridge(H * 0.86, 60, 2.4, '#5c606c', '#1c1e26');
  },
  // dome: a greenhouse under a glass dome, rows of plants under purple grow lamps
  dome(g, W, H) {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#020610'], [0.6, '#0a1a24'], [1, '#0a2a1c']]);
    g.fillRect(0, 0, W, H);
    stars(g, W, H, 140, 171, 0.5);
    g.strokeStyle = 'rgba(160, 220, 255, 0.22)';
    g.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.ellipse(W / 2, H * 0.95, W * 0.12 * Math.abs(i) + 6, H * 0.9, 0, Math.PI, 0);
      g.stroke();
    }
    for (let k = 1; k < 5; k++) {
      g.beginPath(); g.ellipse(W / 2, H * 0.95, W * 0.45, H * 0.9 * k / 5, 0, Math.PI, 0); g.stroke();
    }
    for (let row = 0; row < 3; row++) {
      const y = H * (0.62 + row * 0.12);
      g.fillStyle = '#2a1e16';
      g.fillRect(0, y, W, 10);
      for (let x = 6; x < W; x += 14) {
        const h = 14 + hash(x, row + 180) * 18;
        g.fillStyle = `rgb(${40 + hash(x, row + 181) * 40 | 0}, ${150 + hash(x, row + 182) * 90 | 0}, ${70 + hash(x, row + 183) * 40 | 0})`;
        g.beginPath(); g.ellipse(x, y - h / 2 + 2, 7, h / 2, 0, 0, Math.PI * 2); g.fill();
      }
      const l = g.createLinearGradient(0, y - 60, 0, y);
      l.addColorStop(0, 'rgba(200, 90, 255, 0)');
      l.addColorStop(1, 'rgba(200, 90, 255, 0.18)');
      g.fillStyle = l;
      g.fillRect(0, y - 60, W, 60);
    }
  },
  // crystal: a dark cavern of glowing blue crystals
  crystal(g, W, H) {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#06040e'], [1, '#120a26']]);
    g.fillRect(0, 0, W, H);
    const spike = (x, base, h, w, dir, c) => {
      g.fillStyle = grad(g, x - w, 0, x + w, 0, [[0, c[0]], [0.45, c[1]], [1, c[2]]]);
      g.beginPath(); g.moveTo(x - w, base); g.lineTo(x, base - h * dir); g.lineTo(x + w, base); g.fill();
    };
    for (let i = 0; i < 26; i++) {
      const x = hash(i, 191) * W, h = 60 + hash(i, 192) * 220, w = 12 + hash(i, 193) * 26;
      const far = hash(i, 194) < 0.5;
      const c = far ? ['#1a1440', '#3a3a8a', '#141030'] : ['#1a3a8a', '#6ad0ff', '#14286a'];
      spike(x, H, h * (far ? 0.7 : 1), w, 1, c);
      if (hash(i, 195) < 0.5) spike(x + 40, 0, h * 0.5, w * 0.8, -1, c);
    }
    for (let i = 0; i < 40; i++) {
      const x = hash(i, 196) * W, y = hash(i, 197) * H;
      const l = g.createRadialGradient(x, y, 0, x, y, 30);
      l.addColorStop(0, 'rgba(120, 220, 255, 0.18)');
      l.addColorStop(1, 'rgba(120, 220, 255, 0)');
      g.fillStyle = l;
      g.fillRect(x - 30, y - 30, 60, 60);
    }
  },
  // core: the reactor deck, glowing columns behind girders
  core(g, W, H) {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#0c0604'], [1, '#1e0c06']]);
    g.fillRect(0, 0, W, H);
    for (let x = 60; x < W; x += 200) {
      const l = g.createRadialGradient(x, H * 0.5, 0, x, H * 0.5, 160);
      l.addColorStop(0, 'rgba(255, 140, 40, 0.45)');
      l.addColorStop(1, 'rgba(255, 140, 40, 0)');
      g.fillStyle = l;
      g.fillRect(x - 160, 0, 320, H);
      g.fillStyle = grad(g, x - 18, 0, x + 18, 0, [[0, '#6a2a0a'], [0.5, '#ffd27a'], [1, '#6a2a0a']]);
      g.fillRect(x - 18, 0, 36, H);
      g.fillStyle = 'rgba(40, 20, 10, 0.8)';
      for (let y = 20; y < H; y += 70) g.fillRect(x - 24, y, 48, 8);
    }
    g.strokeStyle = 'rgba(120, 80, 60, 0.5)';
    g.lineWidth = 6;
    for (let y = 40; y < H; y += 150) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 0; x < W; x += 50) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 50, 190); g.stroke(); }
  },
};
const BACKDROP_WIDE = { lunar: 2 };   // painters drawn wider than one 208-px view

// Which painter stands in for each original backdrop file.
const DROP_PAINTER = { DROP0: 'city', DROP1: 'cave', DROP2: 'lab', DROP3: 'dark', DROP5: 'mountains', DROP7: 'stars', DROP9: 'moon', DROP11: 'hangar', DROP13: 'sky' };

const backdropCache = {};
function backdropCanvas(drop) {
  if (backdropCache[drop]) return backdropCache[drop];
  const c = document.createElement('canvas');
  const name = DROP_PAINTER[drop] || drop;
  c.width = BD_W * (BACKDROP_WIDE[name] || 1);
  c.height = BD_H;
  const g = c.getContext('2d');
  (BACKDROPS[name] || BACKDROPS.dark)(g, c.width, BD_H);
  backdropCache[drop] = c;
  return c;
}

// ---------- effects ----------

function glow(g, x, y, r, color, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color.replace('A', a));
  gr.addColorStop(1, color.replace('A', 0));
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

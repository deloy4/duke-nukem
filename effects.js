// Explosions, debris, sparks and the score numbers that float up. The original draws these from
// small tile animations; here they are particles with light, kept to the same places and timing.

const Effects = {
  list: [],
  clear() { this.list = []; },

  // a ring of flying pieces with a flash, for boxes, robots and Duke himself
  debris(x, y, kind = 'metal') {
    const colors = {
      metal: ['#c8d0dc', '#8a94a6', '#ffd94e', '#ff8a3a'],
      grey: ['#a8b1bd', '#6a7282', '#d8dee8'],
      duke: ['#ff5a52', '#ffd94e', '#f5f7fb', '#ff70d9'],
      red: ['#ff5a52', '#b51f2d', '#ffd94e'],
      green: ['#6fe07c', '#20994c', '#d8ffd0'],
      blue: ['#74f1ff', '#5d8dff', '#ffffff'],
    }[kind] || ['#ffffff'];
    this.list.push({ type: 'flash', x, y, t: 0, life: 4, r: 18 });
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5;
      this.list.push({
        type: 'bit', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, t: 0, life: 8 + Math.random() * 6,
        c: colors[i % colors.length], s: 1 + Math.random() * 2.2, rot: Math.random() * 6,
      });
    }
  },
  // the big burst of a destroyed enemy or bomb (the original's ANIM0 42-47 fireball)
  explode(x, y, big = false) {
    this.list.push({ type: 'fire', x, y, t: 0, life: 6, r: big ? 26 : 16 });
    this.debris(x, y, 'metal');
    if (big) G.shake = Math.max(G.shake, 3);
  },
  // small burst where a shot hits a wall
  spark(x, y) {
    this.list.push({ type: 'flash', x, y, t: 0, life: 2, r: 9 });
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2.5;
      this.list.push({ type: 'bit', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 3 + Math.random() * 3, c: '#ffe680', s: 1, rot: 0 });
    }
  },
  // score number floating up (NUMBERS.DN1 in the original)
  points(n, x, y) {
    this.list.push({ type: 'points', n, x, y, t: 0, life: 18 });
  },
  // rubble chunks that hop up and fall (ANIM3 2-11 in pairs), 0097:2fd9
  rubble(x, y) {
    this.list.push({ type: 'rubble', x, y, t: 0, life: 17, st: 1 });
  },
  smoke(x, y) {
    this.list.push({ type: 'smoke', x, y, t: 0, life: 10, r: 4 + Math.random() * 3, vx: (Math.random() - 0.5) * 0.6 });
  },

  update() {
    for (const e of this.list) {
      e.px = e.x; e.py = e.y;
      e.t++;
      if (e.type === 'bit') {
        e.x += e.vx; e.y += e.vy; e.vy += 1.1; e.vx *= 0.94; e.rot += 0.6;
      } else if (e.type === 'points') {
        e.y -= e.t < 12 ? 2 : 0.5;
      } else if (e.type === 'smoke') {
        e.y -= 1.2; e.x += e.vx; e.r += 0.6;
      } else if (e.type === 'rubble') {
        const T = [-64, -32, -16, -8, 0, 8, 16, 16, 32, 32, 32, 64, 64, 128, 128, 128];
        e.st++;
        e.y += (T[e.st - 2] || 128) / 8;
      }
    }
    this.list = this.list.filter((e) => e.t < e.life);
  },

  draw(g, k) {
    for (const e of this.list) {
      const x = e.px === undefined ? e.x : e.px + (e.x - e.px) * k;
      const y = e.py === undefined ? e.y : e.py + (e.y - e.py) * k;
      const f = (e.t + k) / e.life;
      if (e.type === 'flash') {
        g.globalCompositeOperation = 'lighter';
        glow(g, x, y, e.r * (1 + f), 'rgba(255, 220, 140, A)', 0.9 * (1 - f));
        g.globalCompositeOperation = 'source-over';
      } else if (e.type === 'fire') {
        g.globalCompositeOperation = 'lighter';
        glow(g, x, y, e.r * (0.6 + f), 'rgba(255, 150, 40, A)', 1 - f);
        glow(g, x, y, e.r * 0.5 * (1 - f * 0.5), 'rgba(255, 250, 200, A)', 1 - f);
        g.globalCompositeOperation = 'source-over';
        // the original fireball frames, ANIM0 42-47
        drawTile(g, 'ANIM0:' + Math.min(47, 42 + e.t), x - 8, y - 8, false, 0.9);
      } else if (e.type === 'bit') {
        g.save();
        g.translate(x, y);
        g.rotate(e.rot);
        g.globalAlpha = Math.min(1, (1 - f) * 2);
        g.fillStyle = e.c;
        g.fillRect(-e.s, -e.s * 0.6, e.s * 2, e.s * 1.2);
        g.restore();
      } else if (e.type === 'smoke') {
        g.fillStyle = `rgba(150, 150, 160, ${0.35 * (1 - f)})`;
        g.beginPath();
        g.arc(x, y, e.r, 0, Math.PI * 2);
        g.fill();
      } else if (e.type === 'anim') {
        drawTile(g, e.tiles[Math.min(e.tiles.length - 1, e.t)], e.x, e.y);
      } else if (e.type === 'rubble') {
        if (e.st < 16) {
          const i = Math.floor((e.st - 2) / 3);
          drawTile(g, 'ANIM3:' + (2 + 2 * i), x, y);
          drawTile(g, 'ANIM3:' + (3 + 2 * i), x + 16, y);
        }
      } else if (e.type === 'points') {
        g.globalAlpha = Math.min(1, (1 - f) * 3);
        g.font = `700 7px "Rubik", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 2;
        g.strokeStyle = 'rgba(0,0,0,0.7)';
        g.strokeText(String(e.n), x, y);
        g.fillStyle = e.n >= 5000 ? '#ff70d9' : e.n >= 1000 ? '#ff5a52' : e.n >= 500 ? '#74f1ff' : '#ffd94e';
        g.fillText(String(e.n), x, y);
        g.textAlign = 'left';
        g.globalAlpha = 1;
      }
    }
  },
};

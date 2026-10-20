// The screens around play: the title and its menu, the in-game menu, high scores and the ending.
// The story and help text are the original's, from DN1.EXE.

const STORY = [
  ['The Story', 'The year is 1997. Doctor Proton and his army of Techbots have taken control of Earth\'s largest city. Once a respected genius and scientist, Dr. Proton decided he could rule Earth with a new world order.\n\nAfter a terrible radiation accident that altered his brain, Dr. Proton took to the underworld and developed an army of advanced robots, called Techbots. Every attempt by the military to overcome Dr. Proton ended in disaster.'],
  ['The Story', 'Self-proclaimed hero Duke Nukem is Earth\'s final chance. Hired by the CIA, Duke has orders to stop Dr. Proton and rid the world of this latest madman. Armed only with his pistol and his can-do attitude, Duke is the one person who might stand a chance of success.'],
  ['Controls', 'Left and Right arrows walk. Ctrl or Z jumps. Alt or X fires the nuclear pistol.\n\nUp is the action key: it rides elevators and teleporters, reads notes and monitors, opens doors, and puts keys, access cards and other things in their slots.\n\nWith the grappling hooks, jump up into a grated ceiling to hang from it. Up swings Duke on top if there is room, and Down lets go.'],
  ['Important Information', 'Duke needs food and soft drinks to keep him healthy. Grab all the food and drinks you can find, sometimes hidden in boxes.\n\nDr. Proton has built several nuclear reactors to power his Techbots and traps. Destroying them should be a high priority.\n\nKeys open doors, boots help Duke jump higher, and extra pistols increase his firepower.'],
  ['Episode Two', 'Dr. Proton got away in his rocket and dug in on the far side of the Moon. From his lunar fortress he is building a new army of Techbots for one more attack on Earth. Duke goes after him.\n\nThe ten levels of Episode Two are new. They were made for this rebuild from the original game\'s tiles, enemies and machines, and play by the same rules.'],
  ['Important Information', 'Duke has unlimited chances to finish his mission, but every time he dies he goes back to the hallway before the level.\n\nDr. Proton watches every move with his security cameras. Destroying every camera on a level earns a secret bonus. There are several other secret bonuses to find.'],
];

function loadScores() {
  try {
    const s = JSON.parse(localStorage.getItem('dn1-scores') || '[]');
    if (Array.isArray(s)) return s;
  } catch (e) { /* storage blocked */ }
  return [];
}
function saveScores(s) {
  try { localStorage.setItem('dn1-scores', JSON.stringify(s)); } catch (e) { /* storage blocked */ }
}

const Title = {
  sel: 0,
  page: -1,           // -1 menu, 0.. story pages, 'scores'
  items: ['Episode One: Shrapnel City', 'Episode Two: Lunar Fortress', 'Story and controls', 'High scores', 'Sound'],
  tick() {
    if (this.page === 'scores' || this.page >= 0) {
      if (take('enter') || take('esc') || take('fire') || take('jump')) {
        if (this.page === 'scores' || this.page >= STORY.length - 1) this.page = -1;
        else this.page++;
      }
      return;
    }
    if (take('up')) this.sel = (this.sel + this.items.length - 1) % this.items.length;
    if (take('down')) this.sel = (this.sel + 1) % this.items.length;
    if (take('enter') || take('fire') || take('jump')) {
      Sound.init();
      if (this.sel === 0) newGame(1);
      else if (this.sel === 1) newGame(EPISODES[2] ? 2 : 1);
      else if (this.sel === 2) this.page = 0;
      else if (this.sel === 3) this.page = 'scores';
      else Sound.on = !Sound.on;
    }
    for (const k in pressed) pressed[k] = false;
  },
  draw(g) {
    const c = backdropCanvas('DROP0');
    const off = (G.anim || 0) * 0.3 % 208;
    for (let x = -off; x < VW; x += 208) g.drawImage(c, x, 0, 208, 160);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, VW, VH);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `34px ${TITLE_FONT}`;
    const gr = g.createLinearGradient(0, 18, 0, 50);
    gr.addColorStop(0, '#ffe680');
    gr.addColorStop(0.5, '#ff9a3a');
    gr.addColorStop(1, '#c42a2a');
    g.lineWidth = 3;
    g.strokeStyle = '#120808';
    g.strokeText('DUKE NUKEM', VW / 2, 34);
    g.fillStyle = gr;
    g.fillText('DUKE NUKEM', VW / 2, 34);
    g.font = `600 7px ${FONT}`;
    g.fillStyle = '#74f1ff';
    g.fillText(this.sel === 1 ? 'NEW LEVELS ON THE MOON' : 'THE 1991 APOGEE GAME, REMASTERED', VW / 2, 56);
    if (this.page === 'scores') { this.drawScores(g); g.textAlign = 'left'; return; }
    if (this.page >= 0) { this.drawPage(g, STORY[this.page]); g.textAlign = 'left'; return; }
    this.items.forEach((it, i) => {
      const y = 76 + i * 13;
      const label = i === 4 ? 'Sound: ' + (Sound.on ? 'on' : 'off') : it;
      if (i === this.sel) {
        g.fillStyle = 'rgba(255, 217, 78, 0.16)';
        g.beginPath();
        g.roundRect(VW / 2 - 70, y - 6, 140, 12, 3);
        g.fill();
      }
      g.font = `${i === this.sel ? 700 : 500} 7.5px ${FONT}`;
      g.fillStyle = i === this.sel ? '#ffd94e' : '#e8ebf3';
      g.fillText(label, VW / 2, y);
    });
    g.font = `500 5px ${FONT}`;
    g.fillStyle = '#8e98b8';
    g.fillText('Arrows choose, Enter starts. A rebuild of the 1991 Apogee game by Todd Replogle.', VW / 2, VH - 8);
    g.textAlign = 'left';
  },
  drawPage(g, [head, body]) {
    panel(g, 20, 64, VW - 40, 88, 5);
    g.font = `16px ${TITLE_FONT}`;
    g.fillStyle = '#ffd94e';
    g.fillText(head, VW / 2, 75);
    g.font = `500 5.6px ${FONT}`;
    g.fillStyle = '#e8ebf3';
    let y = 88;
    for (const para of body.split('\n')) {
      if (!para) { y += 3; continue; }
      for (const line of wrapText(g, para, VW - 56)) {
        g.fillText(line, VW / 2, y);
        y += 7;
      }
    }
    g.font = `500 5px ${FONT}`;
    g.fillStyle = '#8e98b8';
    g.fillText('Press Enter', VW / 2, 147);
  },
  drawScores(g) {
    panel(g, 50, 64, VW - 100, 88, 5);
    g.font = `16px ${TITLE_FONT}`;
    g.fillStyle = '#ffd94e';
    g.fillText('High Scores', VW / 2, 75);
    const s = loadScores();
    g.font = `500 6.5px ${FONT}`;
    if (!s.length) {
      g.fillStyle = '#8e98b8';
      g.fillText('No scores yet', VW / 2, 105);
    }
    s.slice(0, 8).forEach((r, i) => {
      g.fillStyle = '#e8ebf3';
      g.textAlign = 'left';
      g.fillText(`${i + 1}. ${r.name}${r.ep === 2 ? ' (ep. 2)' : ''}`, 66, 89 + i * 8);
      g.textAlign = 'right';
      g.fillStyle = '#ffd94e';
      g.fillText(String(r.score), VW - 66, 89 + i * 8);
    });
    g.textAlign = 'center';
  },
};

function wrapText(g, text, width) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > width && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

// Esc during play: carry on, sound, hints, speed, restart level, quit to title.
const Menu = {
  open_: false,
  sel: 0,
  items() {
    return ['Carry on', 'Sound: ' + (Sound.on ? 'on' : 'off'), 'Hints: ' + (G.hints ? 'on' : 'off'),
      'Game speed: ' + (10 - G.speed) + ' of 10', 'Restart level', 'Quit to title'];
  },
  open() { this.open_ = true; this.sel = 0; G.paused = false; },
  onKey(e) {
    if (!this.open_) return false;
    const n = this.items().length;
    if (e.code === 'ArrowUp') this.sel = (this.sel + n - 1) % n;
    else if (e.code === 'ArrowDown') this.sel = (this.sel + 1) % n;
    else if (e.code === 'Escape') { this.open_ = false; }
    else if (e.code === 'ArrowLeft' && this.sel === 3) G.speed = Math.min(9, G.speed + 1);
    else if (e.code === 'ArrowRight' && this.sel === 3) G.speed = Math.max(0, G.speed - 1);
    else if (e.code === 'Enter' || e.code === 'Space') {
      if (this.sel === 0) this.open_ = false;
      else if (this.sel === 1) { Sound.on = !Sound.on; if (!Sound.on) Sound.stop(); }
      else if (this.sel === 2) G.hints = !G.hints;
      else if (this.sel === 3) G.speed = G.speed === 0 ? 9 : G.speed - 1;
      else if (this.sel === 4) { this.open_ = false; if (G.level % 2 === 0) { G.health = 0; G.dying = 29; } }
      else if (this.sel === 5) { this.open_ = false; G.mode = 'title'; Title.page = -1; }
    } else return false;
    for (const k in pressed) pressed[k] = false;
    return true;
  },
  draw(g) {
    if (!this.open_) return;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 0, VW, VH);
    panel(g, VW / 2 - 60, 26, 120, 108, 6);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `14px ${TITLE_FONT}`;
    g.fillStyle = '#ffd94e';
    g.fillText('Menu', VW / 2, 38);
    this.items().forEach((it, i) => {
      const y = 54 + i * 13;
      if (i === this.sel) {
        g.fillStyle = 'rgba(255, 217, 78, 0.16)';
        g.beginPath();
        g.roundRect(VW / 2 - 52, y - 5.5, 104, 11, 3);
        g.fill();
      }
      g.font = `${i === this.sel ? 700 : 500} 6.5px ${FONT}`;
      g.fillStyle = i === this.sel ? '#ffd94e' : '#e8ebf3';
      g.fillText(it, VW / 2, y);
    });
    g.textAlign = 'left';
  },
};
// the game loop must stand still while the menu is open
const _tick = tick;
Game.tick = function () { if (Menu.open_) return; _tick(); };

// The end of the episode: Dr. Proton gets away to the moon. The lines are the original's.
// Then the score goes on the board.
const ENDING = [
  ['proton', 'You may have defeated me on Earth,\nbut on the Moon I can make plans\nfor my ultimate attack!'],
  ['duke', 'Proton, you coward! You can run\nbut you can\'t hide!'],
  ['proton', 'Once my forces are together,\nI\'ll be back to rule Earth.'],
  ['duke', 'Not if I can stop you first...\n\nHere I come!'],
  [null, 'TO BE CONTINUED\n\nIn episode two, Duke rockets to the moon\nto infiltrate Dr. Proton\'s massive lunar fortress.'],
];
// Episode Two's ending: Dr. Proton's ship goes down for good. These lines are new.
const ENDING2 = [
  ['proton', 'No! My fortress! My Techbots!\nThis can\'t be happening!'],
  ['duke', 'It\'s happening, Proton.\nNext time, pick a planet\nwith a better landlord.'],
  [null, 'Dr. Proton\'s lunar fortress is finished,\nand Duke heads home to Earth.\n\nTHE END'],
];
const Ending = {
  t: 0, page: 0, name: '', entering: false,
  lines() { return G.episode === 2 ? ENDING2 : ENDING; },
  start() {
    G.score += 100000;
    this.t = 0;
    this.page = 0;
    this.name = '';
    this.entering = false;
    G.mode = 'end';
    Sound.play(SND.theEnd);
  },
  tick() {
    this.t++;
    if (this.entering) return;
    if (this.t > 8 && (take('enter') || take('fire'))) {
      this.page++;
      this.t = 0;
      if (this.page >= this.lines().length) this.finish();
    }
  },
  finish() {
    const s = loadScores();
    if (!G.cheated && (s.length < 8 || G.score > s[Math.min(7, s.length - 1)].score)) {
      this.entering = true;
      Sound.play(SND.duke);
    } else {
      G.mode = 'title';
      Title.page = 'scores';
    }
  },
  onKey(e) {
    if (!this.entering) return false;
    if (e.key === 'Enter') {
      const s = loadScores();
      s.push({ name: this.name.trim() || 'Duke', score: G.score, ep: G.episode });
      s.sort((a, b) => b.score - a.score);
      saveScores(s.slice(0, 10));
      this.entering = false;
      G.mode = 'title';
      Title.page = 'scores';
    } else if (e.key === 'Backspace') this.name = this.name.slice(0, -1);
    else if (e.key.length === 1 && this.name.length < 14) this.name += e.key;
    return true;
  },
  draw(g) {
    if (G.episode === 2) g.drawImage(backdropCanvas('lunar'), 0, 0, 416, 160);
    else if (PICS.city) g.drawImage(PICS.city, 0, 0, VW, VH);
    else { const c = backdropCanvas('DROP7'); g.drawImage(c, 0, 0, 208, 160); g.drawImage(c, 208, 0, 208, 160); }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (this.entering) {
      g.font = `18px ${TITLE_FONT}`;
      g.fillStyle = '#ffd94e';
      g.fillText('A new high score!', VW / 2, 50);
      g.font = `600 9px ${FONT}`;
      g.fillStyle = '#e8ebf3';
      g.fillText(String(G.score), VW / 2, 70);
      panel(g, VW / 2 - 60, 84, 120, 18, 4);
      g.fillStyle = '#ffd94e';
      g.fillText(this.name + ((G.anim >> 3) & 1 ? '_' : ' '), VW / 2, 93);
      g.font = `500 5.5px ${FONT}`;
      g.fillStyle = '#8e98b8';
      g.fillText('Type your name and press Enter', VW / 2, 112);
    } else {
      // Proton's ship climbing away (Episode Two: Duke's, heading home to Earth)
      const p = Math.min(1, this.t / 40);
      const home = G.episode === 2;
      const sx = home ? VW * 0.8 - p * VW * 0.55 : VW * 0.3 + p * VW * 0.5;
      const sy = home ? VH * 0.8 - p * VH * 0.5 : VH * 0.8 - p * VH * 0.7;
      g.globalCompositeOperation = 'lighter';
      glow(g, sx + (home ? 6 : -6), sy + 8, 18, 'rgba(255, 160, 60, A)', 0.8);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#c8d0dc';
      g.beginPath();
      g.ellipse(sx, sy, 10, 4, home ? 0.6 : -0.6, 0, Math.PI * 2);
      g.fill();
      const E = this.lines();
      const [who, text] = E[Math.min(this.page, E.length - 1)];
      const lines = text.split('\n');
      const face = who && PICS[who];
      panel(g, 24, 92, VW - 48, 56, 5);
      if (face) {
        const fh = 48, fw = fh * face.width / face.height;
        g.drawImage(face, 30, 96, fw, fh);
      }
      g.font = `500 7px ${FONT}`;
      g.fillStyle = '#e8ebf3';
      const tx = face ? VW / 2 + 30 : VW / 2;
      lines.forEach((l, i) => g.fillText(l, tx, 120 - (lines.length - 1) * 5 + i * 10));
      g.font = `500 5px ${FONT}`;
      g.fillStyle = '#8e98b8';
      g.fillText('Score ' + G.score + '    Press Enter', VW / 2, VH - 10);
    }
    g.textAlign = 'left';
  },
};
window.addEventListener('keydown', (e) => { if (G.mode === 'end' && Ending.onKey(e)) e.preventDefault(); });

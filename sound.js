// Plays the original PC speaker sounds (sounds-data.js, decoded by tools/sounds.py): PIT divisors
// at 144 steps a second, 0 is silence. Like the PC speaker,
// one sound plays at a time and a new one cuts in only if its priority is at least the playing one's.

const Sound = {
  ctx: null, out: null, on: true, cur: null,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // a soft low-pass and a short echo take the edge off the square wave
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const vol = this.ctx.createGain();
    vol.gain.value = 0.11;
    const dl = this.ctx.createDelay();
    dl.delayTime.value = 0.06;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.18;
    lp.connect(vol);
    vol.connect(this.ctx.destination);
    vol.connect(dl);
    dl.connect(fb);
    fb.connect(this.ctx.destination);
    this.out = lp;
  },
  // name is the sound's name or its number in the original
  play(name) {
    if (!this.on || !this.ctx) return;
    const s = SOUNDS[typeof name === 'number' ? SOUND_IDS[name] : name];
    if (!s) return;
    const now = this.ctx.currentTime;
    if (this.cur && this.cur.end > now && s[0] < this.cur.pri) return;
    this.stop();
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    const gate = this.ctx.createGain();
    const step = 1 / 144;
    s[1].forEach((d, i) => {
      const t = now + i * step;
      if (d) {
        osc.frequency.setValueAtTime(1193181 / d, t);
        gate.gain.setValueAtTime(1, t);
      } else {
        gate.gain.setValueAtTime(0, t);
      }
    });
    const end = now + s[1].length * step;
    osc.connect(gate);
    gate.connect(this.out);
    osc.start(now);
    osc.stop(end);
    this.cur = { osc, pri: s[0], end };
  },
  stop() {
    if (this.cur) {
      try { this.cur.osc.stop(); } catch (e) { /* already stopped */ }
      this.cur = null;
    }
  },
};

// sound numbers used by the game code (index into SOUND_IDS)
const SND = {
  death: 0x00, food: 0x01, cokeHit: 0x02, balloon: 0x03, powerup: 0x04, bridge: 0x05, gun: 0x06,
  teleport: 0x07, key: 0x09, boxExplode: 0x0a, enemyShot: 0x0b, special: 0x0c, jump: 0x0d, land: 0x0e,
  hit: 0x0f, bonus: 0x10, hitReactor: 0x11, smallDeath: 0x12, levelDone: 0x13, elevator: 0x14,
  forcefield: 0x15, walk: 0x16, cheat: 0x19, start: 0x1a, hooks: 0x1b, note: 0x1c, monitor: 0x1d,
  rocket: 0x1e, keyDoor: 0x1f, sign: 0x20, bomb: 0x21, mine: 0x22, rabbit: 0x23, reactor: 0x24,
  duke: 0x25, bump: 0x26, door: 0x27, badGoUp: 0x28, badDead: 0x29, breaker: 0x2a, torch: 0x2b, theEnd: 0x2c,
};

// Start: load the atlas, then run. index.html#test exposes window.__dn for scripted checks.
loadAtlas().then(() => {
  canvas.focus();
  requestAnimationFrame(frame);
});
if (location.hash === '#test') {
  window.__dn = {
    G, keys, pressed, Actors, newGame, startLevel, tick: () => Game.tick(),
    run(n) { for (let i = 0; i < n; i++) Game.tick(); },
    press(k, on = true) { if (on && !keys[k]) pressed[k] = true; keys[k] = on; },
  };
}

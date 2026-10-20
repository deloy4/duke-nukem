# Duke Nukem rebuild: Episode 1 and a new Episode 2

A browser rebuild of Duke Nukem Episode One, "Shrapnel City", the 1991 Apogee shareware game by Todd
Replogle. All ten levels and the hallway between them are the original maps, read from the
`WORLDAL*.DN1` files. The rules come from reading the original program (`DN1.EXE`, unpacked from LZEXE):
Duke's 8-pixel steps, the two jump tables (with and without boots), the grappling hooks, the camera,
health and the 20 safe frames after a hit, every enemy and hazard, boxes and pickups, keys and doors,
elevators, conveyors, teleporters, the rocket, the reactor and force fields, the seven secret bonuses,
and the Dr. Proton ending. The write-ups with code addresses are in `../analysis/` (`player.md`,
`enemies.md`, `items.md`).

The graphics are the original tiles, remastered: `tools/remaster.py` takes each 16 x 16 EGA tile, swaps
the 16 EGA colours for a richer set, smooths the edges with Scale2x, lights each colour region from the
top left, and gives sprites a dark rim. Duke's and Dr. Proton's skin becomes a skin tone instead of EGA
red. The backdrops behind the levels are painted with canvas instead of the EGA pictures, and slide
slowly as the view scrolls. Explosions, shots, fire and machines get light and particles. The sounds are
the original PC speaker effects from `DUKE1.DN1`, played through Web Audio.

## Episode Two, Lunar Fortress (new)

The title menu also offers Episode Two: ten new levels on the Moon, made for this rebuild. They use only the
original game's tiles, enemies and machines and play by the same rules; the original hallway sits between them,
and the last level ends with Dr. Proton going down for good (the original's 0x3042 version of him, which dies
after ten hits). The levels are text files in `../levels/ep2/` (format and design rules in
`../levels/FORMAT.md`), compiled by `tools/lvl.py build levels/ep2 --js` into `ep2.js`. Every level was run
through `tools/lvcheck.js`, which plays every reachable walk and jump with this game's own movement code and
proves the exit (or Dr. Proton) can be reached. The checker was first run on the ten original levels, and it
found a way through each of them. The new backdrops (`lunar`, `dome`, `crystal`, `core`) are painted in
`art.js`.

## Controls

The arrows walk, Ctrl or Z jumps and Alt or X fires. Up is the action key: it rides elevators and
teleporters, reads notes, opens the exit door, and puts keys, the access card and the robohand in their
slots. With the grappling hooks, jump into a grated ceiling to hang from it, Up climbs on top and Down
lets go. Esc opens the menu (sound, hints, game speed, restart level, quit), P pauses, M turns the sound
off, + and − change the speed. On a touchscreen, buttons appear under the game. The original's cheat
still works: hold Backspace and press Page Down (keypad 3) for all the keys and full firepower.

## How it runs

The game runs at 16 frames a second, the original's speed (its timer runs at 144.2 Hz and a frame
waits 9 ticks). Positions use the original's units, and the screen draws between frames so movement
looks smooth. The view is 16 tiles wide instead of 13, so enemies at the left and right edges wake a
little earlier than in the original.

- `index.html`, the page; `main.js` starts it (`index.html#test` exposes `window.__dn` for scripted checks).
- `game.js`, Duke, his shots, the camera, health, death and the level order.
- `actors.js`, the level loader and every enemy and hazard. `items.js`, boxes, pickups and machines.
- `effects.js`, explosions, debris, smoke and score numbers. `ui.js`, the title, menu and ending.
- `art.js`, tile drawing and the painted backdrops. `shell.js`, canvas, keys and the frame clock.
- `sound.js` plays `sounds-data.js`. `data.js` holds the maps and the atlas index. `ep2.js` holds Episode Two.
- `atlas.png`, `duke.png`, `proton.png`, `city.png`, the remastered graphics.

`data.js`, `atlas.png` and `sounds-data.js` are generated: run `tools/build_data.py`,
`tools/portraits.py extracted rebuild` and `tools/sounds.py` from the target folder. There is no build
step for the game; serve the folder and open `index.html`.

Differences from the original: no save slots (dying returns Duke to the last hallway with what he had
there, which is what the original's automatic save does), no demo or joystick setup, high scores are
kept in this browser only, and the secret bonuses are announced in a box when Duke reaches the hallway.

## Rights

This is a fan project with no connection to Apogee, 3D Realms or Gearbox. Duke Nukem and the original
game's maps, graphics and sounds belong to their owners.

# Stillwander

A quiet wander through seven feudal-Japan-inspired lands, with a bow whose arrows the wind learns to obey. Built with three.js.

Play it on GitHub Pages, or serve this folder locally (the scripts are ES modules, so opening `index.html` straight from disk will not work):

```bash
python3 -m http.server 8770
```

## Controls

W A S D to walk · hold the mouse to draw, release to loose · Shift to sidestep · F to gather straw from grass, reeds and shrubs · C to craft an arrow (four straw) · T to change arrow · H to hum · R to ride · Q / E to turn · scroll to zoom · M for sound.

Wake a shrine (carry three motes of light to it) and the bow is blessed with Wind: loose a Wind arrow, then lead it with the pointer.

Mossback Oxen graze on the Pampas Plain. They spook if they see you in the open; stay still in the tall grass, or creep with the bow drawn. Hum (H) close by to settle one, then shoot the moss off both its eyes before it bolts. A calmed ox lets you ride it (R), and a hum calls it back to you.

## Code

| Path | What it is |
|---|---|
| `src/engine.js` | The world: terrain, art, light, day cycle, sound, wandering. |
| `src/core/` | The game rules as classes (Archer, Bow, Arrow, blessings, Hollows, World). They do not touch the engine. |
| `src/beasts.js` | The beasts on screen: herds, models, riding. |
| `src/game.js` | Connects the two: pointer and keys to the bow, and the rules' events to the screen. |

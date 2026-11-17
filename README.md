# Stillwander

A quiet wander through seven feudal-Japan-inspired lands, with a bow whose arrows the wind learns to obey. Built with three.js.

Play it on GitHub Pages, or serve this folder locally (the scripts are ES modules, so opening `index.html` straight from disk will not work):

```bash
python3 -m http.server 8770
```

## Controls

W A S D to walk · hold the mouse to draw, release to loose · Shift to sidestep · F to speak with a villager, or to gather straw from grass, reeds and shrubs · C to craft an arrow (four straw) · T to change arrow · H to hum · R to ride · J for the journal · Q / E to turn · scroll to zoom · M for sound.

Wake a shrine (carry three motes of light to it) and the bow is blessed with Wind: loose a Wind arrow, then lead it with the pointer.

## The game

You wake at a waystation with a bow and no memory. Seven lands sleep. Carry light to each land's shrine: it blesses the bow, and gives back a memory as a chapter of the story. When all seven are awake, the Elder Carp rises in Petal Pond for the ending.

**Beasts.** Each land has a beast of the old age, grown over with moss, bark or ice. Break those parts away to calm it; each gives a gift.

| Land | Beast | How it behaves | Gift |
|---|---|---|---|
| Pampas Plain | Mossback Ox | Shy. Hum (H), then free both eyes of moss. | Ride it (R); a hum calls it. |
| Golden Wood | Ginkgo Stag | Very shy and fast. Shake the leaves from its antlers. | Arrows fly farther. |
| Bamboo Hollow | Hollow Boar | Charges. Break its three cane plates. | Arrows pass through one more. |
| Snow Crest | Frostmane Bear | Slow, hits hard. Fire melts its ice; frost then a full draw shatters it. | Two more petals. |
| Heron Marsh | Reed Toad | Strikes with its tongue. Thunder bites its wet throat. | The bow draws faster. |
| Crimson Vale | Maple Cranes | Scatter into the air. Hawk arrows find them. | Wind arrows turn tighter. |
| Blossom Field | Elder Carp | Sends waves across the pond; turns slowly. | The ending. |

Shy beasts spook if they see you in the open. In the Pampas grass you are hidden while still, or creeping with the bow drawn.

**Hollows.** Empty armour still holding the broken dojo, the fortified pass, the drowned torii and stretches of road. A red ring warns of each blow: step aside with Shift. Your health is five petals; out of danger they grow back. If you fall you wake at the nearest woken shrine with nothing lost.

**Villagers** live at the Waystation, the hamlets, the towns and the monastery. Press F beside one to talk.

## Code

| Path | What it is |
|---|---|
| `src/engine.js` | The world: terrain, art, light, day cycle, sound, wandering. |
| `src/core/` | The game rules as classes (Archer, Bow, Arrow, blessings, Hollows, World). They do not touch the engine. |
| `src/beasts.js` | The beasts on screen: herds, models, riding. |
| `src/folk.js` | Villagers, Hollows, the talk panel, petals and waking at a shrine. |
| `src/story.js` | Prologue, chapters, beast gifts, the journal and the ending. |
| `src/game.js` | Connects the two: pointer and keys to the bow, and the rules' events to the screen. |

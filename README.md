# Here to Slay — solo

A fan-made, browser-based clone of the card game *Here to Slay*, playable solo against 1–5 bot opponents.
It's plain HTML/CSS/JavaScript with no build step, so it runs as-is on GitHub Pages.

## Play on GitHub Pages

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick your branch (e.g. `main`) and the `/ (root)` folder, then **Save**.
4. After a minute the game is live at `https://<your-user>.github.io/here-to-slay-clone/`.

## Play locally

ES modules need a web server (opening `index.html` directly from disk won't work):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Rules implemented

- 3 action points per turn: draw (1), play a Hero/Item/Magic card (1), roll for a Hero's effect (1, once per Hero per turn), attack a Monster (2), discard your hand and draw 5 (3).
- Playing a Hero lets you roll for its effect immediately for free.
- Six classes (Fighter, Guardian, Ranger, Thief, Wizard, Bard); Party Leaders with skills; Monsters with Party requirements, slay rolls, penalty ranges and skills you gain when you slay them.
- Items (including Cursed Items and class Masks), Magic, Modifier cards playable by anyone on any roll, and Challenge cards (contested roll, challenger wins ties, one challenge per card).
- Win by slaying 3 Monsters or by ending your turn with a Party covering all six classes.

## Code layout

| File | Purpose |
| --- | --- |
| `js/cards.js` | Card definitions: Heroes, Items, Magic, Modifiers, Challenges, Party Leaders, Monsters |
| `js/effects.js` | Hero and Magic card effects |
| `js/game.js` | Game engine and turn loop (no DOM access) |
| `js/ai.js` | Heuristic bot opponents |
| `js/ui.js` | Board rendering, dice, prompts |
| `js/main.js` | Setup screen and rules |

*Unofficial fan project, not affiliated with Unstable Games. Card names and emoji art are original placeholders.*

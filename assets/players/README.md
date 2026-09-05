# Player photos

One canonical photo per player, reused everywhere: player profile pages, the
player directory, and the 2026 team reveal cards.

## Where to put them

Drop each file in this folder named after the player's ID (the same ID used
throughout `data/sycamore-data.json`), for example:

```
assets/players/casey-godfrey.jpg
assets/players/mike-grosh.png
assets/players/nick-fowler.jpg
```

You don't need to tell the site what file extension you used — it automatically
tries `.jpg`, `.jpeg`, `.png`, then `.webp` for each player ID, in that order,
and falls back to a plain initials circle if none exist yet. So it's fine to
add these gradually.

## Current player IDs

anthony-gjonaj · auston-chen · ben-conway · brian-danahy · casey-godfrey ·
chris-clement · collin-jewett · david-schultz · farnia-ghavami · gregg-suglia ·
jack-mccarthy · mike-grosh · nick-fowler · nigel-scott · rob-vassallo ·
robert-stong · scottie-collins

New for 2026? Use `firstname-lastname` (all lowercase, hyphenated) as the ID —
same pattern as everyone above — and use that same ID/filename for their
reveal card in `data/reveal-2026.json` (see below).

## How this connects to the 2026 reveal

In `data/reveal-2026.json`, each entry in `"order"` can reference a player two ways:

- `"playerId": "casey-godfrey"` — pulls the photo straight from this folder
  automatically (same lookup as above). Use this for anyone already in
  `sycamore-data.json`.
- `"card": "assets/players/some-file.png"` — an explicit path, for a brand-new
  player who isn't in the site's player data yet.

Either way, it's the same folder and the same file — no need to keep two
copies of anyone's photo.

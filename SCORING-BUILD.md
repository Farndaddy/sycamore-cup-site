# 2026 Live Scoring — what got built
### 2026-09-05

## Pages

| File | What it is |
|---|---|
| `scoring.html` | The microsite. Five tabs: My Card, Individual, Teams, Skins, The Money. |
| `admin.html` | Admin panel. Not linked from the nav — reach it directly at `/admin.html`. |

## Code

| File | What it does |
|---|---|
| `js/tournament-2026.js` | Every fixed fact: four courses with pars, stroke indexes and tee ratings; the twelve players; the six rounds; the payout table; the rules. **Change team names here.** |
| `js/scoring-engine.js` | All the math. Pure functions, no network — course handicaps, stroke allocation, the triple-bogey cap, team totals, skins with carryover, the all-four-rounds individual total. |
| `js/live.js` | Everything that talks to Firebase. Anonymous sign-in, App Check, card claiming, score writes, live subscriptions. |
| `js/scoring-page.js` | The scoring microsite. |
| `js/admin-page.js` | The admin panel. |
| `css/scoring.css` | Styling for both. |

`js/app.js` nav now points at Live Scoring instead of the old placeholder.

## Before anyone can score — three steps, in order

**1. Make yourself an admin.** This can't be done from inside the app; the security
rules only let an existing admin create another, so the first one is by hand.
Open `admin.html` in your browser. It will tell you you're not an admin and show
you an ID. Then in the Firebase console → Firestore Database → Start collection →
name it `admins` → paste that ID as the Document ID → add a field `label` = `Farnia`.
Reload the page.

**2. Create the player records.** In the admin panel, click "Create player records".
Nobody can claim a card until this runs.

**3. Send everyone the link.** Each guy opens `scoring.html`, picks his name, sets a
name from the list. No PIN — that step was retired 2026-09-08; anyone can enter a score for anyone.

## How the money works, as built

- **Team low net** — all four scores, every day. Thursday and Friday fold in the scramble nine.
- **Individual low net** — 1st and 2nd each day. Ties pool both prizes and split them.
- **Skins** — net, carryover on ties, all four 18-hole days. Skins still carrying at the
  end of a round are not paid; the pot divides across the skins actually won.
- **Individual Champion** — all four rounds count, no drops. Shows as provisional until
  a player has all four rounds finished.
- **Handicaps** — full course handicap, recomputed per player per tee per round.

## Three bugs caught during the build

Worth knowing about, because they'd all have been found on the first tee otherwise.

1. **The overlays swallowed every tap.** The sign-in and keypad panels use the `hidden`
   attribute, but a `display: flex` rule overrode it. Both invisible panels sat on top of
   the page. The whole site was unusable. Fixed.
2. **The scorecard collided with an existing style.** `style.css` already defines
   `table.scorecard` with `min-width: 780px`. My table inherited it and only four holes
   fit on a phone. Renamed to `.sc-table`; a full nine now fits with no scrolling.
3. **Invisible buttons.** `.btn-light` in `style.css` is white text on a white border —
   it's designed for dark hero sections. Every admin button and the sheet Back/Close
   buttons were white-on-white. Added `.btn-quiet` for pale backgrounds.

## Still open

- **Team names.** Two are placeholders — `Team One` and `Team Two` in `js/tournament-2026.js`.
  `Starz & Scrubz` is set.
- **App Check enforcement stays OFF** until the site is deployed and the Firebase console
  shows verified requests arriving. Turning it on early locks out every phone, yours included.
- **The site is not deployed.** This folder is not a git repo. It needs a `sycamore-cup-site`
  repo under the `Farndaddy` account, publishing to `farndaddy.github.io/sycamore-cup-site/`
  — that domain is already registered on the reCAPTCHA key.
- **Player photos** missing for Justin Quinn, Ben Conway, David Schultz.
- `leaderboard.html` and `score-entry.html` are the old placeholders. Nothing links to them now.

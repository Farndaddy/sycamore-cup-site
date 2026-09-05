# Sycamore Cup Classic — site

A plain HTML/CSS/JS site (no build step) with:

- `index.html` — home, links to every year
- `years/2023.html`, `years/2024.html`, `years/2025.html` — one mini-site per trip: teams, rosters, fun facts, and (for 2025) the daily matchup schedule
- `players.html` + `players/player.html?id=...` — a directory and a career profile per player that spans every year they've played
- `leaderboard.html` — live, real-time scorecard/leaderboard
- `score-entry.html` — hole-by-hole score entry from any phone
- `data/sycamore-data.json` — everything transcribed from the three brochures (players, teams, indexes, courses, champions, 2025 schedule). Edit this file directly to fix a typo, add a fun fact, or add a new year.

Because it's plain static files, you can open `index.html` directly in a browser to preview it, or run a tiny local server from this folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Set up live scoring (Firebase)

GitHub Pages only serves static files — it can't run a database. To get real live score entry across everyone's phones, this site talks to **Firestore** (Firebase's free real-time database). Setup takes about 5 minutes and is free for a group this size.

1. Go to **console.firebase.google.com** and create a new project (any name, e.g. "sycamore-cup").
2. In the left sidebar: **Build → Firestore Database → Create database**. Choose **Start in test mode** for now (you'll lock it down in step 5).
3. In the left sidebar: **Project settings** (gear icon, top left) → scroll to **Your apps** → click the **</>** (Web) icon → register an app (any nickname, no need for Firebase Hosting).
4. It will show you a `firebaseConfig` object. Copy those values into **`js/firebase-config.js`** in this project, replacing the placeholder strings. Then change `FIREBASE_NOT_CONFIGURED` to `false`.
5. Back in Firestore → **Rules** tab, paste in the contents of **`firestore.rules.txt`** (in this folder) and click **Publish**. This allows anyone with the link to add/edit scores, but not delete anything or write garbage data — good enough for a trusted group trip. If you want it locked down further later (invite-only), just ask and it can be added without changing the data model.

That's it — no server to run, no ongoing cost at this scale (Firestore's free tier is far more than a golf trip needs).

## Deploy to GitHub Pages

1. Create a new GitHub repo and push this whole folder to it (`main` branch is fine).
2. In the repo: **Settings → Pages**. Under "Build and deployment," set **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**. Save.
3. GitHub gives you a URL like `https://yourusername.github.io/your-repo-name/` within a minute or two — that's the live site.
4. Every time you `git push` a change (e.g. after editing `data/sycamore-data.json` to add a player or fix a fun fact), the live site updates automatically within a minute.

A couple of GitHub Pages gotchas already handled for you:
- All links are relative, so the site works both at a bare domain and at a `/repo-name/` subpath.
- `js/firebase-config.js` is safe to commit — it's public client config, not a secret. Access control lives in the Firestore rules, not this file.

## Editing the data

Everything about players, teams, fun facts, and history lives in `data/sycamore-data.json`. It's plain JSON — no code changes needed to:
- Fix a typo in a nickname or fun fact
- Add fun facts for 2025 once you have them
- Add a brand new year (copy the shape of an existing year's block, then duplicate `years/2025.html` as a starting template for the new mini-site and update the year number in the `<script>` at the bottom)
- Add a new player to the roster

`data/sycamore-data.json` also has a `meta.dataNotes` array flagging two small inconsistencies found between different pages of the source brochures (Casey Godfrey's 2023 attendance, and Collin Jewett's 2024 championship vs. his listed years attended) — worth confirming with the group and then fixing directly in the JSON.

## Known placeholders / what's next

- **Net scoring formula** is a simple placeholder (full index for 18-hole rounds, half for 9-hole rounds) since the brochures didn't include a per-hole stroke-index table for any course. Swap in real per-hole allocations in `js/scoring-shared.js` (`netTotal()`) once you have them — useful for true LIV-style net matches.
- **Course pars** default to blank/par-4 until someone fills them in via the "Set par for this course" panel on the score-entry page (saved once per course, shared across every session played there).
- **2025 fun facts** aren't in the source brochure yet — the profile pages will just show "No fun facts on file for 2025" until `data/sycamore-data.json` is updated.
- **Access control**: right now anyone with the site link can enter scores (by design, per your request). If you'd rather restrict that to the actual group later, say the word and a lightweight shared-password or invite-link gate can be layered on top of Firebase Anonymous Auth without touching the data model.

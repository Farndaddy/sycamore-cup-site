# 2026 Sycamore Cup — Live Scoring Microsite
### Build spec, confirmed 2026-09-02

---

## 1. The event

3 teams of 4. Everyone plays their own ball. All scoring is **net**.

| Day | Round | Course | Format |
|---|---|---|---|
| Wednesday | 18 | Southern Hills Plantation | Individual stroke play (LIV team scoring) |
| Thursday | 18 | Bay Hill — Challenger/Champion | Individual stroke play (LIV team scoring) |
| Thursday | 9 | Bay Hill — Charger | 4-man team scramble |
| Friday | 18 | Bay Hill — Challenger/Champion | Individual stroke play (LIV team scoring) |
| Friday | 9 | Bay Hill — Charger | 4-man team scramble |
| Saturday | 18 | Evermore Grand Cypress — Cypress | Individual stroke play (LIV team scoring) |

## 2. Rosters (from the reveal, with Gregg → Justin swap)

| Team | Players | Total HI | Avg |
|---|---|---|---|
| Starz & Scrubz | Nick Fowler (2), Alex Kampmann (3), Anthony Gjonaj (13), Farnia Ghavami (16) | 34 | 9 |
| *(name TBD)* | Scottie Collins (3), Nigel Scott (5), Robert Stong (12), Auston Chen (14) | 34 | 9 |
| *(name TBD)* | Klayton McClosin (8), Rob Vassallo (9), Justin Quinn (10), Mike Grosh (11) | 38 | 10 |

## 3. Confirmed rules

**Handicap — full course handicap, computed per player per round:**

    Course Handicap = round( Index × (Slope ÷ 113) + (Rating − Par) )

Each player **picks their own tee** for each round. The formula handles mixed tees correctly — that's exactly what the `(Rating − Par)` term is for. Pops are allocated hole by hole off that tee's HCP row: a player with 20 strokes gets 1 on every hole plus a 2nd on HCP 1 and 2.

Worked example — Farnia, index 16:

| Course / Tee | Slope | Rating | Course HCP |
|---|---|---|---|
| Southern Hills — Championship | 146 | 76.9 | 26 |
| Southern Hills — Yellow | 141 | 73.9 | 22 |
| Southern Hills — Blue | 138 | 72.0 | 20 |
| Bay Hill — Yellow | 133 | 71.5 | 18 |
| Bay Hill — Yellow/Red | 130 | 70.5 | 18 |
| Evermore Cypress — Gold | 125 | 72.2 | 18 |
| Evermore Cypress — Blue | 119 | 70.1 | 15 |

Note that choosing the shorter tee at Evermore costs 3 strokes. Tee choice has real teeth — worth telling the guys before they pick.

**Team scoring:** all 4 net scores count, every day. No drops.

**Scramble:** the Thursday/Friday Charger 9 rolls into that day's team total. So Thursday's team score = four 18-hole nets + the scramble 9 net.

**Skins:** net skins, individual, carryover on ties, **all 4 days** including Saturday. 18-hole rounds only — no skins on the scramble nines.

**Individual Champion:** lowest net total across **all four rounds** — every round counts, no drops.

## 4. Payouts — updated

Adding Saturday skins changes your total.

| | Games | Amount | Per Person |
|---|---|---|---|
| **Wednesday** | Day 1 Team Low Net | $200 | $50 |
| Southern Hills | Day 1 Individual Low Net | $75 | $75 |
| | Day 1 Individual Low Net #2 | $50 | $50 |
| **Thursday** | Day 2 Team Low Net | $200 | $50 |
| Bay Hill | Day 2 Individual Low Net | $75 | $75 |
| | Day 2 Individual Low Net #2 | $50 | $50 |
| **Friday** | Day 3 Team Low Net | $200 | $50 |
| Bay Hill | Day 3 Individual Low Net | $75 | $75 |
| | Day 3 Individual Low Net #2 | $50 | $50 |
| **Saturday** | Day 4 Team Low Net | $200 | $50 |
| Evermore Cypress | Day 4 Individual Low Net | $75 | $75 |
| | Day 4 Individual Low Net #2 | $50 | $50 |
| | Day 1 Skins | $120 | |
| | Day 2 Skins | $120 | |
| | Day 3 Skins | $120 | |
| | **Day 4 Skins (NEW)** | **$120** | |
| | Overall Team Champion | $720 | $180 |
| | Individual Champion | $300 | $300 |
| | Individual Runner-Up | $225 | $225 |
| | Individual 3rd | $150 | $150 |
| | Individual 4th | $100 | $100 |
| | **Total** | **$3,275** | |

Was $3,155 with 3 skins days. Add $120 for Saturday.

## 5. Confirmed rules, round 2

**"Individual Low Net #2" = second place that day.** $75 to the day's low net, $50 to the runner-up. Two guys paid per day.

**Scramble allowance: 20% of combined course handicaps.** Add all four players' course handicaps for the Charger nine, take 20%, that's the team's strokes for the scramble.

**Ties: split the money.** For now. Farnia may add a card playoff later, so the tiebreak logic is built as a swappable rule rather than hardcoded — switching to back 9 / 6 / 3 / 18th is a one-line change when she wants it.

**Score entry: your PIN, your card only — plus admin override.** Nobody edits your scores but you and an admin.

**Max score: gross triple bogey, hard-capped in the app.**

| Par | Max gross |
|---|---|
| 3 | 6 |
| 4 | 7 |
| 5 | 8 |

This is enforced at entry, not just in the math — type a 9 on a par 4 and the app stores a 7 and tells you it did. No one has to remember the rule on the course.

**PINs: each player sets his own on first login.** Pick your name from the list, choose a PIN, you're in. Nothing to distribute. An admin can reset any PIN from the admin panel when someone forgets.

## 6. The page

`scoring.html` — a microsite with tabs. Mobile-first, built for a phone in one hand and a beer in the other.

**Tab 1 — My Card.** Enter your own gross score hole by hole. Dots on the holes where you get a stroke, so you can see your pops before you tee off. Triple-bogey cap enforced as you type. Running gross and net at the bottom.

**Tab 2 — Individual.** Live net leaderboard for the day, plus thru-hole. Toggle to the all-four-rounds running total for the $300.

**Tab 3 — Teams.** Live daily team net (all 4 counting, scramble folded in on Thu/Fri) and the season-long race for the $720.

**Tab 4 — Skins.** Today's net skins hole by hole — who owns each, what's carried, current pot per skin.

**Tab 5 — The Money.** Every game, what it pays, who's currently winning it.

**Admin panel** — separate, admin-only. Not a tab; its own screen behind an admin login.

- Edit or enter any player's score, any round
- Reset any player's PIN
- Assign or revoke co-admin rights
- Set each player's tee for a round (for the guy who won't do it himself)
- Lock a round once it's final, so nothing shifts after the money's paid
- Override a computed result if something needs a human decision

## 7. Course data — Bay Hill Charger nine (RESOLVED)

Bay Hill only publishes combo cards. Both cards Farnia sent are "CHALLENGER/…" and their front nines have an identical par pattern (4-3-4-5-4-5-3-4-4), which confirms the front nine is the Challenger on both. So the **back nine of the Challenger/Charger card is the Charger** — that's the scramble nine.

Charger nine, GREEN tees (holes 10–18 of the Challenger/Charger card):

| Charger hole | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Tot |
|---|---|---|---|---|---|---|---|---|---|---|
| Yards | 339 | 156 | 318 | 518 | 496 | 365 | 190 | 423 | 301 | 3106 |
| Par | 4 | 3 | 4 | 5 | 5 | 4 | 3 | 4 | 4 | 36 |
| HCP (on the 18 card) | 10 | 12 | 6 | 2 | 16 | 14 | 18 | 4 | 8 | |
| **HCP renumbered 1–9** | **5** | **6** | **3** | **1** | **8** | **7** | **9** | **2** | **4** | |

The renumbering matters: on the combo card the Charger holes carry all the even handicaps (2–18) because the Challenger front took the odds. Standing alone as a nine, they re-rank 1–9 in the same order of difficulty.

The 18s use the **Challenger/Champion** card, as confirmed.

Two caveats on the Charger:
- Only the **Green** tee is published for this combo (6905 / 73.8 / 131). If the group wants a shorter tee on the scramble nine, that card is needed.
- There's no standalone 9-hole rating. For the 20% scramble allowance I'll use half the 18-hole rating (36.9 against par 36), which is the standard approximation. The effect on a 20% team allowance is well under a stroke.

## 8. Backend status — LIVE as of 2026-09-05

| Piece | State |
|---|---|
| Firebase project | `sycamore-cup`, free Spark plan |
| Cloud Firestore | Created, empty, ready |
| Web app | `sycamore-site` registered |
| Config in the site | Written to js/firebase-config.js |
| Anonymous sign-in | Enabled (Auto clean-up deliberately OFF) |
| Security rules | Published — card-ownership model |
| App Check | Registered with reCAPTCHA Enterprise, 7-day token |
| App Check enforcement | **OFF, on purpose — see warning below** |

### The one dangerous switch

App Check is registered but NOT enforced. Enforcement must stay off until the site is deployed and confirmed to be sending App Check tokens. Turning it on early locks out every phone including the admin's, and the fix requires going back into the console. Sequence: deploy the site → watch the App Check metrics show verified requests → then enforce.

### Security model, as built

Anonymous sign-in gives each browser a stable identity. The rules pin each player card to the identity that claimed it, so the database itself — not just the page — refuses writes to another player's scores.

- `players/{playerId}` — public read; a card can be claimed once while unclaimed, then only its owner or an admin can write it.
- `scores/{scoreId}` — public read; writes require a valid stroke and hole, plus either admin rights or ownership of that card with the round still open. Never deletable.
- `teamScores/{scoreId}` — scramble scores; any signed-in player can write, since the whole team is standing there. Admin can correct.
- `courses/{courseId}`, `rounds/{roundId}` — public read, admin-only writes.
- `admins/{uid}` — the existence of a document grants admin. Farnia must add her own document once, by hand, to bootstrap.

### Known cost of this model

The identity lives in the browser. If a player switches from phone to iPad mid-trip, an admin has to release his card — the admin panel needs a visible "Release card" control. This is a correction to what was said when the options were presented; re-entering the PIN alone is not enough.

## 9. Still needed from Farnia

1. **Team names** for the two teams still called Team 2 / Team 3.
2. **Co-admins** — assignable in the panel once built.
3. **A GitHub repo for this site.** See below.

## 10. Deployment gap

This folder is not a git repository and has never been deployed. The CMS Config tab expects a repo named `sycamore-cup-site` under the `Farndaddy` account, which would publish to `farndaddy.github.io/sycamore-cup-site/` — that is the domain registered on the reCAPTCHA key. The repo still has to be created and the site pushed before anything is live.

// =========================================================
// Sycamore Cup Classic — 2026 tournament definition
// =========================================================
// Every fixed fact about the 2026 event lives here: the courses,
// the tees, the field, the schedule and the money. Nothing in this
// file changes during play. Live scores come from Firestore.
//
// Scorecard data transcribed from the official course scorecards,
// confirmed with Farnia 2026-09-05.

// ---------------------------------------------------------
// COURSES
// ---------------------------------------------------------
// hcp[] is the stroke index per hole, straight off the scorecard:
// hcp 1 is the hardest hole, where the first extra stroke lands.
// Each tee carries its own rating and slope, because players choose
// their own tee and the handicap formula needs both.

export const COURSES = {
  'southern-hills': {
    name: 'Southern Hills Plantation',
    short: 'Southern Hills',
    location: 'Brooksville, FL',
    architect: 'Pete Dye',
    holes: 18,
    par: 72,
    pars: [4,4,3,4,5,4,5,3,4, 4,4,5,3,4,4,5,3,4],
    hcp:  [5,9,17,7,11,1,3,15,13, 6,8,14,18,2,10,12,16,4],
    tees: {
      blue:       { name: 'Blue',       yards: 6494, rating: 72.0, slope: 138 },
      blueWhite:  { name: 'Blue/White', yards: 6153, rating: 70.0, slope: 137 }
    },
    defaultTee: 'blue'
  },

  'bay-hill': {
    name: 'Bay Hill Club and Lodge — Challenger/Champion',
    short: 'Bay Hill',
    location: 'Orlando, FL',
    architect: 'Dick Wilson',
    holes: 18,
    par: 72,
    pars: [4,3,4,5,4,5,3,4,4, 4,4,5,4,3,4,5,3,4],
    hcp:  [9,11,5,1,15,13,17,3,7, 12,4,10,14,18,6,2,16,8],
    tees: {
      yellow:    { name: 'Yellow',     yards: 6441, rating: 71.5, slope: 133 },
      yellowRed: { name: 'Yellow/Red', yards: 6172, rating: 70.5, slope: 130 }
    },
    defaultTee: 'yellow'
  },

  'evermore-cypress': {
    name: 'Evermore Grand Cypress Resort — Cypress Course',
    short: 'Evermore Cypress',
    location: 'Orlando, FL',
    architect: 'Jack Nicklaus',
    holes: 18,
    par: 72,
    pars: [4,5,3,4,4,4,4,3,5, 4,3,4,5,4,5,4,3,4],
    hcp:  [5,11,15,7,17,1,3,9,13, 10,12,4,14,18,6,2,16,8],
    tees: {
      gold: { name: 'Gold', yards: 6699, rating: 72.2, slope: 125 },
      blue: { name: 'Blue', yards: 6228, rating: 70.1, slope: 119 }
    },
    defaultTee: 'gold'
  },

  // The scramble nine. Bay Hill only publishes combo cards; this is the
  // back nine of the Challenger/Charger card. Both Challenger combos share
  // an identical front-nine par pattern, which is how we know the front is
  // the Challenger and this back nine is the Charger.
  //
  // On the 18-hole card these holes carry all the EVEN stroke indexes
  // (the Challenger front took the odds). Standing alone as a nine they
  // re-rank 1-9 in the same order of difficulty — that is hcp[] below.
  // hcp18[] preserves the original card values for reference.
  'bay-hill-charger': {
    name: 'Bay Hill Club and Lodge — Charger Nine',
    short: 'Charger 9',
    location: 'Orlando, FL',
    architect: 'Dick Wilson',
    holes: 9,
    par: 36,
    pars:  [4,3,4,5,5,4,3,4,4],
    hcp:   [5,6,3,1,8,7,9,2,4],
    hcp18: [10,12,6,2,16,14,18,4,8],
    tees: {
      // Only the Green tee is published for this combo. Rating shown is
      // half the 18-hole figure (73.8), the standard approximation when a
      // nine has no rating of its own. Effect on a 20% team allowance is
      // well under a stroke.
      green: { name: 'Green', yards: 3106, rating: 36.9, slope: 131, approximated: true }
    },
    defaultTee: 'green'
  }
};

// ---------------------------------------------------------
// THE FIELD
// ---------------------------------------------------------
// Three teams of four. To rename a team, change `name` only — the `id`
// is what every score, rule and leaderboard keys on.

export const TEAMS = [
  { id: 'team-1', name: 'Bison Boys',     accent: 'forest' },
  { id: 'team-2', name: 'Frombys',        accent: 'clay'   },
  { id: 'team-3', name: 'Starz & Scrubz', accent: 'brass'  }
];

export const PLAYERS = [
  { id: 'robert-stong',    name: 'Robert Stong',    short: 'Stong',    team: 'team-1', index: 12 },
  { id: 'scottie-collins', name: 'Scottie Collins', short: 'Scottie',  team: 'team-1', index: 3  },
  { id: 'auston-chen',     name: 'Auston Chen',     short: 'Auston',   team: 'team-1', index: 14 },
  { id: 'nigel-scott',     name: 'Nigel Scott',     short: 'Nigel',    team: 'team-1', index: 5  },

  { id: 'klayton-mcclosin',name: 'Klayton McClosin',short: 'Klaybear', team: 'team-2', index: 8  },
  { id: 'rob-vassallo',    name: 'Rob Vassallo',    short: 'Bobby',    team: 'team-2', index: 9  },
  { id: 'justin-quinn',    name: 'Justin Quinn',    short: 'Justin',   team: 'team-2', index: 10 },
  { id: 'mike-grosh',      name: 'Mike Grosh',      short: 'Mikey',    team: 'team-2', index: 11 },

  { id: 'nick-fowler',     name: 'Nick Fowler',     short: 'Nickie',   team: 'team-3', index: 2  },
  { id: 'alex-kampmann',   name: 'Alex Kampmann',   short: 'Alex',     team: 'team-3', index: 3  },
  { id: 'anthony-gjonaj',  name: 'Anthony Gjonaj',  short: 'Anthony',  team: 'team-3', index: 13 },
  { id: 'farnia-ghavami',  name: 'Farnia Ghavami',  short: 'Farnia',   team: 'team-3', index: 16 }
];

// ---------------------------------------------------------
// SCHEDULE
// ---------------------------------------------------------
// `id` is the Firestore round key. `counts` says what the round feeds:
//   individual - counts toward individual net and the daily low-net money
//   team       - counts toward the daily team total
//   skins      - has its own net skins game
// The scramble counts toward team only.

export const ROUNDS = [
  {
    id: '2026-wed-southern-hills',
    day: 'Wednesday', dayNum: 1, label: 'Day 1',
    course: 'southern-hills', holes: 18, format: 'Individual stroke play',
    counts: { individual: true, team: true, skins: true }
  },
  {
    id: '2026-thu-bay-hill',
    day: 'Thursday', dayNum: 2, label: 'Day 2',
    course: 'bay-hill', holes: 18, format: 'Individual stroke play',
    counts: { individual: true, team: true, skins: true }
  },
  {
    id: '2026-thu-charger-scramble',
    day: 'Thursday', dayNum: 2, label: 'Day 2 Scramble',
    course: 'bay-hill-charger', holes: 9, format: '4-man team scramble',
    scramble: true,
    counts: { individual: false, team: true, skins: false }
  },
  {
    id: '2026-fri-bay-hill',
    day: 'Friday', dayNum: 3, label: 'Day 3',
    course: 'bay-hill', holes: 18, format: 'Individual stroke play',
    counts: { individual: true, team: true, skins: true }
  },
  {
    id: '2026-fri-charger-scramble',
    day: 'Friday', dayNum: 3, label: 'Day 3 Scramble',
    course: 'bay-hill-charger', holes: 9, format: '4-man team scramble',
    scramble: true,
    counts: { individual: false, team: true, skins: false }
  },
  {
    id: '2026-sat-evermore',
    day: 'Saturday', dayNum: 4, label: 'Day 4',
    course: 'evermore-cypress', holes: 18, format: 'Individual stroke play',
    counts: { individual: true, team: true, skins: true }
  }
];

// ---------------------------------------------------------
// THE MONEY
// ---------------------------------------------------------
// `scope` tells the leaderboard how to resolve a winner:
//   day-team       - lowest team net that day
//   day-individual - lowest individual net that day (place 1 or 2)
//   day-skins      - the day's net skins pot
//   event-team     - lowest team net across all four days
//   event-individual - best 3 of 4 rounds, by place

export const PAYOUTS = [
  { id: 'd1-team',   label: 'Day 1 Team Low Net',        amount: 200, perPerson: 50,  scope: 'day-team',       dayNum: 1 },
  { id: 'd1-ind-1',  label: 'Day 1 Individual Low Net',  amount: 75,  perPerson: 75,  scope: 'day-individual', dayNum: 1, place: 1 },
  { id: 'd1-ind-2',  label: 'Day 1 Individual Low Net #2', amount: 50, perPerson: 50, scope: 'day-individual', dayNum: 1, place: 2 },

  { id: 'd2-team',   label: 'Day 2 Team Low Net',        amount: 200, perPerson: 50,  scope: 'day-team',       dayNum: 2 },
  { id: 'd2-ind-1',  label: 'Day 2 Individual Low Net',  amount: 75,  perPerson: 75,  scope: 'day-individual', dayNum: 2, place: 1 },
  { id: 'd2-ind-2',  label: 'Day 2 Individual Low Net #2', amount: 50, perPerson: 50, scope: 'day-individual', dayNum: 2, place: 2 },

  { id: 'd3-team',   label: 'Day 3 Team Low Net',        amount: 200, perPerson: 50,  scope: 'day-team',       dayNum: 3 },
  { id: 'd3-ind-1',  label: 'Day 3 Individual Low Net',  amount: 75,  perPerson: 75,  scope: 'day-individual', dayNum: 3, place: 1 },
  { id: 'd3-ind-2',  label: 'Day 3 Individual Low Net #2', amount: 50, perPerson: 50, scope: 'day-individual', dayNum: 3, place: 2 },

  { id: 'd4-team',   label: 'Day 4 Team Low Net',        amount: 200, perPerson: 50,  scope: 'day-team',       dayNum: 4 },
  { id: 'd4-ind-1',  label: 'Day 4 Individual Low Net',  amount: 75,  perPerson: 75,  scope: 'day-individual', dayNum: 4, place: 1 },
  { id: 'd4-ind-2',  label: 'Day 4 Individual Low Net #2', amount: 50, perPerson: 50, scope: 'day-individual', dayNum: 4, place: 2 },

  { id: 'd1-skins',  label: 'Day 1 Skins', amount: 120, scope: 'day-skins', dayNum: 1 },
  { id: 'd2-skins',  label: 'Day 2 Skins', amount: 120, scope: 'day-skins', dayNum: 2 },
  { id: 'd3-skins',  label: 'Day 3 Skins', amount: 120, scope: 'day-skins', dayNum: 3 },
  { id: 'd4-skins',  label: 'Day 4 Skins', amount: 120, scope: 'day-skins', dayNum: 4 },

  { id: 'team-champ', label: 'Overall Team Champion', amount: 720, perPerson: 180, scope: 'event-team' },

  { id: 'ind-1', label: 'Individual Champion',  amount: 300, perPerson: 300, scope: 'event-individual', place: 1 },
  { id: 'ind-2', label: 'Individual Runner-Up', amount: 225, perPerson: 225, scope: 'event-individual', place: 2 },
  { id: 'ind-3', label: 'Individual 3rd',       amount: 150, perPerson: 150, scope: 'event-individual', place: 3 },
  { id: 'ind-4', label: 'Individual 4th',       amount: 100, perPerson: 100, scope: 'event-individual', place: 4 }
];

// ---------------------------------------------------------
// RULES — the knobs, all in one place
// ---------------------------------------------------------
export const RULES = {
  // All four net scores count toward the daily team total. No drops.
  teamScoresCounted: 4,

  // Individual champion is decided on the best 3 of 4 rounds.
  individualBestOf: 3,
  individualRounds: 4,

  // 4-man scramble allowance: 20% of the four combined course handicaps.
  scrambleAllowancePct: 0.20,

  // Net skins carry over to the next hole when a hole is tied.
  skinsCarryover: true,

  // Gross triple bogey is the most anyone can card. Enforced at entry.
  maxOverPar: 3,

  // Ties split the money. Swap to 'countback' for a card playoff
  // (back 9, then 6, then 3, then 18th) — the engine supports both.
  tieBreak: 'split'
};

export const EVENT = {
  year: 2026,
  name: '2026 Sycamore Cup Classic',
  totalPot: PAYOUTS.reduce((sum, p) => sum + p.amount, 0)
};

// ---------- small lookups ----------
export function playerById(id) { return PLAYERS.find(p => p.id === id) || null; }
export function teamById(id)   { return TEAMS.find(t => t.id === id) || null; }
export function roundById(id)  { return ROUNDS.find(r => r.id === id) || null; }
export function courseFor(round) { return COURSES[round.course] || null; }
export function teamRoster(teamId) { return PLAYERS.filter(p => p.team === teamId); }
export function scoringRounds() { return ROUNDS.filter(r => r.counts.individual); }

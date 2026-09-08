// =========================================================
// Sycamore Cup Classic — scoring engine
// =========================================================
// Pure calculation. No DOM, no network. Everything here can be
// run and checked on its own, which is the point: the money
// depends on these numbers being right.

import { COURSES, PLAYERS, TEAMS, ROUNDS, RULES, playerById, roundById, substituteFor } from './tournament-2026.js';

// ---------------------------------------------------------
// HANDICAPS
// ---------------------------------------------------------

// Playing-handicap overrides, set from the admin panel and keyed
// `${roundId}__${playerId}`. The computed course handicap is correct USGA maths,
// but it works off whole-number indexes, and a real GHIN index has a decimal —
// 16 gives 20 at Southern Hills blue while a true 15.6 gives 19. Rather than
// guess, an admin can pin the number for any player on any round.
//
// This is a module-level registry rather than another argument because
// playerRound() is called from a dozen places; threading a map through every one
// of them the week of the trip is how you break the money.
let HCP_OVERRIDES = {};

export function setHandicapOverrides(map) { HCP_OVERRIDES = map || {}; }

export function handicapOverride(playerId, roundId) {
  const v = HCP_OVERRIDES[`${roundId}__${playerId}`];
  return (v === undefined || v === null || v === '') ? null : Number(v);
}

// Course Handicap = Index x (Slope / 113) + (Rating - Par)
//
// The (Rating - Par) term is what makes scores comparable when players
// choose different tees, which they do here. A nine-hole round uses half
// the index against the nine's own rating and par.
export function courseHandicap(index, course, teeKey) {
  if (index === null || index === undefined) return null;
  const tee = course.tees[teeKey] || course.tees[course.defaultTee];
  if (!tee) return null;

  const isNine = course.holes === 9;
  const workingIndex = isNine ? index / 2 : index;

  const raw = workingIndex * (tee.slope / 113) + (tee.rating - course.par);
  return Math.round(raw);
}

// Which holes a player gets a stroke on, and how many.
// A course handicap of 20 over 18 holes is one stroke everywhere plus a
// second on the two hardest holes. Negative handicaps give strokes back
// on the EASIEST holes, which is the correct treatment for a plus player.
export function strokesByHole(courseHcp, course) {
  const n = course.holes;
  const out = new Array(n).fill(0);
  if (!courseHcp) return out;

  if (courseHcp > 0) {
    const full = Math.floor(courseHcp / n);
    const extra = courseHcp % n;
    for (let i = 0; i < n; i++) {
      out[i] = full + (course.hcp[i] <= extra ? 1 : 0);
    }
  } else {
    // Plus handicap: strokes come back, starting at the easiest hole.
    const give = Math.abs(courseHcp);
    for (let i = 0; i < n; i++) {
      out[i] = (course.hcp[i] > n - give) ? -1 : 0;
    }
  }
  return out;
}

// ---------------------------------------------------------
// THE CAP
// ---------------------------------------------------------
// Gross triple bogey is the most anyone can card: 6 on a par 3,
// 7 on a par 4, 8 on a par 5. Enforced when a score is entered,
// not quietly applied afterwards, so nobody is surprised later.
export function maxGrossForHole(par) {
  return par + RULES.maxOverPar;
}

export function capGross(strokes, par) {
  if (strokes === null || strokes === undefined) return null;
  const max = maxGrossForHole(par);
  return Math.min(Number(strokes), max);
}

export function wasCapped(strokes, par) {
  if (strokes === null || strokes === undefined) return false;
  return Number(strokes) > maxGrossForHole(par);
}

// ---------------------------------------------------------
// A SINGLE PLAYER'S ROUND
// ---------------------------------------------------------
// holeScores: sparse object { 1: 5, 2: 4, ... } of GROSS strokes.
// Returns per-hole detail plus running totals. Only holes actually
// played are counted, so a leaderboard mid-round is still meaningful.
export function playerRound(player, round, holeScores, teeKey) {
  const course = COURSES[round.course];
  const tee = teeKey || course.defaultTee;

  // If someone is standing in for this player on this round, the round is played
  // off the substitute's index. Everything else — team totals, the individual
  // tournament, skins — still counts for the rostered player, because this is the
  // only place the index is read.
  const sub = substituteFor(player.id, round.id);
  const playingIndex = sub ? sub.index : player.index;

  // An admin-pinned playing handicap wins over the calculated one.
  const pinned = handicapOverride(player.id, round.id);
  const chcp = pinned !== null ? pinned : courseHandicap(playingIndex, course, tee);
  const pops = strokesByHole(chcp, course);

  const holes = [];
  let grossOut = 0, grossIn = 0, netOut = 0, netIn = 0;
  let played = 0, toPar = 0, netToPar = 0;

  for (let i = 0; i < course.holes; i++) {
    const par = course.pars[i];
    const raw = holeScores[i + 1];
    const gross = (raw === undefined || raw === null) ? null : capGross(raw, par);
    const pop = pops[i];
    const net = gross === null ? null : gross - pop;

    if (gross !== null) {
      played++;
      toPar += gross - par;
      netToPar += net - par;
      if (i < 9) { grossOut += gross; netOut += net; }
      else { grossIn += gross; netIn += net; }
    }

    holes.push({
      hole: i + 1, par, hcp: course.hcp[i],
      gross, net, pops: pop,
      capped: wasCapped(raw, par)
    });
  }

  return {
    playerId: player.id,
    roundId: round.id,
    tee,
    courseHandicap: chcp,
    holes,
    grossOut, grossIn, grossTotal: grossOut + grossIn,
    netOut, netIn, netTotal: netOut + netIn,
    holesPlayed: played,
    complete: played === course.holes,
    toPar,             // gross vs par
    netToPar,          // net vs par — this is the one the money runs on
    sub,               // null, or who is standing in for this player
    playingIndex,
    hcpPinned: pinned !== null
  };
}

// ---------------------------------------------------------
// INDIVIDUAL LEADERBOARD — one round
// ---------------------------------------------------------
export function individualLeaderboard(round, scoresByPlayer, teeByPlayer) {
  const rows = PLAYERS.map(p => {
    const r = playerRound(p, round, scoresByPlayer[p.id] || {}, (teeByPlayer || {})[p.id]);
    return {
      player: p,
      team: TEAMS.find(t => t.id === p.team),
      ...r
    };
  }).filter(r => r.holesPlayed > 0);

  rows.sort((a, b) => {
    if (a.netTotal !== b.netTotal) return a.netTotal - b.netTotal;
    if (b.holesPlayed !== a.holesPlayed) return b.holesPlayed - a.holesPlayed;
    return a.player.name.localeCompare(b.player.name);
  });

  return assignPositions(rows, r => r.netTotal);
}

// Shared position logic: equal scores share a position and the next
// position skips accordingly (1, T2, T2, 4).
function assignPositions(rows, valueOf) {
  let lastVal = null, lastPos = 0;
  rows.forEach((row, i) => {
    const v = valueOf(row);
    if (v === lastVal) {
      row.position = lastPos;
      row.tied = true;
    } else {
      row.position = i + 1;
      row.tied = false;
      lastPos = i + 1;
      lastVal = v;
    }
  });
  // mark the earlier member of a tie as tied too
  rows.forEach((row, i) => {
    const next = rows[i + 1];
    if (next && next.position === row.position) row.tied = true;
  });
  return rows;
}

// ---------------------------------------------------------
// TEAM SCORING
// ---------------------------------------------------------
// All four net scores count. On Thursday and Friday the scramble nine
// is folded into the same day's team total.
export function teamDayTotals(dayNum, allScores, teeByPlayer, teamScrambleScores) {
  const dayRounds = ROUNDS.filter(r => r.dayNum === dayNum);
  const strokeRounds = dayRounds.filter(r => !r.scramble);
  const scrambleRounds = dayRounds.filter(r => r.scramble);

  return TEAMS.map(team => {
    const roster = PLAYERS.filter(p => p.team === team.id);

    let net = 0, gross = 0, holesPlayed = 0;
    const members = roster.map(p => {
      let pNet = 0, pGross = 0, pPlayed = 0;
      strokeRounds.forEach(round => {
        const r = playerRound(p, round, (allScores[round.id] || {})[p.id] || {}, (teeByPlayer || {})[p.id]);
        pNet += r.netTotal; pGross += r.grossTotal; pPlayed += r.holesPlayed;
      });
      net += pNet; gross += pGross; holesPlayed += pPlayed;
      return { player: p, net: pNet, gross: pGross, holesPlayed: pPlayed };
    });

    // Scramble contribution
    let scramble = null;
    scrambleRounds.forEach(round => {
      const s = scrambleTeamScore(team.id, round, (teamScrambleScores || {})[round.id] || {}, teeByPlayer);
      if (s && s.holesPlayed > 0) {
        scramble = s;
        net += s.net;
        gross += s.gross;
        holesPlayed += s.holesPlayed;
      }
    });

    return { team, members, net, gross, holesPlayed, scramble };
  }).filter(r => r.holesPlayed > 0)
    .sort((a, b) => a.net - b.net);
}

// A 4-man scramble plays one ball. Allowance is 20% of the four
// combined course handicaps for that nine.
export function scrambleTeamScore(teamId, round, holeScoresForTeam, teeByPlayer) {
  const course = COURSES[round.course];
  const roster = PLAYERS.filter(p => p.team === teamId);

  const combined = roster.reduce((sum, p) => {
    const tee = (teeByPlayer || {})[p.id] || course.defaultTee;
    const ch = courseHandicap(p.index, course, course.tees[tee] ? tee : course.defaultTee);
    return sum + (ch || 0);
  }, 0);

  const allowance = Math.round(combined * RULES.scrambleAllowancePct);

  const scores = holeScoresForTeam[teamId] || holeScoresForTeam || {};
  let gross = 0, played = 0;
  const holes = [];
  for (let i = 0; i < course.holes; i++) {
    const par = course.pars[i];
    const raw = scores[i + 1];
    const g = (raw === undefined || raw === null) ? null : capGross(raw, par);
    if (g !== null) { gross += g; played++; }
    holes.push({ hole: i + 1, par, gross: g });
  }

  return {
    teamId, roundId: round.id,
    combinedHandicap: combined,
    allowance,
    holes,
    gross,
    net: gross - allowance,
    holesPlayed: played,
    complete: played === course.holes
  };
}

// Team standings across the whole event.
export function teamEventStandings(allScores, teeByPlayer, teamScrambleScores) {
  const totals = {};
  TEAMS.forEach(t => totals[t.id] = { team: t, net: 0, gross: 0, holesPlayed: 0, byDay: {} });

  [1, 2, 3, 4].forEach(dayNum => {
    teamDayTotals(dayNum, allScores, teeByPlayer, teamScrambleScores).forEach(row => {
      const acc = totals[row.team.id];
      acc.net += row.net;
      acc.gross += row.gross;
      acc.holesPlayed += row.holesPlayed;
      acc.byDay[dayNum] = row.net;
    });
  });

  const rows = Object.values(totals).filter(r => r.holesPlayed > 0).sort((a, b) => a.net - b.net);
  return assignPositions(rows, r => r.net);
}

// ---------------------------------------------------------
// SKINS — net and gross
// ---------------------------------------------------------
// One skin unit per hole. The low score alone on a hole takes every unit
// riding on it, including any carried over from tied holes. Units still
// carrying at the end of the round are not awarded, so the pot divides
// among the units that were actually won.
// `mode` picks which number decides the hole: 'net' (handicap applied) or
// 'gross' (raw strokes). Both games run off the same cards and the same
// carryover rule; they are separate pots with separate winners.
export function skinsForRound(round, scoresByPlayer, teeByPlayer, pot, mode = 'net') {
  const gross = mode === 'gross';
  const course = COURSES[round.course];

  const cards = PLAYERS.map(p => ({
    player: p,
    round: playerRound(p, round, scoresByPlayer[p.id] || {}, (teeByPlayer || {})[p.id])
  }));

  const holes = [];
  let carry = 0;
  let unitsAwarded = 0;
  const wonBy = {};

  for (let i = 0; i < course.holes; i++) {
    const entries = cards
      .map(c => ({
        player: c.player,
        net: gross ? c.round.holes[i].gross : c.round.holes[i].net,
        pops: c.round.holes[i].pops
      }))
      .filter(e => e.net !== null);

    const atStake = carry + 1;

    // A hole nobody has finished yet is simply pending — no carry applied.
    if (entries.length === 0) {
      holes.push({ hole: i + 1, par: course.pars[i], status: 'pending', atStake, winner: null, low: null, entries: [] });
      continue;
    }

    const low = Math.min(...entries.map(e => e.net));
    const lowest = entries.filter(e => e.net === low);

    if (lowest.length === 1) {
      const w = lowest[0].player;
      wonBy[w.id] = (wonBy[w.id] || 0) + atStake;
      unitsAwarded += atStake;
      holes.push({
        hole: i + 1, par: course.pars[i], status: 'won',
        atStake, winner: w, low, entries
      });
      carry = 0;
    } else {
      holes.push({
        hole: i + 1, par: course.pars[i], status: 'tied',
        atStake, winner: null, low, entries, tiedCount: lowest.length
      });
      carry = atStake;
    }
  }

  const perUnit = unitsAwarded > 0 ? (pot / unitsAwarded) : 0;

  const winners = Object.entries(wonBy).map(([playerId, units]) => ({
    player: playerById(playerId),
    units,
    amount: units * perUnit
  })).sort((a, b) => b.units - a.units);

  return {
    roundId: round.id,
    mode,
    holes,
    winners,
    unitsAwarded,
    carrying: carry,
    pot,
    perUnit
  };
}

// ---------------------------------------------------------
// INDIVIDUAL CHAMPIONSHIP — all four rounds count
// ---------------------------------------------------------
export function individualStandings(allScores, teeByPlayer) {
  const rounds = ROUNDS.filter(r => r.counts.individual);

  const rows = PLAYERS.map(p => {
    const played = rounds.map(round => {
      const r = playerRound(p, round, (allScores[round.id] || {})[p.id] || {}, (teeByPlayer || {})[p.id]);
      return { round, ...r };
    }).filter(r => r.holesPlayed > 0);

    const complete = played.filter(r => r.complete);
    // individualBestOf is currently set to all 4 rounds (no drops), but this
    // stays generic in case that ever changes back to a best-N-of-4 format.
    const counting = [...complete].sort((a, b) => a.netTotal - b.netTotal)
      .slice(0, RULES.individualBestOf);

    const total = counting.reduce((s, r) => s + r.netTotal, 0);
    const dropped = complete.filter(r => !counting.includes(r));

    return {
      player: p,
      team: TEAMS.find(t => t.id === p.team),
      rounds: played,
      countingRounds: counting,
      droppedRounds: dropped,
      roundsComplete: complete.length,
      total,
      // Until a player has all four rounds finished this is a running
      // number, not a final one. The page should say so rather than imply a result.
      provisional: complete.length < RULES.individualBestOf
    };
  }).filter(r => r.rounds.length > 0);

  rows.sort((a, b) => {
    if (a.roundsComplete !== b.roundsComplete) return b.roundsComplete - a.roundsComplete;
    return a.total - b.total;
  });

  return assignPositions(rows, r => `${r.roundsComplete}:${r.total}`);
}

// ---------------------------------------------------------
// TIES AND MONEY
// ---------------------------------------------------------
// Ties split by default. Countback (back 9, then 6, then 3, then 18th)
// is here so switching is a one-word change in RULES, not a rebuild.
export function countbackCompare(a, b) {
  const seg = (card, from) => card.holes.slice(from)
    .filter(h => h.net !== null)
    .reduce((s, h) => s + h.net, 0);
  for (const from of [9, 12, 15, 17]) {
    const d = seg(a, from) - seg(b, from);
    if (d !== 0) return d;
  }
  return 0;
}

export function resolveTie(rows) {
  if (RULES.tieBreak === 'countback') {
    return [...rows].sort(countbackCompare);
  }
  return rows;
}

// Splits a prize across everyone tied for a position.
export function splitPrize(amount, winners) {
  const n = Math.max(winners.length, 1);
  return winners.map(w => ({ ...w, amount: amount / n, split: n > 1 }));
}

export function formatMoney(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}


// ---------------------------------------------------------
// TO-PAR HELPERS
// ---------------------------------------------------------
// Golf reads scores against par, not as raw totals. These live here rather than
// in either UI so the spectator leaderboard and the scoring app show the same
// number for the same card.

export function fmtToPar(n) {
  if (n === null || n === undefined) return '\u2014';
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}

// A team's net-to-par for one day. Stroke rounds add each member's net-to-par;
// a scramble nine adds the team's own net against the par of the holes played.
export function teamDayToPar(teamId, dayNum, scoresByRound, teamScoresByRound, teeMap) {
  const dayRounds = ROUNDS.filter(r => r.dayNum === dayNum);
  let toPar = 0, played = false;

  dayRounds.forEach(round => {
    if (round.scramble) {
      const sc = scrambleTeamScore(teamId, round, (teamScoresByRound || {})[round.id] || {}, teeMap);
      if (sc.holesPlayed > 0) {
        played = true;
        const parPlayed = sc.holes.filter(h => h.gross !== null).reduce((sum, h) => sum + h.par, 0);
        toPar += sc.net - parPlayed;
      }
    } else {
      PLAYERS.filter(p => p.team === teamId).forEach(p => {
        const holeScores = ((scoresByRound || {})[round.id] || {})[p.id] || {};
        const rr = playerRound(p, round, holeScores, (teeMap || {})[p.id]);
        if (rr.holesPlayed > 0) { played = true; toPar += rr.netToPar; }
      });
    }
  });

  return { toPar, played };
}

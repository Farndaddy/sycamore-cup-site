// =========================================================
// 2026 — LIV-style live leaderboard for years/2026.html
// =========================================================
// A read-only, spectator-facing view of the same live scores that
// power scoring.html. Nobody needs to sign in or claim a card to see
// this — Live.start() just gets an anonymous browser identity, which
// is all the security rules require to read.
//
// Individual and team totals here are the same official numbers the
// Individual/Teams/Money tabs use (all four rounds count, no drops —
// see RULES.individualBestOf in tournament-2026.js) — this view just
// reformats them relative to par, LIV-style, instead of raw net
// strokes.
import { COURSES, PLAYERS, ROUNDS } from './tournament-2026.js';
import { individualStandings, teamEventStandings, playerRound, scrambleTeamScore } from './scoring-engine.js';
import * as Live from './live.js';

const mount = document.getElementById('liv-board');
if (mount) boot();

async function boot() {
  if (!Live.isConfigured()) {
    mount.innerHTML = banner('Live scoring is not connected yet.', 'Once Firebase is wired up this board fills in on its own.');
    return;
  }
  try {
    await Live.start();
  } catch (e) {
    mount.innerHTML = banner("Couldn't reach the scoring database.", e.message);
    return;
  }

  const S = { scores: {}, teamScores: {}, players: {}, rounds: {}, view: 'players' };

  Live.watchPlayers(p => { S.players = p; render(S); });
  Live.watchAllScores(s => { S.scores = s; render(S); });
  Live.watchTeamScores(t => { S.teamScores = t; render(S); });
  Live.watchRounds(r => { S.rounds = r; render(S); });

  render(S);
}

function banner(title, body) {
  return `<div class="banner warn"><strong>${title}</strong>${body ? ' ' + body : ''}</div>`;
}

// A player's tee choice can change round to round, but the engine's
// event-total functions take one flat map applied to every round (the
// same simplification scoring.html itself uses). We use each player's
// most recent tee pick as that one reference.
function referenceTeeMap(players) {
  const lastRound = ROUNDS[ROUNDS.length - 1];
  const out = {};
  PLAYERS.forEach(p => {
    const doc = players[p.id];
    const course = COURSES[lastRound.course];
    let chosen = null;
    for (let i = ROUNDS.length - 1; i >= 0; i--) {
      const t = doc && doc.tees ? doc.tees[ROUNDS[i].id] : null;
      if (t) { chosen = t; break; }
    }
    out[p.id] = (chosen && course.tees[chosen]) ? chosen : course.defaultTee;
  });
  return out;
}

function statusInfo(S) {
  const strokeRounds = ROUNDS.filter(r => r.counts.individual);
  let lastFinished = null, current = null;
  strokeRounds.forEach(r => {
    const locked = !!(S.rounds[r.id] && S.rounds[r.id].locked);
    const hasAny = Object.keys(S.scores[r.id] || {}).length > 0;
    if (locked) lastFinished = r;
    else if (hasAny) current = r;
  });
  if (current) return { title: `${current.day}'s round is underway`, sub: 'Scores update live as the guys tap them in.' };
  if (lastFinished) return { title: `${lastFinished.day}'s round has now finished`, sub: 'See the standings below.' };
  return { title: 'Tee times are set', sub: 'The board fills in once Wednesday tees off.' };
}

function initials(name) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(); }

function avatarSmall(player) {
  const base = `../assets/players/${player.id}`;
  const fb = initials(player.name);
  return `<div class="liv-avatar" data-base="${base}" data-ext-i="0" data-fallback="${fb}">
    <img src="${base}.png" alt="" onerror="handleAvatarError2(this)">
  </div>`;
}
// Same fallback-extension probing as app.js's avatarHTML, kept local so
// this module doesn't depend on load order for a global helper.
window.handleAvatarError2 = function (img) {
  const wrap = img.parentElement;
  const exts = ['jpg', 'jpeg', 'webp'];
  const i = Number(wrap.dataset.extI || 0);
  if (i < exts.length) {
    wrap.dataset.extI = String(i + 1);
    img.src = `${wrap.dataset.base}.${exts[i]}`;
  } else {
    wrap.innerHTML = wrap.dataset.fallback;
  }
};

// ---------- relative-to-par formatting ----------
// -4, E, +3 — same convention as the "To Par" tile on the My Card tab.
function fmtToPar(n) { return n > 0 ? `+${n}` : (n === 0 ? 'E' : String(n)); }

// Net-to-par for one played round: sum of (net - par) over holes actually
// played so far. Works mid-round too, e.g. "-1 thru 5".
function netToPar(playerRoundResult) {
  return playerRoundResult.holes.reduce((s, h) => h.net !== null ? s + (h.net - h.par) : s, 0);
}

function render(S) {
  const status = statusInfo(S);
  mount.innerHTML = `
    <div class="liv-top">
      <div class="liv-toggle" id="liv-toggle">
        <button class="tp-players ${S.view === 'players' ? 'on' : ''}" data-view="players">Players</button>
        <button class="tp-teams ${S.view === 'teams' ? 'on' : ''}" data-view="teams">Teams</button>
      </div>
      <div class="liv-status"><strong>${status.title}</strong><span>${status.sub}</span></div>
    </div>
    <h2 class="liv-heading ${S.view === 'teams' ? 'tp-teams' : ''}">All Rounds</h2>
    <div id="liv-table-wrap"></div>
  `;

  document.querySelectorAll('#liv-toggle button').forEach(b =>
    b.addEventListener('click', () => { S.view = b.dataset.view; render(S); }));

  const wrap = document.getElementById('liv-table-wrap');
  wrap.innerHTML = S.view === 'players' ? playersTable(S) : teamsTable(S);
}

function playersTable(S) {
  const teeMap = referenceTeeMap(S.players);
  const rows = individualStandings(S.scores, teeMap);

  if (!rows.length) {
    return `<p class="liv-note">No individual scores yet — this fills in once Wednesday's round starts.</p>`;
  }

  const body = rows.map(r => {
    const byDay = {};
    r.rounds.forEach(rr => { byDay[rr.round.dayNum] = rr; });

    const cells = [1, 2, 3, 4].map(d => {
      const rr = byDay[d];
      if (!rr) return `<td class="num"><span class="liv-round dash">—</span></td>`;
      const course = COURSES[rr.round.course];
      const thru = rr.complete ? '' : `<span class="thru">thru ${rr.holesPlayed}/${course.holes}</span>`;
      return `<td class="num"><span class="liv-round">${fmtToPar(netToPar(rr))}${thru}</span></td>`;
    }).join('');

    // All four rounds count (RULES.individualBestOf = 4), so countingRounds
    // is every complete round — total is provisional until all four are in.
    const totalToPar = r.countingRounds.reduce((s, rr) => s + netToPar(rr), 0);

    return `
      <tr>
        <td class="liv-pos">${r.tied ? 'T' : ''}${r.position}</td>
        <td>
          <div class="liv-who">
            ${avatarSmall(r.player)}
            <div class="liv-namecol">
              <div class="n">${r.player.name}</div>
              <div class="t">${r.team.name}</div>
            </div>
          </div>
        </td>
        ${cells}
        <td class="num"><span class="liv-tot ${r.roundsComplete > 0 ? 'under' : ''}">${r.roundsComplete ? fmtToPar(totalToPar) : '—'}</span></td>
      </tr>`;
  }).join('');

  return `
    <table class="liv-table">
      <thead><tr>
        <th></th><th>Player</th>
        <th class="num">Rd 1</th><th class="num">Rd 2</th><th class="num">Rd 3</th><th class="num">Rd 4</th>
        <th class="num">Tot</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="liv-note">Net, relative to par. All four rounds count toward the total — no drops.
    A player under four finished rounds is still provisional.</p>`;
}

// A team's day total is every member's net-to-par for that day's stroke
// round, plus (Thursday/Friday) the scramble nine's net-to-par folded in —
// exactly what teamDayTotals sums in raw strokes, just reformatted.
function teamDayToPar(teamId, dayNum, S, teeMap) {
  const dayRounds = ROUNDS.filter(r => r.dayNum === dayNum);
  let toPar = 0, played = false;

  dayRounds.forEach(round => {
    if (round.scramble) {
      const s = scrambleTeamScore(teamId, round, S.teamScores[round.id] || {}, teeMap);
      if (s.holesPlayed > 0) {
        played = true;
        const parPlayed = s.holes.filter(h => h.gross !== null).reduce((sum, h) => sum + h.par, 0);
        toPar += s.net - parPlayed;
      }
    } else {
      PLAYERS.filter(p => p.team === teamId).forEach(p => {
        const holeScores = (S.scores[round.id] || {})[p.id] || {};
        const rr = playerRound(p, round, holeScores, teeMap[p.id]);
        if (rr.holesPlayed > 0) { played = true; toPar += netToPar(rr); }
      });
    }
  });

  return { toPar, played };
}

function teamsTable(S) {
  const teeMap = referenceTeeMap(S.players);
  // Ranking (position/tied) stays on the official raw-net standings —
  // only the displayed numbers below are converted to relative-to-par.
  const rows = teamEventStandings(S.scores, teeMap, S.teamScores);

  if (!rows.length) {
    return `<p class="liv-note">No team scores yet — this fills in once Wednesday's round starts.</p>`;
  }

  const body = rows.map(r => {
    let grandToPar = 0;
    const cells = [1, 2, 3, 4].map(d => {
      const { toPar, played } = teamDayToPar(r.team.id, d, S, teeMap);
      if (!played) return `<td class="num"><span class="liv-round dash">—</span></td>`;
      grandToPar += toPar;
      return `<td class="num"><span class="liv-round">${fmtToPar(toPar)}</span></td>`;
    }).join('');
    return `
      <tr>
        <td class="liv-pos">${r.tied ? 'T' : ''}${r.position}</td>
        <td><div class="liv-who"><span class="team-dot dot-${r.team.id}" style="width:14px;height:14px;"></span>
          <div class="liv-namecol"><div class="n">${r.team.name}</div></div></div></td>
        ${cells}
        <td class="num"><span class="liv-tot under">${fmtToPar(grandToPar)}</span></td>
      </tr>`;
  }).join('');

  return `
    <table class="liv-table">
      <thead><tr>
        <th></th><th>Team</th>
        <th class="num">Day 1</th><th class="num">Day 2</th><th class="num">Day 3</th><th class="num">Day 4</th>
        <th class="num">Tot</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="liv-note">Net, relative to par, summed across all four members each day — no drops.
    Thursday and Friday's scramble nine is folded into that day's number.</p>`;
}

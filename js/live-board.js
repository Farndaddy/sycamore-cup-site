// =========================================================
// 2026 — LIV-style live leaderboard for years/2026.html
// =========================================================
// A read-only, spectator-facing view of the same live scores that
// power scoring.html. Nobody needs to sign in or claim a card to see
// this — Live.start() just gets an anonymous browser identity, which
// is all the security rules require to read.
//
// Numbers here are meant to match scoring.html exactly, not to be a
// second, competing source of truth. So the individual TOTAL column
// is the official best-3-of-4 total (the one the $300 is decided on),
// with the dropped round shown struck through rather than hidden —
// and both views reuse the exact same engine functions the Individual
// and Teams tabs already use.
import { COURSES, TEAMS, PLAYERS, ROUNDS, playerById, roundById } from './tournament-2026.js';
import { individualStandings, teamEventStandings } from './scoring-engine.js';
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
// best-3-of-4 / team-total functions take one flat map applied to every
// round (the same simplification scoring.html itself uses). We use each
// player's most recent tee pick as that one reference.
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

function fmtNet(n) { return n > 0 ? `+${n}` : (n === 0 ? 'E' : String(n)); }

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
      const dropped = r.droppedRounds.includes(rr);
      const cls = ['liv-round', dropped ? 'dropped' : ''].filter(Boolean).join(' ');
      const course = COURSES[rr.round.course];
      const thru = rr.complete ? '' : `<span class="thru">thru ${rr.holesPlayed}/${course.holes}</span>`;
      return `<td class="num"><span class="${cls}">${rr.netTotal}${thru}</span></td>`;
    }).join('');

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
        <td class="num"><span class="liv-tot ${r.roundsComplete > 0 ? 'under' : ''}">${r.roundsComplete ? r.total : '—'}</span></td>
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
    <p class="liv-note">Net scores. Total counts the best 3 of 4 rounds — the dropped round is struck through.
    A player under three finished rounds is still provisional.</p>`;
}

function teamsTable(S) {
  const teeMap = referenceTeeMap(S.players);
  const rows = teamEventStandings(S.scores, teeMap, S.teamScores);

  if (!rows.length) {
    return `<p class="liv-note">No team scores yet — this fills in once Wednesday's round starts.</p>`;
  }

  const body = rows.map(r => {
    const cells = [1, 2, 3, 4].map(d => {
      const v = r.byDay[d];
      return `<td class="num">${v !== undefined ? `<span class="liv-round">${v}</span>` : `<span class="liv-round dash">—</span>`}</td>`;
    }).join('');
    return `
      <tr>
        <td class="liv-pos">${r.tied ? 'T' : ''}${r.position}</td>
        <td><div class="liv-who"><span class="team-dot dot-${r.team.id}" style="width:14px;height:14px;"></span>
          <div class="liv-namecol"><div class="n">${r.team.name}</div></div></div></td>
        ${cells}
        <td class="num"><span class="liv-tot under">${r.net}</span></td>
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
    <p class="liv-note">All four net scores count toward each team's daily total — no drops.
    Thursday and Friday scramble nines are folded into that day's number.</p>`;
}

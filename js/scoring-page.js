// =========================================================
// Sycamore Cup Classic — live scoring page
// =========================================================
import {
  COURSES, TEAMS, PLAYERS, ROUNDS, PAYOUTS, RULES, EVENT,
  playerById, teamById, roundById
} from './tournament-2026.js';

import {
  courseHandicap, strokesByHole, capGross, maxGrossForHole, playerRound,
  individualLeaderboard, teamDayTotals, teamEventStandings,
  skinsForRound, individualStandings, formatMoney, fmtToPar, teamDayToPar,
  setHandicapOverrides
} from './scoring-engine.js';

import * as Live from './live.js';

initShell('scoring');

// ---------------------------------------------------------
// STATE
// ---------------------------------------------------------
const S = {
  scores: {},        // { roundId: { playerId: { hole: strokes } } }
  scoreMeta: {},     // same shape, carrying firstAt / editCount
  teamScores: {},    // { roundId: { teamId: { hole: strokes } } }
  players: {},       // firestore player docs
  rounds: {},        // firestore round docs (locked flags)
  me: null,          // whose card is on screen (anyone can score for anyone)
  roundId: ROUNDS[0].id,
  tab: 'card',
  boardSide: 'individual',   // 'individual' | 'teams'
  boardScope: 'round',       // 'round' | 'event'
  moneyMode: 'day',          // 'day' | 'type' | 'overall'
  moneyDay: 1,
  moneyType: 'team',
  skinsView: 'net',  // 'net' | 'gross' — two separate skins games
  ready: false
};

const $ = id => document.getElementById(id);

// ---------------------------------------------------------
// BOOT
// ---------------------------------------------------------
(async function boot() {
  buildRoundSelect();
  wireTabs();

  if (!Live.isConfigured()) {
    banner('warn', 'Live scoring is not connected', 'The Firebase settings are missing from this build.');
    return;
  }

  try {
    await Live.start();
  } catch (e) {
    banner('warn', "Couldn't reach the scoring database", e.message);
    return;
  }

  Live.watchPlayers(p => { S.players = p; pushHandicapOverrides(); render(); });
  Live.watchAllScores((s, m) => { S.scores = s; S.scoreMeta = m; render(); });
  Live.watchTeamScores(t => { S.teamScores = t; render(); });
  Live.watchRounds(r => { S.rounds = r; render(); });

  S.me = rememberedWho();
  S.ready = true;

  if (!S.me) openSignIn();
  render();
})();

function banner(kind, title, body) {
  $('status-banner').innerHTML =
    `<div class="banner ${kind === 'warn' ? 'warn' : ''}"><strong>${title}</strong>${body || ''}</div>`;
}

// ---------------------------------------------------------
// ROUND PICKER + TABS
// ---------------------------------------------------------
function buildRoundSelect() {
  const sel = $('round-select');
  sel.innerHTML = ROUNDS.map(r => {
    const c = COURSES[r.course];
    return `<option value="${r.id}">${r.day} — ${c.short}${r.scramble ? ' (Scramble)' : ''}</option>`;
  }).join('');
  sel.value = S.roundId;
  sel.addEventListener('change', () => { S.roundId = sel.value; render(); });
}

function wireTabs() {
  $('tabbar').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    S.tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === btn));
    document.querySelectorAll('.tabpane').forEach(p => p.classList.remove('active'));
    $('pane-' + S.tab).classList.add('active');
    render();
  });
  $('ident-switch').addEventListener('click', openSignIn);
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
function currentRound() { return roundById(S.roundId); }
function isLocked(roundId) { const r = S.rounds[roundId]; return !!(r && r.locked); }

function teeFor(playerId, roundId) {
  const p = S.players[playerId];
  const round = roundById(roundId);
  const course = COURSES[round.course];
  const chosen = p && p.tees ? p.tees[roundId] : null;
  return (chosen && course.tees[chosen]) ? chosen : course.defaultTee;
}

function teeMap(roundId) {
  const out = {};
  PLAYERS.forEach(p => out[p.id] = teeFor(p.id, roundId));
  return out;
}

// Admin-pinned playing handicaps live on the player docs as hcp[roundId].
// Hand them to the engine whenever the docs change, so every calculation —
// leaderboard, teams, skins, money — picks them up from one place.
function pushHandicapOverrides() {
  const map = {};
  Object.entries(S.players || {}).forEach(([playerId, docData]) => {
    Object.entries((docData && docData.hcp) || {}).forEach(([roundId, v]) => {
      if (v !== null && v !== undefined && v !== '') map[`${roundId}__${playerId}`] = Number(v);
    });
  });
  setHandicapOverrides(map);
}

function scoresFor(roundId) { return S.scores[roundId] || {}; }

function fmtNet(n) { return n > 0 ? `+${n}` : (n === 0 ? 'E' : String(n)); }
function relPar(strokes, par) { return strokes - par; }

function teamDot(teamId) { return `<span class="team-dot dot-${teamId}"></span>`; }

// ---------------------------------------------------------
// RENDER
// ---------------------------------------------------------
function render() {
  renderIdent();
  renderRoundMeta();
  if (S.tab === 'card')  renderCard();
  if (S.tab === 'board') renderBoard();
  if (S.tab === 'skins') renderSkins();
  if (S.tab === 'money') renderMoney();
}

function renderIdent() {
  const p = S.me ? playerById(S.me) : null;
  $('ident-name').textContent = p ? p.name : 'Not signed in';
  $('ident-switch').textContent = p ? 'Change' : 'Pick player';
}

function renderRoundMeta() {
  const r = currentRound();
  const c = COURSES[r.course];
  const locked = isLocked(r.id);
  $('round-meta').innerHTML =
    `${c.name} · Par ${c.par} · ${r.format}` +
    (locked ? '<span class="round-locked">Final</span>' : '');
}

// ---------------------------------------------------------
// TAB 1 — MY CARD
// ---------------------------------------------------------
function renderCard() {
  const pane = $('pane-card');
  const round = currentRound();
  const course = COURSES[round.course];

  if (!S.me) {
    pane.innerHTML = `<div class="banner"><strong>Pick a name to start scoring</strong>
      Tap &ldquo;Pick player&rdquo; up top and choose whose card to open. You can enter scores for anybody.</div>`;
    return;
  }

  if (round.scramble) { renderScrambleCard(pane, round, course); return; }

  const player = playerById(S.me);
  const tee = teeFor(S.me, round.id);
  const scores = (scoresFor(round.id)[S.me]) || {};
  const r = playerRound(player, round, scores, tee);
  const locked = isLocked(round.id);

  const teeButtons = Object.entries(course.tees).map(([key, t]) => {
    const ch = courseHandicap(player.index, course, key);
    return `<button class="tee-btn ${key === tee ? 'on' : ''}" data-tee="${key}" ${locked ? 'disabled' : ''}>
      ${t.name} <span class="muted">· ${t.yards}y · ${ch} strokes</span>
    </button>`;
  }).join('');

  pane.innerHTML = `
    <div class="tee-row">
      <span class="tee-label">Your tee</span>
      ${teeButtons}
      <span class="tee-hcp">Playing off <strong>${r.courseHandicap}</strong></span>
    </div>

    ${r.sub ? `<div class="banner"><strong>${r.sub.subName} is playing this round for ${player.name}</strong>
      The card is played off ${r.sub.subName.split(' ')[0]}'s index of ${r.sub.index} &mdash; ${player.name} plays off ${player.index} the rest of the week.
      Everything it earns still counts for ${player.name}: his team, his individual total and his skins.</div>` : ''}

    ${locked ? '<div class="banner warn"><strong>This round is final</strong>Scores are locked. Ask Farnia if something needs fixing.</div>' : ''}

    <div class="totals-strip">
      <div class="total-tile"><div class="t-label">Thru</div><div class="t-value">${r.holesPlayed}</div></div>
      <div class="total-tile"><div class="t-label">Gross</div><div class="t-value">${r.holesPlayed ? r.grossTotal : '—'}</div></div>
      <div class="total-tile"><div class="t-label">To Par</div><div class="t-value">${r.holesPlayed ? fmtNet(r.toPar) : '—'}</div></div>
      <div class="total-tile"><div class="t-label">Net</div><div class="t-value">${r.holesPlayed ? r.netTotal : '—'}</div></div>
    </div>

    ${scorecardHTML(r, course, locked)}

    <p class="pane-note">A dot on a hole means you get a stroke there.
    Tap any box to enter your score. Maximum is a gross triple bogey —
    type higher and it saves the max.</p>
  `;

  pane.querySelectorAll('.tee-btn').forEach(b => {
    b.addEventListener('click', async () => {
      await Live.setTee(S.me, round.id, b.dataset.tee);
    });
  });

  if (!locked) {
    pane.querySelectorAll('.score-cell').forEach(cell => {
      cell.addEventListener('click', () => openKeypad(Number(cell.dataset.hole)));
    });
  }
}

function scorecardHTML(r, course, locked) {
  const n = course.holes;
  const half = n === 18 ? 9 : n;

  const seg = (from, to, label) => {
    const holes = r.holes.slice(from, to);
    const gross = holes.reduce((s, h) => s + (h.gross || 0), 0);
    const net = holes.reduce((s, h) => s + (h.net || 0), 0);
    const par = holes.reduce((s, h) => s + h.par, 0);
    const any = holes.some(h => h.gross !== null);
    return `
      <table class="sc-table">
        <thead>
          <tr>
            <th class="row-label">${label}</th>
            ${holes.map(h => `<th>${h.hole}</th>`).join('')}
            <th class="col-total">Tot</th>
          </tr>
        </thead>
        <tbody>
          <tr class="row-par">
            <td class="row-label">Par</td>
            ${holes.map(h => `<td>${h.par}</td>`).join('')}
            <td class="col-total">${par}</td>
          </tr>
          <tr class="row-hcp">
            <td class="row-label">Hcp</td>
            ${holes.map(h => `<td>${h.hcp}</td>`).join('')}
            <td class="col-total">—</td>
          </tr>
          <tr>
            <td class="row-label">Score</td>
            ${holes.map(h => scoreCellHTML(h, locked)).join('')}
            <td class="col-total">${any ? gross : '—'}</td>
          </tr>
          <tr>
            <td class="row-label">Net</td>
            ${holes.map(h => `<td class="${h.net === null ? '' : parClassFor(h.net, h.par)}">${h.net === null ? '·' : h.net}</td>`).join('')}
            <td class="col-total">${any ? net : '—'}</td>
          </tr>
        </tbody>
      </table>`;
  };

  if (n === 18) {
    return `<div class="card-wrap">${seg(0, 9, 'Out')}</div>
            <div class="card-wrap" style="margin-top:18px;">${seg(9, 18, 'In')}</div>`;
  }
  return `<div class="card-wrap">${seg(0, n, 'Hole')}</div>`;
}

function scoreCellHTML(h, locked) {
  const dots = Array.from({ length: Math.max(h.pops, 0) }, () => '<span class="pop-dot"></span>').join('');
  const cls = [
    'score-cell',
    h.gross === null ? 'empty' : '',
    locked ? 'locked' : '',
    h.capped ? 'capped' : '',
    h.gross === null ? '' : parClassFor(h.gross, h.par)
  ].filter(Boolean).join(' ');
  return `<td class="${cls}" data-hole="${h.hole}">
    ${dots ? `<span class="pops">${dots}</span>` : ''}
    ${h.gross === null ? '·' : h.gross}
  </td>`;
}

function parClassFor(strokes, par) {
  const d = strokes - par;
  if (d <= -2) return 'score-under eagle';
  if (d === -1) return 'score-under birdie';
  if (d === 0) return 'score-even';
  return 'score-over bogey-plus';
}

// ---------- scramble card ----------
function renderScrambleCard(pane, round, course) {
  const me = playerById(S.me);
  const team = teamById(me.team);
  const scores = ((S.teamScores[round.id] || {})[team.id]) || {};
  const locked = isLocked(round.id);

  const roster = PLAYERS.filter(p => p.team === team.id);
  const combined = roster.reduce((s, p) =>
    s + (courseHandicap(p.index, course, teeFor(p.id, round.id)) || 0), 0);
  const allowance = Math.round(combined * RULES.scrambleAllowancePct);

  let gross = 0, played = 0;
  const holes = course.pars.map((par, i) => {
    const raw = scores[i + 1];
    const g = (raw === undefined || raw === null) ? null : capGross(raw, par);
    if (g !== null) { gross += g; played++; }
    return { hole: i + 1, par, hcp: course.hcp[i], gross: g, net: g, pops: 0, capped: false };
  });

  pane.innerHTML = `
    <div class="banner"><strong>${team.name} — team scramble</strong>
      One ball, one score per hole. Anyone on the team can enter it.</div>

    <div class="totals-strip">
      <div class="total-tile"><div class="t-label">Thru</div><div class="t-value">${played}</div></div>
      <div class="total-tile"><div class="t-label">Gross</div><div class="t-value">${played ? gross : '—'}</div></div>
      <div class="total-tile"><div class="t-label">Allowance</div><div class="t-value">${allowance}</div></div>
      <div class="total-tile"><div class="t-label">Net</div><div class="t-value">${played ? gross - allowance : '—'}</div></div>
    </div>

    ${scorecardHTML({ holes }, course, locked)}

    <p class="pane-note">Allowance is 20% of the four combined course handicaps for this nine
    (${roster.map(p => courseHandicap(p.index, course, teeFor(p.id, round.id))).join(' + ')} = ${combined},
    20% = ${allowance}). This nine's net rolls into today's team total.</p>
  `;

  if (!locked) {
    pane.querySelectorAll('.score-cell').forEach(cell => {
      cell.addEventListener('click', () => openKeypad(Number(cell.dataset.hole), true));
    });
  }
}

// ---------------------------------------------------------
// TAB 2 — LEADERBOARD (individual + teams, one tab)
// ---------------------------------------------------------
// Same look as the spectator board on the 2026 page, and the same numbers:
// scores read against par, and the ranking comes straight from the engine
// functions the money uses. Nothing is ranked twice.

function boardToggles(round) {
  const side = S.boardSide, scope = S.boardScope;
  return `
    <div class="liv-top">
      <div class="liv-toggle">
        <button class="${side === 'individual' ? 'on tp-players' : ''}" data-side="individual" type="button">Individual</button>
        <button class="${side === 'teams' ? 'on tp-teams' : ''}" data-side="teams" type="button">Teams</button>
      </div>
      <div class="tee-row" style="margin:0;">
        <button class="tee-btn ${scope === 'round' ? 'on' : ''}" data-scope="round" type="button">${round.day}</button>
        <button class="tee-btn ${scope === 'event' ? 'on' : ''}" data-scope="event" type="button">All 4 rounds</button>
      </div>
    </div>`;
}

function subNote(r) {
  return r.sub ? `<em class="sub-flag">${r.sub.subName} playing &middot; off ${r.sub.index}</em>` : '';
}

function renderBoard() {
  const pane = $('pane-board');
  const round = currentRound();
  const teeM = teeMap(round.id);
  let body = '';

  // ---- INDIVIDUAL ----
  if (S.boardSide === 'individual') {
    if (S.boardScope === 'round') {
      if (round.scramble) {
        body = `<div class="banner"><strong>The scramble has no individual scoring</strong>
          It counts toward the team total only. Switch to Teams, or pick another round.</div>`;
      } else {
        const rows = individualLeaderboard(round, scoresFor(round.id), teeM);
        body = rows.length === 0
          ? `<div class="banner"><strong>No scores yet</strong>This board fills in as the guys tap in holes.</div>`
          : `<h3 class="liv-heading">${round.day}</h3>
            <table class="liv-table">
              <thead><tr><th></th><th>Player</th><th class="num">Gross</th><th class="num">Hcp</th><th class="num">Thru</th><th class="num">Net</th></tr></thead>
              <tbody>${rows.map(r => `
                <tr class="${r.player.id === S.me ? 'is-me' : ''}">
                  <td class="liv-pos">${r.tied ? 'T' : ''}${r.position}</td>
                  <td class="liv-who">${avatarHTML(r.player, 'liv-avatar')}
                    <span class="liv-namecol"><span class="n">${r.player.name}</span>
                    <span class="t">${r.team.name}</span>${subNote(r)}</span></td>
                  <td class="num"><span class="liv-round">${r.grossTotal}</span></td>
                  <td class="num"><span class="liv-round">${r.courseHandicap}</span></td>
                  <td class="num"><span class="liv-round">${r.complete ? 'F' : r.holesPlayed}</span></td>
                  <td class="num"><span class="liv-tot ${r.netToPar < 0 ? 'under' : ''}">${fmtToPar(r.netToPar)}</span></td>
                </tr>`).join('')}</tbody>
            </table>
            <p class="liv-note">Scores are net against par. Someone thru 9 has had half the holes
            to move, so read the Thru column alongside the number.</p>`;
      }
    } else {
      const rows = individualStandings(S.scores, teeM);
      const strokeRounds = ROUNDS.filter(r => r.counts.individual);
      body = rows.length === 0
        ? `<div class="banner"><strong>Nothing to rank yet</strong>This is the race for the $300.</div>`
        : `<h3 class="liv-heading">All Rounds</h3>
          <table class="liv-table">
            <thead><tr><th></th><th>Player</th>
              ${strokeRounds.map((r, i) => `<th class="num">Rd ${i + 1}</th>`).join('')}
              <th class="num">Tot</th></tr></thead>
            <tbody>${rows.map(r => {
              const byRound = {};
              r.countingRounds.forEach(rr => { byRound[rr.roundId] = rr; });
              const total = r.countingRounds.reduce((sum, rr) => sum + rr.netToPar, 0);
              return `
                <tr class="${r.player.id === S.me ? 'is-me' : ''}">
                  <td class="liv-pos">${r.tied ? 'T' : ''}${r.position}</td>
                  <td class="liv-who">${avatarHTML(r.player, 'liv-avatar')}
                    <span class="liv-namecol"><span class="n">${r.player.name}</span>
                    <span class="t">${teamById(r.player.team).name}</span></span></td>
                  ${strokeRounds.map(sr => {
                    const rr = byRound[sr.id];
                    return `<td class="num"><span class="${rr ? 'liv-round' : 'liv-round dash'}">${
                      rr ? fmtToPar(rr.netToPar) : '&mdash;'}</span></td>`;
                  }).join('')}
                  <td class="num"><span class="liv-tot ${total < 0 ? 'under' : ''}">${
                    r.roundsComplete ? fmtToPar(total) : '&mdash;'}</span></td>
                </tr>`;
            }).join('')}</tbody>
          </table>
          <p class="liv-note">All four rounds count &mdash; no drops. Anyone with fewer than four
          finished is still provisional.</p>`;
    }

  // ---- TEAMS ----
  } else {
    if (S.boardScope === 'round') {
      const rows = teamDayTotals(round.dayNum, S.scores, teeM, S.teamScores);
      body = rows.length === 0
        ? `<div class="banner"><strong>No team scores yet</strong>Team totals build as holes come in.</div>`
        : `<h3 class="liv-heading tp-teams">${round.day}</h3>
          <table class="liv-table">
            <thead><tr><th></th><th>Team</th><th class="num hide-sm">Net</th><th class="num">To Par</th></tr></thead>
            <tbody>${rows.map((r, i) => {
              const { toPar, played } = teamDayToPar(r.team.id, round.dayNum, S.scores, S.teamScores, teeM);
              return `
                <tr>
                  <td class="liv-pos">${i + 1}</td>
                  <td class="liv-who"><span class="liv-namecol"><span class="n">${teamDot(r.team.id)}${r.team.name}</span></span></td>
                  <td class="num hide-sm"><span class="liv-round">${r.net}</span></td>
                  <td class="num"><span class="liv-tot ${toPar < 0 ? 'under' : ''}">${
                    played ? fmtToPar(toPar) : '&mdash;'}</span></td>
                </tr>`;
            }).join('')}</tbody>
          </table>
          <p class="liv-note tp-teams">Every man's net counts toward the team, plus the scramble nine on
          Thursday and Friday.</p>`;
    } else {
      const rows = teamEventStandings(S.scores, teeM, S.teamScores);
      const days = [1, 2, 3, 4];
      body = rows.length === 0
        ? `<div class="banner"><strong>Nothing to rank yet</strong>This is the race for the Cup.</div>`
        : `<h3 class="liv-heading tp-teams">All Four Days</h3>
          <table class="liv-table">
            <thead><tr><th></th><th>Team</th>
              ${days.map(d => `<th class="num">D${d}</th>`).join('')}<th class="num">Tot</th></tr></thead>
            <tbody>${rows.map((r, i) => {
              let grand = 0, anyPlayed = false;
              const cells = days.map(d => {
                const { toPar, played } = teamDayToPar(r.team.id, d, S.scores, S.teamScores, teeM);
                if (played) { grand += toPar; anyPlayed = true; }
                return `<td class="num"><span class="${played ? 'liv-round' : 'liv-round dash'}">${
                  played ? fmtToPar(toPar) : '&mdash;'}</span></td>`;
              }).join('');
              return `
                <tr>
                  <td class="liv-pos">${i + 1}</td>
                  <td class="liv-who"><span class="liv-namecol"><span class="n">${teamDot(r.team.id)}${r.team.name}</span></span></td>
                  ${cells}
                  <td class="num"><span class="liv-tot ${grand < 0 ? 'under' : ''}">${
                    anyPlayed ? fmtToPar(grand) : '&mdash;'}</span></td>
                </tr>`;
            }).join('')}</tbody>
          </table>
          <p class="liv-note tp-teams">Lowest total across the week takes the Cup and the $720.</p>`;
    }
  }

  pane.innerHTML = `<div class="liv-board">${boardToggles(round)}${body}</div>`;

  pane.querySelectorAll('[data-side]').forEach(b =>
    b.addEventListener('click', () => { S.boardSide = b.dataset.side; render(); }));
  pane.querySelectorAll('[data-scope]').forEach(b =>
    b.addEventListener('click', () => { S.boardScope = b.dataset.scope; render(); }));
}

// ---------------------------------------------------------
// TAB 4 — SKINS
// ---------------------------------------------------------
function renderSkins() {
  const pane = $('pane-skins');
  const round = currentRound();

  if (!round.counts.skins) {
    pane.innerHTML = `<div class="banner"><strong>No skins on the scramble</strong>
      Skins run on the four 18-hole rounds only.</div>`;
    return;
  }

  // Two separate games on the same holes: net (handicap applied) and gross (raw
  // strokes), each with its own pot and its own winners.
  const gross = S.skinsView === 'gross';
  const scope = gross ? 'day-gross-skins' : 'day-skins';
  const pot = (PAYOUTS.find(p => p.scope === scope && p.dayNum === round.dayNum) || {}).amount || 0;
  const sk = skinsForRound(round, scoresFor(round.id), teeMap(round.id), pot, gross ? 'gross' : 'net');
  const word = gross ? 'gross' : 'net';

  const grid = sk.holes.map(h => {
    const cls = ['skin-hole', h.status, h.atStake > 1 ? 'carry-in' : ''].filter(Boolean).join(' ');
    let who = '—', val = '';
    if (h.status === 'won') { who = h.winner.short; val = `${word} ${h.low}${h.atStake > 1 ? ` · ${h.atStake} skins` : ''}`; }
    else if (h.status === 'tied') { who = `${h.tiedCount} tied`; val = `${word} ${h.low} · carries`; }
    else { who = '—'; val = 'not in'; }
    return `<div class="${cls}">
      <div class="sh-num">Hole ${h.hole}</div>
      <div class="sh-who">${who}</div>
      <div class="sh-val">${val}</div>
    </div>`;
  }).join('');

  pane.innerHTML = `
    <div class="pane-head">
      <h2>${round.day} skins</h2>
      <span class="muted">${formatMoney(pot)} pot</span>
    </div>

    <div class="tee-row" style="margin-bottom:16px;">
      <button class="tee-btn ${gross ? '' : 'on'}" data-skinsview="net" type="button">Net Skins</button>
      <button class="tee-btn ${gross ? 'on' : ''}" data-skinsview="gross" type="button">Gross Skins</button>
    </div>

    ${sk.carrying > 0 ? `<div class="carry-note"><strong>${sk.carrying} skin${sk.carrying > 1 ? 's' : ''} carrying.</strong>
      Next hole won outright takes ${sk.carrying + 1}.</div>` : ''}

    ${sk.winners.length ? `
      <table class="lb" style="margin-bottom:22px;">
        <thead><tr><th>Holding skins</th><th class="num">Skins</th><th class="num">Worth</th></tr></thead>
        <tbody>${sk.winners.map(w => `
          <tr class="${w.player.id === S.me ? 'is-me' : ''}">
            <td class="who">${teamDot(w.player.team)}${w.player.name}</td>
            <td class="num">${w.units}</td>
            <td class="num net">${formatMoney(w.amount)}</td>
          </tr>`).join('')}</tbody>
      </table>` : `<div class="banner"><strong>No skins won yet</strong>Every hole is worth one skin. Tie it and it rolls forward.</div>`}

    <div class="skins-grid">${grid}</div>

    <p class="pane-note">${gross ? 'Gross skins — raw strokes, no handicap. Low gross' : 'Net skins — handicap applied. Low net'} alone on a hole takes it, plus anything carried.
    ${sk.unitsAwarded > 0 ? `Right now each skin is worth ${formatMoney(sk.perUnit)} —
    that moves as more skins are won.` : ''}
    Skins still carrying when the round ends are not paid; the pot splits across the skins actually won.
    Net and gross are separate games with separate pots.</p>
  `;

  pane.querySelectorAll('[data-skinsview]').forEach(b =>
    b.addEventListener('click', () => { S.skinsView = b.dataset.skinsview; render(); }));
}

// ---------------------------------------------------------
// TAB 5 — THE MONEY
// ---------------------------------------------------------
// Ties split the money. When two players tie for the day's low net, they
// don't take 1st and 2nd separately — they pool both prizes and halve them.
// This works out who is actually owed what for a given day.
function dailyIndividualAwards(dayNum) {
  const rd = ROUNDS.find(r => r.dayNum === dayNum && r.counts.individual);
  if (!rd) return [];
  const rows = individualLeaderboard(rd, scoresFor(rd.id), teeMap(rd.id));
  if (!rows.length) return [];

  const prizes = PAYOUTS
    .filter(x => x.scope === 'day-individual' && x.dayNum === dayNum)
    .sort((a, b) => a.place - b.place)
    .map(x => x.amount);

  // Group players who share a net score.
  const groups = [];
  rows.forEach(r => {
    const last = groups[groups.length - 1];
    if (last && last.net === r.netTotal) last.players.push(r);
    else groups.push({ net: r.netTotal, players: [r] });
  });

  // Walk the groups down the prize list, pooling whatever a group spans.
  const out = [];
  let place = 0;
  for (const g of groups) {
    if (place >= prizes.length) break;
    const spans = prizes.slice(place, place + g.players.length);
    const pool = spans.reduce((s, v) => s + v, 0);
    const each = pool / g.players.length;
    const names = g.players.map(x => x.player.name).join(' & ');
    for (let i = 0; i < spans.length; i++) {
      out.push(g.players.length > 1
        ? `${names} tied at ${g.net} — ${formatMoney(each)} each`
        : `${names} at ${g.net}`);
    }
    place += g.players.length;
  }
  return out;
}

// Same pooling rule as the daily prizes, applied to the four end-of-week
// individual places. Two players tied for 2nd don't take 2nd and 3rd — they
// pool both and split. Three tied for 4th split the one prize between them.
function eventIndividualAwards() {
  const rows = individualStandings(S.scores, teeMap(S.roundId));
  if (!rows.length) return [];

  const prizes = PAYOUTS
    .filter(x => x.scope === 'event-individual')
    .sort((a, b) => a.place - b.place)
    .map(x => x.amount);

  const groups = [];
  rows.forEach(r => {
    const last = groups[groups.length - 1];
    const key = `${r.roundsComplete}:${r.total}`;
    if (last && last.key === key) last.players.push(r);
    else groups.push({ key, total: r.total, provisional: r.provisional, players: [r] });
  });

  const out = [];
  let place = 0;
  for (const g of groups) {
    if (place >= prizes.length) break;
    const spans = prizes.slice(place, place + g.players.length);
    const pool = spans.reduce((s, v) => s + v, 0);
    const each = pool / g.players.length;
    const names = g.players.map(x => x.player.name).join(' & ');
    const prov = g.provisional ? ' (provisional)' : '';
    for (let i = 0; i < spans.length; i++) {
      out.push(g.players.length > 1
        ? `${names} tied at ${g.total} — ${formatMoney(each)} each${prov}`
        : `${names} at ${g.total}${prov}`);
    }
    place += g.players.length;
  }
  return out;
}

const MONEY_TYPES = [
  { key: 'team',       label: 'Team',        scope: 'day-team' },
  { key: 'individual', label: 'Individual',  scope: 'day-individual' },
  { key: 'skins',      label: 'Net Skins',   scope: 'day-skins' },
  { key: 'gross',      label: 'Gross Skins', scope: 'day-gross-skins' }
];

const DAY_TITLES = {
  1: 'Wednesday · Southern Hills',
  2: 'Thursday · Bay Hill',
  3: 'Friday · Bay Hill',
  4: 'Saturday · Evermore Cypress'
};

function renderMoney() {
  const pane = $('pane-money');

  const leadFor = (p) => {
    try {
      if (p.scope === 'day-team') {
        const rows = teamDayTotals(p.dayNum, S.scores, teeMap(S.roundId), S.teamScores);
        return rows.length ? `${rows[0].team.name} at ${rows[0].net}` : null;
      }
      if (p.scope === 'day-individual') {
        const a = dailyIndividualAwards(p.dayNum);
        return a[p.place - 1] || null;
      }
      if (p.scope === 'day-skins' || p.scope === 'day-gross-skins') {
        const rd = ROUNDS.find(r => r.dayNum === p.dayNum && r.counts.skins);
        if (!rd) return null;
        const mode = p.scope === 'day-gross-skins' ? 'gross' : 'net';
        const sk = skinsForRound(rd, scoresFor(rd.id), teeMap(rd.id), p.amount, mode);
        return sk.winners.length ? `${sk.winners[0].player.name} holds ${sk.winners[0].units}` : null;
      }
      if (p.scope === 'event-individual') {
        const a = eventIndividualAwards();
        return a[p.place - 1] || null;
      }
      if (p.scope === 'event-team') {
        const rows = teamEventStandings(S.scores, teeMap(S.roundId), S.teamScores);
        if (!rows.length) return null;
        const tied = rows.filter(r => r.net === rows[0].net);
        const prize = PAYOUTS.find(x => x.id === 'team-champ').amount;
        return tied.length > 1
          ? `${tied.map(t => t.team.name).join(' & ')} tied at ${rows[0].net} — ${formatMoney(prize / tied.length)} each`
          : `${rows[0].team.name} at ${rows[0].net}`;
      }
    } catch { return null; }
    return null;
  };

  // One payout to one man needs no "each" line — that only means something when
  // the money is being split.
  const row = (p) => {
    const lead = leadFor(p);
    const split = p.perPerson && p.perPerson !== p.amount;
    return `<div class="money-row">
      <div class="m-label">${p.label}${lead ? `<div class="m-lead">${lead}</div>` : ''}</div>
      <div class="m-amount">${formatMoney(p.amount)}${
        split ? `<span class="m-per">${formatMoney(p.perPerson)} each</span>` : ''}</div>
    </div>`;
  };

  const group = (title, payouts) => payouts.length
    ? `<div class="money-group"><h3>${title}</h3>${payouts.map(row).join('')}</div>` : '';

  const dayPayouts = d => PAYOUTS.filter(p => p.dayNum === d);
  const eventPayouts = () => PAYOUTS.filter(p => p.scope.startsWith('event-'));

  let body = '';
  let chips = '';

  if (S.moneyMode === 'day') {
    chips = [1, 2, 3, 4].map(d =>
      `<button class="tee-btn ${S.moneyDay === d ? 'on' : ''}" data-mday="${d}" type="button">Day ${d}</button>`).join('');
    body = group(DAY_TITLES[S.moneyDay], dayPayouts(S.moneyDay));

  } else if (S.moneyMode === 'type') {
    chips = MONEY_TYPES.map(t =>
      `<button class="tee-btn ${S.moneyType === t.key ? 'on' : ''}" data-mtype="${t.key}" type="button">${t.label}</button>`).join('');
    const t = MONEY_TYPES.find(x => x.key === S.moneyType);
    body = [1, 2, 3, 4].map(d =>
      group(DAY_TITLES[d], PAYOUTS.filter(p => p.scope === t.scope && p.dayNum === d))).join('');

  } else {
    body = group('2026 Sycamore Cup', eventPayouts());
  }

  pane.innerHTML = `
    <div class="tee-row" style="margin-bottom:12px;">
      <button class="tee-btn ${S.moneyMode === 'day' ? 'on' : ''}" data-mmode="day" type="button">By Day</button>
      <button class="tee-btn ${S.moneyMode === 'type' ? 'on' : ''}" data-mmode="type" type="button">By Type</button>
      <button class="tee-btn ${S.moneyMode === 'overall' ? 'on' : ''}" data-mmode="overall" type="button">Overall</button>
    </div>
    ${chips ? `<div class="tee-row money-chips" style="margin-bottom:18px;">${chips}</div>` : ''}
    ${body || '<div class="banner"><strong>Nothing here</strong>No payouts match that filter.</div>'}
    <p class="pane-note" style="margin-top:14px;">Leaders shown are live and provisional —
    nothing is settled until a round is marked final. Ties split the money.</p>`;

  pane.querySelectorAll('[data-mmode]').forEach(b =>
    b.addEventListener('click', () => { S.moneyMode = b.dataset.mmode; render(); }));
  pane.querySelectorAll('[data-mday]').forEach(b =>
    b.addEventListener('click', () => { S.moneyDay = Number(b.dataset.mday); render(); }));
  pane.querySelectorAll('[data-mtype]').forEach(b =>
    b.addEventListener('click', () => { S.moneyType = b.dataset.mtype; render(); }));
}

// ---------------------------------------------------------
// SIGN-IN SHEET
// ---------------------------------------------------------
// Nobody signs in any more. Everyone can enter a score for anyone, so picking a
// name here only chooses whose card you are looking at — it is remembered on this
// phone so you land on your own card next time, and you can switch at any moment.
const WHO_KEY = 'sycamore-2026-scoring-as';

function rememberWho(playerId) {
  try { localStorage.setItem(WHO_KEY, playerId || ''); } catch (e) { /* private mode */ }
}
function rememberedWho() {
  try { return localStorage.getItem(WHO_KEY) || null; } catch (e) { return null; }
}

function openSignIn() {
  const sheet = $('signin-sheet');
  const grid = $('signin-names');

  grid.innerHTML = PLAYERS.map(p => `
    <button class="name-btn ${p.id === S.me ? 'is-current' : ''}" data-player="${p.id}">
      ${p.name}<small>${p.id === S.me ? 'showing now' : `index ${p.index}`}</small>
    </button>`).join('');

  grid.querySelectorAll('.name-btn').forEach(b => {
    b.addEventListener('click', () => {
      S.me = b.dataset.player;
      rememberWho(S.me);
      sheet.hidden = true;
      render();
    });
  });

  sheet.hidden = false;
}

// The sign-in sheet is always dismissable — plenty of people just want to watch
// the leaderboard and never claim a card. Previously it could only be closed by
// tapping the backdrop AND only once you had already claimed one, which trapped
// everybody else behind it.
function closeSignin() { $('signin-sheet').hidden = true; }

$('signin-close').addEventListener('click', closeSignin);
$('signin-sheet').addEventListener('click', e => {
  if (e.target === $('signin-sheet')) closeSignin();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('signin-sheet').hidden) { closeSignin(); return; }
  if (!$('keypad-sheet').hidden) $('keypad-sheet').hidden = true;
});

// ---------------------------------------------------------
// KEYPAD
// ---------------------------------------------------------
let keypadSave = null;
let keypadHole = null;
let keypadIsScramble = false;

function openKeypad(hole, scramble) {
  keypadHole = hole;
  keypadIsScramble = !!scramble;

  const round = currentRound();
  const course = COURSES[round.course];
  const par = course.pars[hole - 1];
  const tee = teeFor(S.me, round.id);
  const teeInfo = course.tees[tee];

  let pops = 0;
  if (!scramble) {
    const player = playerById(S.me);
    pops = strokesByHole(courseHandicap(player.index, course, tee), course)[hole - 1];
  }

  $('keypad-eyebrow').textContent = scramble ? 'Team scramble' : `${teeInfo.name} tee`;
  $('keypad-title').textContent = `Hole ${hole}`;
  const holeYards = teeInfo.holeYards ? teeInfo.holeYards[hole - 1] : null;
  $('keypad-sub').textContent =
    `Par ${par}${holeYards ? ' · ' + holeYards + 'y' : ''} · SI ${course.hcp[hole - 1]}`;

  $('keypad-pops').innerHTML = pops > 0
    ? `<div class="kp-dots">${Array.from({ length: pops }, () => '<span class="kp-dot"></span>').join('')}</div>
       <div class="kp-text">${pops} stroke${pops > 1 ? 's' : ''} here</div>`
    : '';

  const max = maxGrossForHole(par);
  const current = scramble
    ? ((S.teamScores[round.id] || {})[playerById(S.me).team] || {})[hole]
    : ((scoresFor(round.id)[S.me]) || {})[hole];

  // Once a hole has been in for more than the self-edit window, only an
  // admin can change it. Say so plainly instead of letting the save fail.
  const meta = scramble ? null : (((S.scoreMeta[round.id] || {})[S.me] || {})[hole]);
  const secondsLeft = meta ? Live.selfEditSecondsLeft(meta) : Live.SELF_EDIT_MINUTES * 60;
  const lockedToMe = !scramble && current !== undefined && secondsLeft === 0 && !Live.isAdmin();

  if (lockedToMe) {
    document.querySelector('.kp-entryrow').hidden = true;
    document.querySelector('.kp-quick-l').hidden = true;
    $('keypad-grid').innerHTML =
      `<div style="grid-column:1/-1;text-align:center;padding:22px 8px;">
         <div style="font-family:var(--font-mono);font-size:34px;font-weight:600;">${current}</div>
         <p class="muted" style="margin:8px 0 0;font-size:13.5px;">This hole is locked in.</p>
       </div>`;
    $('keypad-note').hidden = false;
    $('keypad-note').textContent =
      'A score locks ' + Live.SELF_EDIT_MINUTES + ' minutes after it goes in. Ask Farnia to change it now — every change is logged.';
    setKeypadNav(hole, course.holes);
    $('keypad-sheet').hidden = false;
    return;
  }

  // No maximum any more, so the buttons are a shortcut rather than the whole
  // range: 1 through triple bogey covers nearly every tap, and anything worse
  // gets typed into the box.
  const quickTo = par + 3;
  const keys = [];
  for (let v = 1; v <= quickTo; v++) {
    keys.push(`<button class="key ${v === current ? 'on' : ''}" data-val="${v}">${v}</button>`);
  }
  $('keypad-grid').innerHTML = keys.join('');

  const entry = $('keypad-entry');
  const saveBtn = $('keypad-save');
  document.querySelector('.kp-entryrow').hidden = false;
  document.querySelector('.kp-quick-l').hidden = false;
  entry.value = current === undefined ? '' : current;
  saveBtn.disabled = !(Number(entry.value) >= 1);

  $('keypad-note').hidden = false;
  $('keypad-note').textContent = current !== undefined && !Live.isAdmin()
    ? `${secondsLeft}s left to change this yourself. After that only Farnia can.`
    : 'Tap a number or type any score — there is no maximum.';

  async function saveHole(val) {
    if (!(val >= 1)) return;
    try {
      if (scramble) {
        await Live.submitTeamScore({
          roundId: round.id, teamId: playerById(S.me).team, hole, strokes: val
        });
      } else {
        await Live.submitScore({ roundId: round.id, playerId: S.me, hole, strokes: val });
      }
      // Walk straight on to the next hole. Going hole to hole is the whole job
      // out there; closing the sheet after every score meant hunting for the
      // next cell on a phone. The last hole still closes.
      if (hole < course.holes) openKeypad(hole + 1, scramble);
      else $('keypad-sheet').hidden = true;
    } catch (e) {
      $('keypad-note').textContent = 'Could not save: ' + e.message;
    }
  }
  keypadSave = saveHole;

  $('keypad-grid').querySelectorAll('.key').forEach(k => {
    k.addEventListener('click', () => saveHole(Number(k.dataset.val)));
  });

  setKeypadNav(hole, course.holes);
  $('keypad-sheet').hidden = false;
}

function setKeypadNav(hole, holeCount) {
  $('keypad-prev').disabled = hole <= 1;
  $('keypad-next').disabled = hole >= holeCount;
}

function stepHole(delta) {
  const course = COURSES[currentRound().course];
  const next = keypadHole + delta;
  if (next < 1 || next > course.holes) return;
  openKeypad(next, keypadIsScramble);
}

$('keypad-close').addEventListener('click', () => { $('keypad-sheet').hidden = true; });
$('keypad-entry').addEventListener('input', e => {
  $('keypad-save').disabled = !(Number(e.target.value) >= 1);
});
$('keypad-save').addEventListener('click', () => {
  if (keypadSave) keypadSave(Number($('keypad-entry').value));
});
$('keypad-entry').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); if (keypadSave) keypadSave(Number(e.target.value)); }
});

$('keypad-prev').addEventListener('click', () => stepHole(-1));
$('keypad-next').addEventListener('click', () => stepHole(1));

document.addEventListener('keydown', e => {
  if ($('keypad-sheet').hidden) return;
  // Left/right inside the score box move the cursor, not the hole.
  if (e.target === $('keypad-entry')) return;
  if (e.key === 'ArrowLeft') stepHole(-1);
  if (e.key === 'ArrowRight') stepHole(1);
});
$('keypad-sheet').addEventListener('click', e => {
  if (e.target === $('keypad-sheet')) $('keypad-sheet').hidden = true;
});

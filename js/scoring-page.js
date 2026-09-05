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
  skinsForRound, individualStandings, formatMoney
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
  me: null,          // my playerId
  roundId: ROUNDS[0].id,
  tab: 'card',
  indivView: 'round',
  teamView: 'day',
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

  Live.watchPlayers(p => { S.players = p; resolveMe(); render(); });
  Live.watchAllScores((s, m) => { S.scores = s; S.scoreMeta = m; render(); });
  Live.watchTeamScores(t => { S.teamScores = t; render(); });
  Live.watchRounds(r => { S.rounds = r; render(); });

  S.me = await Live.myPlayerId();
  S.ready = true;

  if (!S.me) openSignIn();
  render();
})();

function resolveMe() {
  const myUid = Live.uid();
  const found = Object.entries(S.players).find(([, v]) => v.uid && v.uid === myUid);
  S.me = found ? found[0] : null;
}

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
  if (S.tab === 'indiv') renderIndividual();
  if (S.tab === 'teams') renderTeams();
  if (S.tab === 'skins') renderSkins();
  if (S.tab === 'money') renderMoney();
}

function renderIdent() {
  const p = S.me ? playerById(S.me) : null;
  $('ident-name').textContent = p ? p.name : 'Not signed in';
  $('ident-switch').textContent = p ? 'Change' : 'Sign in';
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
    pane.innerHTML = `<div class="banner"><strong>Pick your name to start scoring</strong>
      Tap "Sign in" up top, choose yourself, and set a PIN.</div>`;
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
// TAB 2 — INDIVIDUAL
// ---------------------------------------------------------
function renderIndividual() {
  const pane = $('pane-indiv');
  const round = currentRound();

  if (round.scramble) {
    pane.innerHTML = `<div class="banner"><strong>The scramble has no individual scoring</strong>
      It counts toward the team total only. Pick another round to see individual net.</div>`;
    return;
  }

  const toggle = `
    <div class="tee-row" style="margin-bottom:16px;">
      <button class="tee-btn ${S.indivView === 'round' ? 'on' : ''}" data-view="round">This round</button>
      <button class="tee-btn ${S.indivView === 'event' ? 'on' : ''}" data-view="event">Best 3 of 4</button>
    </div>`;

  if (S.indivView === 'round') {
    const rows = individualLeaderboard(round, scoresFor(round.id), teeMap(round.id));
    pane.innerHTML = toggle + (rows.length === 0
      ? `<div class="banner"><strong>No scores yet</strong>This board fills in as the guys tap in holes.</div>`
      : `<table class="lb">
          <thead><tr><th class="pos"></th><th>Player</th><th class="num">Thru</th><th class="num">Gross</th><th class="num">Net</th></tr></thead>
          <tbody>${rows.map(r => `
            <tr class="${r.player.id === S.me ? 'is-me' : ''}">
              <td class="pos">${r.tied ? 'T' : ''}${r.position}</td>
              <td class="who">${teamDot(r.player.team)}${r.player.name}
                <small>${r.team.name} · plays off ${r.courseHandicap}</small></td>
              <td class="num thru">${r.holesPlayed}</td>
              <td class="num">${r.grossTotal}</td>
              <td class="num net">${r.netTotal}</td>
            </tr>`).join('')}</tbody>
        </table>
        <p class="pane-note">Net counts only the holes played so far, so a player thru 9 will
        show a lower number than someone thru 18. Watch the Thru column.</p>`);
  } else {
    const rows = individualStandings(S.scores, teeMap(round.id));
    const anyProvisional = rows.some(r => r.provisional);
    pane.innerHTML = toggle + (rows.length === 0
      ? `<div class="banner"><strong>Nothing to rank yet</strong>This is the race for the $300.</div>`
      : `<table class="lb">
          <thead><tr><th class="pos"></th><th>Player</th><th class="num">Rounds</th><th class="num">Best 3</th></tr></thead>
          <tbody>${rows.map(r => `
            <tr class="${r.player.id === S.me ? 'is-me' : ''}">
              <td class="pos">${r.tied ? 'T' : ''}${r.position}</td>
              <td class="who">${teamDot(r.player.team)}${r.player.name}
                <small>${r.countingRounds.map(c => c.netTotal).join(' + ') || 'no finished rounds'}${
                  r.droppedRounds.length ? ` · dropped ${r.droppedRounds.map(d => d.netTotal).join(', ')}` : ''}</small></td>
              <td class="num thru">${r.roundsComplete}/4</td>
              <td class="num net">${r.roundsComplete ? r.total : '—'}</td>
            </tr>`).join('')}</tbody>
        </table>
        ${anyProvisional ? `<p class="pane-note">Anyone with fewer than three finished rounds is
        still provisional — their total will drop once they have a worst round to throw out.</p>` : ''}`);
  }

  pane.querySelectorAll('[data-view]').forEach(b =>
    b.addEventListener('click', () => { S.indivView = b.dataset.view; render(); }));
}

// ---------------------------------------------------------
// TAB 3 — TEAMS
// ---------------------------------------------------------
function renderTeams() {
  const pane = $('pane-teams');
  const round = currentRound();

  const toggle = `
    <div class="tee-row" style="margin-bottom:16px;">
      <button class="tee-btn ${S.teamView === 'day' ? 'on' : ''}" data-tview="day">${round.day}</button>
      <button class="tee-btn ${S.teamView === 'event' ? 'on' : ''}" data-tview="event">All four days</button>
    </div>`;

  if (S.teamView === 'day') {
    const rows = teamDayTotals(round.dayNum, S.scores, teeMap(round.id), S.teamScores);
    pane.innerHTML = toggle + (rows.length === 0
      ? `<div class="banner"><strong>No scores yet for ${round.day}</strong>All four scores count — no drops.</div>`
      : rows.map((row, i) => `
        <div class="team-card">
          <div class="team-card-head">
            <h3>${teamDot(row.team.id)}${row.team.name}</h3>
            <div>
              <div class="team-net">${row.net}</div>
              <div class="muted" style="font-size:11px;text-align:right;">${i === 0 ? 'leading' : `+${row.net - rows[0].net}`}</div>
            </div>
          </div>
          <div class="team-members">
            ${row.members.map(m => `
              <div class="team-member">
                <span>${m.player.name}<span class="m-thru">thru ${m.holesPlayed}</span></span>
                <span class="m-net">${m.holesPlayed ? m.net : '—'}</span>
              </div>`).join('')}
          </div>
          ${row.scramble ? `
            <div class="scramble-line">
              <span>Scramble nine · gross ${row.scramble.gross} less ${row.scramble.allowance} allowance</span>
              <span class="s-net">${row.scramble.net}</span>
            </div>` : ''}
        </div>`).join('') +
        `<p class="pane-note">All four net scores count toward the daily total.
        On Thursday and Friday the scramble nine folds in here too.</p>`);
  } else {
    const rows = teamEventStandings(S.scores, teeMap(round.id), S.teamScores);
    pane.innerHTML = toggle + (rows.length === 0
      ? `<div class="banner"><strong>Nothing to rank yet</strong>This is the race for the $720.</div>`
      : `<table class="lb">
          <thead><tr><th class="pos"></th><th>Team</th><th class="num">Day 1</th><th class="num">Day 2</th><th class="num">Day 3</th><th class="num">Day 4</th><th class="num">Total</th></tr></thead>
          <tbody>${rows.map(r => `
            <tr>
              <td class="pos">${r.tied ? 'T' : ''}${r.position}</td>
              <td class="who">${teamDot(r.team.id)}${r.team.name}</td>
              ${[1,2,3,4].map(d => `<td class="num">${r.byDay[d] !== undefined ? r.byDay[d] : '—'}</td>`).join('')}
              <td class="num net">${r.net}</td>
            </tr>`).join('')}</tbody>
        </table>`);
  }

  pane.querySelectorAll('[data-tview]').forEach(b =>
    b.addEventListener('click', () => { S.teamView = b.dataset.tview; render(); }));
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

  const pot = (PAYOUTS.find(p => p.scope === 'day-skins' && p.dayNum === round.dayNum) || {}).amount || 0;
  const sk = skinsForRound(round, scoresFor(round.id), teeMap(round.id), pot);

  const grid = sk.holes.map(h => {
    const cls = ['skin-hole', h.status, h.atStake > 1 ? 'carry-in' : ''].filter(Boolean).join(' ');
    let who = '—', val = '';
    if (h.status === 'won') { who = h.winner.short; val = `net ${h.low}${h.atStake > 1 ? ` · ${h.atStake} skins` : ''}`; }
    else if (h.status === 'tied') { who = `${h.tiedCount} tied`; val = `net ${h.low} · carries`; }
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

    <p class="pane-note">Net skins. Low net alone on a hole takes it, plus anything carried.
    ${sk.unitsAwarded > 0 ? `Right now each skin is worth ${formatMoney(sk.perUnit)} —
    that moves as more skins are won.` : ''}
    Skins still carrying when the round ends are not paid; the pot splits across the skins actually won.</p>
  `;
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
      if (p.scope === 'day-skins') {
        const rd = ROUNDS.find(r => r.dayNum === p.dayNum && r.counts.skins);
        if (!rd) return null;
        const sk = skinsForRound(rd, scoresFor(rd.id), teeMap(rd.id), p.amount);
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

  const groups = [
    { title: 'Wednesday · Southern Hills', ids: ['d1-team', 'd1-ind-1', 'd1-ind-2', 'd1-skins'] },
    { title: 'Thursday · Bay Hill',        ids: ['d2-team', 'd2-ind-1', 'd2-ind-2', 'd2-skins'] },
    { title: 'Friday · Bay Hill',          ids: ['d3-team', 'd3-ind-1', 'd3-ind-2', 'd3-skins'] },
    { title: 'Saturday · Evermore Cypress',ids: ['d4-team', 'd4-ind-1', 'd4-ind-2', 'd4-skins'] },
    { title: 'The whole week',             ids: ['team-champ', 'ind-1', 'ind-2', 'ind-3', 'ind-4'] }
  ];

  pane.innerHTML = groups.map(g => `
    <div class="money-group">
      <h3>${g.title}</h3>
      ${g.ids.map(id => {
        const p = PAYOUTS.find(x => x.id === id);
        if (!p) return '';
        const lead = leadFor(p);
        return `<div class="money-row">
          <div class="m-label">${p.label}${lead ? `<div class="m-lead">${lead}</div>` : ''}</div>
          <div class="m-amount">${formatMoney(p.amount)}
            ${p.perPerson ? `<span class="m-per">${formatMoney(p.perPerson)} each</span>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`).join('') + `
    <div class="money-total"><span>Total on the line</span><span class="mt-amount">${formatMoney(EVENT.totalPot)}</span></div>
    <p class="pane-note" style="margin-top:14px;">Leaders shown are live and provisional —
    nothing is settled until a round is marked final. Ties split the money.</p>`;
}

// ---------------------------------------------------------
// SIGN-IN SHEET
// ---------------------------------------------------------
let pendingPlayer = null;
let pendingMode = 'claim';

function openSignIn() {
  const sheet = $('signin-sheet');
  const grid = $('signin-names');

  grid.innerHTML = PLAYERS.map(p => {
    const doc = S.players[p.id];
    const taken = doc && doc.uid && doc.uid !== Live.uid();
    const mine = doc && doc.uid === Live.uid();
    return `<button class="name-btn ${taken ? 'taken' : ''}" data-player="${p.id}">
      ${p.name}<small>${mine ? 'this phone' : taken ? 'claimed elsewhere' : `index ${p.index}`}</small>
    </button>`;
  }).join('');

  grid.querySelectorAll('.name-btn').forEach(b => {
    b.addEventListener('click', () => {
      pendingPlayer = b.dataset.player;
      const doc = S.players[pendingPlayer];
      const claimedByMe = doc && doc.uid === Live.uid();
      const claimedByOther = doc && doc.uid && !claimedByMe;

      if (claimedByOther) {
        $('pin-error').textContent = `${playerById(pendingPlayer).name} is already claimed on another phone. Farnia can release it from the admin panel.`;
        $('pin-error').hidden = false;
        return;
      }

      pendingMode = claimedByMe ? 'verify' : 'claim';
      $('pin-label').textContent = claimedByMe ? 'Enter your PIN' : 'Set a 4-digit PIN';
      $('pin-block').hidden = false;
      $('pin-error').hidden = true;
      $('pin-input').value = '';
      $('pin-input').focus();
    });
  });

  $('pin-block').hidden = true;
  $('pin-error').hidden = true;
  sheet.hidden = false;
}

$('pin-back').addEventListener('click', () => { $('pin-block').hidden = true; });

$('pin-go').addEventListener('click', async () => {
  const pin = $('pin-input').value.trim();
  const err = $('pin-error');
  if (!/^\d{4}$/.test(pin)) {
    err.textContent = 'Four digits, please.'; err.hidden = false; return;
  }
  try {
    if (pendingMode === 'verify') {
      const ok = await Live.verifyPin(pendingPlayer, pin);
      if (!ok) { err.textContent = "That PIN doesn't match."; err.hidden = false; return; }
    } else {
      await Live.claimCard(pendingPlayer, pin);
    }
    S.me = pendingPlayer;
    $('signin-sheet').hidden = true;
    render();
  } catch (e) {
    err.textContent = e.message; err.hidden = false;
  }
});

$('signin-sheet').addEventListener('click', e => {
  if (e.target === $('signin-sheet') && S.me) $('signin-sheet').hidden = true;
});

// ---------------------------------------------------------
// KEYPAD
// ---------------------------------------------------------
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

  $('keypad-eyebrow').textContent = scramble ? 'Team scramble' : `${course.short} · ${teeInfo.name} tee`;
  $('keypad-title').textContent = `Hole ${hole}`;
  $('keypad-sub').textContent = `Par ${par} · stroke index ${course.hcp[hole - 1]}`;

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
    $('keypad-grid').innerHTML =
      `<div style="grid-column:1/-1;text-align:center;padding:22px 8px;">
         <div style="font-family:var(--font-mono);font-size:34px;font-weight:600;">${current}</div>
         <p class="muted" style="margin:8px 0 0;font-size:13.5px;">This hole is locked in.</p>
       </div>`;
    $('keypad-note').hidden = false;
    $('keypad-note').textContent =
      'You had ' + Live.SELF_EDIT_MINUTES + ' minutes to fix it. Ask Farnia to change it now — every change is logged.';
    $('keypad-sheet').hidden = false;
    return;
  }

  const keys = [];
  for (let v = 1; v <= max; v++) {
    keys.push(`<button class="key ${v === current ? 'on' : ''} ${v === max ? 'max' : ''}" data-val="${v}">${v}</button>`);
  }
  $('keypad-grid').innerHTML = keys.join('');

  $('keypad-note').hidden = false;
  $('keypad-note').textContent = current !== undefined && !Live.isAdmin()
    ? `${secondsLeft}s left to change this yourself. After that only Farnia can.`
    : `${max} is the most you can card here — gross triple bogey.`;

  $('keypad-grid').querySelectorAll('.key').forEach(k => {
    k.addEventListener('click', async () => {
      const val = Number(k.dataset.val);
      try {
        if (scramble) {
          await Live.submitTeamScore({
            roundId: round.id, teamId: playerById(S.me).team, hole, strokes: val
          });
        } else {
          await Live.submitScore({ roundId: round.id, playerId: S.me, hole, strokes: val });
        }
        $('keypad-sheet').hidden = true;
      } catch (e) {
        $('keypad-note').textContent = 'Could not save: ' + e.message;
      }
    });
  });

  $('keypad-sheet').hidden = false;
}

$('keypad-close').addEventListener('click', () => { $('keypad-sheet').hidden = true; });
$('keypad-sheet').addEventListener('click', e => {
  if (e.target === $('keypad-sheet')) $('keypad-sheet').hidden = true;
});

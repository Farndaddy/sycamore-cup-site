import { firebaseReady, subscribeToRoundScores, getCourse } from './firebase.js';

initShell('leaderboard');

let DATA = null;
let unsubscribe = null;
let currentPars = null;

const yearSel = document.getElementById('year-select');
const sessionSel = document.getElementById('session-select');
const holeCountSel = document.getElementById('holecount-select');

function showConfigBanner() {
  const el = document.getElementById('config-banner');
  if (firebaseReady()) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="banner warn">
    <strong>Live scoring isn't connected yet.</strong> Once a Firebase project is wired up
    (see <code>README.md</code>) this page will update in real time as scores are entered.
  </div>`;
}

function populateYears() {
  const years = Object.keys(DATA.years).sort((a, b) => b - a);
  yearSel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
}

function populateSessions() {
  const year = yearSel.value;
  const sessions = yearSessions(DATA, year);
  if (sessions.length === 0) {
    sessionSel.innerHTML = `<option value="">No schedule on file for ${year}</option>`;
    return;
  }
  sessionSel.innerHTML = sessions.map(s =>
    `<option value="${s.slug}" data-course="${s.course}" data-format="${s.format}">${s.label} — ${s.course}</option>`
  ).join('');
  holeCountSel.value = String(guessHoleCount(sessions[0].format));
}

async function loadPars() {
  const opt = sessionSel.selectedOptions[0];
  const n = Number(holeCountSel.value);
  if (!opt || !firebaseReady()) { currentPars = Array(n).fill(null); return; }
  const course = await getCourse(slugifyLocal(opt.dataset.course)).catch(() => null);
  currentPars = (course && course.pars) ? course.pars : Array(n).fill(null);
}
function slugifyLocal(s) { return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

function render(scores) {
  const year = yearSel.value;
  const n = Number(holeCountSel.value);
  const roster = yearRoster(DATA, year);

  // aggregate strokes per player per hole
  const byPlayer = {};
  roster.forEach(p => byPlayer[p.playerId] = { ...p, holes: {} });
  scores.forEach(s => {
    if (byPlayer[s.playerId]) byPlayer[s.playerId].holes[s.hole] = s.strokes;
  });

  const rows = Object.values(byPlayer).map(p => {
    const holeVals = Array.from({ length: n }, (_, i) => p.holes[i + 1]);
    const played = holeVals.filter(v => v !== undefined);
    const gross = played.length ? played.reduce((a, b) => a + b, 0) : null;
    const net = netTotal(gross, p.index, n);
    return { ...p, holeVals, gross, net, holesPlayed: played.length };
  });

  rows.sort((a, b) => {
    if (a.net === null && b.net === null) return 0;
    if (a.net === null) return 1;
    if (b.net === null) return -1;
    return a.net - b.net;
  });

  // team totals
  const teams = {};
  rows.forEach(r => {
    teams[r.team] = teams[r.team] || { name: r.team, net: 0, count: 0 };
    if (r.net !== null) { teams[r.team].net += r.net; teams[r.team].count++; }
  });
  document.getElementById('team-totals').innerHTML = Object.values(teams).map((t, i) => `
    <div class="card" style="padding:18px; border-left:5px solid ${i === 0 ? 'var(--fairway)' : 'var(--wine)'};">
      <p class="eyebrow mb-0">${t.name}</p>
      <div class="total-score">${t.count ? t.net : '—'} <span class="muted" style="font-size:0.8rem; font-weight:400;">team net total</span></div>
    </div>
  `).join('');

  // header
  document.getElementById('lb-header').innerHTML =
    '<th style="text-align:left;">Player</th><th>Team</th>' +
    Array.from({ length: n }, (_, i) => `<th>${i + 1}</th>`).join('') +
    '<th>Gross</th><th>Idx</th><th>Net</th>';

  // par row (only if pars are set)
  const hasPars = currentPars && currentPars.some(p => p);
  const parRow = hasPars ? `<tr class="par-row"><td class="hole-name">Par</td><td></td>${currentPars.map(p => `<td>${p || '–'}</td>`).join('')}<td></td><td></td><td></td></tr>` : '';

  document.getElementById('lb-body').innerHTML = parRow + rows.map((r, i) => `
    <tr ${i === 0 && r.gross !== null ? 'style="background:rgba(198,154,70,0.12);"' : ''}>
      <td class="hole-name">${i === 0 && r.gross !== null ? '🏆 ' : ''}<a href="players/player.html?id=${r.playerId}" style="color:var(--pine);">${r.name}</a></td>
      <td><span class="team-pill ${r.team === rows[0].team ? 'a' : 'b'}">${r.team}</span></td>
      ${r.holeVals.map((v, hi) => `<td class="${hasPars ? parClass(v, currentPars[hi]) : ''}">${v !== undefined ? v : '–'}</td>`).join('')}
      <td><strong>${r.gross !== null ? r.gross : '–'}</strong></td>
      <td>${fmtIndex(r.index)}</td>
      <td><strong>${r.net !== null ? r.net : '–'}</strong></td>
    </tr>
  `).join('');
}

async function refreshAll() {
  populateSessions();
  await loadPars();
  subscribe();
}

function subscribe() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  document.getElementById('lb-body').innerHTML = '';
  if (!firebaseReady()) { render([]); return; }
  const year = yearSel.value;
  const sessionSlug = sessionSel.value;
  if (!sessionSlug) { render([]); return; }
  unsubscribe = subscribeToRoundScores(year, sessionSlug, scores => render(scores));
}

yearSel.addEventListener('change', refreshAll);
sessionSel.addEventListener('change', async () => { await loadPars(); subscribe(); });
holeCountSel.addEventListener('change', async () => { await loadPars(); subscribe(); });

loadData().then(async data => {
  DATA = data;
  showConfigBanner();
  populateYears();
  await refreshAll();
});

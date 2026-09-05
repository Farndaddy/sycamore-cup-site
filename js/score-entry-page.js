import { firebaseReady, submitScore, subscribeToRoundScores, getCourse, saveCourse, slugify } from './firebase.js';

initShell('score-entry');

let DATA = null;
let unsubscribe = null;
let currentPars = null;

const yearSel = document.getElementById('year-select');
const sessionSel = document.getElementById('session-select');
const holeCountSel = document.getElementById('holecount-select');
const playerSel = document.getElementById('player-select');
const holeSel = document.getElementById('hole-select');
const strokesInput = document.getElementById('strokes-input');
const yourNameInput = document.getElementById('your-name');
const submitBtn = document.getElementById('submit-score');
const statusEl = document.getElementById('submit-status');

yourNameInput.value = localStorage.getItem('sycamore_your_name') || '';
yourNameInput.addEventListener('change', () => localStorage.setItem('sycamore_your_name', yourNameInput.value));

function showConfigBanner() {
  const el = document.getElementById('config-banner');
  if (firebaseReady()) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="banner warn">
    <strong>Live scoring isn't connected yet.</strong> This form needs a free Firebase project —
    see the "Set up live scoring" section in <code>README.md</code>, then fill in <code>js/firebase-config.js</code>.
  </div>`;
  submitBtn.disabled = true;
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

function populatePlayers() {
  const year = yearSel.value;
  const roster = yearRoster(DATA, year).sort((a, b) => a.name.localeCompare(b.name));
  playerSel.innerHTML = roster.map(p => `<option value="${p.playerId}">${p.name} (${p.team})</option>`).join('');
}

function populateHoles() {
  const n = Number(holeCountSel.value);
  holeSel.innerHTML = Array.from({ length: n }, (_, i) => i + 1).map(h => `<option value="${h}">Hole ${h}</option>`).join('');
}

function currentCourseSlug() {
  const opt = sessionSel.selectedOptions[0];
  return opt ? slugify(opt.dataset.course) : null;
}

async function loadPars() {
  const slug = currentCourseSlug();
  const parSetupEl = document.getElementById('par-setup');
  if (!slug || !firebaseReady()) { parSetupEl.innerHTML = '<p class="muted">Connect Firebase first.</p>'; return; }
  const course = await getCourse(slug).catch(() => null);
  const n = Number(holeCountSel.value);
  currentPars = (course && course.pars) ? course.pars : Array(n).fill(4);
  renderParInputs();
}

function renderParInputs() {
  const parSetupEl = document.getElementById('par-setup');
  const n = Number(holeCountSel.value);
  while (currentPars.length < n) currentPars.push(4);
  parSetupEl.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:8px;">
      ${Array.from({ length: n }, (_, i) => `
        <div style="width:56px;">
          <label style="margin-bottom:4px;">H${i + 1}</label>
          <input type="number" min="3" max="6" value="${currentPars[i]}" data-hole="${i}" class="par-input" style="width:100%; padding:6px;">
        </div>
      `).join('')}
    </div>
    <button class="btn btn-sm btn-gold" id="save-pars" style="margin-top:14px;">Save Pars</button>
  `;
  document.getElementById('save-pars').addEventListener('click', async () => {
    const inputs = parSetupEl.querySelectorAll('.par-input');
    const pars = Array.from(inputs).map(i => Number(i.value) || 4);
    const slug = currentCourseSlug();
    const courseName = sessionSel.selectedOptions[0].dataset.course;
    await saveCourse(slug, courseName, pars);
    statusEl.textContent = 'Pars saved for ' + courseName + '.';
  });
}

function renderPlayerCard(scores) {
  const n = Number(holeCountSel.value);
  const playerId = playerSel.value;
  const playerName = playerSel.selectedOptions[0] ? playerSel.selectedOptions[0].textContent : '';
  document.getElementById('player-card-sub').textContent = playerName;

  const byHole = {};
  scores.filter(s => s.playerId === playerId).forEach(s => byHole[s.hole] = s.strokes);

  document.getElementById('card-header').innerHTML =
    '<th class="hole-name">Hole</th>' + Array.from({ length: n }, (_, i) => `<th>${i + 1}</th>`).join('') + '<th>Tot</th>';

  let total = 0, any = false;
  const cells = Array.from({ length: n }, (_, i) => {
    const v = byHole[i + 1];
    if (v !== undefined) { total += v; any = true; }
    const par = currentPars ? currentPars[i] : null;
    return `<td class="${parClass(v, par)}">${v !== undefined ? v : '–'}</td>`;
  }).join('');
  document.getElementById('card-row').innerHTML = `<td class="hole-name">Strokes</td>${cells}<td><strong>${any ? total : '–'}</strong></td>`;
}

function subscribeCard() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (!firebaseReady()) return;
  const year = yearSel.value;
  const sessionSlug = sessionSel.value;
  if (!sessionSlug) return;
  unsubscribe = subscribeToRoundScores(year, sessionSlug, scores => renderPlayerCard(scores));
}

async function refreshAll() {
  populateSessions();
  populatePlayers();
  populateHoles();
  await loadPars();
  subscribeCard();
}

yearSel.addEventListener('change', refreshAll);
sessionSel.addEventListener('change', async () => { populateHoles(); await loadPars(); subscribeCard(); });
holeCountSel.addEventListener('change', async () => { populateHoles(); await loadPars(); subscribeCard(); });
playerSel.addEventListener('change', subscribeCard);

submitBtn.addEventListener('click', async () => {
  if (!firebaseReady()) return;
  const year = yearSel.value;
  const sessionSlug = sessionSel.value;
  const course = sessionSel.selectedOptions[0] ? sessionSel.selectedOptions[0].dataset.course : '';
  const playerId = playerSel.value;
  const hole = holeSel.value;
  const strokes = strokesInput.value;
  if (!strokes) { statusEl.textContent = 'Enter a strokes value first.'; return; }
  submitBtn.disabled = true;
  statusEl.textContent = 'Saving…';
  try {
    await submitScore({ year, session: sessionSlug, course, playerId, hole, strokes, enteredBy: yourNameInput.value || 'unknown' });
    statusEl.textContent = `Saved: hole ${hole}, ${strokes} strokes.`;
    strokesInput.value = '';
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
  }
  submitBtn.disabled = false;
});

loadData().then(async data => {
  DATA = data;
  showConfigBanner();
  populateYears();
  await refreshAll();
});

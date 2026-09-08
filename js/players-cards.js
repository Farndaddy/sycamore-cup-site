// Players page — flip cards.
// FRONT is the full "Sycamore Topps" card artwork from assets/players/<id>.png.
// Those illustrations already carry the player's name, nickname and HCP badge,
// so nothing is ever overlaid on the front and the art is never cropped square.
// BACK echoes the artwork's livery: deep green field, gold rules, cream text.

import { PLAYERS as ROSTER_2026, TEAMS as TEAMS_2026 } from './tournament-2026.js';

const CURRENT_YEAR = 2026;

// Fun facts were asked in different years with different question sets, but the
// year they came from carries no meaning here — every answer a guy has ever given
// is shown as one combined list, in this order.
const FACT_ORDER = [
  'golfer', 'golfClub', 'distanceShot', 'course',
  'sportsTeam', 'athlete', 'jersey',
  'comedian', 'actress', 'star', 'album',
  'warMovie', 'sportsMovie', 'comedyMovie',
  'dish', 'chip', 'candy'
];

function allFacts(data, playerId) {
  const ff = (data.funFactsByPlayer || {})[playerId];
  if (!ff) return [];
  const seen = new Set();
  const out = [];
  FACT_ORDER.forEach(k => { if (ff[k]) { out.push([k, ff[k]]); seen.add(k); } });
  // Anything the CMS adds later that isn't in FACT_ORDER still shows, at the end.
  Object.keys(ff).forEach(k => { if (!seen.has(k) && ff[k]) out.push([k, ff[k]]); });
  return out;
}

// data/sycamore-data.json only carries played Cups (2023-2025). The 2026 field
// lives in tournament-2026.js, so fold it in here rather than leaving the
// current roster invisible on this page.
const FIELD_2026 = new Map(ROSTER_2026.map(p => [
  p.id,
  { index: p.index, team: (TEAMS_2026.find(t => t.id === p.team) || {}).name || '' }
]));

function lastName(full) {
  const parts = String(full).trim().split(/\s+/);
  return parts[parts.length - 1] || full;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Walk data.years and pull one row per Cup this player appeared in.
function careerRows(data, player) {
  const rows = [];
  Object.values(data.years).forEach(y => {
    (y.teams || []).forEach(team => {
      const entry = (team.roster || []).find(r => r.playerId === player.id);
      if (!entry) return;
      rows.push({
        year: y.year,
        team: team.name,
        // Only an exact "Champion" counts as a win. The data also carries the
        // compound "Defending champion, runner-up", which is NOT a win that year.
        won: team.result === 'Champion',
        index: player.indexByYear[String(y.year)],
        titles: entry.titles || '',
        displayName: entry.displayName || '',
        funFacts: entry.funFacts || null
      });
    });
  });
  const up = FIELD_2026.get(player.id);
  if (up) {
    rows.push({ year: CURRENT_YEAR, team: up.team, won: false, index: up.index,
                upcoming: true, titles: '', displayName: '', funFacts: null });
  }
  return rows.sort((a, b) => a.year - b.year);
}

const TROPHY = '<svg class="trophy" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v2h3v3a4 4 0 0 1-4 4h-.4A6 6 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A6 6 0 0 1 7.4 12H7a4 4 0 0 1-4-4V5h3V3zm0 4H5v1a2 2 0 0 0 1 1.7V7zm12 0v2.7A2 2 0 0 0 19 8V7h-1z"/></svg>';

function cardHTML(data, player) {
  const rows = careerRows(data, player);
  const played = rows.filter(r => !r.upcoming);
  const cups = played.length;
  const wins = played.filter(r => r.won).length;

  const named = [...played].reverse().find(r => r.displayName);
  const titled = [...played].reverse().find(r => r.titles);
  const facts = allFacts(data, player.id);

  const field = FIELD_2026.get(player.id);
  const currentIndex = field ? field.index : null;
  const isRookie = cups === 0;

  const careerHTML = isRookie
    ? `<p class="cb-rookie">First Sycamore Cup &mdash; ${CURRENT_YEAR}${field ? `, with the ${esc(field.team)}` : ''}.</p>`
    : `<div class="cb-career">
         ${rows.map(r => `
           <div class="cb-row${r.won ? ' won' : ''}${r.upcoming ? ' upcoming' : ''}">
             <span class="cb-yr">${r.year}</span>
             <span class="cb-team">${esc(r.team)}${r.won ? TROPHY : ''}</span>
             <span class="cb-idx">${r.index == null ? '&mdash;' : r.index}</span>
           </div>`).join('')}
       </div>`;

  const factsHTML = facts.length
    ? `<dl class="cb-facts">
         ${facts.map(([k, v]) => `
           <div class="cb-fact">
             <dt>${esc(k.replace(/([A-Z])/g, ' $1').trim())}</dt>
             <dd>${esc(v)}</dd>
           </div>`).join('')}
       </dl>`
    : `<p class="cb-empty">No fun facts on file yet &mdash; he&rsquo;s keeping it close to the vest.</p>`;

  return `
    <div class="flipcard" data-id="${player.id}"
         data-active="${field ? '1' : '0'}"
         data-cups="${cups}" data-wins="${wins}"
         data-hcp="${currentIndex == null ? '' : currentIndex}"
         data-first="${esc(player.name)}"
         data-last="${esc(lastName(player.name))}"
         data-search="${esc([player.name, named && named.displayName, titled && titled.titles].filter(Boolean).join(' ').toLowerCase())}">
      <button class="flipcard-inner" type="button" aria-label="Flip card for ${esc(player.name)}">
        <div class="face front">
          <img src="assets/players/${player.id}.png" alt="${esc(player.name)} trading card"
               loading="lazy" onerror="cardArtFallback(this, '${esc(player.name)}')">
          <span class="flip-hint">Tap to flip</span>
        </div>
        <div class="face back">
          <div class="cb-head">
            <div>
              <h3>${esc(named && named.displayName ? named.displayName : player.name)}</h3>
              <p class="cb-sub">${cups === 0 ? 'Rookie' : `${cups} Cup${cups === 1 ? '' : 's'} played`}${wins ? ` &middot; ${wins} won` : ''}${field ? ' &middot; in for 2026' : ''}</p>
            </div>
            ${currentIndex != null ? `<span class="cb-hcp">HCP ${currentIndex}</span>` : ''}
          </div>
          ${titled ? `<p class="cb-titles">${esc(titled.titles)}</p>` : ''}
          ${isRookie ? '' : '<p class="cb-label">Cups Played</p>'}
          ${careerHTML}
          <p class="cb-label">Fun Facts</p>
          ${factsHTML}
        </div>
      </button>
    </div>`;
}

window.cardArtFallback = function cardArtFallback(img, name) {
  const face = img.parentElement;
  if (!face) return;
  const hint = face.querySelector('.flip-hint');
  img.remove();
  face.insertAdjacentHTML('afterbegin',
    `<div class="art-missing"><span>${name}</span><em>card coming soon</em></div>`);
  if (hint) face.appendChild(hint);
};

initShell('players');

// Sorts operate on data- attributes so the cards are built once and only
// reordered afterwards — that keeps each card's flip state and means no
// listener is ever rebound. CSS grid honours `order`, so nothing moves in
// the DOM either.
const SORTS = {
  default: {
    label: '2026 Field First',
    cmp: (a, b) =>
      (b.active - a.active) || a.first.localeCompare(b.first)
  },
  handicap: {
    label: 'Handicap (low to high)',
    // Alumni carry no 2026 index, so they fall to the bottom rather than
    // sorting as if they were scratch.
    cmp: (a, b) =>
      (a.hcp === null) - (b.hcp === null) ||
      (a.hcp === null ? 0 : a.hcp - b.hcp) ||
      a.first.localeCompare(b.first)
  },
  wins: {
    label: 'Cups Won',
    cmp: (a, b) =>
      (b.wins - a.wins) || (b.cups - a.cups) || a.first.localeCompare(b.first)
  },
  first: {
    label: 'First Name',
    cmp: (a, b) => a.first.localeCompare(b.first)
  },
  last: {
    label: 'Last Name',
    cmp: (a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first)
  }
};

loadData().then(data => {
  // The three 2026 rookies have never played a Cup, so they are absent from
  // sycamore-data.json entirely. Union the two sources so the field is complete.
  const known = new Set(data.players.map(p => p.id));
  const rookies = ROSTER_2026
    .filter(p => !known.has(p.id))
    .map(p => ({ id: p.id, name: p.name, yearsAttended: [], indexByYear: {} }));

  const players = [...data.players, ...rookies]
    .sort((a, b) => a.name.localeCompare(b.name));

  const grid = document.getElementById('card-grid');
  grid.innerHTML = players.map(p => cardHTML(data, p)).join('');

  const activeCount = players.filter(p => FIELD_2026.has(p.id)).length;

  document.getElementById('card-filters').innerHTML = `
    <div class="cbar">
      <div class="cchips">
        <button class="cfilter is-on" data-filter="all">All ${players.length}</button>
        <button class="cfilter" data-filter="active">2026 Field (${activeCount})</button>
        <button class="cfilter" data-filter="alumni">Alumni (${players.length - activeCount})</button>
      </div>
      <div class="ctools">
        <label class="csearch">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2a8 8 0 1 1-4.9 14.3l-3.4 3.4-1.4-1.4 3.4-3.4A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>
          <input type="search" id="card-search" placeholder="Search players" aria-label="Search players">
        </label>
        <label class="csort">
          <span>Sort</span>
          <select id="card-sort" aria-label="Sort players">
            ${Object.entries(SORTS).map(([k, v]) =>
              `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>`;

  const cards = [...grid.querySelectorAll('.flipcard')].map(el => ({
    el,
    active: el.dataset.active === '1' ? 1 : 0,
    cups: Number(el.dataset.cups) || 0,
    wins: Number(el.dataset.wins) || 0,
    hcp: el.dataset.hcp === '' ? null : Number(el.dataset.hcp),
    first: el.dataset.first || '',
    last: el.dataset.last || '',
    search: el.dataset.search || ''
  }));

  const empty = document.createElement('p');
  empty.className = 'card-empty muted';
  empty.hidden = true;
  grid.after(empty);

  const state = { filter: 'all', sort: 'default', q: '' };

  function applyView() {
    [...cards].sort(SORTS[state.sort].cmp)
      .forEach((c, i) => { c.el.style.order = i; });

    const q = state.q.trim().toLowerCase();
    let shown = 0;
    cards.forEach(c => {
      const passFilter =
        state.filter === 'all' ||
        (state.filter === 'active' && c.active) ||
        (state.filter === 'alumni' && !c.active);
      const passSearch = !q || c.search.includes(q);
      const show = passFilter && passSearch;
      c.el.hidden = !show;
      if (show) shown++;
    });

    empty.hidden = shown > 0;
    if (!shown) empty.textContent = `No players match “${state.q.trim()}”.`;
  }

  applyView();

  // Delegated throughout — nothing is ever bound per card.
  document.addEventListener('click', e => {
    const inner = e.target.closest('.flipcard-inner');
    if (inner) { inner.parentElement.classList.toggle('flipped'); return; }

    const btn = e.target.closest('.cfilter');
    if (!btn) return;
    document.querySelectorAll('.cfilter').forEach(b => b.classList.toggle('is-on', b === btn));
    state.filter = btn.dataset.filter;
    applyView();
  });

  document.getElementById('card-sort').addEventListener('change', e => {
    state.sort = e.target.value;
    applyView();
  });

  document.getElementById('card-search').addEventListener('input', e => {
    state.q = e.target.value;
    applyView();
  });

  const notes = (data.meta && data.meta.dataNotes) || [];
  const notesEl = document.getElementById('data-notes');
  if (notes.length) {
    notesEl.innerHTML = `
      <h3 class="mt-0">Data Notes</h3>
      <ul style="color:var(--ink-soft); padding-left:20px; margin-bottom:0;">
        ${notes.map(n => `<li style="margin-bottom:8px;">${n}</li>`).join('')}
      </ul>`;
  } else {
    notesEl.style.display = 'none';
  }
});

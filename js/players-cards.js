// Players page — the full directory grid, filters, search and sort.
// The card itself and the flip behaviour live in js/player-card.js.

import { PLAYERS as ROSTER_2026 } from './tournament-2026.js';
import { cardHTML, FIELD_2026 } from './player-card.js';

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

  // Delegated — nothing is ever bound per card. (Flipping is handled globally
  // in player-card.js, so it is deliberately not repeated here.)
  document.addEventListener('click', e => {
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

});

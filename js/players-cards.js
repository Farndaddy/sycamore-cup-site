// Players page — flip cards.
// FRONT is the full "Sycamore Topps" card artwork from assets/players/<id>.png.
// Those illustrations already carry the player's name, nickname and HCP badge,
// so nothing is ever overlaid on the front and the art is never cropped square.
// BACK echoes the artwork's livery: deep green field, gold rules, cream text.

import { PLAYERS as ROSTER_2026, TEAMS as TEAMS_2026 } from './tournament-2026.js';

const CURRENT_YEAR = 2026;

// data/sycamore-data.json only carries played Cups (2023-2025). The 2026 field
// lives in tournament-2026.js, so fold it in here rather than leaving the
// current roster invisible on this page.
const FIELD_2026 = new Map(ROSTER_2026.map(p => [
  p.id,
  { index: p.index, team: (TEAMS_2026.find(t => t.id === p.team) || {}).name || '' }
]));

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

  // Fun facts were collected in different years for different guys, so take the
  // most recent entry that actually has any rather than blanking on an empty one.
  const withFacts = [...played].reverse().find(r => r.funFacts && Object.keys(r.funFacts).length);
  const named = [...played].reverse().find(r => r.displayName) || withFacts;
  const titled = [...played].reverse().find(r => r.titles);
  const facts = withFacts ? Object.entries(withFacts.funFacts).filter(([, v]) => v) : [];

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
           <dt>${esc(k.replace(/([A-Z])/g, ' $1').trim())}</dt>
           <dd>${esc(v)}</dd>`).join('')}
       </dl>`
    : `<p class="cb-empty">No fun facts on file yet &mdash; he&rsquo;s keeping it close to the vest.</p>`;

  return `
    <div class="flipcard" data-id="${player.id}" data-cups="${cups}" data-active="${field ? '1' : '0'}">
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

loadData().then(data => {
  // The three 2026 rookies have never played a Cup, so they are absent from
  // sycamore-data.json entirely. Union the two sources so the field is complete.
  const known = new Set(data.players.map(p => p.id));
  const rookies = ROSTER_2026
    .filter(p => !known.has(p.id))
    .map(p => ({ id: p.id, name: p.name, yearsAttended: [], indexByYear: {} }));

  const players = [...data.players, ...rookies].sort((a, b) => {
    // 2026 roster first, then alumni, each alphabetical.
    const aActive = FIELD_2026.has(a.id) ? 0 : 1;
    const bActive = FIELD_2026.has(b.id) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a.name.localeCompare(b.name);
  });

  document.getElementById('card-grid').innerHTML =
    players.map(p => cardHTML(data, p)).join('');

  const activeCount = players.filter(p => FIELD_2026.has(p.id)).length;
  document.getElementById('card-filters').innerHTML = `
    <button class="cfilter is-on" data-filter="all">All ${players.length}</button>
    <button class="cfilter" data-filter="active">2026 Field (${activeCount})</button>
    <button class="cfilter" data-filter="alumni">Alumni (${players.length - activeCount})</button>`;

  // Delegated — the grid is rewritten wholesale, so never bind per-card.
  document.addEventListener('click', e => {
    const inner = e.target.closest('.flipcard-inner');
    if (inner) { inner.parentElement.classList.toggle('flipped'); return; }

    const btn = e.target.closest('.cfilter');
    if (!btn) return;
    document.querySelectorAll('.cfilter').forEach(b => b.classList.toggle('is-on', b === btn));
    const f = btn.dataset.filter;
    document.querySelectorAll('.flipcard').forEach(c => {
      const active = c.dataset.active === '1';
      c.hidden = !(f === 'all' || (f === 'active' && active) || (f === 'alumni' && !active));
      c.classList.remove('flipped');
    });
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

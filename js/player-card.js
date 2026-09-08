// Shared player card — one definition, used everywhere on the site.
// FRONT is the full "Sycamore Topps" card artwork from assets/players/<id>.png.
// Those illustrations already carry the player's name, nickname and HCP badge,
// so nothing is ever overlaid on the front and the art is never cropped square.
// BACK echoes the artwork's livery: deep green field, gold rules, cream text.

import { PLAYERS as ROSTER_2026, TEAMS as TEAMS_2026 } from './tournament-2026.js';

// Pages live at the root or one level down (years/, players/), so the artwork
// path has to be resolved rather than hardcoded.
const ROOT = (window.location.pathname.includes('/years/') ||
              window.location.pathname.includes('/players/')) ? '../' : './';

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
export const FIELD_2026 = new Map(ROSTER_2026.map(p => [
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

export function cardHTML(data, player) {
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
         <div class="cb-row cb-colhead">
           <span class="cb-yr">Year</span>
           <span class="cb-team">Team</span>
           <span class="cb-idx">HCP</span>
         </div>
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
          <img src="${ROOT}assets/players/${player.id}.png" alt="${esc(player.name)} trading card"
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


/* ---------- popup ----------
 * Individual player pages are gone. Anything carrying data-player-card opens
 * the card right where you clicked, and it flips in place. */

let dataPromise = null;
function playerData() {
  if (!dataPromise) dataPromise = loadData();
  return dataPromise;
}

export function findPlayer(data, id) {
  const known = data.players.find(p => p.id === id);
  if (known) return known;
  // 2026 rookies have never played a Cup, so they are absent from the JSON.
  const rookie = ROSTER_2026.find(p => p.id === id);
  return rookie ? { id: rookie.id, name: rookie.name, yearsAttended: [], indexByYear: {} } : null;
}

let modalEl = null;
let lastFocus = null;

function ensureModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'pc-modal';
  modalEl.hidden = true;
  modalEl.innerHTML = `
    <div class="pc-backdrop" data-pc-close></div>
    <div class="pc-shell" role="dialog" aria-modal="true" aria-label="Player card">
      <button class="pc-close" type="button" data-pc-close aria-label="Close card">&times;</button>
      <div class="pc-card"></div>
      <p class="pc-tip">Click the card to flip it</p>
    </div>`;
  document.body.appendChild(modalEl);
  return modalEl;
}

export function closePlayerCard() {
  if (!modalEl || modalEl.hidden) return;
  modalEl.hidden = true;
  document.body.classList.remove('pc-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
  lastFocus = null;
}

export function openPlayerCard(id) {
  return playerData().then(data => {
    const player = findPlayer(data, id);
    if (!player) return;
    lastFocus = document.activeElement;
    const m = ensureModal();
    m.querySelector('.pc-card').innerHTML = cardHTML(data, player);
    m.hidden = false;
    document.body.classList.add('pc-open');
    const inner = m.querySelector('.flipcard-inner');
    if (inner) inner.focus();
  });
}

// One delegated listener for the whole site. Flipping lives here too, so the
// players page and the popup share exactly one code path.
document.addEventListener('click', e => {
  if (e.target.closest('[data-pc-close]')) { closePlayerCard(); return; }

  const inner = e.target.closest('.flipcard-inner');
  if (inner) { inner.parentElement.classList.toggle('flipped'); return; }

  const trigger = e.target.closest('[data-player-card]');
  if (trigger) {
    e.preventDefault();
    openPlayerCard(trigger.dataset.playerCard);
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePlayerCard();
});

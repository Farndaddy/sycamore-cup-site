// 2026 Team Reveal — presenter-controlled draft board.
// No dependency on app.js/firebase — this page is fully standalone and offline-safe.

const ACCENTS = ['forest', 'clay', 'brass'];
const PHOTO_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

function initials(name) {
  return String(name).trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// Resolves an order item's photo the same way the rest of the site does:
// prefer a shared assets/players/<playerId>.<ext> lookup (tries each
// extension in turn), otherwise fall back to an explicit "card" path.
// Calls onFound(url) if something loads, otherwise leaves the initials card as-is.
function resolvePlayerImage(item, onFound) {
  if (item.playerId) {
    tryExt(0);
    function tryExt(i) {
      if (i >= PHOTO_EXTS.length) {
        if (item.card) loadExplicit();
        return;
      }
      const url = `assets/players/${item.playerId}.${PHOTO_EXTS[i]}`;
      const img = new Image();
      img.onload = () => onFound(url);
      img.onerror = () => tryExt(i + 1);
      img.src = url;
    }
  } else if (item.card) {
    loadExplicit();
  }
  function loadExplicit() {
    const img = new Image();
    img.onload = () => onFound(item.card);
    img.onerror = () => {};
    img.src = item.card;
  }
}

function faceHTML(kind, item) {
  if (kind === 'front') {
    return `<div class="face front" data-img-slot>
      <div class="initials-big">${initials(item.name)}</div>
    </div>`;
  }
  return `<div class="face back"><div class="q">?</div></div>`;
}

let STATE = null; // { teams: {id: {...,revealed:[]}}, order: [...], nextIndex: 0 }

async function boot() {
  let data;
  try {
    const res = await fetch('data/reveal-2026.json');
    if (!res.ok) throw new Error('fetch failed');
    data = await res.json();
  } catch (err) {
    document.getElementById('reveal-teams').innerHTML =
      `<p style="color:#E9D9AE;">Couldn't load data/reveal-2026.json — make sure you're running this from a local server (not double-clicking the file), and that the file exists.</p>`;
    return;
  }

  document.title = `${data.eventSubtitle || 'The Reveal'} — ${data.eventTitle || 'Sycamore Cup Classic'}`;

  STATE = {
    teams: {},
    order: data.order.map((item, i) => ({ ...item, _i: i, revealed: false })),
  };
  data.teams.forEach((t, i) => {
    STATE.teams[t.id] = { ...t, accent: t.accent || ACCENTS[i % ACCENTS.length], revealedItems: [] };
  });

  renderTeamColumns();
  renderPool();
  updateProgress();

  document.getElementById('reveal-btn').addEventListener('click', revealNextInOrder);
  document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowRight') {
      e.preventDefault();
      revealNextInOrder();
    }
  });
}

function renderTeamColumns() {
  const el = document.getElementById('reveal-teams');
  const teamIds = Object.keys(STATE.teams);
  el.innerHTML = teamIds.map(id => teamColumnHTML(id)).join('');
}

function teamColumnHTML(teamId) {
  const t = STATE.teams[teamId];
  return `
    <div class="reveal-team-col accent-${t.accent}" id="team-col-${teamId}">
      <div class="reveal-team-head">
        <h2><span class="swatch"></span>${t.name}</h2>
        <div class="team-stats">
          <div class="stat">
            <span class="stat-label">Team Handicap</span>
            <span class="stat-value" id="stat-handicap-${teamId}">–</span>
          </div>
          <div class="stat">
            <span class="stat-label">Ave. Handicap</span>
            <span class="stat-value" id="stat-avg-${teamId}">–</span>
          </div>
        </div>
      </div>
      <span class="count" id="team-count-${teamId}">0 revealed</span>
      <div class="reveal-roster" id="team-roster-${teamId}">
        <div class="reveal-roster-empty">Waiting...</div>
      </div>
    </div>`;
}

// Sums/averages the "index" (handicap) field across a team's revealed
// players so far — updates live as each player lands, building suspense
// about which team ends up stronger/weaker.
function updateTeamStats(teamId) {
  const items = STATE.teams[teamId].revealedItems.filter(i => typeof i.index === 'number');
  const handicapEl = document.getElementById(`stat-handicap-${teamId}`);
  const avgEl = document.getElementById(`stat-avg-${teamId}`);
  if (!handicapEl || !avgEl) return;
  if (!items.length) {
    handicapEl.textContent = '–';
    avgEl.textContent = '–';
    return;
  }
  const sum = items.reduce((s, i) => s + i.index, 0);
  handicapEl.textContent = sum.toFixed(1).replace(/\.0$/, '');
  avgEl.textContent = (sum / items.length).toFixed(1);
}

function renderPool() {
  const el = document.getElementById('reveal-pool');
  el.innerHTML = STATE.order.map((item) => `
    <div class="mystery-card ${item._i === nextUnrevealedIndex() ? 'is-next' : ''}" data-index="${item._i}" id="mystery-${item._i}">
      <span class="pick-num">${item._i + 1}</span>
      <span class="flag">⛳</span>
      <span class="q">?</span>
    </div>
  `).join('');
  el.querySelectorAll('.mystery-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = Number(card.dataset.index);
      revealByIndex(idx);
    });
  });
  updatePoolCount();
}

function nextUnrevealedIndex() {
  const next = STATE.order.find(o => !o.revealed);
  return next ? next._i : -1;
}

function updatePoolCount() {
  const remaining = STATE.order.filter(o => !o.revealed).length;
  document.getElementById('pool-count').textContent = remaining === 0 ? 'All revealed' : `${remaining} remaining`;
}

function updateProgress() {
  const total = STATE.order.length;
  const done = STATE.order.filter(o => o.revealed).length;
  document.getElementById('progress-label').textContent = `${done} of ${total} revealed`;
  document.getElementById('progress-fill').style.width = total ? `${(done / total) * 100}%` : '0%';
  Object.keys(STATE.teams).forEach(id => {
    const n = STATE.teams[id].revealedItems.length;
    const countEl = document.getElementById(`team-count-${id}`);
    if (countEl) countEl.textContent = `${n} revealed`;
  });
  if (done === total && total > 0) {
    document.getElementById('reveal-complete').classList.add('show');
    document.getElementById('reveal-btn').setAttribute('disabled', 'disabled');
  }
}

function revealNextInOrder() {
  const idx = nextUnrevealedIndex();
  if (idx === -1) return;
  revealByIndex(idx);
}

function revealByIndex(idx) {
  const item = STATE.order[idx];
  if (!item || item.revealed) return;
  item.revealed = true;

  const mysteryEl = document.getElementById(`mystery-${idx}`);
  if (!mysteryEl) return;
  const sourceRect = mysteryEl.getBoundingClientRect();
  mysteryEl.classList.add('is-gone');

  // Placeholder tile in the destination roster, used purely to measure target position.
  const team = STATE.teams[item.team];
  const rosterEl = document.getElementById(`team-roster-${item.team}`);
  const emptyMsg = rosterEl.querySelector('.reveal-roster-empty');
  if (emptyMsg) emptyMsg.remove();

  const placeholder = document.createElement('div');
  placeholder.className = 'roster-tile';
  placeholder.style.visibility = 'hidden';
  placeholder.innerHTML = `<div class="thumb"></div><div class="rname">${item.name}</div>`;
  rosterEl.appendChild(placeholder);
  const targetRect = placeholder.getBoundingClientRect();

  // Build the flying clone.
  const flying = document.createElement('div');
  flying.className = 'flying-card';
  flying.style.top = sourceRect.top + 'px';
  flying.style.left = sourceRect.left + 'px';
  flying.style.width = sourceRect.width + 'px';
  flying.style.height = sourceRect.height + 'px';
  flying.innerHTML = faceHTML('back', item) + faceHTML('front', item);
  document.body.appendChild(flying);

  // Try to load the real photo (playerId lookup, or explicit card path);
  // fall back to initials silently if nothing resolves in time.
  resolvePlayerImage(item, (url) => {
    item._photoUrl = url;
    const slot = flying.querySelector('[data-img-slot]');
    if (slot) slot.innerHTML = `<img src="${url}" alt="${item.name}">`;
  });

  requestAnimationFrame(() => {
    // Step 1: flip to reveal.
    flying.classList.add('is-flipping');
    setTimeout(() => {
      // Step 2: fly to the team roster slot.
      flying.style.top = targetRect.top + 'px';
      flying.style.left = targetRect.left + 'px';
      flying.style.width = targetRect.width + 'px';
      flying.style.height = targetRect.height + 'px';
      flying.classList.add('show-name');
      const nameplate = document.createElement('div');
      nameplate.className = 'nameplate';
      nameplate.textContent = item.name;
      flying.appendChild(nameplate);

      setTimeout(() => {
        // Step 3: swap placeholder for the real tile, remove the flying clone.
        placeholder.style.visibility = 'visible';
        placeholder.innerHTML = `
          <div class="thumb">${item._photoUrl ? `<img src="${item._photoUrl}" alt="${item.name}">` : `<span class="initials">${initials(item.name)}</span>`}</div>
          <div class="rname">${item.name}</div>`;
        flying.remove();
        team.revealedItems.push(item);
        updateProgress();
        updatePoolCount();
        updateTeamStats(item.team);
        // refresh "is-next" highlight
        document.querySelectorAll('.mystery-card').forEach(c => c.classList.remove('is-next'));
        const nextIdx = nextUnrevealedIndex();
        if (nextIdx !== -1) {
          const nextEl = document.getElementById(`mystery-${nextIdx}`);
          if (nextEl) nextEl.classList.add('is-next');
        }
      }, 750);
    }, 550);
  });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

boot();

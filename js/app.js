// Shared shell + helpers used on every page.
// Figures out how deep the current page is nested so links work
// whether we're at / or /years/2025.html or /players/player.html

const ROOT = (() => {
  const path = window.location.pathname;
  const depth = path.split('/').filter(Boolean).length - (path.endsWith('.html') ? 1 : 0);
  // pages live at root, or one level deep (years/, players/)
  return path.includes('/years/') || path.includes('/players/') ? '../' : './';
})();

async function loadData() {
  const res = await fetch(ROOT + 'data/sycamore-data.json');
  if (!res.ok) throw new Error('Could not load sycamore-data.json');
  return res.json();
}

function renderHeader(activeKey) {
  const el = document.getElementById('site-header');
  if (!el) return;
  const links = [
    { key: 'home', href: ROOT + 'index.html', label: 'Home' },
    { key: '2026', href: ROOT + 'years/2026.html', label: '2026' },
    { key: '2025', href: ROOT + 'years/2025.html', label: '2025' },
    { key: '2024', href: ROOT + 'years/2024.html', label: '2024' },
    { key: '2023', href: ROOT + 'years/2023.html', label: '2023' },
    { key: 'players', href: ROOT + 'players.html', label: 'Players' },
    { key: 'scoring', href: ROOT + 'scoring.html', label: 'Live Scoring' },
  ];
  el.innerHTML = `
    <div class="wrap">
      <a class="brand" href="${ROOT}index.html"><img src="${ROOT}assets/logos/sycamore-cup-logo.png" alt="Sycamore Cup Classic"></a>
      <nav class="main-nav">
        ${links.map(l => `<a href="${l.href}" class="${l.key === activeKey ? 'active' : ''}">${l.label}${l.soon ? ' <span class=\"soon-badge\">soon</span>' : ''}</a>`).join('')}
      </nav>
    </div>`;
}

function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  el.innerHTML = `
    <div class="wrap">
      <span>Sycamore Cup Classic — est. 2021</span>
      <span class="muted">Built by the guys, for the guys. Data straight off the brochures.</span>
    </div>`;
}

function initShell(activeKey) {
  renderHeader(activeKey);
  renderFooter();
}

function playerNameById(data, id) {
  const p = data.players.find(p => p.id === id);
  return p ? p.name : id;
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ---------- Player photos ----------
// Convention: assets/players/<player-id>.<ext> — we don't know the extension
// in advance, so we try each in turn and fall back to an initials circle if
// none of them exist. See assets/players/README.md.
const PHOTO_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

function avatarHTML(player, cls) {
  cls = cls || 'profile-avatar';
  if (!player) return `<div class="${cls}">--</div>`;
  const base = `${ROOT}assets/players/${player.id}`;
  const fallback = initials(player.name).replace(/"/g, '&quot;');
  return `<div class="${cls} avatar-photo" data-base="${base}" data-ext-i="0" data-fallback="${fallback}">
    <img src="${base}.${PHOTO_EXTS[0]}" alt="${player.name}" onerror="handleAvatarError(this)">
  </div>`;
}

function handleAvatarError(img) {
  const wrap = img.parentElement;
  if (!wrap) return;
  const i = Number(wrap.dataset.extI || 0) + 1;
  if (i < PHOTO_EXTS.length) {
    wrap.dataset.extI = String(i);
    img.src = `${wrap.dataset.base}.${PHOTO_EXTS[i]}`;
  } else {
    wrap.classList.remove('avatar-photo');
    wrap.innerHTML = wrap.dataset.fallback;
  }
}

function fmtIndex(v) {
  return (v === null || v === undefined) ? '—' : v;
}

// ---------- Trading-card fallback ----------
// assets/players/<id>.png are full "Sycamore Topps" card illustrations. If one is
// missing, draw a card-shaped placeholder in the same green/gold livery.
function tcardFallback(img, name, index) {
  const box = img.parentElement;
  if (!box) return;
  box.classList.add('tcard-missing');
  box.innerHTML = `<div class="tcard-fb">
      <span class="tcard-fb-name">${name}</span>
      <span class="tcard-fb-hcp">HCP ${index}</span>
      <span class="tcard-fb-note">card coming soon</span>
    </div>`;
}

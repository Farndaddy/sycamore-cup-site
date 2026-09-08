const YEAR_PHOTOS = {
  2023: {
    hero: '../assets/photos/2023-cover-tree-sunset.jpg',
    layout: 'masonry',
    gallery: [
      { src: '../assets/photos/2023-crew-full-lineup.jpg',    caption: 'The 2023 Sycamore Cup Classic crew', hero: true },
      { src: '../assets/photos/2023-stairs-celebration.jpg',  caption: 'House stairs, full send' },
      { src: '../assets/photos/2023-fairway-eight.jpg',       caption: 'Morning eight on the fairway' },
      { src: '../assets/photos/2023-duo-maroon.jpg',          caption: 'Matching kits at golden hour' },
      { src: '../assets/photos/2023-bunker-bw.jpg',           caption: 'Sand save attempt' },
      { src: '../assets/photos/2023-house-bar.jpg',           caption: 'The bar and the table' },
      { src: '../assets/photos/2023-tee-duo-floral.jpg',      caption: 'Off the first tee' },
      { src: '../assets/photos/2023-cash-cart-bw.jpg',        caption: 'Payday at the cart' },
      { src: '../assets/photos/2023-house-living.jpg',        caption: 'The great room' },
      { src: '../assets/photos/2023-bunker-belly-bw.jpg',     caption: 'Full commitment out of the bunker' },
      { src: '../assets/photos/2023-gorilla-kitchen.jpg',     caption: 'Kitchen mischief' },
      { src: '../assets/photos/2023-house-lounge.jpg',        caption: 'The sports lounge' },
      { src: '../assets/photos/2023-stone-wall-bw.jpg',       caption: 'Unplayable lie, stone wall edition' },
      { src: '../assets/photos/2023-late-night-couch.jpg',    caption: 'Late night, house rules' },
      { src: '../assets/photos/2023-house-theater.jpg',       caption: 'The theater' }
    ]
  },
  2024: {
    hero: '../assets/photos/2024-crew-sunset-lineup.jpg',
    layout: 'masonry',
    gallery: [
      { src: '../assets/photos/2024-crew-sunset-lineup.jpg',   caption: 'The 2024 crew', hero: true },
      { src: '../assets/photos/2024-stairs-group.jpg',         caption: 'House stairs' },
      { src: '../assets/photos/2024-green-clouds.jpg',         caption: 'Late light on the green' },
      { src: '../assets/photos/2024-vultures-oaks.jpg',        caption: 'Under the oaks, with an audience' },
      { src: '../assets/photos/2024-shuttle-selfie.jpg',       caption: 'Shuttle to the first tee' },
      { src: '../assets/photos/2024-clubhouse.jpg',            caption: 'Clubhouse' },
      { src: '../assets/photos/2024-green-celebration.jpg',    caption: 'Putt drops' },
      { src: '../assets/photos/2024-bar-lean-back.jpg',        caption: 'Post-round posture' },
      { src: '../assets/photos/2024-house-pool.jpg',           caption: 'The pool deck' },
      { src: '../assets/photos/2024-peace-signs.jpg',          caption: 'Peace and quiet' },
      { src: '../assets/photos/2024-cart-staging.jpg',         caption: 'Carts staged and ready' },
      { src: '../assets/photos/2024-house-gameroom.jpg',       caption: 'The game room' },
      { src: '../assets/photos/2024-house-avengers-hall.jpg',  caption: 'The hallway' },
      { src: '../assets/photos/2024-house-vw-lounge.jpg',      caption: 'The VW lounge' },
      { src: '../assets/photos/2024-house-dining.jpg',         caption: 'The dining room' },
      { src: '../assets/photos/2024-house-arcade.jpg',         caption: 'The arcade' }
    ]
  },
  2025: {
    hero: '../assets/photos/2025-turning-stone-aerial.jpg',
    layout: 'masonry',
    gallery: [
      { src: '../assets/photos/2025-belt-celebration.jpg', caption: 'Championship belt, earned', hero: true },
      { src: '../assets/photos/2025-tee-box-view.jpg',     caption: 'Over the fescue, Turning Stone' },
      { src: '../assets/photos/2025-line-dancing.jpg',     caption: 'Line dancing at the Tin Rooster' },
      { src: '../assets/photos/2025-sunrise-course.jpg',   caption: 'First light' },
      { src: '../assets/photos/2025-fountain-selfie.jpg',  caption: 'Lobby laps' },
      { src: '../assets/photos/2025-geese-field.jpg',      caption: 'Outnumbered by geese' },
      { src: '../assets/photos/2025-casino-floor.jpg',     caption: 'On the floor' },
      { src: '../assets/photos/2025-hole-flag.jpg',        caption: 'Dead center' },
      { src: '../assets/photos/2025-tin-rooster-hug.jpg',  caption: 'Brotherly love' },
      { src: '../assets/photos/2025-marquee.jpg',          caption: 'The marquee said it best' },
      { src: '../assets/photos/2025-phone-booth.jpg',      caption: 'Taking a call' },
      { src: '../assets/photos/2025-piggyback.jpg',        caption: 'Transportation, solved' },
      { src: '../assets/photos/2025-speaker-wall.jpg',     caption: 'The speaker wall' },
      { src: '../assets/photos/2025-neon-promenade.jpg',   caption: 'The promenade' },
      { src: '../assets/photos/2025-resort-hallway.jpg',   caption: 'The long green hallway' },
      { src: '../assets/photos/2025-shower-cap.jpg',       caption: 'Recovery day' }
    ]
  }
};

const YEAR_ABOUT = {
  2023: "The inaugural Sycamore Cup. Orlando swing #1. Two teams drafted, six-a-side: Palm Lickers vs. Bird Dogs, across Southern Hills, Shingle Creek, Providence, and Grand Cypress. Four days of 36, battles across every turn, every hole, every house game imaginable. In the end, Bird Dogs took the crown on the final day, becoming the first-ever Sycamore Cup Champions.",
  2024: "Running it back, Orlando Part II. Bird Dogs came in as defending champs — Sycamore Swingers (formerly Palm Lickers) took the Cup back in grand fashion on the final hole, final putt. The battles were epic and the finish was one for the ages, but only one team stood victorious, the Sycamore Swingers!",
  2025: "The Sycamore boys take their game to the upper northeast to Turning Stone Resort. Stacked with 4 amazing PGA level courses, the boys showed up, some on time, some late, but always there in style and with mad charisma. They hit the links hard during the day, and tables at night. DOMinators dominated in true fashion on the links, taking the 2025 Sycamore Cup by Friday! Off the course, the winner on dem carpeted floors was Stongerino, winning at every table, every slot, everything he touched, and thus we birthed the nickname, Casino Stong."
};

function renderYearPage(yearNum) {
  const photos = YEAR_PHOTOS[yearNum];
  if (photos) {
    document.getElementById('year-hero').style.backgroundImage = `url('${photos.hero}')`;
  }
  const aboutEl = document.getElementById('year-about');
  if (aboutEl) aboutEl.textContent = YEAR_ABOUT[yearNum] || '';

  loadData().then(data => {
    const y = data.years[String(yearNum)];
    if (!y) { document.getElementById('year-content').innerHTML = '<p>No data for this year yet.</p>'; return; }

    document.getElementById('year-title').innerHTML = `${y.year} <em>Sycamore Cup</em>`;
    document.getElementById('year-loc').textContent = y.location;
    document.title = `${y.year} — Sycamore Cup Classic`;

    const champEl = document.getElementById('year-champ');
    if (y.teamChampion) {
      champEl.innerHTML = `🏆 Team Champion: <strong>${y.teamChampion}</strong>`;
    } else {
      champEl.innerHTML = `Champion TBD — trip in progress`;
    }

    document.getElementById('year-courses').innerHTML = y.courses.map(c => `<li>${c}</li>`).join('');

    // Gallery
    const galleryEl = document.getElementById('year-gallery');
    if (photos && galleryEl) {
      // Masonry years keep every photo at its natural shape — nothing is cropped —
      // with any photo flagged `hero` spanning the full width above the columns.
      const masonry = photos.layout === 'masonry';
      galleryEl.classList.toggle('gallery--masonry', masonry);
      galleryEl.innerHTML = photos.gallery.map(g => {
        const cls = masonry ? (g.hero ? 'g-hero' : '') : (g.wide ? 'g-wide' : '');
        return `
        <figure class="${cls}">
          <img src="${g.src}" alt="${g.caption}" loading="lazy">
        </figure>`;
      }).join('');
    }

    const teamsEl = document.getElementById('year-teams');
    // Champion on the left, runner-up on the right. "Champion" must match exactly —
    // a compound result like "Defending champion, runner-up" means this team did NOT
    // win this particular year, it only entered as the prior year's titleholder.
    const teamsSorted = [...y.teams].sort((a, b) => (b.result === 'Champion') - (a.result === 'Champion'));
    teamsEl.innerHTML = `<div class="grid grid-2 teams-grid">` + teamsSorted.map((team, idx) => {
      const isChamp = team.result === 'Champion';
      const rosterRows = team.roster.map(r => {
        const player = data.players.find(p => p.id === r.playerId);
        const displayName = r.displayName || (player ? player.name : r.playerId);
        const idxVal = r.index !== undefined ? r.index : (player ? player.indexByYear[String(yearNum)] : null);
        return `
          <a class="player-row" href="#" data-player-card="${r.playerId}">
            <div class="jersey-num">${r.jerseyNumber !== undefined ? '#'+r.jerseyNumber : '⛳'}</div>
            <div>
              <div class="pname">${displayName}${player ? ` <span class="muted" style="font-family:var(--font-body); font-size:0.82rem; font-style:normal;">(${player.name})</span>` : ''}</div>
              ${r.titles ? `<div class="ptitle">${r.titles}</div>` : ''}
            </div>
            <div class="pindex">${idxVal !== null && idxVal !== undefined ? 'Index ' + idxVal : ''}</div>
          </a>`;
      }).join('');
      return `
        <div class="team-block${isChamp ? ' team-block--champ' : ''}">
          <div class="team-head">
            <h3>${team.name}${isChamp ? '<span class="team-badge">Champion</span>' : (team.result ? ` <span class="muted" style="font-family:var(--font-body); font-size:0.8rem; font-weight:400;"> — ${team.result}</span>` : '')}</h3>
            ${team.captain ? `<span class="cap">Captain: ${team.captain}</span>` : ''}
          </div>
          <div class="roster">${rosterRows}</div>
        </div>`;
    }).join('') + `</div>`;

    // 2025 has a match schedule instead of fun facts
    const scheduleEl = document.getElementById('year-schedule');
    const ctaEl = document.getElementById('year-cta');
    // No live-leaderboard or score-entry buttons on past years — those trips are
    // over, and the live tools only apply to the current Cup.
    if (ctaEl) ctaEl.remove();
    if (y.schedule && scheduleEl) {
      scheduleEl.style.display = '';
      scheduleEl.innerHTML = `
        <div class="section-head"><div><span class="eyebrow">Round By Round</span><h2>Daily Matchups</h2></div></div>
        ${y.schedule.map(s => `
          <div class="card" style="padding:24px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
              <h3 class="mt-0 mb-0">${s.session} · ${s.course}</h3>
              <span class="eyebrow">${s.format} — ${s.cupPoints} Cup Point${s.cupPoints === 1 ? '' : 's'}</span>
            </div>
            <div class="scorecard-wrap" style="border:none;">
              <table class="scorecard" style="min-width:0;">
                <thead><tr><th>Time</th><th>Sycamore Swingers</th><th>DOMinators</th></tr></thead>
                <tbody>
                  ${s.matches.map(m => `<tr><td>${m.time}</td><td style="text-align:left;">${m.swingers.join(' / ')}</td><td style="text-align:left;">${m.dominators.join(' / ')}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      `;
    }
  });
}

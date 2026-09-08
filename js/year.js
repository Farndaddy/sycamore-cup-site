const YEAR_PHOTOS = {
  2023: {
    hero: '../assets/photos/2023-cover-tree-sunset.jpg',
    gallery: [
      { src: '../assets/photos/2023-sunset-course.jpg', caption: 'Crooked Tooth, Orange County National', wide: true },
      { src: '../assets/photos/2023-trophy-handoff.jpg', caption: '2022 champion hands off the cup' },
      { src: '../assets/photos/2022-crew-group.jpg', caption: 'The 2022 crew' },
      { src: '../assets/photos/2023-evermore-links-group.jpg', caption: 'Evermore Links, group shot' },
    ]
  },
  2024: {
    hero: '../assets/photos/2024-cover-stairs-group.jpg',
    gallery: [
      { src: '../assets/photos/2023-crew-lineup-orange-sky.jpg', caption: '2023 Sycamore Cup Classic members', wide: true },
      { src: '../assets/photos/2022-trophy-photo.jpg', caption: 'Cup champions, handing it down' },
      { src: '../assets/photos/2024-cover-stairs-group.jpg', caption: 'The 2024 crew' },
    ]
  },
  2025: {
    hero: '../assets/photos/2025-cover-team-lineup.jpg',
    gallery: [
      { src: '../assets/photos/2025-cover-team-lineup.jpg', caption: 'Turning Stone Resort, Verona NY', wide: true },
      { src: '../assets/photos/2025-wall-of-jackie.jpg', caption: 'The Infamous Wall of Jackie' },
      { src: '../assets/photos/2025-hole-in-one.jpg', caption: 'The Infamous Hole in One' },
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
      galleryEl.innerHTML = photos.gallery.map(g => `
        <figure class="${g.wide ? 'g-wide' : ''}">
          <img src="${g.src}" alt="${g.caption}">
          <figcaption>${g.caption}</figcaption>
        </figure>
      `).join('');
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
          <a class="player-row" href="../players/player.html?id=${r.playerId}">
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
    if (y.schedule && scheduleEl) {
      if (ctaEl) ctaEl.innerHTML = `
        <a class="btn btn-primary" href="../leaderboard.html">Live Leaderboard →</a>
        <a class="btn btn-light" href="../score-entry.html">Enter Scores</a>`;
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

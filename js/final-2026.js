// =========================================================
// Sycamore Cup Classic — 2026 FINAL
// =========================================================
// The year is closed. This renders data/2026-final.json, which was computed
// once from the finished cards and frozen: standings, every prize, every skin
// and the full payout ledger. It does NOT read the live database, so the page
// stands on its own the way 2023, 2024 and 2025 do.
//
// Scores read against par everywhere. The cap in force was DOUBLE PAR, so a
// hole counts for at most twice its par; where that bit, the card shows the
// number that counted with the number actually written alongside.

const F = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const par = n => n === 0 ? 'E' : (n > 0 ? `+${n}` : `${n}`);
  // Whole dollars, always rounded DOWN — same rule as formatMoney in the engine.
  const money = n => '$' + Math.floor(n).toLocaleString('en-US');

  let D = null, byId = {}, teamOf = {};

  function boot(data) {
    D = data;
    D.players.forEach(p => { byId[p.id] = p; teamOf[p.id] = p.team; });
    renderChampions();
    renderIndividual();
    renderTeams();
    renderRounds();
    renderMoney();
  }

  const nameOf = id => (byId[id] || {}).name || id;
  const shortOf = id => (byId[id] || {}).short || id;
  const teamName = tid => (D.teams.find(t => t.id === tid) || {}).name || tid;
  const dot = tid => `<span class="team-dot dot-${tid}"></span>`;

  // ---------- champions ----------
  function renderChampions() {
    const el = $('final-champions'); if (!el) return;
    const c = D.champions;
    const roster = (D.teams.find(t => t.id === c.team.id) || { roster: [] }).roster;
    el.innerHTML = `
      <div class="champ-grid">
        <div class="champ-card champ-card--team">
          <span class="eyebrow">Team Champion</span>
          <h3>${esc(c.team.name)}</h3>
          <div class="champ-score">${par(c.team.toPar)}</div>
          <ul class="champ-roster">${roster.map(id => `<li>${esc(nameOf(id))}</li>`).join('')}</ul>
          <p class="champ-note">Runner-up ${esc(c.teamRunnerUp)}</p>
        </div>
        <div class="champ-card champ-card--ind">
          <span class="eyebrow">Individual Champion</span>
          <h3>${esc(c.individual.name)}</h3>
          <div class="champ-score">${par(c.individual.toPar)}</div>
          <p class="champ-note">Low net across all three rounds.
            ${esc(shortOf(c.individual.id))} also took the Thursday individual prize
            and never made worse than a double bogey all week.</p>
        </div>
      </div>`;
  }

  // ---------- individual ----------
  function renderIndividual() {
    const el = $('final-individual'); if (!el) return;
    el.innerHTML = `
      <table class="liv-table">
        <thead><tr><th></th><th>Player</th>
          ${D.rounds.map(r => `<th class="num">${r.day.slice(0, 3)}</th>`).join('')}
          <th class="num">Total</th></tr></thead>
        <tbody>${D.individual.map(r => `
          <tr class="${r.pos === 1 ? 'fin-lead' : ''}">
            <td class="liv-pos">${r.tied ? 'T' : ''}${r.pos}</td>
            <td><div class="liv-who"><div class="liv-namecol">
              <div class="n">${dot(teamOf[r.id])}${esc(nameOf(r.id))}</div>
              <div class="t">${esc(teamName(teamOf[r.id]))}</div>
            </div></div></td>
            ${r.rounds.map(x => `<td class="num"><span class="liv-round">${par(x.toPar)}</span></td>`).join('')}
            <td class="num"><span class="liv-tot">${par(r.toPar)}</span></td>
          </tr>`).join('')}</tbody>
      </table>
      <p class="liv-note">Net, against par. All three rounds count &mdash; no drops.
      A hole counted for at most double its par.</p>`;
  }

  // ---------- teams ----------
  function renderTeams() {
    const el = $('final-teams'); if (!el) return;
    el.innerHTML = `
      <table class="liv-table">
        <thead><tr><th></th><th>Team</th>
          ${D.days.map(d => `<th class="num">${d.day.slice(0, 3)}</th>`).join('')}
          <th class="num">Total</th></tr></thead>
        <tbody>${D.teamEvent.map((t, i) => `
          <tr class="${i === 0 ? 'fin-lead' : ''}">
            <td class="liv-pos">${i + 1}</td>
            <td><div class="liv-who"><div class="liv-namecol">
              <div class="n">${dot(t.id)}${esc(t.name)}</div>
              <div class="t">${t.roster ? '' : (D.teams.find(x => x.id === t.id).roster.map(shortOf).join(' · '))}</div>
            </div></div></td>
            ${t.byDay.map(v => `<td class="num"><span class="liv-round">${par(v)}</span></td>`).join('')}
            <td class="num"><span class="liv-tot">${par(t.toPar)}</span></td>
          </tr>`).join('')}</tbody>
      </table>
      <p class="liv-note">All four men count every day &mdash; no drops. Thursday includes the Charger nine scramble.</p>`;
  }

  // ---------- round by round ----------
  function renderRounds() {
    const el = $('final-rounds'); if (!el) return;
    el.innerHTML = D.rounds.map(r => {
      const cards = [...r.cards].sort((a, b) => a.toPar - b.toPar);
      return `
      <div class="rnd">
        <div class="rnd-head">
          <div><h3>${esc(r.day)} &mdash; ${esc(r.short)}</h3>
            <p class="muted">Par ${r.par} &middot; ${esc(r.tee)} tee &middot; ${r.rating}/${r.slope}</p></div>
        </div>
        <table class="liv-table rnd-table">
          <thead><tr><th></th><th>Player</th><th class="num">Gross</th><th class="num hide-sm">Hcp</th><th class="num">Net</th></tr></thead>
          <tbody>${cards.map((c, i) => `
            <tr class="rnd-row ${i === 0 ? 'fin-lead' : ''}" data-card="${r.id}__${c.id}"
                tabindex="0" role="button" aria-expanded="false"
                aria-label="Show ${esc(nameOf(c.id))}'s card">
              <td class="liv-pos">${i + 1}</td>
              <td><div class="liv-who"><div class="liv-namecol">
                <div class="n">${dot(teamOf[c.id])}${esc(nameOf(c.id))}</div></div></div></td>
              <td class="num">${c.gross}${c.grossCarded !== c.gross ? `<small class="carded"> (${c.grossCarded})</small>` : ''}</td>
              <td class="num hide-sm">${c.hcp}</td>
              <td class="num"><span class="liv-tot">${par(c.toPar)}</span><i class="rnd-caret"></i></td>
            </tr>
            <tr class="rnd-cardrow" id="row-${r.id}__${c.id}" hidden>
              <td colspan="5">${holeTable(r, c)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
    }).join('');

    // The whole row opens the card. A button in its own column did not fit
    // beside gross and net at 393px, and the row is the bigger tap target anyway.
    const toggle = tr => {
      const row = document.getElementById('row-' + tr.dataset.card);
      row.hidden = !row.hidden;
      tr.setAttribute('aria-expanded', String(!row.hidden));
      tr.classList.toggle('is-open', !row.hidden);
    };
    el.querySelectorAll('.rnd-row').forEach(tr => {
      tr.addEventListener('click', () => toggle(tr));
      tr.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(tr); }
      });
    });
  }

  function holeTable(r, c) {
    const seg = (from, to, label) => {
      const idx = []; for (let i = from; i < to; i++) idx.push(i);
      const g = idx.reduce((s, i) => s + c.counted[i], 0);
      return `
      <table class="hole-table">
        <thead><tr><th class="rl">${label}</th>${idx.map(i => `<th>${i + 1}</th>`).join('')}<th class="tot">Tot</th></tr></thead>
        <tbody>
          <tr class="row-par"><td class="rl">Par</td>${idx.map(i => `<td>${r.pars[i]}</td>`).join('')}<td class="tot">${idx.reduce((s, i) => s + r.pars[i], 0)}</td></tr>
          <tr class="row-si"><td class="rl">SI</td>${idx.map(i => `<td>${r.si[i]}</td>`).join('')}<td class="tot">&mdash;</td></tr>
          <tr><td class="rl">Score</td>${idx.map(i => {
            const v = c.counted[i], raw = c.carded[i], d = v - r.pars[i];
            const cls = d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'evenh' : d === 1 ? 'bogey' : 'worse';
            return `<td class="sc ${cls}${raw !== v ? ' capd' : ''}"${raw !== v ? ` title="carded ${raw}, counted ${v}"` : ''}>${v}${c.pops[i] > 0 ? '<i class="pop"></i>' : ''}</td>`;
          }).join('')}<td class="tot">${g}</td></tr>
        </tbody>
      </table>`;
    };
    const capped = c.carded.map((v, i) => v !== c.counted[i] ? `#${i + 1} carded ${v}, counted ${c.counted[i]}` : null).filter(Boolean);
    return `<div class="hole-wrap">${seg(0, 9, 'Out')}${seg(9, 18, 'In')}</div>
      <p class="hole-note">Dots mark a stroke. ${capped.length ? 'Double-par cap applied: ' + capped.join('; ') + '.' : 'No hole hit the double-par cap.'}</p>`;
  }

  // ---------- the money ----------
  function renderMoney() {
    const el = $('final-money'); if (!el) return;
    const dayBlocks = D.days.map(d => `
      <div class="money-day">
        <h4>${esc(d.day)}</h4>
        <table class="lb money-table">
          <tbody>
            ${d.prizes.map(p => `<tr>
              <td class="prize"><span class="what">${esc(p.what)}</span><span class="who">${esc(p.who)} <small>${par(p.score)}</small></span></td>
              <td class="num amt">${money(p.amount)}</td></tr>`).join('')}
            ${['net', 'gross'].map(mode => {
              const s = d.skins[mode];
              return `<tr>
                <td class="prize"><span class="what">${mode === 'net' ? 'Net' : 'Gross'} Skins</span>
                  <span class="who">${s.winners.map(w => `${esc(shortOf(w.id))} ${w.skins}`).join(' &middot; ')}
                  <small>${s.count} skins @ ${money(s.perSkin)}</small></span></td>
                <td class="num amt">${money(s.pot)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`).join('');

    el.innerHTML = `
      <div class="money-days">${dayBlocks}</div>
      <h4 class="money-h">The Whole Week</h4>
      <table class="lb money-table">
        <tbody>
          <tr><td class="prize"><span class="what">Team Champion</span><span class="who">${esc(D.champions.team.name)} <small>${par(D.champions.team.toPar)}</small></span></td><td class="num amt">${money(D.event.teamChampion)}</td></tr>
          <tr><td class="prize"><span class="what">Individual Champion</span><span class="who">${esc(D.champions.individual.name)} <small>${par(D.champions.individual.toPar)}</small></span></td><td class="num amt">${money(D.event.places[0])}</td></tr>
          ${D.individual.slice(1, 4).map((r, i) => `<tr>
            <td class="prize"><span class="what">Individual ${['Runner-Up', '3rd', '4th'][i]}</span>
              <span class="who">${esc(nameOf(r.id))} <small>${par(r.toPar)}</small></span></td>
            <td class="num amt">${money(D.event.places[i + 1])}</td></tr>`).join('')}
        </tbody>
      </table>
      <h4 class="money-h">What Each Man Collected</h4>
      <table class="lb money-table ledger">
        <thead><tr><th>Player</th><th class="num">Total</th></tr></thead>
        <tbody>${D.ledger.map(l => `
          <tr><td class="prize"><span class="what">${dot(teamOf[l.id])}${esc(nameOf(l.id))}</span>
            <span class="who">${l.items.length ? l.items.map(i => esc(i.label)).join(' &middot; ') : 'no prizes'}</span></td>
            <td class="num amt">${money(l.total)}</td></tr>`).join('')}</tbody>
      </table>`;
  }

  return { boot };
})();

fetch('../data/2026-final.json').then(r => r.json()).then(F.boot);

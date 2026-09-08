// =========================================================
// Sycamore Cup Classic — admin panel
// =========================================================
// Everything Farnia needs when something goes sideways on the course.

import { COURSES, PLAYERS, TEAMS, ROUNDS, playerById, teamById, substituteFor } from './tournament-2026.js';
import { courseHandicap, capGross } from './scoring-engine.js';
import * as Live from './live.js';

initShell('admin');

const root = document.getElementById('admin-root');
const S = { players: {}, scores: {}, rounds: {}, admins: {}, edited: [], log: [], editing: null };

(async function boot() {
  if (!Live.isConfigured()) {
    root.innerHTML = `<div class="gate"><h1>Not connected</h1>
      <p class="muted">The Firebase settings are missing from this build.</p></div>`;
    return;
  }

  try { await Live.start(); }
  catch (e) {
    root.innerHTML = `<div class="gate"><h1>Couldn't connect</h1><p class="muted">${e.message}</p></div>`;
    return;
  }

  Live.watchPlayers(p => { S.players = p; render(); });
  Live.watchAllScores(s => { S.scores = s; render(); });
  Live.watchRounds(r => { S.rounds = r; render(); });
  Live.watchEditedScores(e => { S.edited = e; render(); });
  Live.watchScoreLog(l => { S.log = l; render(); }, 200);
  try { S.admins = await Live.listAdmins(); } catch { S.admins = {}; }

  render();
})();

function render() {
  if (!Live.isAdmin()) { renderGate(); return; }
  renderPanel();
}

// ---------------------------------------------------------
// THE BOOTSTRAP GATE
// ---------------------------------------------------------
// The very first admin cannot be created from inside the app — the rules
// only let an existing admin grant admin. So this screen hands Farnia the
// exact ID she needs to paste into the Firebase console once.
function renderGate() {
  root.innerHTML = `
    <div class="admin-sec">
      <h2>You're not an admin yet</h2>
      <p class="sec-note">This is expected the first time. Security rules only let an existing
      admin create another one, so the first admin has to be made by hand — once.</p>

      <p style="font-size:14px;">Here is this browser's ID:</p>
      <div class="uid-box" id="uid-box">${Live.uid() || '—'}</div>
      <button class="btn btn-sm btn-quiet" id="copy-uid" type="button">Copy ID</button>

      <ol style="font-size:14px; line-height:1.8; margin-top:20px; padding-left:20px;">
        <li>Open the <strong>Firebase console</strong> → your <strong>sycamore-cup</strong> project → <strong>Firestore Database</strong>.</li>
        <li>Click <strong>Start collection</strong> and name it exactly <code>admins</code>.</li>
        <li>For <strong>Document ID</strong>, paste the ID above.</li>
        <li>Add one field: name it <code>label</code>, type string, value <code>Farnia</code>.</li>
        <li>Save, then reload this page.</li>
      </ol>

      <p class="sec-note" style="margin-top:16px;">One catch worth knowing: this ID belongs to this
      browser on this computer. If you later want to run admin from your phone, open this page there
      and add that ID as a second admin from the panel.</p>
    </div>`;

  document.getElementById('copy-uid').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(Live.uid());
      document.getElementById('copy-uid').textContent = 'Copied';
    } catch {
      document.getElementById('copy-uid').textContent = 'Select it manually';
    }
  });
}

// ---------------------------------------------------------
// THE PANEL
// ---------------------------------------------------------
function renderPanel() {
  const seeded = Object.keys(S.players).length;

  root.innerHTML = `
    <div class="admin-sec">
      <h2>Changed scores</h2>
      <p class="sec-note">Every hole keeps the number that was first entered. The database will not
      let anyone overwrite that original — not a player, not an admin, not me. So if a score was
      changed after it went in, it shows up here with the original still attached.</p>
      ${S.edited.length === 0
        ? '<p class="muted" style="font-size:13.5px;">No score has been changed since it was entered.</p>'
        : S.edited.map(e => {
            const p = playerById(e.playerId);
            const r = ROUNDS.find(x => x.id === e.roundId);
            const who = e.updatedBy === e.firstBy ? 'same person' : 'someone else';
            return `<div class="admin-row">
              <div class="r-main">
                <strong>${p ? p.name : e.playerId} — hole ${e.hole}</strong>
                <small>${r ? r.day + ' · ' + COURSES[r.course].short : e.roundId}
                  · entered as <strong>${e.firstStrokes}</strong>, now <strong>${e.strokes}</strong>
                  · ${e.editCount} change${e.editCount === 1 ? '' : 's'} · edited by ${who}</small>
              </div>
              <span class="pill ${e.strokes < e.firstStrokes ? 'locked' : 'open'}">
                ${e.strokes < e.firstStrokes ? 'lowered' : 'raised'}
              </span>
            </div>`;
          }).join('')}
    </div>

    <div class="admin-sec">
      <h2>Change history</h2>
      <p class="sec-note">Append-only. Entries cannot be edited or deleted by anyone, including you.</p>
      ${S.log.length === 0
        ? '<p class="muted" style="font-size:13.5px;">Nothing logged yet.</p>'
        : S.log.slice(0, 40).map(l => {
            const p = playerById(l.playerId);
            const r = ROUNDS.find(x => x.id === l.roundId);
            const when = l.at && l.at.toDate ? l.at.toDate().toLocaleString() : '—';
            return `<div class="admin-row">
              <div class="r-main">
                <strong>${p ? p.name : l.playerId} · hole ${l.hole} · ${l.from} → ${l.to}</strong>
                <small>${r ? r.day : l.roundId} · ${when}${l.viaAdmin ? ' · via admin panel' : ''}</small>
              </div>
            </div>`;
          }).join('')}
    </div>

    <div class="admin-sec">
      <h2>Setup</h2>
      <p class="sec-note">Run once, before anyone tries to sign in.</p>
      <div class="admin-row">
        <div class="r-main">
          <strong>Player records</strong>
          <small>${seeded === 0
            ? 'Not created yet. Nobody can claim a card until this runs.'
            : `${seeded} of ${PLAYERS.length} players set up.`}</small>
        </div>
        <div class="admin-actions">
          <button class="btn btn-sm ${seeded === 0 ? 'btn-primary' : 'btn-quiet'}" id="seed-btn">
            ${seeded === 0 ? 'Create player records' : 'Add any missing'}
          </button>
        </div>
      </div>
      <div class="admin-status" id="seed-status"></div>
    </div>

    <div class="admin-sec">
      <h2>Cards</h2>
      <p class="sec-note">Card claiming and PINs were retired &mdash; anyone can enter a score for
      anyone now. These rows are just a record of who claimed what before the change; releasing
      one is harmless and no longer affects scoring.</p>
      ${PLAYERS.map(p => {
        const doc = S.players[p.id];
        const claimed = doc && doc.uid;
        return `<div class="admin-row">
          <div class="r-main">
            <strong>${p.name}</strong>
            <small>${teamById(p.team).name} · index ${p.index}
              ${!doc ? ' · no record yet' : ''}</small>
          </div>
          <span class="pill ${claimed ? 'claimed' : 'open'}">${claimed ? 'claimed' : 'open'}</span>
          <div class="admin-actions">
            <button class="btn btn-sm btn-quiet" data-release="${p.id}" ${claimed ? '' : 'disabled'}>Release</button>
          </div>
        </div>`;
      }).join('')}
      <div class="admin-status" id="card-status"></div>
    </div>

    <div class="admin-sec">
      <h2>Rounds</h2>
      <p class="sec-note">Lock a round once the money is settled. Locked rounds refuse new scores
      from players — you can still fix them here.</p>
      ${ROUNDS.map(r => {
        const locked = S.rounds[r.id] && S.rounds[r.id].locked;
        const c = COURSES[r.course];
        return `<div class="admin-row">
          <div class="r-main">
            <strong>${r.day} · ${c.short}${r.scramble ? ' (Scramble)' : ''}</strong>
            <small>${r.holes} holes · ${r.format}</small>
          </div>
          <span class="pill ${locked ? 'locked' : 'open'}">${locked ? 'final' : 'open'}</span>
          <div class="admin-actions">
            <button class="btn btn-sm btn-quiet" data-lock="${r.id}" data-to="${locked ? 'open' : 'lock'}">
              ${locked ? 'Reopen' : 'Mark final'}
            </button>
          </div>
        </div>`;
      }).join('')}
      <div class="admin-status" id="round-status"></div>
    </div>

    <div class="admin-sec">
      <h2>Fix a scorecard</h2>
      <p class="sec-note">Pick a round and a player, then type over any hole. Blank leaves it unscored.
      The triple-bogey cap still applies.</p>
      <div class="admin-actions" style="margin-bottom:14px;">
        <select class="admin-input" id="edit-round">
          ${ROUNDS.filter(r => !r.scramble).map(r =>
            `<option value="${r.id}">${r.day} — ${COURSES[r.course].short}</option>`).join('')}
        </select>
        <select class="admin-input" id="edit-player">
          ${PLAYERS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
        <button class="btn btn-sm btn-quiet" id="edit-load">Load card</button>
      </div>
      <div id="edit-area"></div>
      <div class="admin-status" id="edit-status"></div>
    </div>

    <div class="admin-sec">
      <h2>Tees &amp; Playing Handicaps</h2>
      <p class="sec-note">Players set their own tee, but you can override it — useful for the guy
      who never gets around to it.</p>
      <div class="admin-actions" style="margin-bottom:14px;">
        <select class="admin-input" id="tee-round">
          ${ROUNDS.map(r => `<option value="${r.id}">${r.day} — ${COURSES[r.course].short}</option>`).join('')}
        </select>
      </div>
      <div id="tee-area"></div>
      <div class="admin-status" id="tee-status"></div>
    </div>

    <div class="admin-sec">
      <h2>Co-admins</h2>
      <p class="sec-note">Have the person open this page on their own phone, copy the ID it shows them,
      and paste it here.</p>
      ${Object.keys(S.admins).length
        ? Object.entries(S.admins).map(([id, v]) => `<div class="admin-row">
            <div class="r-main"><strong>${v.label || 'Unnamed'}</strong><small>${id}</small></div>
          </div>`).join('')
        : '<p class="muted" style="font-size:13px;">Just you so far.</p>'}
      <div class="admin-actions" style="margin-top:14px;">
        <input class="admin-input" id="admin-uid" placeholder="Their browser ID" style="flex:1;min-width:220px;">
        <input class="admin-input" id="admin-label" placeholder="Name" style="max-width:140px;">
        <button class="btn btn-sm btn-quiet" id="admin-add">Add</button>
      </div>
      <div class="admin-status" id="admin-status"></div>
    </div>
  `;

  wirePanel();
  renderTeeArea();
}

// ---------------------------------------------------------
// WIRING
// ---------------------------------------------------------
// Status lives in a bar outside #admin-root, because a live database update
// re-renders the panel and would otherwise wipe the message the moment it appears.
function say(_id, msg, isErr) {
  const el = document.getElementById('admin-flash');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('err', !!isErr);
  el.hidden = !msg;
}

// One listener on the document, attached once. Buttons are rebuilt on every
// database update, so listeners bound to individual buttons get detached
// mid-click and the button silently does nothing. Delegation survives that.
let wired = false;
function wirePanel() {
  if (wired) return;
  wired = true;

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button, [data-tee-set]');
    if (!t) return;

    if (t.id === 'seed-btn') {
      say(null, 'Creating player records…');
      try { await Live.seedPlayers(); say(null, 'Player records are ready.'); }
      catch (err) { say(null, err.message, true); }
      return;
    }

    if (t.dataset.hcpReset) {
      const roundId = document.getElementById('tee-round').value;
      try {
        await Live.adminSetHandicap(t.dataset.hcpReset, roundId, null);
        say(null, `${playerById(t.dataset.hcpReset).name} is back on the calculated handicap.`);
        renderTeeArea();
      } catch (err) { say(null, err.message, true); }
      return;
    }

    if (t.dataset.release) {
      const id = t.dataset.release;
      t.disabled = true;
      say(null, `Releasing ${playerById(id).name}'s card…`);
      try {
        await Live.releaseCard(id);
        say(null, `${playerById(id).name}'s card is free — he can claim it again on any phone.`);
      } catch (err) { say(null, err.message, true); }
      return;
    }

    if (t.dataset.lock) {
      const to = t.dataset.to === 'lock';
      try {
        await Live.setRoundLocked(t.dataset.lock, to);
        say(null, to ? 'Round marked final.' : 'Round reopened.');
      } catch (err) { say(null, err.message, true); }
      return;
    }

    if (t.id === 'edit-load') { renderEditArea(); return; }

    if (t.id === 'edit-save') { await saveEditedCard(); return; }

    if (t.dataset.teeSet) {
      const roundId = document.getElementById('tee-round').value;
      const round = ROUNDS.find(r => r.id === roundId);
      try {
        await Live.adminSetTee(t.dataset.teeSet, roundId, t.dataset.teeKey);
        say(null, `${playerById(t.dataset.teeSet).name} moved to the ${COURSES[round.course].tees[t.dataset.teeKey].name} tee.`);
      } catch (err) { say(null, err.message, true); }
      return;
    }

    if (t.id === 'admin-add') {
      const uidVal = document.getElementById('admin-uid').value.trim();
      const label = document.getElementById('admin-label').value.trim();
      if (!uidVal) { say(null, 'Paste their browser ID first.', true); return; }
      try {
        await Live.addAdmin(uidVal, label);
        S.admins = await Live.listAdmins();
        say(null, `${label || 'They'} can now use this panel.`);
        renderPanel();
      } catch (err) { say(null, err.message, true); }
      return;
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'tee-round') renderTeeArea();
  });

  // Pin a playing handicap for one player on the selected round.
  document.addEventListener('change', async (e) => {
    const box = e.target.closest && e.target.closest('[data-hcp-set]');
    if (!box) return;
    const roundId = document.getElementById('tee-round').value;
    const playerId = box.dataset.hcpSet;
    try {
      await Live.adminSetHandicap(playerId, roundId, box.value);
      say(null, `${playerById(playerId).name} pinned to ${box.value} for this round. Every total recalculates.`);
      renderTeeArea();
    } catch (err) { say(null, err.message, true); }
  });
}

function renderEditArea() {
  const roundId = document.getElementById('edit-round').value;
  const playerId = document.getElementById('edit-player').value;
  const round = ROUNDS.find(r => r.id === roundId);
  const course = COURSES[round.course];
  const existing = ((S.scores[roundId] || {})[playerId]) || {};

  document.getElementById('edit-area').innerHTML = `
    <div class="edit-grid">
      ${course.pars.map((par, i) => `
        <div class="edit-cell">
          <label>${i + 1} · par ${par}</label>
          <input type="number" min="1" max="${par + 3}" data-hole="${i + 1}"
                 value="${existing[i + 1] !== undefined ? existing[i + 1] : ''}">
        </div>`).join('')}
    </div>
    <div class="admin-actions" style="margin-top:14px;">
      <button class="btn btn-sm btn-primary" id="edit-save">Save card</button>
    </div>`;

}

async function saveEditedCard() {
  const roundId = document.getElementById('edit-round').value;
  const playerId = document.getElementById('edit-player').value;
  const round = ROUNDS.find(r => r.id === roundId);
  const course = COURSES[round.course];
  const existing = ((S.scores[roundId] || {})[playerId]) || {};
  {
    say(null, 'Saving…');
    const inputs = document.querySelectorAll('#edit-area input[data-hole]');
    let saved = 0, capped = 0;
    try {
      for (const inp of inputs) {
        const hole = Number(inp.dataset.hole);
        const raw = inp.value.trim();
        if (raw === '') continue;
        const par = course.pars[hole - 1];
        const val = capGross(Number(raw), par);
        if (Number(raw) > val) capped++;
        if (existing[hole] === val) continue;
        await Live.submitScore({ roundId, playerId, hole, strokes: val, viaAdmin: true });
        saved++;
      }
      say(null, `Saved ${saved} hole${saved === 1 ? '' : 's'}.` +
        (capped ? ` ${capped} capped to triple bogey.` : ''));
    } catch (e) { say(null, e.message, true); }
  }
}

function renderTeeArea() {
  const roundId = document.getElementById('tee-round').value;
  const round = ROUNDS.find(r => r.id === roundId);
  const course = COURSES[round.course];

  document.getElementById('tee-area').innerHTML = PLAYERS.map(p => {
    const doc = S.players[p.id];
    const chosen = (doc && doc.tees && doc.tees[roundId]) || course.defaultTee;
    // A stand-in plays this round off HIS index, so the calculated number shown
    // here has to match what the engine actually uses — otherwise the panel
    // reports one handicap while the scoring runs on another.
    const sub = substituteFor(p.id, roundId);
    const playingIndex = sub ? sub.index : p.index;
    const calc = courseHandicap(playingIndex, course, chosen);
    const raw = doc && doc.hcp ? doc.hcp[roundId] : null;
    const pinned = (raw === null || raw === undefined || raw === '') ? null : Number(raw);
    return `<div class="admin-row">
      <div class="r-main">
        <strong>${p.name}${sub ? ` <span class="sub-badge">${sub.subName} playing</span>` : ''}</strong>
        <small>${sub ? `${sub.subName}&rsquo;s index ${sub.index}` : `index ${p.index}`} &middot; ${
          course.tees[chosen].name} tee &middot; calculated ${calc}${
          pinned !== null ? ` &middot; <span class="hcp-pinned">pinned to ${pinned}</span>` : ''}</small>
      </div>
      <div class="admin-actions">
        ${Object.entries(course.tees).map(([key, t]) =>
          `<button class="tee-btn ${key === chosen ? 'on' : ''}" data-tee-set="${p.id}" data-tee-key="${key}">${t.name}</button>`
        ).join('')}
        <label class="hcp-field">HCP
          <input type="number" inputmode="numeric" min="-10" max="54" step="1"
                 data-hcp-set="${p.id}" value="${pinned !== null ? pinned : calc}"
                 class="${pinned !== null ? 'is-pinned' : ''}">
        </label>
        <button class="btn btn-sm btn-quiet" data-hcp-reset="${p.id}" ${pinned === null ? 'disabled' : ''}>Reset</button>
      </div>
    </div>`;
  }).join('');

}

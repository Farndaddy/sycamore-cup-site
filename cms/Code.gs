/**
 * SYCAMORE CUP CLASSIC — Sheet-to-Site publisher
 * ------------------------------------------------
 * Paste this whole file into Extensions ▸ Apps Script (as Code.gs), replacing
 * any starter code. Full setup steps are in CMS-SETUP.md.
 *
 * What it does:
 *  1. Adds a "Sycamore Cup Site" menu with a "Publish to Site" button.
 *  2. Reads the Rosters / FunFacts / Schedule / Years / Config tabs.
 *  3. Rebuilds the exact JSON shape the website already expects
 *     (same structure as data/sycamore-data.json).
 *  4. Commits that JSON straight to your GitHub repo using the Contents API,
 *     which makes GitHub Pages rebuild the live site automatically.
 *
 * Nothing runs on a timer — it only runs when you click "Publish to Site",
 * per your choice to keep edits from going live mid-draft.
 */

const CONFIG_SHEET = 'Config';
const ROSTERS_SHEET = 'Rosters';
const FUNFACTS_SHEET = 'FunFacts';
const SCHEDULE_SHEET = 'Schedule';
const YEARS_SHEET = 'Years';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sycamore Cup Site')
    .addItem('Publish to Site', 'publishToSite')
    .addItem('Preview JSON (no publish)', 'previewJson')
    .addToUi();
}

// ---------- Menu actions ----------

function publishToSite() {
  const ui = SpreadsheetApp.getUi();
  try {
    const json = buildDataJson();
    const result = commitToGitHub(json);
    ui.alert('Published! ✅', 'Your changes are live (or will be within a minute).\n\nCommit: ' + result.htmlUrl, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Publish failed ❌', String(err), ui.ButtonSet.OK);
  }
}

function previewJson() {
  const ui = SpreadsheetApp.getUi();
  const json = buildDataJson();
  const text = JSON.stringify(json, null, 2);
  const truncated = text.length > 3000 ? text.slice(0, 3000) + '\n...(truncated)...' : text;
  ui.alert('Preview (not published)', truncated, ui.ButtonSet.OK);
}

// ---------- Build the JSON from the sheet ----------

function buildDataJson() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterRows = sheetToObjects(ss.getSheetByName(ROSTERS_SHEET));
  const funFactRows = sheetToObjects(ss.getSheetByName(FUNFACTS_SHEET));
  const scheduleRows = sheetToObjects(ss.getSheetByName(SCHEDULE_SHEET));
  const yearRows = sheetToObjects(ss.getSheetByName(YEARS_SHEET));

  // ----- players[] : derived as the unique set of players across all rosters -----
  const playersById = {};
  rosterRows.forEach(r => {
    const id = String(r['Player ID']).trim();
    if (!id) return;
    if (!playersById[id]) {
      playersById[id] = { id: id, name: String(r['Player Name (canonical)']).trim(), yearsAttended: [], indexByYear: { '2023': null, '2024': null, '2025': null, '2026': null } };
    }
    const year = String(Math.round(r['Year']));
    if (playersById[id].yearsAttended.indexOf(Number(year)) === -1) {
      playersById[id].yearsAttended.push(Number(year));
    }
    const idx = r['Index (handicap)'];
    playersById[id].indexByYear[year] = (idx === '' || idx === null || idx === undefined) ? null : Number(idx);
  });
  Object.values(playersById).forEach(p => p.yearsAttended.sort());
  const players = Object.values(playersById).sort((a, b) => a.name.localeCompare(b.name));

  // ----- fun facts, grouped by year + playerId -----
  const funFactsByYearPlayer = {};
  funFactRows.forEach(r => {
    const year = String(Math.round(r['Year']));
    const playerId = String(r['Player ID']).trim();
    const key = year + '::' + playerId;
    if (!funFactsByYearPlayer[key]) funFactsByYearPlayer[key] = {};
    const factKey = String(r['Fact Key']).trim();
    if (factKey) funFactsByYearPlayer[key][factKey] = r['Fact Value'];
  });

  // ----- years{} -----
  const years = {};
  const yearMeta = {};
  yearRows.forEach(r => {
    const year = Math.round(r['Year']);
    yearMeta[year] = {
      location: r['Location'] || '',
      courses: String(r['Courses Played (comma-separated)'] || '').split(',').map(s => s.trim()).filter(Boolean),
      teamChampion: r['Team Champion'] || null,
      teamRunnerUp: r['Team Runner-Up'] || null
    };
  });

  // group roster rows by year + team
  const teamsByYear = {};
  rosterRows.forEach(r => {
    const year = Math.round(r['Year']);
    const teamName = String(r['Team']).trim();
    teamsByYear[year] = teamsByYear[year] || {};
    if (!teamsByYear[year][teamName]) {
      teamsByYear[year][teamName] = {
        id: year + '-' + slugify(teamName),
        name: teamName,
        captain: r['Captain'] || '',
        result: r['Team Result'] || null,
        roster: []
      };
    }
    const playerId = String(r['Player ID']).trim();
    const year_ = String(year);
    const facts = funFactsByYearPlayer[year_ + '::' + playerId];
    const entry = {
      playerId: playerId,
      displayName: r['Display Name (this year\u2019s nickname)'] || undefined,
      jerseyNumber: (r['Jersey #'] === '' || r['Jersey #'] === null) ? undefined : Number(r['Jersey #']),
      titles: r['Titles / Nicknames'] || undefined,
      index: (r['Index (handicap)'] === '' || r['Index (handicap)'] === null) ? undefined : Number(r['Index (handicap)']),
      funFacts: facts || undefined
    };
    // drop undefined keys so the JSON stays clean
    Object.keys(entry).forEach(k => entry[k] === undefined && delete entry[k]);
    teamsByYear[year][teamName].roster.push(entry);
  });

  // schedule, grouped by year + session
  const scheduleByYear = {};
  scheduleRows.forEach(r => {
    const year = Math.round(r['Year']);
    scheduleByYear[year] = scheduleByYear[year] || {};
    const sessionKey = r['Session'] + '::' + r['Course'];
    if (!scheduleByYear[year][sessionKey]) {
      scheduleByYear[year][sessionKey] = {
        session: r['Session'], course: r['Course'], format: r['Format'],
        cupPoints: Number(r['Cup Points']), matches: []
      };
    }
    scheduleByYear[year][sessionKey].matches.push({
      time: r['Time'],
      swingers: splitPlayerList(r['Team A Players (Name (Idx), Name (Idx))']),
      dominators: splitPlayerList(r['Team B Players (Name (Idx), Name (Idx))'])
    });
  });

  Object.keys(yearMeta).forEach(year => {
    const teams = Object.values(teamsByYear[year] || {});
    const schedule = Object.values(scheduleByYear[year] || {});
    years[year] = {
      year: Number(year),
      location: yearMeta[year].location,
      courses: yearMeta[year].courses,
      teamChampion: yearMeta[year].teamChampion,
      teams: teams
    };
    if (schedule.length) years[year].schedule = schedule;
  });

  const championshipHistory = Object.keys(yearMeta)
    .filter(y => yearMeta[y].teamChampion)
    .map(y => ({ year: Number(y), teamChampion: yearMeta[y].teamChampion, teamRunnerUp: yearMeta[y].teamRunnerUp }))
    .sort((a, b) => a.year - b.year);

  return {
    meta: {
      name: 'Sycamore Cup Classic',
      founded: 2021,
      sourceNote: 'Content managed via the Sycamore Cup CMS Google Sheet.'
    },
    players: players,
    years: years,
    championshipHistory: championshipHistory
  };
}

// ---------- helpers ----------

function sheetToObjects(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(v => v === '' || v === null)) continue; // skip blank rows
    const obj = {};
    headers.forEach((h, idx) => obj[h] = row[idx]);
    rows.push(obj);
  }
  return rows;
}

function splitPlayerList(str) {
  if (!str) return [];
  return String(str).split(',').map(s => s.trim()).filter(Boolean);
}

function slugify(str) {
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG_SHEET);
  const values = sheet.getDataRange().getValues();
  // Config has a title + instructions row above the real "Setting"/"Value"
  // header, so find that header row instead of assuming it's row 1.
  const headerRow = values.findIndex(row => row[0] === 'Setting');
  const cfg = {};
  if (headerRow !== -1) {
    for (let i = headerRow + 1; i < values.length; i++) {
      const setting = values[i][0];
      const value = values[i][1];
      if (setting) cfg[setting] = value;
    }
  }
  return {
    owner: cfg['GitHub repo owner (username or org)'],
    repo: cfg['GitHub repo name'],
    branch: cfg['Branch'] || 'main',
    path: cfg['Data file path in repo'] || 'data/sycamore-data.json'
  };
}

// ---------- GitHub Contents API ----------

function commitToGitHub(jsonObj) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    throw new Error('No GitHub token found. See CMS-SETUP.md — Project Settings ▸ Script Properties ▸ add GITHUB_TOKEN.');
  }
  const { owner, repo, branch, path } = getConfig();
  if (!owner || !repo) {
    throw new Error('Fill in the Config tab (repo owner + repo name) first.');
  }

  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json'
  };

  // 1. Get current file SHA (required by GitHub to update an existing file)
  let sha = null;
  const getResp = UrlFetchApp.fetch(apiBase + '?ref=' + branch, { headers, muteHttpExceptions: true });
  if (getResp.getResponseCode() === 200) {
    sha = JSON.parse(getResp.getContentText()).sha;
  } else if (getResp.getResponseCode() !== 404) {
    throw new Error('GitHub GET failed: ' + getResp.getContentText());
  }

  // 2. Commit the new content
  const content = Utilities.base64Encode(JSON.stringify(jsonObj, null, 2), Utilities.Charset.UTF_8);
  const payload = {
    message: 'Update site data via Sheet (' + new Date().toISOString() + ')',
    content: content,
    branch: branch
  };
  if (sha) payload.sha = sha;

  const putResp = UrlFetchApp.fetch(apiBase, {
    method: 'put',
    headers,
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (putResp.getResponseCode() >= 300) {
    throw new Error('GitHub commit failed (' + putResp.getResponseCode() + '): ' + putResp.getContentText());
  }

  const result = JSON.parse(putResp.getContentText());
  return { htmlUrl: result.commit && result.commit.html_url ? result.commit.html_url : '(committed)' };
}

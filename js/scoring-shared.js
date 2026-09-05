// Shared between leaderboard.html and score-entry.html

function sessionSlug(year, sessionLabel) {
  return `${year}-${sessionLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}

// Best-guess hole count from the format text; user can override in the UI.
function guessHoleCount(formatText) {
  if (/18 hole/i.test(formatText)) return 18;
  if (/9 hole/i.test(formatText)) return 9;
  if (/shamble.*scramble|scramble.*shamble/i.test(formatText)) return 18; // 9+9
  return 9;
}

// Every player rostered for a given year, flattened across both teams.
function yearRoster(data, year) {
  const y = data.years[String(year)];
  if (!y) return [];
  const out = [];
  y.teams.forEach(team => {
    team.roster.forEach(r => {
      const player = data.players.find(p => p.id === r.playerId);
      out.push({
        playerId: r.playerId,
        name: player ? player.name : r.playerId,
        team: team.name,
        index: r.index !== undefined ? r.index : (player ? player.indexByYear[String(year)] : null)
      });
    });
  });
  return out;
}

// Sessions list (label + course + format + cupPoints) for a year, built from the schedule if present.
function yearSessions(data, year) {
  const y = data.years[String(year)];
  if (!y || !y.schedule) return [];
  return y.schedule.map(s => ({
    label: s.session,
    course: s.course,
    format: s.format,
    cupPoints: s.cupPoints,
    slug: sessionSlug(year, s.session)
  }));
}

// Simple, transparent net-scoring approximation:
// full 18-hole rounds subtract the player's index; 9-hole sessions subtract half (rounded).
// This is a placeholder formula (no per-hole stroke-index table was in the source brochures) —
// swap in real handicap allocation once you have stroke-index-per-hole data for each course.
function netTotal(grossTotal, index, holeCount) {
  if (index === null || index === undefined || grossTotal === null) return grossTotal;
  const allowance = holeCount >= 18 ? index : Math.round(index / 2);
  return grossTotal - allowance;
}

function parClass(strokes, par) {
  if (!par || strokes === null || strokes === undefined) return '';
  if (strokes < par) return 'score-under';
  if (strokes > par) return 'score-over';
  return 'score-even';
}

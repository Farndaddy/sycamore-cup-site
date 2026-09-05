// =========================================================
// Sycamore Cup Classic — live data layer
// =========================================================
// Everything that talks to Firebase lives here. The scoring pages
// never touch Firestore directly.
//
// Identity model: each browser signs in anonymously and gets a stable
// id. A player claims his card once by picking his name and setting a
// PIN; from then on the DATABASE — not just the page — refuses writes
// to that card from anyone else. Admins are the exception.

import { firebaseConfig, FIREBASE_NOT_CONFIGURED, RECAPTCHA_SITE_KEY } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';
import { getAuth, signInAnonymously, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, collection, setDoc, updateDoc, getDoc, getDocs, addDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { PLAYERS, ROUNDS, COURSES } from './tournament-2026.js';

let app, db, auth, currentUser = null, adminFlag = false;
let readyResolve;
const ready = new Promise(r => { readyResolve = r; });

export function isConfigured() { return !FIREBASE_NOT_CONFIGURED; }

// ---------------------------------------------------------
// STARTUP
// ---------------------------------------------------------
export async function start() {
  if (!isConfigured()) throw new Error('Firebase is not configured.');
  if (app) return ready;

  app = initializeApp(firebaseConfig);

  // App Check. Registered but not enforced yet — this makes the tokens
  // start flowing so the console metrics can confirm it works BEFORE
  // enforcement is switched on. Wrapped because a blocked reCAPTCHA
  // script should never stop scoring from working.
  try {
    if (RECAPTCHA_SITE_KEY) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    }
  } catch (e) {
    console.warn('[sycamore] App Check did not start:', e.message);
  }

  db = getFirestore(app);
  auth = getAuth(app);

  await new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async user => {
      if (user) {
        currentUser = user;
        adminFlag = await checkAdmin(user.uid);
        resolve();
      }
    }, reject);
    signInAnonymously(auth).catch(reject);
  });

  readyResolve(true);
  return ready;
}

export function uid() { return currentUser ? currentUser.uid : null; }
export function isAdmin() { return adminFlag; }

async function checkAdmin(userId) {
  try {
    const snap = await getDoc(doc(db, 'admins', userId));
    return snap.exists();
  } catch { return false; }
}

// ---------------------------------------------------------
// PINS
// ---------------------------------------------------------
// The PIN is hashed with the player id mixed in, so two players who
// pick the same PIN don't produce the same hash. Be clear-eyed about
// what this is: a 4-digit PIN behind a public hash is a courtesy lock,
// not a vault. The real protection is that the database ties a card to
// one browser identity.
async function hashPin(playerId, pin) {
  const data = new TextEncoder().encode(`sycamore-2026:${playerId}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------
// PLAYERS
// ---------------------------------------------------------
export async function getPlayers() {
  const snap = await getDocs(collection(db, 'players'));
  const out = {};
  snap.forEach(d => out[d.id] = d.data());
  return out;
}

export function watchPlayers(cb) {
  return onSnapshot(collection(db, 'players'), snap => {
    const out = {};
    snap.forEach(d => out[d.id] = d.data());
    cb(out);
  });
}

// Claim an unclaimed card: pick your name, set your PIN. First person to
// claim a name owns it. An admin can release it later if a phone dies.
export async function claimCard(playerId, pin) {
  const ref = doc(db, 'players', playerId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('That player has not been set up yet. Ask Farnia to run setup.');

  const data = snap.data();
  if (data.uid && data.uid !== uid()) {
    throw new Error(`${data.claimedName || 'Someone'} already claimed this card on another phone. Farnia can release it from the admin panel.`);
  }

  await updateDoc(ref, {
    uid: uid(),
    pinHash: await hashPin(playerId, pin),
    claimedAt: serverTimestamp()
  });
  return true;
}

// Re-entering your PIN on the SAME browser just confirms it's you.
export async function verifyPin(playerId, pin) {
  const snap = await getDoc(doc(db, 'players', playerId));
  if (!snap.exists()) return false;
  const data = snap.data();
  if (!data.pinHash) return false;
  return data.pinHash === await hashPin(playerId, pin);
}

// Which card, if any, this browser owns.
export async function myPlayerId() {
  const players = await getPlayers();
  const me = uid();
  const found = Object.entries(players).find(([, v]) => v.uid === me);
  return found ? found[0] : null;
}

export async function setTee(playerId, roundId, teeKey) {
  await updateDoc(doc(db, 'players', playerId), {
    [`tees.${roundId}`]: teeKey,
    uid: uid()   // rules require the uid field to be restated on update
  });
}

// ---------------------------------------------------------
// SCORES
// ---------------------------------------------------------
export function scoreId(roundId, playerId, hole) {
  return `${roundId}__${playerId}__h${hole}`;
}

// Writing a score keeps the ORIGINAL value alongside the current one.
// firstStrokes and firstAt are locked by the security rules — once a hole
// is entered, nothing can rewrite what was first put in, not even an admin.
// That is what makes the change log worth trusting: a later edit can change
// the score, but it cannot hide what the score used to be.
export async function submitScore({ roundId, playerId, hole, strokes, viaAdmin }) {
  const id = scoreId(roundId, playerId, hole);
  const ref = doc(db, 'scores', id);
  const snap = await getDoc(ref);
  const n = Number(strokes);

  if (!snap.exists()) {
    await setDoc(ref, {
      session: roundId, roundId, playerId,
      hole: Number(hole),
      strokes: n,
      firstStrokes: n,
      firstAt: serverTimestamp(),
      firstBy: uid(),
      editCount: 0,
      updatedAt: serverTimestamp(),
      updatedBy: uid()
    });
    return { created: true };
  }

  const prev = snap.data();
  if (Number(prev.strokes) === n) return { unchanged: true };

  await setDoc(ref, {
    ...prev,
    strokes: n,
    editCount: (prev.editCount || 0) + 1,
    updatedAt: serverTimestamp(),
    updatedBy: uid()
  });

  // Append-only history. Entries can never be edited or removed.
  await addDoc(collection(db, 'scoreLog'), {
    roundId, playerId,
    hole: Number(hole),
    from: Number(prev.strokes),
    to: n,
    original: Number(prev.firstStrokes !== undefined ? prev.firstStrokes : prev.strokes),
    at: serverTimestamp(),
    by: uid(),
    viaAdmin: !!viaAdmin
  });

  return { edited: true, from: Number(prev.strokes), to: n };
}

// Scores that have been changed since they were first entered.
export function watchEditedScores(cb) {
  return onSnapshot(collection(db, 'scores'), snap => {
    const out = [];
    snap.forEach(d => {
      const v = d.data();
      if ((v.editCount || 0) > 0) out.push({ id: d.id, ...v });
    });
    out.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    cb(out);
  });
}

// The full change history, newest first.
export function watchScoreLog(cb, max) {
  const q = query(collection(db, 'scoreLog'), orderBy('at', 'desc'), limit(max || 100));
  return onSnapshot(q, snap => {
    const out = [];
    snap.forEach(d => out.push({ id: d.id, ...d.data() }));
    cb(out);
  }, err => {
    // orderBy needs the field present; fall back to unordered rather than break the page
    console.warn('[sycamore] score log query failed, falling back:', err.message);
    onSnapshot(collection(db, 'scoreLog'), s2 => {
      const out = [];
      s2.forEach(d => out.push({ id: d.id, ...d.data() }));
      out.sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0));
      cb(out);
    });
  });
}

// Live feed of every score in the event. Twelve players over six rounds
// is a small enough set to watch in one subscription, which keeps every
// leaderboard on the page in sync with no extra plumbing.
// Emits both the plain strokes (what the leaderboards need) and per-hole
// metadata (what the self-edit window needs).
export function watchAllScores(cb) {
  return onSnapshot(collection(db, 'scores'), snap => {
    const byRound = {}, meta = {};
    snap.forEach(d => {
      const s = d.data();
      if (!byRound[s.roundId]) { byRound[s.roundId] = {}; meta[s.roundId] = {}; }
      if (!byRound[s.roundId][s.playerId]) { byRound[s.roundId][s.playerId] = {}; meta[s.roundId][s.playerId] = {}; }
      byRound[s.roundId][s.playerId][s.hole] = s.strokes;
      meta[s.roundId][s.playerId][s.hole] = {
        firstAt: s.firstAt || null,
        firstStrokes: s.firstStrokes,
        editCount: s.editCount || 0
      };
    });
    cb(byRound, meta);
  });
}

// A player may fix his own hole for this long after first entering it.
// After that only an admin can change it. Mirrors the security rule exactly —
// the rule is what enforces it; this just keeps the UI honest about it.
export const SELF_EDIT_MINUTES = 2;

export function selfEditSecondsLeft(metaForHole) {
  if (!metaForHole || !metaForHole.firstAt) return SELF_EDIT_MINUTES * 60;
  const first = metaForHole.firstAt.toDate ? metaForHole.firstAt.toDate() : new Date(metaForHole.firstAt);
  const left = SELF_EDIT_MINUTES * 60 - (Date.now() - first.getTime()) / 1000;
  return Math.max(0, Math.round(left));
}

// ---------------------------------------------------------
// TEAM SCRAMBLE
// ---------------------------------------------------------
export async function submitTeamScore({ roundId, teamId, hole, strokes }) {
  await setDoc(doc(db, 'teamScores', `${roundId}__${teamId}__h${hole}`), {
    roundId, teamId,
    hole: Number(hole),
    strokes: Number(strokes),
    updatedAt: serverTimestamp(),
    updatedBy: uid()
  });
}

export function watchTeamScores(cb) {
  return onSnapshot(collection(db, 'teamScores'), snap => {
    const byRound = {};
    snap.forEach(d => {
      const s = d.data();
      if (!byRound[s.roundId]) byRound[s.roundId] = {};
      if (!byRound[s.roundId][s.teamId]) byRound[s.roundId][s.teamId] = {};
      byRound[s.roundId][s.teamId][s.hole] = s.strokes;
    });
    cb(byRound);
  });
}

// ---------------------------------------------------------
// ROUNDS
// ---------------------------------------------------------
export function watchRounds(cb) {
  return onSnapshot(collection(db, 'rounds'), snap => {
    const out = {};
    snap.forEach(d => out[d.id] = d.data());
    cb(out);
  });
}

export async function setRoundLocked(roundId, locked) {
  await setDoc(doc(db, 'rounds', roundId), { locked: !!locked, updatedAt: serverTimestamp() }, { merge: true });
}

// ---------------------------------------------------------
// ADMIN
// ---------------------------------------------------------

// One-time setup: create the twelve player documents. Needs admin rights,
// which is why Farnia's own admin record has to be created by hand in the
// Firebase console first — nothing else can grant the first one.
export async function seedPlayers() {
  for (const p of PLAYERS) {
    const ref = doc(db, 'players', p.id);
    const snap = await getDoc(ref);
    if (snap.exists()) continue;
    await setDoc(ref, {
      name: p.name, short: p.short, team: p.team, index: p.index,
      uid: '', pinHash: '', tees: {}, createdAt: serverTimestamp()
    });
  }
}

// Frees a card so its owner can claim it again from a different phone.
export async function releaseCard(playerId) {
  await updateDoc(doc(db, 'players', playerId), {
    uid: '', pinHash: '', releasedAt: serverTimestamp()
  });
}

export async function addAdmin(userId, label) {
  await setDoc(doc(db, 'admins', userId), { label: label || '', addedAt: serverTimestamp(), addedBy: uid() });
}

export async function listAdmins() {
  const snap = await getDocs(collection(db, 'admins'));
  const out = {};
  snap.forEach(d => out[d.id] = d.data());
  return out;
}

export async function adminSetTee(playerId, roundId, teeKey) {
  await updateDoc(doc(db, 'players', playerId), { [`tees.${roundId}`]: teeKey });
}

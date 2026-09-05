// Firestore layer for live scoring. Loaded as an ES module.
// Data model:
//   courses/{courseSlug}          -> { name, pars: [18 numbers] }
//   scores/{year_session_player_holeN} -> { year, session, course, playerId, hole, strokes, updatedAt, updatedBy }
//
// "session" is a slug like "2025-thursday-am" so each round's scores are independent.

import { firebaseConfig, FIREBASE_NOT_CONFIGURED } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot,
  collection, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let app, db;

export function firebaseReady() {
  return !FIREBASE_NOT_CONFIGURED;
}

function ensureInit() {
  if (!firebaseReady()) {
    throw new Error('Firebase is not configured yet — see README.md "Set up live scoring".');
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
}

export function scoreDocId(year, session, playerId, hole) {
  return `${year}_${session}_${playerId}_h${hole}`;
}

export async function submitScore({ year, session, course, playerId, hole, strokes, enteredBy }) {
  const database = ensureInit();
  const id = scoreDocId(year, session, playerId, hole);
  await setDoc(doc(database, 'scores', id), {
    year, session, course, playerId, hole: Number(hole), strokes: Number(strokes),
    updatedAt: serverTimestamp(), updatedBy: enteredBy || 'unknown'
  });
}

// Live-subscribes to every score doc for a given year+session.
// callback receives an array of score records, refreshed in real time.
export function subscribeToRoundScores(year, session, callback) {
  const database = ensureInit();
  const q = query(
    collection(database, 'scores'),
    where('year', '==', Number(year)),
    where('session', '==', session)
  );
  return onSnapshot(q, snap => {
    const rows = [];
    snap.forEach(d => rows.push(d.data()));
    callback(rows);
  });
}

export async function getCourse(courseSlug) {
  const database = ensureInit();
  const snap = await getDoc(doc(database, 'courses', courseSlug));
  return snap.exists() ? snap.data() : null;
}

export async function saveCourse(courseSlug, name, pars) {
  const database = ensureInit();
  await setDoc(doc(database, 'courses', courseSlug), { name, pars });
}

export function slugify(str) {
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

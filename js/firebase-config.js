// =========================================================
// Sycamore Cup Classic — live scoring backend
// Firebase project: sycamore-cup  (free Spark plan)
// Wired up 2026-09-05. Nothing here needs editing.
// =========================================================
// Everything in this file is safe to commit and safe to be public.
// These values only tell a browser WHICH project to talk to.
// What actually controls who can read and write is the Firestore
// Security Rules, set in the Firebase console.

export const firebaseConfig = {
  apiKey: "AIzaSyBRQ0e48tOZ4_iD2rqxz-1SxeCouhnA8_Y",
  authDomain: "sycamore-cup.firebaseapp.com",
  projectId: "sycamore-cup",
  storageBucket: "sycamore-cup.firebasestorage.app",
  messagingSenderId: "609328798447",
  appId: "1:609328798447:web:bc6a3d657481d1206a991a"
};

// Live scoring is connected.
export const FIREBASE_NOT_CONFIGURED = false;

// ---------------------------------------------------------
// App Check — reCAPTCHA Enterprise
// ---------------------------------------------------------
// Public site key (not a secret — it ships inside the page).
// Registered for: farndaddy.github.io and localhost.
// Token lifetime is 7 days, so a phone with bad signal on the
// course isn't re-checking constantly.
export const RECAPTCHA_SITE_KEY = "6Lch-qotAAAAAPgd-uv--Ho0CROcLSAy6Ii8WGK9";

// IMPORTANT SEQUENCING:
// App Check is REGISTERED but NOT ENFORCED. Do not turn on
// enforcement in the Firebase console until this site is deployed
// and confirmed sending App Check tokens — enforcing first locks
// everyone out, including the admin.
export const APP_CHECK_ENFORCED = false;

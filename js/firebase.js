// ══════════════════════════════════════════════════════════
//  মেস মিল ট্র্যাকার — js/firebase.js  (fixed v3)
//  Fix: deprecated persistence, real config ঢোকানো হয়েছে
// ══════════════════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth,
  GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ── Firebase Config ──────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBHkl-cFR7Z4ZhItYPNlh78vBuP0HngNQg",
  authDomain:        "mess-tracker-3b98a.firebaseapp.com",
  projectId:         "mess-tracker-3b98a",
  storageBucket:     "mess-tracker-3b98a.firebasestorage.app",
  messagingSenderId: "170556408162",
  appId:             "1:170556408162:web:21f198e1a07a2ddbc52c3b",
  measurementId:     "G-M5TVZW2G0W"
};

// ── Initialize App ───────────────────────────────────────
const app = initializeApp(firebaseConfig);

// ── Firestore — নতুন persistent cache API (deprecated warning নেই) ──
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // Hot reload বা already initialized
  db = getFirestore(app);
}

// ── Auth ─────────────────────────────────────────────────
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ── Storage ──────────────────────────────────────────────
const storage = getStorage(app);

export { app, db, auth, storage, googleProvider };

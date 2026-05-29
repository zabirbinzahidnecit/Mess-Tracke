// auth.js — fixed: deleted mess check, 3-day pending auto-cleanup, invite handling

import { auth, db, googleProvider } from './firebase.js';
import { toast, ld, uld } from './utils.js';
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  writeBatch, collection, getDocs, query, where, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { renderRouter } from './router.js';
import { processPendingInvite } from './invite-handler.js';

export let currentUser    = null;
export let currentProfile = null;

// ── Google Sign-In ────────────────────────────────────────
export async function startAuth() {
  const btn = document.getElementById('btn-login');
  if (btn) btn.disabled = true;
  ld('লগইন হচ্ছে…');
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    const code = err.code || '';
    if (code === 'auth/popup-blocked') {
      toast('Popup block — redirect এ যাচ্ছে…', 'info');
      try { await signInWithRedirect(auth, googleProvider); return; } catch(e2) {}
    }
    uld();
    if (btn) btn.disabled = false;
    if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      toast('লগইন ব্যর্থ: ' + (err.message || code), 'er');
    }
  }
}

export async function handleRedirectResult() {
  try { await getRedirectResult(auth); } catch(err) {}
}

export async function logout() {
  try {
    currentUser = null; currentProfile = null;
    await signOut(auth);
  } catch (err) { toast('লগআউট ব্যর্থ', 'er'); }
}

// ── User doc ensure ───────────────────────────────────────
async function ensureUserDoc(firebaseUser) {
  const ref  = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: firebaseUser.email,
      name:  firebaseUser.displayName || firebaseUser.email.split('@')[0],
      avatar: firebaseUser.photoURL || null,
      status: 'pending', platformRole: null, currentMessId: null,
      createdAt: serverTimestamp()
    });
    return (await getDoc(ref)).data();
  }
  const data = snap.data();
  const upd  = {};
  if (firebaseUser.photoURL && data.avatar !== firebaseUser.photoURL) upd.avatar = firebaseUser.photoURL;
  if (Object.keys(upd).length) await updateDoc(ref, upd);
  return { ...data, ...upd };
}

// ── Deleted mess check ────────────────────────────────────
async function checkDeletedMess(profile, uid) {
  if (!profile.currentMessId) return profile;
  try {
    const messSnap = await getDoc(doc(db,'messes',profile.currentMessId));
    if (!messSnap.exists()) {
      // Mess deleted — user কে pending করো
      await updateDoc(doc(db,'users',uid), { currentMessId: null, status: 'pending' });
      toast('আপনার মেস মুছে ফেলা হয়েছে', 'er');
      return { ...profile, currentMessId: null, status: 'pending' };
    }
  } catch(e) {}
  return profile;
}

// ── 3 দিনের বেশি pending user cleanup ───────────────────
// ✅ Client-side — Firebase Functions ছাড়াই কাজ করবে
// Admin login করলে check করে পুরনো pending request গুলো expire করে
async function cleanupExpiredRequests() {
  try {
    const threeDaysAgo = new Date(Date.now() - 3*24*60*60*1000);
    const q = query(collection(db,'messRequests'), where('status','==','pending'));
    const snap = await getDocs(q);

    for (const d of snap.docs) {
      const data = d.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate()
        : new Date((data.createdAt?.seconds||0)*1000);
      if (createdAt < threeDaysAgo) {
        // Expired — reject করে দাও
        await updateDoc(doc(db,'messRequests',d.id), {
          status: 'rejected',
          reviewNote: 'স্বয়ংক্রিয়ভাবে বাতিল — ৩ দিনের বেশি সময় পার হয়েছে',
          reviewedBy: 'system'
        });
      }
    }
  } catch(e) { console.warn('Cleanup error:', e); }
}

// ── inviteIndex দিয়ে invite check ────────────────────────
async function checkInviteByEmail(firebaseUser) {
  const email = firebaseUser.email?.toLowerCase();
  if (!email) return false;
  try {
    const idxKey  = email.replace(/\./g,'_').replace(/@/g,'_at_');
    const idxRef  = doc(db, 'inviteIndex', idxKey);
    const idxSnap = await getDoc(idxRef);
    if (!idxSnap.exists()) return false;

    const { messId, token, role } = idxSnap.data();
    const tokenRef  = doc(db,'messes',messId,'invites',token);
    const tokenSnap = await getDoc(tokenRef);
    if (!tokenSnap.exists()) return false;

    const inv = tokenSnap.data();
    const exp = inv.expiresAt?.toDate ? inv.expiresAt.toDate() : new Date((inv.expiresAt?.seconds||0)*1000);
    if (inv.used || exp < new Date()) return false;

    const batch = writeBatch(db);
    batch.set(doc(db,'messes',messId,'members',firebaseUser.uid), {
      name: firebaseUser.displayName||email, email,
      avatar: firebaseUser.photoURL||null, role, joinedAt: serverTimestamp()
    });
    batch.update(doc(db,'users',firebaseUser.uid), { status:'active', currentMessId: messId });
    batch.update(tokenRef, { used:true, usedBy:firebaseUser.uid, usedAt:serverTimestamp() });
    batch.delete(idxRef);
    await batch.commit();
    toast('মেসে যোগ হয়েছে! স্বাগতম 🎉', 'ok');
    return true;
  } catch(e) {
    console.warn('Email invite check error:', e.code);
    return false;
  }
}

// ── Auth State Listener ───────────────────────────────────
let _processing = false;

export function initAuth() {
  handleRedirectResult();

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (_processing) return;
    _processing = true;

    if (!firebaseUser) {
      currentUser = null; currentProfile = null;
      uld(); _processing = false;
      renderRouter(null, null);
      return;
    }

    ld('প্রোফাইল লোড হচ্ছে…');
    try {
      currentUser = firebaseUser;
      let profile = await ensureUserDoc(firebaseUser);

      // ✅ Deleted mess check
      profile = await checkDeletedMess(profile, firebaseUser.uid);

      if (!profile.currentMessId) {
        // URL invite link check
        const joinedViaLink = await processPendingInvite(firebaseUser);
        if (joinedViaLink) {
          const s = await getDoc(doc(db,'users',firebaseUser.uid));
          profile = s.data();
        } else {
          // Email invite check
          const joinedViaEmail = await checkInviteByEmail(firebaseUser);
          if (joinedViaEmail) {
            const s = await getDoc(doc(db,'users',firebaseUser.uid));
            profile = s.data();
          }
        }
      }

      currentProfile = { uid: firebaseUser.uid, ...profile };

      // ✅ Platform admin হলে expired requests cleanup
      if (['admin','co-admin'].includes(profile.platformRole)) {
        cleanupExpiredRequests(); // background এ চলবে, await করবো না
      }

      uld(); _processing = false;
      renderRouter(currentUser, currentProfile);
    } catch(err) {
      console.error('Auth state error:', err);
      uld(); _processing = false;
      toast('প্রোফাইল লোড ব্যর্থ', 'er');
      renderRouter(firebaseUser, null);
    }
  });
}

export const isPlatformAdmin   = () => currentProfile?.platformRole === 'admin';
export const isPlatformCoAdmin = () => ['admin','co-admin'].includes(currentProfile?.platformRole);
export const hasMessAccess     = () => !!currentProfile?.currentMessId;

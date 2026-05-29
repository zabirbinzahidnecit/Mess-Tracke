// ══════════════════════════════════════════════════════════
//  মেস মিল ট্র্যাকার — js/invite-handler.js
//  URL invite link থেকে mess join করা
//  index.html এ import করা হয়েছে
// ══════════════════════════════════════════════════════════

import { db } from './firebase.js';
import { toast } from './utils.js';
import {
  doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/**
 * Login এর পর call করা হয় — pending invite থাকলে process করে
 * auth.js এর ensureUserDoc এর পরে call হয়
 */
export async function handleInviteLink() {
  // এই function index.html এ import হয় কিন্তু auth.js থেকে call হয়
}

/**
 * auth.js এ login এর পর pending invite check করে
 * localStorage এ mm_pending_invite থাকলে process করে
 */
export async function processPendingInvite(firebaseUser) {
  const raw = localStorage.getItem('mm_pending_invite');
  if (!raw) return false;

  let pending;
  try { pending = JSON.parse(raw); } catch { localStorage.removeItem('mm_pending_invite'); return false; }

  const { token, messId } = pending;
  if (!token || !messId) { localStorage.removeItem('mm_pending_invite'); return false; }

  try {
    // Invite doc check
    const tokenRef  = doc(db, 'messes', messId, 'invites', token);
    const tokenSnap = await getDoc(tokenRef);

    if (!tokenSnap.exists()) {
      toast('Invite link টি valid নয়', 'er');
      localStorage.removeItem('mm_pending_invite');
      return false;
    }

    const inv = tokenSnap.data();

    if (inv.used) {
      toast('এই invite link আগেই ব্যবহার হয়েছে', 'er');
      localStorage.removeItem('mm_pending_invite');
      return false;
    }

    // Expiry check
    const expiresAt = inv.expiresAt?.toDate ? inv.expiresAt.toDate() : new Date(inv.expiresAt);
    if (expiresAt < new Date()) {
      toast('Invite link এর মেয়াদ শেষ হয়েছে', 'er');
      localStorage.removeItem('mm_pending_invite');
      return false;
    }

    // Email match check (optional — যে email এ invite গেছে সে যদি অন্য email দিয়ে login করে)
    if (inv.email && inv.email.toLowerCase() !== firebaseUser.email?.toLowerCase()) {
      toast(`এই invite শুধুমাত্র ${inv.email} এর জন্য`, 'er');
      localStorage.removeItem('mm_pending_invite');
      return false;
    }

    // Mess join
    const batch = writeBatch(db);

    batch.set(doc(db, 'messes', messId, 'members', firebaseUser.uid), {
      name:     firebaseUser.displayName || firebaseUser.email,
      email:    firebaseUser.email,
      avatar:   firebaseUser.photoURL || null,
      role:     inv.role || 'member',
      joinedAt: serverTimestamp()
    });

    batch.update(doc(db, 'users', firebaseUser.uid), {
      currentMessId: messId,
      status: 'active'
    });

    batch.update(tokenRef, {
      used:   true,
      usedBy: firebaseUser.uid,
      usedAt: serverTimestamp()
    });

    // inviteIndex cleanup (fail হলেও join হবে)
    try {
      const idxKey = firebaseUser.email?.toLowerCase()
        .replace(/\./g,'_').replace(/@/g,'_at_');
      if (idxKey) batch.delete(doc(db, 'inviteIndex', idxKey));
    } catch(e) {}

    await batch.commit();

    localStorage.removeItem('mm_pending_invite');
    toast(`${inv.messName || 'মেসে'} স্বাগতম! 🎉`, 'ok');
    return true;

  } catch (err) {
    console.error('Invite process error:', err);
    // Rules error হলে user কে জানাও
    if (err.code === 'permission-denied') {
      toast('Permission error — Firestore rules চেক করুন', 'er');
    } else {
      toast('Invite process ব্যর্থ: ' + err.message, 'er');
    }
    localStorage.removeItem('mm_pending_invite');
    return false;
  }
}

// ══════════════════════════════════════════════════════════
//  মেস মিল ট্র্যাকার — js/plan.js
//  Free / Paid plan system
//  Free  → Google AdSense ad দেখাবে
//  Paid  → বিজ্ঞাপন নেই, extra features
// ══════════════════════════════════════════════════════════

import { db } from './firebase.js';
import { toast, ld, uld } from './utils.js';
import {
  doc, getDoc, addDoc, collection, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const PLANS = {
  free: {
    name:      'Free',
    price:     0,
    maxMembers: 10,
    maxMesses:  1,
    ads:        true,
    features:  ['মিল ট্র্যাকিং','বাজার হিসাব','ডিপোজিট','মাসিক রিপোর্ট'],
  },
  paid: {
    name:      'Pro',
    price:     199,        // ৳199/মাস
    priceYear: 1999,       // ৳1999/বছর
    maxMembers: 50,
    maxMesses:  5,
    ads:        false,
    features:  ['সব Free features','বিজ্ঞাপন নেই','Push Notification','Priority Support','Unlimited Members'],
  },
};

// ── Mess এর plan check ────────────────────────────────────
export async function getMessPlan(messId) {
  try {
    const snap = await getDoc(doc(db, 'messes', messId));
    return snap.exists() ? (snap.data().plan || 'free') : 'free';
  } catch {
    return 'free';
  }
}

export function isPaid(messData) {
  if (!messData) return false;
  // plan paid এবং expiry পার হয়নি
  if (messData.plan !== 'paid') return false;
  if (!messData.planExpiry) return false;
  const expiry = messData.planExpiry?.toDate
    ? messData.planExpiry.toDate()
    : new Date(messData.planExpiry);
  return expiry > new Date();
}

// ── Ad banner (Free plan) ─────────────────────────────────
export function showAdBanner(container) {
  if (!container) return;
  // AdSense script লোড না হলে fallback banner দেখাবে
  const adDiv = document.createElement('div');
  adDiv.style.cssText = `
    width:100%;background:#f1f5f2;border:1px solid #d8e8dc;
    border-radius:8px;padding:10px;text-align:center;
    font-size:11px;color:#4a7055;margin:12px 0;
  `;

  // Google AdSense ad unit — replace with your ad unit id
  adDiv.innerHTML = `
<ins class="adsbygoogle"
  style="display:block;width:100%;min-height:60px"
  data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
  data-ad-slot="XXXXXXXXXX"
  data-ad-format="auto"
  data-full-width-responsive="true"></ins>
<div style="font-size:10px;color:#8aaa90;margin-top:4px">
  বিজ্ঞাপনমুক্ত অভিজ্ঞতার জন্য
  <button onclick="window.__showUpgrade()" style="background:none;border:none;color:#146b40;font-size:10px;font-weight:700;cursor:pointer;text-decoration:underline">Pro তে upgrade করুন</button>
</div>`;

  container.appendChild(adDiv);

  // AdSense push
  try {
    if (window.adsbygoogle) {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    }
  } catch(e) {}
}

// ── Payment request (bKash) ──────────────────────────────
export async function requestPayment(messId, profile, plan = 'monthly') {
  const price  = plan === 'yearly' ? PLANS.paid.priceYear : PLANS.paid.price;
  const period = plan === 'yearly' ? '১ বছর' : '১ মাস';

  // Show payment modal
  const mo = document.createElement('div');
  mo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px';
  mo.innerHTML = `
<div style="background:#fff;border-radius:16px;padding:24px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2)">
  <h3 style="font-size:16px;font-weight:700;color:#0a180e;margin-bottom:4px">💳 Pro Plan — ${price}৳</h3>
  <p style="font-size:12px;color:#4a7055;margin-bottom:16px">${period} এর জন্য</p>

  <div style="background:#e7f3e7;border:1px solid #c0dcc0;border-radius:10px;padding:12px;margin-bottom:16px">
    <p style="font-size:12px;color:#083d22;font-weight:700;margin-bottom:6px">bKash এ Payment করুন:</p>
    <p style="font-size:20px;font-weight:700;color:#146b40;letter-spacing:2px;margin-bottom:4px">01XXXXXXXXXX</p>
    <p style="font-size:11px;color:#4a7055">(Personal/Merchant নম্বর)</p>
    <p style="font-size:12px;color:#083d22;margin-top:8px">Amount: <strong>${price}৳</strong></p>
    <p style="font-size:12px;color:#083d22">Reference: <strong>${messId.slice(0,8).toUpperCase()}</strong></p>
  </div>

  <div style="margin-bottom:14px">
    <label style="font-size:11px;font-weight:700;color:#4a7055;text-transform:uppercase;letter-spacing:.7px;display:block;margin-bottom:5px">bKash Transaction ID *</label>
    <input id="txn-inp" class="inp inp-sm" placeholder="যেমন: 8N6YJX8P4E" maxlength="20"
      style="width:100%;height:36px;border:1.5px solid #b0ceb8;border-radius:8px;padding:0 10px;font-size:13px;outline:none"/>
  </div>

  <div style="display:flex;gap:8px">
    <button onclick="this.closest('[style*=fixed]').remove()"
      style="flex:1;height:38px;border:1px solid #b0ceb8;background:#f1f5f2;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
      বাতিল
    </button>
    <button id="pay-submit"
      style="flex:1;height:38px;background:#146b40;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
      📤 Submit করুন
    </button>
  </div>
  <p style="font-size:10px;color:#8aaa90;text-align:center;margin-top:10px">
    Admin verify করার পর Plan activate হবে (সাধারণত ২৪ ঘণ্টার মধ্যে)
  </p>
</div>`;

  document.body.appendChild(mo);

  document.getElementById('pay-submit')?.addEventListener('click', async () => {
    const txnId = document.getElementById('txn-inp')?.value.trim();
    if (!txnId || txnId.length < 6) {
      toast('সঠিক Transaction ID দিন', 'er');
      return;
    }
    ld('Submit হচ্ছে…');
    try {
      await addDoc(collection(db, 'paymentRequests'), {
        messId,
        requestedBy:  profile.uid,
        requesterName: profile.name || profile.email,
        amount:       price,
        plan,
        txnId,
        status:       'pending',
        createdAt:    serverTimestamp(),
      });
      mo.remove();
      toast('Payment request পাঠানো হয়েছে! Admin verify করবেন।', 'ok');
    } catch (err) {
      toast('Submit ব্যর্থ: ' + err.message, 'er');
    } finally { uld(); }
  });
}

// ── Upgrade modal ─────────────────────────────────────────
export function showUpgradeModal(messId, profile) {
  window.__showUpgrade = () => requestPayment(messId, profile);
  window.__showUpgrade();
}

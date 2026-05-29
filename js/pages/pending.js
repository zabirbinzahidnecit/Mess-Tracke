// pending.js — fixed: mess deleted = new request allowed, data delete option

import { db } from '../firebase.js';
import { currentProfile, logout } from '../auth.js';
import { toast, ld, uld } from '../utils.js';
import {
  doc, collection, addDoc, query, where, getDocs,
  deleteDoc, serverTimestamp, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export async function render(root, { profile }) {
  // ── Check করো mess সত্যিই exist করে কিনা ────────────────
  // যদি currentMessId আছে কিন্তু mess deleted → clear করো
  if (profile.currentMessId) {
    try {
      const mSnap = await getDoc(doc(db,'messes',profile.currentMessId));
      if (!mSnap.exists()) {
        // Mess deleted — user কে pending করো
        const { updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await updateDoc(doc(db,'users',profile.uid), { currentMessId:null, status:'pending' });
        profile.currentMessId = null;
        toast('আপনার মেস মুছে ফেলা হয়েছে','er');
      }
    } catch(e) {}
  }

  // ── সবচেয়ে নতুন request খোঁজো ───────────────────────────
  let existingReq = null;
  try {
    const q    = query(collection(db,'messRequests'), where('requestedBy','==',profile.uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const sorted = snap.docs
        .map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      const latest = sorted[0];

      // ✅ approved request এর mess যদি delete হয়ে গেছে → নতুন request দেওয়া যাবে
      if (latest.status === 'approved' && latest.messId) {
        const messSnap = await getDoc(doc(db,'messes', latest.messId));
        if (!messSnap.exists()) {
          // Mess deleted — এই request টা stale, নতুন করতে দেওয়া যাবে
          existingReq = null;
        } else {
          existingReq = latest;
        }
      } else if (latest.status === 'pending') {
        // ✅ 3 দিনের বেশি pending → expired দেখাও, নতুন করতে দাও
        const createdAt = latest.createdAt?.toDate ? latest.createdAt.toDate() : new Date(latest.createdAt?.seconds*1000||0);
        const daysDiff  = (Date.now() - createdAt.getTime()) / (1000*60*60*24);
        if (daysDiff > 3) {
          existingReq = { ...latest, expired: true };
        } else {
          existingReq = latest;
        }
      } else {
        existingReq = latest;
      }
    }
  } catch(e) { console.warn('Request check error:', e); }

  root.innerHTML = `
<div style="min-height:100vh;background:var(--g0);position:relative;overflow:hidden">
  <div style="position:absolute;width:400px;height:400px;border-radius:50%;
    background:rgba(20,107,64,.2);filter:blur(80px);top:-100px;right:-80px;pointer-events:none"></div>

  <!-- Topbar -->
  <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;
    background:rgba(0,0,0,.2);border-bottom:1px solid rgba(255,255,255,.07);
    position:sticky;top:0;z-index:50;backdrop-filter:blur(8px)">
    <div style="display:flex;align-items:center;gap:8px;flex:1">
      <div style="width:32px;height:32px;border-radius:9px;background:var(--g2);
        display:flex;align-items:center;justify-content:center;font-size:17px">🍽</div>
      <span style="color:var(--g6);font-size:13px;font-weight:700">মেস মিল ট্র্যাকার</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      ${profile.avatar
        ? `<img src="${_e(profile.avatar)}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.2)" alt=""/>`
        : `<div style="width:30px;height:30px;border-radius:50%;background:var(--g2);color:#fff;
            font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center">
            ${(profile.name||'?')[0].toUpperCase()}</div>`}
      <span style="color:#dff5ec;font-size:13px;font-weight:600;max-width:120px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_e(profile.name||profile.email)}</span>
      <button id="pend-logout" style="height:28px;padding:0 10px;border-radius:6px;
        background:none;border:1px solid rgba(255,255,255,.2);color:var(--g5);
        font-size:12px;font-weight:600;cursor:pointer;font-family:var(--fn)">লগআউট</button>
    </div>
  </div>

  <div style="max-width:560px;margin:0 auto;padding:20px 16px;display:flex;flex-direction:column;gap:14px">

    <!-- Info card -->
    <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
      border-radius:18px;padding:22px;text-align:center">
      <div style="font-size:36px;margin-bottom:10px">👤</div>
      <h2 style="color:var(--g6);font-size:17px;font-weight:700;margin-bottom:8px">আপনি কোনো মেসে নেই</h2>
      <p style="color:var(--g5);font-size:13px;margin-bottom:16px;line-height:1.6">
        Mess Admin এর invite link দিয়ে join করুন অথবা নতুন মেস তৈরির অনুরোধ পাঠান।
      </p>
      <div style="text-align:left;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:flex-start;gap:10px;background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px">
          <span style="font-size:20px">📨</span>
          <div>
            <p style="color:var(--g6);font-size:13px;font-weight:600;margin-bottom:2px">Invite Link দিয়ে Join করুন</p>
            <p style="color:var(--g5);font-size:11px">Admin এর কাছ থেকে invite link নিন এবং সেই link এ click করুন</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Form area -->
    <div id="pend-form-area"></div>
  </div>
</div>

<style>
.pend-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:22px}
.pend-card h3{color:var(--g6);font-size:15px;font-weight:700;margin-bottom:4px}
.pend-card .sub{color:var(--g5);font-size:12px;margin-bottom:16px;line-height:1.5}
.pend-field{margin-bottom:12px}
.pend-field label{display:block;font-size:10px;font-weight:700;color:var(--g5);
  text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px}
.pend-field input,.pend-field textarea{width:100%;background:rgba(255,255,255,.07);
  border:1.5px solid rgba(255,255,255,.1);border-radius:9px;padding:10px 12px;
  font-size:13px;color:var(--g6);outline:none;font-family:var(--fn);resize:vertical;transition:.15s;
  box-sizing:border-box}
.pend-field input:focus,.pend-field textarea:focus{border-color:var(--g3)}
.pend-field input::placeholder,.pend-field textarea::placeholder{color:rgba(255,255,255,.2)}
.pend-btn{width:100%;height:42px;border:none;border-radius:10px;
  font-size:14px;font-weight:600;cursor:pointer;font-family:var(--fn);transition:.15s}
.pend-btn-p{background:var(--g2);color:#fff}
.pend-btn-p:hover{background:var(--g1)}
.pend-btn-d{background:var(--r1);color:#fff;margin-top:8px}
.pend-btn-d:hover{background:var(--r0)}
.pend-btn:disabled{opacity:.5;cursor:not-allowed}
</style>`;

  root.querySelector('#pend-logout').addEventListener('click', () => logout());
  _renderFormArea(root, profile, existingReq);
}

function _renderFormArea(root, profile, req) {
  const area = root.querySelector('#pend-form-area');
  if (!area) return;

  if (!req) {
    area.innerHTML = _formHTML();
    area.querySelector('#pend-submit-btn').addEventListener('click', () => _submit(root, area, profile));
    return;
  }

  // Expired pending (3+ days)
  if (req.expired) {
    area.innerHTML = `
<div class="pend-card">
  <div style="text-align:center">
    <div style="font-size:32px;margin-bottom:10px">⏰</div>
    <h3 style="text-align:center;margin-bottom:8px">অনুরোধের মেয়াদ শেষ</h3>
    <p style="color:var(--g5);font-size:12px;margin-bottom:16px;line-height:1.6">
      আপনার আগের অনুরোধ (<strong>${_e(req.messName)}</strong>) ৩ দিনেরও বেশি সময় ধরে pending।
      এটি মুছে নতুন অনুরোধ পাঠান।
    </p>
    <button class="pend-btn pend-btn-d" id="del-expired-btn" style="width:auto;padding:0 20px">
      🗑 পুরনো অনুরোধ মুছুন ও নতুন করুন
    </button>
  </div>
</div>`;
    area.querySelector('#del-expired-btn').addEventListener('click', async () => {
      ld('মুছে ফেলা হচ্ছে…');
      try {
        await deleteDoc(doc(db,'messRequests',req.id));
        uld();
        _renderFormArea(root, profile, null);
      } catch(e) { uld(); toast('ব্যর্থ: '+e.message,'er'); }
    });
    return;
  }

  // Existing request
  const statusMap = {
    pending:  { label:'⏳ অপেক্ষামাণ', color:'var(--a0)', bg:'var(--a3)' },
    approved: { label:'✅ অনুমোদিত',   color:'var(--g1)', bg:'var(--g7)' },
    rejected: { label:'❌ বাতিল',       color:'var(--r1)', bg:'var(--r3)' },
  };
  const s = statusMap[req.status] || statusMap.pending;

  area.innerHTML = `
<div class="pend-card">
  <div style="text-align:center;padding:8px 0">
    <div style="font-size:32px;margin-bottom:10px">📋</div>
    <h3 style="text-align:center">আপনার অনুরোধ পাঠানো হয়েছে</h3>
    <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;
      border-radius:20px;font-size:12px;font-weight:700;
      background:${s.bg};color:${s.color};margin:10px 0 14px;font-family:var(--fn)">
      ${s.label}
    </span>
    <p style="color:var(--g6);font-size:14px;font-weight:600">${_e(req.messName||'')}</p>
    ${req.address?`<p style="color:rgba(255,255,255,.4);font-size:11px;margin-top:4px">${_e(req.address)}</p>`:''}
    ${req.reviewNote?`<p style="color:var(--a2);font-size:12px;margin-top:10px;
      background:rgba(217,141,42,.1);padding:8px;border-radius:8px">
      💬 ${_e(req.reviewNote)}</p>`:''}
    <p style="color:rgba(255,255,255,.3);font-size:11px;margin-top:10px">
      ${req.status==='pending'?'Admin review করলে জানানো হবে। Refresh করুন।':''}
    </p>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap">
      ${req.status==='rejected'?`<button class="pend-btn pend-btn-p" style="max-width:200px" id="new-req-btn">🔄 নতুন অনুরোধ</button>`:''}
      ${req.status!=='approved'?`<button class="pend-btn pend-btn-d" style="max-width:200px" id="del-req-btn">🗑 অনুরোধ মুছুন</button>`:''}
    </div>
  </div>
</div>`;

  area.querySelector('#del-req-btn')?.addEventListener('click', () => _deleteReq(root, area, profile, req));
  area.querySelector('#new-req-btn')?.addEventListener('click', () => _renderFormArea(root, profile, null));
}

function _formHTML() {
  return `
<div class="pend-card">
  <h3>🏠 নতুন মেস তৈরির অনুরোধ</h3>
  <p class="sub">Admin approve করলে আপনার মেস active হবে এবং আপনি Mess Admin হবেন।</p>
  <div class="pend-field">
    <label>মেসের নাম *</label>
    <input id="req-name" placeholder="যেমন: মিয়া বাড়ি মেস" maxlength="80"/>
  </div>
  <div class="pend-field">
    <label>ঠিকানা</label>
    <input id="req-addr" placeholder="রোড, এলাকা, শহর" maxlength="120"/>
  </div>
  <div class="pend-field">
    <label>বিবরণ (ঐচ্ছিক)</label>
    <textarea id="req-desc" rows="3" placeholder="মেস সম্পর্কে সংক্ষিপ্ত বিবরণ…" maxlength="300"></textarea>
  </div>
  <button class="pend-btn pend-btn-p" id="pend-submit-btn">📤 অনুরোধ পাঠান</button>
</div>`;
}

async function _submit(root, area, profile) {
  const name = area.querySelector('#req-name')?.value.trim();
  const addr = area.querySelector('#req-addr')?.value.trim();
  const desc = area.querySelector('#req-desc')?.value.trim();
  if (!name) { toast('মেসের নাম দিন','er'); return; }

  const btn = area.querySelector('#pend-submit-btn');
  if (btn) { btn.disabled=true; btn.textContent='পাঠানো হচ্ছে…'; }

  try {
    const docRef = await addDoc(collection(db,'messRequests'), {
      requestedBy:    profile.uid,
      requesterEmail: profile.email,
      requesterName:  profile.name,
      messName:  name,
      address:   addr||'',
      description: desc||'',
      status:    'pending',
      reviewedBy: null,
      reviewNote: '',
      createdAt: serverTimestamp()
    });
    toast('অনুরোধ পাঠানো হয়েছে!','ok');
    _renderFormArea(root, profile, { id: docRef.id, messName: name, address: addr, status: 'pending' });
  } catch(err) {
    toast('পাঠানো যায়নি: '+err.message,'er');
    if (btn) { btn.disabled=false; btn.textContent='📤 অনুরোধ পাঠান'; }
  }
}

async function _deleteReq(root, area, profile, req) {
  if (!window.confirm('অনুরোধটি মুছে ফেলবেন?')) return;
  ld('মুছে ফেলা হচ্ছে…');
  try {
    await deleteDoc(doc(db,'messRequests',req.id));
    uld();
    toast('অনুরোধ মুছে ফেলা হয়েছে','ok');
    _renderFormArea(root, profile, null);
  } catch(err) {
    uld();
    toast('মুছতে ব্যর্থ: '+err.message,'er');
  }
}

const _e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

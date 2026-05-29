// requests.js — fixed: no composite index needed (client-side sort)

import { db } from '../../firebase.js';
import { toast, taka, formatDate, CICO } from '../../utils.js';
import {
  collection, getDocs, updateDoc, doc,
  query, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let _pendingExp=[], _pendingDep=[], _tab='expense';

export async function render(root, ctx) {
  const role = ctx?.myMessRole || 'member';

  if (!['mess-admin','mess-co-admin'].includes(role)) {
    root.innerHTML = `
<div class="card">
  <div class="cb" style="text-align:center;padding:30px;color:var(--ink3)">
    <div style="font-size:32px;margin-bottom:8px">🔒</div>
    <p style="font-size:13px">এই পেজ শুধুমাত্র Mess Admin ও Co-Admin এর জন্য।</p>
  </div>
</div>`;
    return;
  }

  root.innerHTML = `
<div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
    <div>
      <h2 style="font-size:17px;font-weight:700;color:var(--ink);margin:0">✅ অনুমোদন</h2>
      <p style="font-size:12px;color:var(--ink3);margin:3px 0 0" id="req-count">লোড হচ্ছে…</p>
    </div>
    <button class="btn btn-ghost btn-sm" id="req-refresh">🔄 রিফ্রেশ</button>
  </div>
  <div class="adm-tabs">
    <button class="adm-tab active" data-tab="expense">🛒 বাজার</button>
    <button class="adm-tab" data-tab="deposit">💰 ডিপোজিট</button>
  </div>
  <div id="req-content" style="display:flex;flex-direction:column;gap:8px">
    <div style="padding:20px;text-align:center;color:var(--ink3)">লোড হচ্ছে…</div>
  </div>
</div>

<style>
.req-item{background:#fff;border:1px solid var(--line);border-radius:12px;
  padding:12px 14px;box-shadow:var(--sh)}
.req-item-hd{display:flex;align-items:flex-start;justify-content:space-between;
  gap:8px;margin-bottom:8px}
.req-item-hd h3{font-size:13px;font-weight:700;color:var(--ink);margin:0}
.req-item-hd p{font-size:11px;color:var(--ink3);margin:3px 0 0}
</style>`;

  const messId = ctx.messId;
  root.querySelector('#req-refresh').addEventListener('click', () => _load(root, messId, ctx));
  root.querySelector('.adm-tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    _tab = b.dataset.tab;
    root.querySelectorAll('.adm-tab').forEach(x => x.classList.toggle('active', x.dataset.tab===_tab));
    _renderTab(root);
  });
  root.querySelector('#req-content').addEventListener('click', e => {
    const apExp = e.target.closest('[data-app-exp]');
    const rjExp = e.target.closest('[data-rej-exp]');
    const apDep = e.target.closest('[data-app-dep]');
    const rjDep = e.target.closest('[data-rej-dep]');
    if (apExp) _approve(root, messId, ctx, 'expenses', apExp.dataset.appExp);
    if (rjExp) _reject(root, messId, ctx, 'expenses', rjExp.dataset.rejExp);
    if (apDep) _approve(root, messId, ctx, 'deposits', apDep.dataset.appDep);
    if (rjDep) _reject(root, messId, ctx, 'deposits', rjDep.dataset.rejDep);
  });

  await _load(root, messId, ctx);
}

async function _load(root, messId, ctx) {
  try {
    // ✅ FIXED: where মাত্র একটা — no composite index needed
    // client-side এ filter + sort করছি
    const [expSnap, depSnap] = await Promise.all([
      getDocs(query(collection(db,'messes',messId,'expenses'), where('status','==','pending'))),
      getDocs(query(collection(db,'messes',messId,'deposits'), where('status','==','pending'))),
    ]);

    // Client-side sort by createdAt desc
    _pendingExp = expSnap.docs
      .map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    _pendingDep = depSnap.docs
      .map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));

    const total = _pendingExp.length + _pendingDep.length;
    const el = root.querySelector('#req-count');
    if (el) el.textContent = `${total}টি অনুমোদন অপেক্ষামাণ`;
    _renderTab(root);
  } catch (err) {
    console.error('Requests load error:', err);
    toast('লোড ব্যর্থ: '+err.message,'er');
  }
}

function _renderTab(root) {
  const content = root.querySelector('#req-content');
  if (!content) return;
  const items = _tab==='expense' ? _pendingExp : _pendingDep;
  const isExp  = _tab==='expense';

  if (!items.length) {
    content.innerHTML = `<div style="padding:30px;text-align:center;color:var(--ink3)">
      <div style="font-size:28px;margin-bottom:8px">✅</div>
      <p>কোনো pending অনুরোধ নেই</p></div>`;
    return;
  }

  content.innerHTML = items.map(item => `
<div class="req-item">
  <div class="req-item-hd">
    <div>
      <h3>${isExp?(CICO[item.category]||'📦')+' '+_e(item.item||''):'💰 '+_e(item.memberName||'')}</h3>
      <p>${isExp?_e(item.addedByName||'—')+' · '+_e(item.date||''):_e(item.date||'')}</p>
    </div>
    <span style="font-size:15px;font-weight:700;font-family:var(--mono);
      color:${isExp?'var(--g1)':'var(--b0)'}">
      ${taka(item.amount)}
    </span>
  </div>
  ${item.note?`<p style="font-size:12px;color:var(--ink3);margin-bottom:8px">📝 ${_e(item.note)}</p>`:''}
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    ${isExp
      ? `<button class="btn btn-sm btn-p" data-app-exp="${item.id}">✓ অনুমোদন</button>
         <button class="btn btn-sm btn-danger" data-rej-exp="${item.id}">✗ বাতিল</button>`
      : `<button class="btn btn-sm btn-p" data-app-dep="${item.id}">✓ অনুমোদন</button>
         <button class="btn btn-sm btn-danger" data-rej-dep="${item.id}">✗ বাতিল</button>`
    }
  </div>
</div>`).join('');
}

async function _approve(root, messId, ctx, col, id) {
  try {
    await updateDoc(doc(db,'messes',messId,col,id), {
      status:'approved', approvedBy:ctx.profile.uid, approvedAt:serverTimestamp()
    });
    toast('অনুমোদন দেওয়া হয়েছে','ok');
    if (col==='expenses') _pendingExp = _pendingExp.filter(e=>e.id!==id);
    else                  _pendingDep = _pendingDep.filter(d=>d.id!==id);
    _updateCount(root);
    _renderTab(root);
  } catch(err){ toast('ব্যর্থ: '+err.message,'er'); }
}

async function _reject(root, messId, ctx, col, id) {
  try {
    await updateDoc(doc(db,'messes',messId,col,id), {status:'rejected'});
    toast('বাতিল করা হয়েছে','ok');
    if (col==='expenses') _pendingExp = _pendingExp.filter(e=>e.id!==id);
    else                  _pendingDep = _pendingDep.filter(d=>d.id!==id);
    _updateCount(root);
    _renderTab(root);
  } catch(err){ toast('ব্যর্থ: '+err.message,'er'); }
}

function _updateCount(root) {
  const total = _pendingExp.length + _pendingDep.length;
  const el = root.querySelector('#req-count');
  if (el) el.textContent = `${total}টি অনুমোদন অপেক্ষামাণ`;
  document.getElementById('req-badge-dot')?.classList.toggle('show', total>0);
}

const _e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

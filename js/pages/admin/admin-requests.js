// admin-requests.js — fixed: show all requests, re-approve deleted mess, delete option

import { db } from '../../firebase.js';
import { currentProfile } from '../../auth.js';
import { toast, ld, uld, formatDate } from '../../utils.js';
import {
  collection, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, writeBatch, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let _allReqs=[], _curTab='pending', _rejectId=null;

export async function render(root) {
  root.innerHTML = `
<div>
  <div class="adp-hd">
    <div>
      <h2 class="adp-h">মেস তৈরির অনুরোধ</h2>
      <p class="adp-sub" id="req-count">লোড হচ্ছে…</p>
    </div>
    <button class="btn btn-ghost btn-sm" id="req-refresh">🔄 রিফ্রেশ</button>
  </div>
  <div class="adm-tabs">
    <button class="adm-tab active" data-tab="pending">⏳ অপেক্ষামাণ</button>
    <button class="adm-tab" data-tab="approved">✅ অনুমোদিত</button>
    <button class="adm-tab" data-tab="rejected">❌ বাতিল</button>
    <button class="adm-tab" data-tab="all">সব</button>
  </div>
  <div id="req-list" style="display:flex;flex-direction:column;gap:10px">
    <div class="adm-loading">লোড হচ্ছে…</div>
  </div>
</div>

<!-- Reject modal -->
<div id="reject-mo" style="display:none;position:fixed;inset:0;
  background:rgba(0,0,0,.45);z-index:300;align-items:center;justify-content:center;padding:20px">
  <div style="background:#fff;border-radius:14px;padding:22px;width:100%;max-width:400px">
    <h3 style="font-size:15px;font-weight:700;margin-bottom:10px">❌ অনুরোধ বাতিল</h3>
    <p style="font-size:12px;color:var(--ink3);margin-bottom:12px">কারণ লিখুন (ঐচ্ছিক):</p>
    <textarea id="reject-note" rows="3"
      style="width:100%;border:1.5px solid var(--line2);border-radius:8px;
        padding:9px 11px;font-size:13px;resize:vertical;outline:none;box-sizing:border-box"
      placeholder="বাতিলের কারণ…"></textarea>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-ghost btn-sm" id="reject-close">বাতিল</button>
      <button class="btn btn-danger btn-sm" id="reject-confirm">✗ বাতিল করুন</button>
    </div>
  </div>
</div>

<style>
.req-card{background:#fff;border:1px solid var(--line);border-radius:12px;
  box-shadow:var(--sh);padding:14px 16px}
.req-card-hd{display:flex;align-items:flex-start;justify-content:space-between;
  gap:10px;margin-bottom:10px}
.req-card-hd h3{font-size:14px;font-weight:700;color:var(--ink);margin:0}
.req-card-hd p{font-size:11px;color:var(--ink3);margin:3px 0 0}
.req-info{font-size:12px;color:var(--ink3);margin-bottom:12px;line-height:1.8}
.req-note{background:var(--a4);border:1px solid var(--a3);border-radius:8px;
  padding:8px 11px;font-size:12px;color:var(--a0);margin-top:8px}
.mess-deleted-warn{background:var(--r3);border:1px solid var(--r2);border-radius:8px;
  padding:6px 10px;font-size:11px;color:var(--r1);margin-top:6px}
</style>`;

  root.querySelector('#req-refresh').addEventListener('click', () => _load(root));
  root.querySelector('.adm-tabs').addEventListener('click', e => {
    const b=e.target.closest('[data-tab]');
    if(!b) return;
    _curTab=b.dataset.tab;
    root.querySelectorAll('.adm-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===_curTab));
    _render(root);
  });
  root.querySelector('#reject-close').addEventListener('click', _closeReject);
  root.querySelector('#reject-confirm').addEventListener('click', () => _reject(root, _rejectId));
  root.querySelector('#req-list').addEventListener('click', e => {
    const ap = e.target.closest('[data-approve]');
    const rj = e.target.closest('[data-reject]');
    const dl = e.target.closest('[data-delete]');
    if (ap) _approve(root, ap.dataset.approve);
    if (rj) { _rejectId=rj.dataset.reject; document.getElementById('reject-mo').style.display='flex'; }
    if (dl) _delete(root, dl.dataset.delete);
  });

  await _load(root);
}

async function _load(root) {
  ld('অনুরোধ লোড হচ্ছে…');
  try {
    const snap = await getDocs(query(collection(db,'messRequests'), orderBy('createdAt','desc')));
    _allReqs = snap.docs.map(d=>({id:d.id,...d.data()}));

    // ✅ approved request এর mess exist করে কিনা check করো
    for (const req of _allReqs) {
      if (req.status==='approved' && req.messId) {
        const mSnap = await getDoc(doc(db,'messes',req.messId));
        req._messDeleted = !mSnap.exists();
      }
    }

    const pending = _allReqs.filter(r=>r.status==='pending').length;
    const expired = _allReqs.filter(r=>r.status==='pending' && _isExpired(r)).length;
    root.querySelector('#req-count').textContent =
      `${pending}টি অপেক্ষামাণ${expired>0?` (${expired}টি expired)`:''}`;
    _render(root);
  } catch(err) {
    root.querySelector('#req-list').innerHTML = `<div class="adm-loading">⚠️ ${err.message}</div>`;
  } finally { uld(); }
}

function _isExpired(req) {
  const createdAt = req.createdAt?.toDate ? req.createdAt.toDate()
    : new Date((req.createdAt?.seconds||0)*1000);
  return (Date.now() - createdAt.getTime()) > 3*24*60*60*1000;
}

function _render(root) {
  const list = root.querySelector('#req-list');
  if (!list) return;
  const filtered = _curTab==='all' ? _allReqs : _allReqs.filter(r=>r.status===_curTab);
  if (!filtered.length) { list.innerHTML='<div class="adm-loading">কোনো অনুরোধ নেই</div>'; return; }

  const badge = {
    pending:  '<span class="badge b-amber">⏳ অপেক্ষামাণ</span>',
    approved: '<span class="badge b-green">✅ অনুমোদিত</span>',
    rejected: '<span class="badge b-red">❌ বাতিল</span>',
  };

  list.innerHTML = filtered.map(r => {
    const expired  = r.status==='pending' && _isExpired(r);
    const canApprove = r.status==='pending' || (r.status==='approved' && r._messDeleted);

    return `
<div class="req-card">
  <div class="req-card-hd">
    <div>
      <h3>🏠 ${_e(r.messName)}</h3>
      <p>${_e(r.requesterName)} · ${_e(r.requesterEmail)}</p>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
      ${badge[r.status]||''}
      ${expired?'<span class="badge b-red" style="font-size:9px">⏰ Expired</span>':''}
    </div>
  </div>
  <div class="req-info">
    ${r.address?`<div>📍 ${_e(r.address)}</div>`:''}
    ${r.description?`<div>📝 ${_e(r.description)}</div>`:''}
    <div>📅 ${r.createdAt?formatDate(r.createdAt):'—'}</div>
  </div>
  ${r.reviewNote?`<div class="req-note">💬 ${_e(r.reviewNote)}</div>`:''}
  ${r._messDeleted?`<div class="mess-deleted-warn">⚠️ এই mess টি মুছে ফেলা হয়েছে। Re-approve করলে নতুন mess তৈরি হবে।</div>`:''}
  <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
    ${canApprove?`<button class="btn btn-sm btn-p" data-approve="${r.id}">✓ ${r._messDeleted?'Re-approve':'অনুমোদন'}</button>`:''}
    ${r.status==='pending'?`<button class="btn btn-sm btn-danger" data-reject="${r.id}">✗ বাতিল</button>`:''}
    <button class="btn btn-sm btn-ghost" data-delete="${r.id}">🗑 মুছুন</button>
  </div>
</div>`;
  }).join('');
}

async function _approve(root, reqId) {
  const req = _allReqs.find(r=>r.id===reqId);
  if (!req) return;
  ld('মেস তৈরি হচ্ছে…');
  try {
    const batch   = writeBatch(db);
    const messRef = doc(collection(db,'messes'));

    batch.set(messRef, {
      name:      req.messName,
      address:   req.address||'',
      status:    'active',
      createdAt: serverTimestamp(),
      createdBy: req.requestedBy,
    });
    batch.set(doc(db,'messes',messRef.id,'settings','main'), {
      slots:['সকাল','দুপুর','রাত'], cutoffHour:10, maxMealsPerDay:3,
      rentEnabled:false, rentGas:0, rentElectric:0, rentWater:0, rentBua:0, lang:'bn',
    });
    batch.set(doc(db,'messes',messRef.id,'members',req.requestedBy), {
      name:req.requesterName, email:req.requesterEmail, avatar:null,
      role:'mess-admin', joinedAt:serverTimestamp(),
    });
    batch.update(doc(db,'users',req.requestedBy), {
      currentMessId: messRef.id, status:'active',
    });
    batch.update(doc(db,'messRequests',reqId), {
      status:'approved', messId: messRef.id,
      reviewedBy: currentProfile?.uid||'', reviewNote:'',
    });
    await batch.commit();
    req.status='approved'; req.messId=messRef.id; req._messDeleted=false;
    _render(root);
    toast('মেস তৈরি ও অনুমোদন হয়েছে!','ok');
  } catch(err) {
    toast('অনুমোদন ব্যর্থ: '+err.message,'er');
    console.error(err);
  } finally { uld(); }
}

async function _reject(root, reqId) {
  if (!reqId) return;
  const note = document.getElementById('reject-note')?.value.trim()||'';
  const req  = _allReqs.find(r=>r.id===reqId);
  if (!req) return;
  try {
    await updateDoc(doc(db,'messRequests',reqId), {
      status:'rejected', reviewedBy:currentProfile?.uid||'', reviewNote:note,
    });
    req.status='rejected'; req.reviewNote=note;
    _render(root);
    toast('অনুরোধ বাতিল হয়েছে','ok');
  } catch(err) { toast('ব্যর্থ: '+err.message,'er'); }
  _closeReject();
}

async function _delete(root, reqId) {
  if (!window.confirm('এই অনুরোধ সম্পূর্ণ মুছে ফেলবেন?')) return;
  try {
    await deleteDoc(doc(db,'messRequests',reqId));
    _allReqs = _allReqs.filter(r=>r.id!==reqId);
    _render(root);
    toast('মুছে ফেলা হয়েছে','ok');
  } catch(err) { toast('ব্যর্থ: '+err.message,'er'); }
}

function _closeReject() {
  _rejectId=null;
  document.getElementById('reject-mo').style.display='none';
  document.getElementById('reject-note').value='';
}

const _e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

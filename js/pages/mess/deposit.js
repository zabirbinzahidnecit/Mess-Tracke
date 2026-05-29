// মেস মিল ট্র্যাকার — deposit.js (fixed: event delegation)

import { db } from '../../firebase.js';
import { toast, taka, pad, moName } from '../../utils.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const TODAY = new Date();
let _vy=TODAY.getFullYear(), _vm=TODAY.getMonth();
let _deposits=[], _members=[], _ctx={};

export async function render(root, ctx) {
  _ctx = ctx;

  root.innerHTML = `
<div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <button class="btn btn-ghost btn-sm" id="dep-prev">◀</button>
    <span style="font-size:14px;font-weight:700;min-width:130px;text-align:center" id="dep-month"></span>
    <button class="btn btn-ghost btn-sm" id="dep-next">▶</button>
    <button class="btn btn-ghost btn-sm" style="margin-left:auto" id="dep-refresh">🔄</button>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="ch"><h3>💰 নতুন ডিপোজিট যোগ করুন</h3></div>
    <div class="cb">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
        <div class="field"><label class="lbl">সদস্য</label>
          <select class="inp inp-sm" id="dep-member"></select></div>
        <div class="field"><label class="lbl">তারিখ</label>
          <input class="inp inp-sm" type="date" id="dep-date"
            value="${TODAY.getFullYear()}-${pad(TODAY.getMonth()+1)}-${pad(TODAY.getDate())}"/></div>
        <div class="field"><label class="lbl">পরিমাণ (৳)</label>
          <input class="inp inp-sm" id="dep-amount" type="number" min="0" placeholder="0"/></div>
        <div class="field" style="grid-column:1/-1"><label class="lbl">নোট (ঐচ্ছিক)</label>
          <input class="inp inp-sm" id="dep-note" placeholder="বিস্তারিত…"/></div>
      </div>
      <button class="btn btn-p btn-sm" style="margin-top:8px" id="dep-add-btn">+ যোগ করুন</button>
    </div>
  </div>

  <div class="gA" id="dep-summary" style="margin-bottom:14px"></div>

  <div class="card">
    <div class="ch">
      <h3>💳 ডিপোজিট তালিকা</h3>
      <span style="font-size:12px;font-weight:700;color:var(--g1)" id="dep-total">৳০</span>
    </div>
    <div style="overflow-x:auto" id="dep-content">লোড হচ্ছে…</div>
  </div>
</div>`;

  root.querySelector('#dep-prev').addEventListener('click', () => { _vm--; if(_vm<0){_vm=11;_vy--} _load(root); });
  root.querySelector('#dep-next').addEventListener('click', () => { _vm++; if(_vm>11){_vm=0;_vy++} _load(root); });
  root.querySelector('#dep-refresh').addEventListener('click', () => _load(root));
  root.querySelector('#dep-add-btn').addEventListener('click', () => _add(root));
  root.querySelector('#dep-content').addEventListener('click', e => {
    const ap = e.target.closest('[data-approve]');
    const rj = e.target.closest('[data-reject]');
    const dl = e.target.closest('[data-delete]');
    if (ap) _approve(root, ap.dataset.approve);
    if (rj) _reject(root, rj.dataset.reject);
    if (dl) _delete(root, dl.dataset.delete);
  });

  root.querySelector('#dep-month').textContent = `${moName(_vm)} ${_vy}`;
  await _load(root);
}

async function _load(root) {
  root.querySelector('#dep-month').textContent = `${moName(_vm)} ${_vy}`;
  const monthStr = `${_vy}-${pad(_vm+1)}`;

  const mSnap = await getDocs(query(collection(db,'messes',_ctx.messId,'members'), orderBy('joinedAt')));
  _members = mSnap.docs.map(d=>({uid:d.id,...d.data()}));

  const sel = root.querySelector('#dep-member');
  if (sel) {
    sel.innerHTML = _members.map(m=>
      `<option value="${m.uid}" data-name="${_e(m.name||m.email)}">${_e(m.name||m.email)}</option>`
    ).join('');
    sel.value = _ctx.profile.uid;
  }

  const dSnap = await getDocs(query(collection(db,'messes',_ctx.messId,'deposits'), orderBy('date','desc')));
  _deposits = dSnap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.date?.startsWith(monthStr));
  _render(root);
}

function _render(root) {
  const canApprove = ['mess-admin','mess-co-admin'].includes(_ctx.myMessRole);
  const isAdmin    = _ctx.myMessRole==='mess-admin';

  const memberTotals={};
  _deposits.filter(d=>d.status==='approved').forEach(d=>{
    memberTotals[d.memberId]=(memberTotals[d.memberId]||0)+(parseFloat(d.amount)||0);
  });
  const grand = Object.values(memberTotals).reduce((a,b)=>a+b,0);
  const totalEl = root.querySelector('#dep-total');
  if (totalEl) totalEl.textContent = taka(grand);

  const sumEl = root.querySelector('#dep-summary');
  if (sumEl) {
    sumEl.innerHTML = _members.map(m=>
      `<div class="sc sg"><div class="sl">${_e(m.name||m.email)}</div>
      <div class="sv">${taka(memberTotals[m.uid]||0)}</div>
      <div class="ss">মোট জমা</div></div>`
    ).join('');
  }

  const content = root.querySelector('#dep-content');
  if (!content) return;
  if (!_deposits.length) {
    content.innerHTML='<div style="padding:20px;text-align:center;color:var(--ink3)">এই মাসে কোনো ডিপোজিট নেই</div>';
    return;
  }

  content.innerHTML = `<table class="dt">
<thead><tr>
  <th class="tl">সদস্য</th><th>তারিখ</th><th>পরিমাণ</th><th>অবস্থা</th>
  ${canApprove?'<th>অ্যাকশন</th>':''}
</tr></thead><tbody>
${_deposits.map(d=>`<tr>
  <td class="tl" style="font-weight:600">${_e(d.memberName||'—')}</td>
  <td>${d.date||'—'}</td>
  <td style="font-weight:700;font-family:var(--mono)">${taka(d.amount)}</td>
  <td>${_badge(d.status)}</td>
  ${canApprove?`<td><div style="display:flex;gap:4px;justify-content:center">
    ${d.status==='pending'?`<button class="btn btn-xs btn-p" data-approve="${d.id}">✓</button><button class="btn btn-xs btn-danger" data-reject="${d.id}">✗</button>`:''}
    ${isAdmin?`<button class="btn btn-xs btn-ghost" data-delete="${d.id}">🗑</button>`:''}
  </div></td>`:''}
</tr>`).join('')}
</tbody></table>`;
}

function _badge(s) {
  if (s==='approved') return '<span class="badge b-green" style="font-size:9px">✓ অনুমোদিত</span>';
  if (s==='rejected') return '<span class="badge b-red" style="font-size:9px">✗ বাতিল</span>';
  return '<span class="badge b-amber" style="font-size:9px">⏳ অপেক্ষামাণ</span>';
}

async function _add(root) {
  const sel      = root.querySelector('#dep-member');
  const memberId = sel?.value;
  const memberName = sel?.options[sel.selectedIndex]?.dataset?.name||'';
  const date     = root.querySelector('#dep-date')?.value;
  const amount   = parseFloat(root.querySelector('#dep-amount')?.value)||0;
  const note     = root.querySelector('#dep-note')?.value.trim();
  if (!memberId) { toast('সদস্য নির্বাচন করুন','er'); return; }
  if (!date)     { toast('তারিখ দিন','er'); return; }
  if (!amount)   { toast('পরিমাণ দিন','er'); return; }

  const isCoAdmin = ['mess-admin','mess-co-admin'].includes(_ctx.myMessRole);
  await addDoc(collection(db,'messes',_ctx.messId,'deposits'), {
    memberId, memberName, date, amount, note:note||'',
    addedBy:_ctx.profile.uid,
    status: isCoAdmin?'approved':'pending',
    approvedBy:null, approvedAt:null,
    createdAt:serverTimestamp()
  });
  toast('ডিপোজিট যোগ হয়েছে','ok');
  root.querySelector('#dep-amount').value='';
  root.querySelector('#dep-note').value='';
  await _load(root);
}

async function _approve(root,id) {
  await updateDoc(doc(db,'messes',_ctx.messId,'deposits',id),
    {status:'approved',approvedBy:_ctx.profile.uid,approvedAt:serverTimestamp()});
  toast('অনুমোদন দেওয়া হয়েছে','ok');
  await _load(root);
}
async function _reject(root,id) {
  await updateDoc(doc(db,'messes',_ctx.messId,'deposits',id),{status:'rejected'});
  toast('বাতিল হয়েছে','ok');
  await _load(root);
}
async function _delete(root,id) {
  if (!window.confirm('ডিপোজিট মুছে ফেলবেন?')) return;
  await deleteDoc(doc(db,'messes',_ctx.messId,'deposits',id));
  toast('মুছে ফেলা হয়েছে','ok');
  await _load(root);
}

const _e = s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

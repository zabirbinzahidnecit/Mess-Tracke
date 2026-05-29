// মেস মিল ট্র্যাকার — bazar.js (fixed: event delegation)

import { db } from '../../firebase.js';
import { toast, taka, pad, moName, formatDate, CATS, CICO } from '../../utils.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const TODAY = new Date();
let _vy=TODAY.getFullYear(), _vm=TODAY.getMonth();
let _expenses=[], _view='tree', _ctx={};

export async function render(root, ctx) {
  _ctx = ctx;

  root.innerHTML = `
<div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <button class="btn btn-ghost btn-sm" id="bz-prev">◀</button>
    <span style="font-size:14px;font-weight:700;min-width:130px;text-align:center" id="bz-month"></span>
    <button class="btn btn-ghost btn-sm" id="bz-next">▶</button>
    <div style="display:flex;gap:5px;margin-left:auto">
      <button class="btn btn-ghost btn-sm" id="bz-tree-btn">🌳 Tree</button>
      <button class="btn btn-ghost btn-sm" id="bz-list-btn">📋 List</button>
    </div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="ch"><h3>➕ নতুন বাজার যোগ করুন</h3></div>
    <div class="cb">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
        <div class="field"><label class="lbl">তারিখ</label>
          <input class="inp inp-sm" type="date" id="bz-date"
            value="${TODAY.getFullYear()}-${pad(TODAY.getMonth()+1)}-${pad(TODAY.getDate())}"/></div>
        <div class="field"><label class="lbl">বিভাগ</label>
          <select class="inp inp-sm" id="bz-cat">
            ${CATS.map(c=>`<option value="${c}">${CICO[c]||''} ${c}</option>`).join('')}
          </select></div>
        <div class="field"><label class="lbl">আইটেম</label>
          <input class="inp inp-sm" id="bz-item" placeholder="কী কিনলেন"/></div>
        <div class="field"><label class="lbl">পরিমাণ (৳)</label>
          <input class="inp inp-sm" id="bz-amount" type="number" min="0" placeholder="0"/></div>
        <div class="field" style="grid-column:1/-1"><label class="lbl">নোট (ঐচ্ছিক)</label>
          <input class="inp inp-sm" id="bz-note" placeholder="বিস্তারিত…"/></div>
      </div>
      <button class="btn btn-p btn-sm" style="margin-top:8px" id="bz-add-btn">+ যোগ করুন</button>
    </div>
  </div>

  <div class="gA" id="bz-summary" style="margin-bottom:14px"></div>

  <div class="card">
    <div class="ch">
      <h3>📋 বাজারের তালিকা</h3>
      <span style="font-size:12px;font-weight:700;color:var(--g1)" id="bz-total">৳০</span>
    </div>
    <div id="bz-content">লোড হচ্ছে…</div>
  </div>
</div>`;

  // Event listeners
  root.querySelector('#bz-prev').addEventListener('click', () => { _vm--; if(_vm<0){_vm=11;_vy--} _load(root); });
  root.querySelector('#bz-next').addEventListener('click', () => { _vm++; if(_vm>11){_vm=0;_vy++} _load(root); });
  root.querySelector('#bz-add-btn').addEventListener('click', () => _add(root));
  root.querySelector('#bz-tree-btn').addEventListener('click', () => _setView(root,'tree'));
  root.querySelector('#bz-list-btn').addEventListener('click', () => _setView(root,'list'));

  root.querySelector('#bz-content').addEventListener('click', e => {
    const ap = e.target.closest('[data-approve]');
    const rj = e.target.closest('[data-reject]');
    const dl = e.target.closest('[data-delete]');
    if (ap) _approve(root, ap.dataset.approve);
    if (rj) _reject(root, rj.dataset.reject);
    if (dl) _delete(root, dl.dataset.delete);
  });

  _setView(root, _view, false);
  root.querySelector('#bz-month').textContent = `${moName(_vm)} ${_vy}`;
  await _load(root);
}

function _setView(root, v, doRender=true) {
  _view = v;
  root.querySelector('#bz-tree-btn')?.classList.toggle('btn-p', v==='tree');
  root.querySelector('#bz-list-btn')?.classList.toggle('btn-p', v==='list');
  if (doRender) _render(root);
}

async function _load(root) {
  root.querySelector('#bz-month').textContent = `${moName(_vm)} ${_vy}`;
  const monthStr = `${_vy}-${pad(_vm+1)}`;
  try {
    const snap = await getDocs(query(collection(db,'messes',_ctx.messId,'expenses'), orderBy('date','desc')));
    _expenses = snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.date?.startsWith(monthStr));
    _render(root);
  } catch(err) { toast('লোড ব্যর্থ','er'); }
}

function _render(root) {
  const canApprove = ['mess-admin','mess-co-admin'].includes(_ctx.myMessRole);
  const isAdmin    = _ctx.myMessRole==='mess-admin';

  const catTotals = {};
  _expenses.filter(e=>e.status==='approved').forEach(e=>{
    catTotals[e.category]=(catTotals[e.category]||0)+(parseFloat(e.amount)||0);
  });
  const total = Object.values(catTotals).reduce((a,b)=>a+b,0);
  const totalEl = root.querySelector('#bz-total');
  if (totalEl) totalEl.textContent = taka(total);

  const sumEl = root.querySelector('#bz-summary');
  if (sumEl) {
    sumEl.innerHTML = Object.keys(catTotals).length
      ? Object.entries(catTotals).map(([c,v])=>
          `<div class="sc"><div class="sl">${CICO[c]||''} ${c}</div><div class="sv">${taka(v)}</div></div>`
        ).join('')
      : '';
  }

  const content = root.querySelector('#bz-content');
  if (!content) return;
  if (!_expenses.length) {
    content.innerHTML='<div style="padding:20px;text-align:center;color:var(--ink3)">এই মাসে কোনো বাজার নেই</div>';
    return;
  }

  if (_view==='tree') {
    const byDate={};
    _expenses.forEach(e=>{(byDate[e.date]=byDate[e.date]||[]).push(e);});
    content.innerHTML = Object.entries(byDate).sort(([a],[b])=>b.localeCompare(a)).map(([date,items])=>{
      const dayTotal=items.filter(i=>i.status==='approved').reduce((s,i)=>s+(parseFloat(i.amount)||0),0);
      return `<div style="border-bottom:1px solid var(--line);padding:10px 14px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
  <span style="font-size:12px;font-weight:700;color:var(--ink)">${date}</span>
  <span style="font-size:12px;color:var(--g1);font-weight:700">${taka(dayTotal)}</span>
</div>
${items.map(e=>`
<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:.5px solid var(--line)">
  <span>${CICO[e.category]||'📦'}</span>
  <span style="flex:1;font-size:12px">${_e(e.item)} ${e.note?`<span style="color:var(--ink4)">(${_e(e.note)})</span>`:''}</span>
  <span style="font-family:var(--mono);font-size:12px;font-weight:700">${taka(e.amount)}</span>
  ${_badge(e.status)}
  ${canApprove&&e.status==='pending'?`<button class="btn btn-xs btn-p" data-approve="${e.id}">✓</button><button class="btn btn-xs btn-danger" data-reject="${e.id}">✗</button>`:''}
  ${isAdmin?`<button class="btn btn-xs btn-ghost" data-delete="${e.id}">🗑</button>`:''}
</div>`).join('')}
</div>`;
    }).join('');
  } else {
    content.innerHTML = `<div style="overflow-x:auto"><table class="dt">
<thead><tr>
  <th class="tl">তারিখ</th><th class="tl">বিভাগ</th><th class="tl">আইটেম</th>
  <th>পরিমাণ</th><th>অবস্থা</th>
  ${canApprove?'<th>অ্যাকশন</th>':''}
</tr></thead><tbody>
${_expenses.map(e=>`<tr>
  <td class="tl">${e.date}</td>
  <td class="tl">${CICO[e.category]||''} ${_e(e.category)}</td>
  <td class="tl">${_e(e.item)}</td>
  <td style="font-weight:700;font-family:var(--mono)">${taka(e.amount)}</td>
  <td>${_badge(e.status)}</td>
  ${canApprove?`<td><div style="display:flex;gap:4px;justify-content:center">
    ${e.status==='pending'?`<button class="btn btn-xs btn-p" data-approve="${e.id}">✓</button><button class="btn btn-xs btn-danger" data-reject="${e.id}">✗</button>`:''}
    ${isAdmin?`<button class="btn btn-xs btn-ghost" data-delete="${e.id}">🗑</button>`:''}
  </div></td>`:''}
</tr>`).join('')}
</tbody></table></div>`;
  }
}

function _badge(s) {
  if (s==='approved') return '<span class="badge b-green" style="font-size:9px">✓</span>';
  if (s==='rejected') return '<span class="badge b-red" style="font-size:9px">✗</span>';
  return '<span class="badge b-amber" style="font-size:9px">⏳</span>';
}

async function _add(root) {
  const date   = root.querySelector('#bz-date')?.value;
  const cat    = root.querySelector('#bz-cat')?.value;
  const item   = root.querySelector('#bz-item')?.value.trim();
  const amount = parseFloat(root.querySelector('#bz-amount')?.value)||0;
  const note   = root.querySelector('#bz-note')?.value.trim();
  if (!date||!item||!amount) { toast('তারিখ, আইটেম ও পরিমাণ দিন','er'); return; }

  const isCoAdmin = ['mess-admin','mess-co-admin'].includes(_ctx.myMessRole);
  await addDoc(collection(db,'messes',_ctx.messId,'expenses'), {
    date, category:cat, item, amount, note:note||'',
    addedBy:_ctx.profile.uid, addedByName:_ctx.profile.name||'',
    status: isCoAdmin?'approved':'pending',
    createdAt:serverTimestamp()
  });
  toast('বাজার যোগ হয়েছে','ok');
  root.querySelector('#bz-item').value='';
  root.querySelector('#bz-amount').value='';
  root.querySelector('#bz-note').value='';
  await _load(root);
}

async function _approve(root, id) {
  await updateDoc(doc(db,'messes',_ctx.messId,'expenses',id),
    {status:'approved',approvedBy:_ctx.profile.uid,approvedAt:serverTimestamp()});
  toast('অনুমোদন দেওয়া হয়েছে','ok');
  await _load(root);
}
async function _reject(root, id) {
  await updateDoc(doc(db,'messes',_ctx.messId,'expenses',id),{status:'rejected'});
  toast('বাতিল হয়েছে','ok');
  await _load(root);
}
async function _delete(root, id) {
  if (!window.confirm('মুছে ফেলবেন?')) return;
  await deleteDoc(doc(db,'messes',_ctx.messId,'expenses',id));
  toast('মুছে ফেলা হয়েছে','ok');
  await _load(root);
}

const _e = s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

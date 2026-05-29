import { db } from '../../firebase.js';
import { currentProfile } from '../../auth.js';
import { toast, formatDate, ini, avColor } from '../../utils.js';
import {
  collection, getDocs, doc, updateDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let _all=[], _tab='pending';

export async function render(root) {
  root.innerHTML=`
<div>
  <div class="adp-hd">
    <div><h2 class="adp-h">ব্যবহারকারী</h2><p class="adp-sub" id="uc">লোড হচ্ছে…</p></div>
    <button class="btn btn-ghost btn-sm" id="u-refresh">🔄 রিফ্রেশ</button>
  </div>
  <div class="adm-tabs">
    <button class="adm-tab active" data-tab="pending">অপেক্ষামাণ</button>
    <button class="adm-tab" data-tab="active">সক্রিয়</button>
    <button class="adm-tab" data-tab="all">সব</button>
  </div>
  <div id="u-list" style="display:flex;flex-direction:column;gap:8px"></div>
</div>
<style>
.u-row{background:#fff;border:1px solid var(--line);border-radius:12px;
  padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:var(--sh);flex-wrap:wrap}
.u-av{width:42px;height:42px;border-radius:50%;flex-shrink:0;display:flex;
  align-items:center;justify-content:center;font-size:16px;font-weight:700;overflow:hidden}
.u-av img{width:100%;height:100%;object-fit:cover}
.u-info{flex:1;min-width:0}
.u-info h3{font-size:13px;font-weight:700;color:var(--ink);margin:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u-info p{font-size:11px;color:var(--ink3);margin:2px 0 0}
</style>`;

  root.querySelector('#u-refresh').addEventListener('click',()=>_load(root));
  root.querySelector('.adm-tabs').addEventListener('click',e=>{
    const b=e.target.closest('[data-tab]');
    if(!b) return;
    _tab=b.dataset.tab;
    root.querySelectorAll('.adm-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===_tab));
    _render(root);
  });
  root.querySelector('#u-list').addEventListener('click',e=>{
    const add=e.target.closest('[data-add-coadmin]');
    const rem=e.target.closest('[data-rem-coadmin]');
    if(add) _setCoadmin(add.dataset.addCoadmin, 'co-admin', root);
    if(rem) _setCoadmin(rem.dataset.remCoadmin, null, root);
  });

  await _load(root);
}

async function _load(root) {
  try {
    const snap=await getDocs(query(collection(db,'users'),orderBy('createdAt','desc')));
    _all=snap.docs.map(d=>({id:d.id,...d.data()}));
    const pending=_all.filter(u=>u.status==='pending').length;
    root.querySelector('#uc').textContent=`${pending}জন অপেক্ষামাণ`;
    _render(root);
  } catch(err){
    root.querySelector('#u-list').innerHTML=`<div class="adm-loading">⚠️ ${err.message}</div>`;
  }
}

function _render(root) {
  const list=root.querySelector('#u-list');
  if(!list) return;
  const filtered=_tab==='all'?_all:_all.filter(u=>u.status===_tab);
  if(!filtered.length){list.innerHTML='<div class="adm-loading">কোনো ব্যবহারকারী নেই</div>';return;}

  list.innerHTML=filtered.map(u=>{
    const isMe=u.id===currentProfile?.uid;
    const isAdmin=u.platformRole==='admin';
    const av=u.avatar?`<img src="${_e(u.avatar)}" alt=""/>`:`<span>${ini(u.name||u.email)}</span>`;
    const roleBadge=u.platformRole==='admin'?'<span class="badge b-green">🔑 Admin</span>':
      u.platformRole==='co-admin'?'<span class="badge b-blue">🛡 Co-Admin</span>':
      u.currentMessId?'<span class="badge b-muted">🏠 মেসে</span>':
      '<span class="badge b-amber">⏳ Pending</span>';
    return `
<div class="u-row">
  <div class="u-av ${u.avatar?'':avColor(u.name||u.email)}">${av}</div>
  <div class="u-info">
    <h3>${_e(u.name||'—')}${isMe?' (আপনি)':''}</h3>
    <p>${_e(u.email||'—')}</p>
  </div>
  ${roleBadge}
  ${!isMe&&!isAdmin?
    u.platformRole==='co-admin'
      ?`<button class="btn btn-xs btn-danger" data-rem-coadmin="${u.id}">Co-Admin সরান</button>`
      :`<button class="btn btn-xs btn-blue" data-add-coadmin="${u.id}">+ Co-Admin</button>`
    :''}
</div>`;
  }).join('');
}

async function _setCoadmin(uid, role, root) {
  const msg=role?'Co-Admin করবেন?':'Co-Admin role সরাবেন?';
  if(!window.confirm(msg)) return;
  try {
    await updateDoc(doc(db,'users',uid),{platformRole:role});
    const u=_all.find(x=>x.id===uid); if(u) u.platformRole=role;
    _render(root);
    toast(role?'Co-Admin করা হয়েছে':'Role সরানো হয়েছে','ok');
  } catch(err){toast('ব্যর্থ: '+err.message,'er');}
}

const _e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

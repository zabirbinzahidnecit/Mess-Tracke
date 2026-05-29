// admin-messes.js — fixed: tree view, members on click, cascade delete

import { db } from '../../firebase.js';
import { toast, ld, uld, formatDate, ini, avColor } from '../../utils.js';
import {
  collection, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, writeBatch, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let _all=[], _tab='all', _expanded=new Set();

export async function render(root) {
  root.innerHTML = `
<div>
  <div class="adp-hd">
    <div><h2 class="adp-h">সব মেস</h2>
    <p class="adp-sub" id="mc">লোড হচ্ছে…</p></div>
    <button class="btn btn-ghost btn-sm" id="m-refresh">🔄 রিফ্রেশ</button>
  </div>
  <div class="adm-tabs">
    <button class="adm-tab active" data-tab="all">সব</button>
    <button class="adm-tab" data-tab="active">সক্রিয়</button>
    <button class="adm-tab" data-tab="deactive">নিষ্ক্রিয়</button>
  </div>
  <div id="mess-list" style="display:flex;flex-direction:column;gap:10px"></div>
</div>

<style>
.mc2{background:#fff;border:1px solid var(--line);border-radius:12px;
  box-shadow:var(--sh);overflow:hidden}
.mc2-hd{padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;
  transition:background .12s}
.mc2-hd:hover{background:var(--g8)}
.mc2-ic{width:38px;height:38px;background:var(--g7);border-radius:9px;
  display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.mc2-info{flex:1;min-width:0}
.mc2-info h3{font-size:13px;font-weight:700;color:var(--ink);margin:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc2-info p{font-size:11px;color:var(--ink3);margin:2px 0 0}
.mc2-chevron{font-size:12px;color:var(--ink4);transition:transform .2s;flex-shrink:0}
.mc2-chevron.open{transform:rotate(90deg)}
.mc2-body{border-top:1px solid var(--line);padding:12px 14px;display:none}
.mc2-body.open{display:block}
.mc2-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;
  padding-top:10px;border-top:1px solid var(--line)}
/* Tree view */
.tree-member{display:flex;align-items:center;gap:8px;padding:6px 0;
  border-bottom:.5px solid var(--line)}
.tree-member:last-child{border-bottom:none}
.tree-av{width:32px;height:32px;border-radius:50%;flex-shrink:0;overflow:hidden;
  display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.tree-av img{width:100%;height:100%;object-fit:cover}
.tree-info{flex:1;min-width:0}
.tree-info p{font-size:12px;font-weight:600;color:var(--ink);margin:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tree-info span{font-size:10px;color:var(--ink3)}
.tree-loading{font-size:12px;color:var(--ink3);padding:8px 0}
</style>`;

  root.querySelector('#m-refresh').addEventListener('click', () => _load(root));
  root.querySelector('.adm-tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    _tab = b.dataset.tab;
    root.querySelectorAll('.adm-tab').forEach(x=>x.classList.toggle('active', x.dataset.tab===_tab));
    _render(root);
  });

  // Event delegation for mess cards
  root.querySelector('#mess-list').addEventListener('click', e => {
    const tog = e.target.closest('[data-toggle-status]');
    const del = e.target.closest('[data-delete]');
    const hd  = e.target.closest('[data-expand]');
    if (tog) { e.stopPropagation(); _toggleStatus(root, tog.dataset.toggleStatus, tog.dataset.status); }
    else if (del) { e.stopPropagation(); _delete(root, del.dataset.delete, del.dataset.name); }
    else if (hd)  { _toggleExpand(root, hd.dataset.expand); }
  });

  await _load(root);
}

async function _load(root) {
  ld('মেস লোড হচ্ছে…');
  try {
    const snap = await getDocs(query(collection(db,'messes'), orderBy('createdAt','desc')));
    _all = snap.docs.map(d=>({id:d.id,...d.data()}));
    root.querySelector('#mc').textContent = `মোট ${_all.length}টি মেস`;
    _render(root);
  } catch(err) {
    root.querySelector('#mess-list').innerHTML =
      `<div class="adm-loading">⚠️ ${err.message}</div>`;
  } finally { uld(); }
}

function _render(root) {
  const list = root.querySelector('#mess-list');
  if (!list) return;
  const filtered = _tab==='all' ? _all : _all.filter(m=>m.status===_tab);

  if (!filtered.length) {
    list.innerHTML = '<div class="adm-loading">কোনো মেস নেই</div>';
    return;
  }

  list.innerHTML = filtered.map(m => {
    const isExpanded = _expanded.has(m.id);
    return `
<div class="mc2" id="mc2-${m.id}">
  <!-- Header — click করলে expand/collapse -->
  <div class="mc2-hd" data-expand="${m.id}">
    <div class="mc2-ic">🏠</div>
    <div class="mc2-info">
      <h3>${_e(m.name||'অজানা মেস')}</h3>
      <p>${_e(m.address||'—')} · ${m.createdAt?formatDate(m.createdAt):'—'}</p>
    </div>
    <span class="badge ${m.status==='active'?'b-green':'b-red'}" style="font-size:9px;flex-shrink:0">
      ${m.status==='active'?'● সক্রিয়':'○ নিষ্ক্রিয়'}
    </span>
    <span class="mc2-chevron${isExpanded?' open':''}">▶</span>
  </div>

  <!-- Body — expand হলে দেখাবে -->
  <div class="mc2-body${isExpanded?' open':''}" id="mc2-body-${m.id}">
    <p style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;
      letter-spacing:.5px;margin-bottom:8px">👥 সদস্য তালিকা</p>
    <div id="mc2-members-${m.id}" class="tree-loading">লোড হচ্ছে…</div>

    <div class="mc2-actions">
      <button class="btn btn-sm ${m.status==='active'?'btn-amber':'btn-ghost'}"
        data-toggle-status="${m.id}" data-status="${m.status}">
        ${m.status==='active'?'⏸ নিষ্ক্রিয়':'▶ সক্রিয়'}
      </button>
      <button class="btn btn-sm btn-danger"
        data-delete="${m.id}" data-name="${_e(m.name||'')}">
        🗑 মুছুন
      </button>
    </div>
  </div>
</div>`;
  }).join('');

  // Auto-load expanded messes members
  _expanded.forEach(id => {
    if (filtered.find(m=>m.id===id)) _loadMembers(id);
  });
}

async function _toggleExpand(root, messId) {
  const body    = document.getElementById(`mc2-body-${messId}`);
  const chevron = document.querySelector(`#mc2-${messId} .mc2-chevron`);
  if (!body) return;

  if (_expanded.has(messId)) {
    _expanded.delete(messId);
    body.classList.remove('open');
    if (chevron) chevron.classList.remove('open');
  } else {
    _expanded.add(messId);
    body.classList.add('open');
    if (chevron) chevron.classList.add('open');
    await _loadMembers(messId);
  }
}

async function _loadMembers(messId) {
  const el = document.getElementById(`mc2-members-${messId}`);
  if (!el) return;
  el.innerHTML = '<p class="tree-loading">সদস্য লোড হচ্ছে…</p>';
  try {
    const snap = await getDocs(query(
      collection(db,'messes',messId,'members'), orderBy('joinedAt')
    ));
    const members = snap.docs.map(d=>({uid:d.id,...d.data()}));
    if (!members.length) {
      el.innerHTML = '<p class="tree-loading">কোনো সদস্য নেই</p>';
      return;
    }
    const roleLabel = {
      'mess-admin':    '🔑 অ্যাডমিন',
      'mess-co-admin': '🛡 কো-অ্যাডমিন',
      'member':        '👤 সদস্য',
    };
    el.innerHTML = `
<div style="margin-bottom:6px;font-size:11px;color:var(--ink3)">
  মোট ${members.length}জন সদস্য
</div>
${members.map(m=>{
  const av = m.avatar
    ? `<img src="${_e(m.avatar)}" alt=""/>`
    : `<span>${ini(m.name||m.email)}</span>`;
  return `
<div class="tree-member">
  <div class="tree-av ${m.avatar?'':avColor(m.name||m.email)}">${av}</div>
  <div class="tree-info">
    <p>${_e(m.name||'—')}</p>
    <span>${_e(m.email||'—')} · ${roleLabel[m.role]||m.role}</span>
  </div>
  <span class="badge ${m.role==='mess-admin'?'b-green':m.role==='mess-co-admin'?'b-blue':'b-muted'}"
    style="font-size:9px">${roleLabel[m.role]||m.role}</span>
</div>`;
}).join('')}`;
  } catch(err) {
    el.innerHTML = `<p class="tree-loading" style="color:var(--r1)">লোড ব্যর্থ</p>`;
  }
}

async function _toggleStatus(root, id, cur) {
  const next = cur==='active' ? 'deactive' : 'active';
  try {
    await updateDoc(doc(db,'messes',id), {status:next});
    const m = _all.find(x=>x.id===id);
    if (m) m.status = next;
    _render(root);
    toast(`মেস ${next==='active'?'সক্রিয়':'নিষ্ক্রিয়'} হয়েছে`, 'ok');
  } catch(err) { toast('ব্যর্থ: '+err.message,'er'); }
}

async function _delete(root, id, name) {
  if (!window.confirm(`"${name}" মেস মুছে ফেলবেন?\nসব সদস্য pending হয়ে যাবে।`)) return;
  ld('মুছে ফেলা হচ্ছে…');
  try {
    const membersSnap = await getDocs(collection(db,'messes',id,'members'));
    const batch = writeBatch(db);
    membersSnap.docs.forEach(d => {
      batch.update(doc(db,'users',d.id), { currentMessId:null, status:'pending' });
    });
    batch.delete(doc(db,'messes',id));
    await batch.commit();
    _all = _all.filter(m=>m.id!==id);
    _expanded.delete(id);
    root.querySelector('#mc').textContent = `মোট ${_all.length}টি মেস`;
    _render(root);
    toast('মেস মুছে ফেলা হয়েছে','ok');
  } catch(err) { toast('মুছতে ব্যর্থ: '+err.message,'er'); }
  finally { uld(); }
}

const _e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

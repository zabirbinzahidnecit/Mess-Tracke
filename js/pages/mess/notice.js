// ══════════════════════════════════════════════════════════
//  মেস মিল ট্র্যাকার — js/pages/mess/notice.js
//  নোটিশ বোর্ড: add (admin/co-admin), view all, delete
// ══════════════════════════════════════════════════════════

import { db } from '../../firebase.js';
import { toast, formatDate } from '../../utils.js';
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, query, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let _ctx = {};

export async function render(root, ctx) {
  _ctx = ctx;
  const canWrite = ['mess-admin','mess-co-admin'].includes(ctx.myMessRole);
  const isAdmin  = ctx.myMessRole === 'mess-admin';

  root.innerHTML = `
<div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
    <div>
      <h2 style="font-size:17px;font-weight:700;color:var(--ink);margin:0">📢 নোটিশ বোর্ড</h2>
      <p style="font-size:12px;color:var(--ink3);margin:3px 0 0">মেসের সব সদস্য নোটিশ দেখতে পারবেন</p>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="window.__noticeRefresh()">🔄 রিফ্রেশ</button>
  </div>

  ${canWrite ? `
  <!-- Add notice -->
  <div class="card" style="margin-bottom:14px">
    <div class="ch"><h3>✏️ নতুন নোটিশ লিখুন</h3></div>
    <div class="cb">
      <div class="field">
        <textarea class="inp" id="notice-txt" rows="3"
          style="resize:vertical;min-height:80px"
          placeholder="নোটিশের বিষয় লিখুন… (সর্বোচ্চ ৫০০ অক্ষর)"
          maxlength="500"></textarea>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-p btn-sm" onclick="window.__noticeAdd()">📤 নোটিশ দিন</button>
        <span id="notice-char" style="font-size:11px;color:var(--ink4)">0/500</span>
      </div>
    </div>
  </div>` : ''}

  <!-- Notice list -->
  <div id="notice-list" style="display:flex;flex-direction:column;gap:10px">
    <div style="padding:20px;text-align:center;color:var(--ink3)">লোড হচ্ছে…</div>
  </div>
</div>`;

  window.__noticeRefresh = () => _load();
  window.__noticeAdd     = () => _add();
  window.__noticeDelete  = id => _delete(id);

  // Character counter
  const txt = document.getElementById('notice-txt');
  if (txt) {
    txt.addEventListener('input', () => {
      const counter = document.getElementById('notice-char');
      if (counter) counter.textContent = `${txt.value.length}/500`;
    });
  }

  await _load();
}

async function _load() {
  const list = document.getElementById('notice-list');
  if (!list) return;

  const isAdmin = _ctx.myMessRole === 'mess-admin';

  try {
    const snap = await getDocs(query(
      collection(db,'messes',_ctx.messId,'notices'),
      orderBy('createdAt','desc'),
      limit(50)
    ));

    if (snap.empty) {
      list.innerHTML = `
<div class="card">
  <div class="cb" style="text-align:center;padding:30px;color:var(--ink3)">
    <div style="font-size:32px;margin-bottom:10px">📭</div>
    <p style="font-size:13px">এখনো কোনো নোটিশ নেই</p>
  </div>
</div>`;
      return;
    }

    list.innerHTML = snap.docs.map(d => {
      const n = { id: d.id, ...d.data() };
      const isOwn = n.addedBy === _ctx.profile.uid;
      return `
<div class="card notice-card">
  <div class="cb">
    <p style="font-size:14px;color:var(--ink);line-height:1.6;white-space:pre-wrap;word-break:break-word">${_esc(n.text)}</p>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;flex-wrap:wrap;gap:6px">
      <div>
        <span style="font-size:11px;color:var(--ink3)">
          📌 ${_esc(n.addedByName || '—')} · ${n.createdAt ? formatDate(n.createdAt) : '—'}
        </span>
      </div>
      ${(isAdmin || isOwn)
        ? `<button class="btn btn-xs btn-danger" onclick="window.__noticeDelete('${n.id}')">🗑 মুছুন</button>`
        : ''}
    </div>
  </div>
</div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div class="card"><div class="cb" style="color:var(--r1)">⚠️ ${err.message}</div></div>`;
  }
}

async function _add() {
  const txt = document.getElementById('notice-txt')?.value.trim();
  if (!txt) { toast('নোটিশের বিষয় লিখুন', 'er'); return; }

  const btn = document.querySelector('[onclick="window.__noticeAdd()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'পাঠানো হচ্ছে…'; }

  try {
    await addDoc(collection(db,'messes',_ctx.messId,'notices'), {
      text:        txt,
      addedBy:     _ctx.profile.uid,
      addedByName: _ctx.profile.name || _ctx.profile.email,
      createdAt:   serverTimestamp()
    });
    document.getElementById('notice-txt').value = '';
    document.getElementById('notice-char').textContent = '0/500';
    toast('নোটিশ দেওয়া হয়েছে', 'ok');
    await _load();
  } catch (err) {
    toast('পাঠানো যায়নি: ' + err.message, 'er');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 নোটিশ দিন'; }
  }
}

async function _delete(id) {
  if (!window.confirm('নোটিশটি মুছে ফেলবেন?')) return;
  try {
    await deleteDoc(doc(db,'messes',_ctx.messId,'notices',id));
    toast('মুছে ফেলা হয়েছে', 'ok');
    await _load();
  } catch (err) {
    toast('মুছতে ব্যর্থ: ' + err.message, 'er');
  }
}

const _esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// members.js — fixed: EmailJS invite email, invite delete, link copy

import { db } from '../../firebase.js';
import { toast, ld, uld, formatDate, ini, avColor } from '../../utils.js';
import { EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID } from '../../emailjs-config.js';
import {
  collection, getDocs, doc, query, orderBy, setDoc,
  where, writeBatch, serverTimestamp, getDoc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let _ctx={}, _members=[], _invites=[];

// EmailJS SDK লোড
let _ejsReady = false;
async function _loadEmailJS() {
  if (_ejsReady) return true;
  if (window.emailjs) { window.emailjs.init(EMAILJS_PUBLIC_KEY); _ejsReady=true; return true; }
  return new Promise(res => {
    const s  = document.createElement('script');
    s.src    = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload = () => {
      window.emailjs.init(EMAILJS_PUBLIC_KEY);
      _ejsReady = true;
      res(true);
    };
    s.onerror = () => res(false);
    document.head.appendChild(s);
  });
}

// ✅ Consistent key format
const _invKey = email => email.toLowerCase().replace(/\./g,'_').replace(/@/g,'_at_');

export async function render(root, ctx) {
  _ctx = ctx;
  const isAdmin = ctx.myMessRole==='mess-admin';

  root.innerHTML = `
<div>
  <div class="ptit">👥 সদস্য ব্যবস্থাপনা</div>
  <div class="psub" id="mem-count">লোড হচ্ছে…</div>

  ${isAdmin ? `
  <!-- Invite form -->
  <div class="card" style="margin-bottom:14px">
    <div class="ch"><h3>📨 নতুন সদস্য Invite করুন</h3></div>
    <div class="cb">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:2;min-width:180px;margin:0">
          <label class="lbl">Gmail ঠিকানা *</label>
          <input class="inp inp-sm" id="inv-email" type="email" placeholder="example@gmail.com"/>
        </div>
        <div class="field" style="flex:1;min-width:130px;margin:0">
          <label class="lbl">ভূমিকা</label>
          <select class="inp inp-sm" id="inv-role">
            <option value="member">সদস্য</option>
            <option value="mess-co-admin">কো-অ্যাডমিন</option>
          </select>
        </div>
        <button class="btn btn-p btn-sm" id="inv-btn" style="flex-shrink:0">📤 Invite পাঠান</button>
      </div>
      <p style="font-size:11px;color:var(--ink4);margin-top:8px">
        📧 Gmail এ email + 🔗 copy link — দুটোই পাঠানো হবে
      </p>
    </div>
  </div>

  <!-- Invite result -->
  <div id="inv-result-box" class="card" style="margin-bottom:14px;display:none;border-color:var(--g4)">
    <div class="ch"><h3>✅ Invite পাঠানো হয়েছে</h3></div>
    <div class="cb">
      <div id="inv-email-status" style="margin-bottom:10px;font-size:12px"></div>
      <label class="lbl">Invite Link (copy করুন)</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="inp inp-sm" id="inv-link-inp" readonly
          style="font-size:11px;font-family:var(--mono);background:#f8fdf8;flex:1"/>
        <button class="btn btn-p btn-sm" id="inv-copy-btn">📋 কপি</button>
      </div>
    </div>
  </div>

  <!-- Pending invites -->
  <div class="card" style="margin-bottom:14px">
    <div class="ch">
      <h3>⏳ Pending Invites</h3>
      <button class="btn btn-ghost btn-sm" id="inv-refresh">🔄</button>
    </div>
    <div id="inv-list" class="cb">লোড হচ্ছে…</div>
  </div>` : ''}

  <!-- Member list -->
  <div class="card">
    <div class="ch"><h3>👥 সকল সদস্য</h3></div>
    <div id="mem-list">লোড হচ্ছে…</div>
  </div>
</div>

<style>
.mem-row{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:.5px solid var(--line)}
.mem-row:last-child{border-bottom:none}
.mem-av{width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;
  align-items:center;justify-content:center;font-size:15px;font-weight:700;overflow:hidden}
.mem-av img{width:100%;height:100%;object-fit:cover}
.mem-info{flex:1;min-width:0}
.mem-info h3{font-size:13px;font-weight:600;color:var(--ink);margin:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mem-info p{font-size:11px;color:var(--ink3);margin:2px 0 0}
.inv-row{display:flex;align-items:center;justify-content:space-between;
  gap:8px;padding:8px 0;border-bottom:.5px solid var(--line);flex-wrap:wrap}
.inv-row:last-child{border-bottom:none}
</style>`;

  root.querySelector('#inv-btn')?.addEventListener('click', () => _invite(root));
  root.querySelector('#inv-copy-btn')?.addEventListener('click', () => _copyLink(root));
  root.querySelector('#inv-refresh')?.addEventListener('click', () => _loadInvites(root));
  root.querySelector('#mem-list')?.addEventListener('click', e => {
    const rm = e.target.closest('[data-remove]');
    if (rm) _remove(root, rm.dataset.remove);
  });
  root.querySelector('#inv-list')?.addEventListener('click', e => {
    const dl = e.target.closest('[data-del-invite]');
    const lk = e.target.closest('[data-show-link]');
    if (dl) _deleteInvite(root, dl.dataset.delInvite);
    if (lk) _showExistingLink(root, lk.dataset.showLink);
  });

  await _load(root);
  if (isAdmin) await _loadInvites(root);
}

async function _load(root) {
  ld('সদস্য লোড হচ্ছে…');
  try {
    const snap = await getDocs(query(collection(db,'messes',_ctx.messId,'members'), orderBy('joinedAt')));
    _members = snap.docs.map(d=>({uid:d.id,...d.data()}));

    const countEl = root.querySelector('#mem-count');
    if (countEl) countEl.textContent = `মোট ${_members.length}জন সদস্য`;

    const isAdmin = _ctx.myMessRole==='mess-admin';
    const list = root.querySelector('#mem-list');
    if (!list) return;

    list.innerHTML = _members.map(m => {
      const isMe = m.uid===_ctx.profile.uid;
      const av   = m.avatar
        ? `<img src="${_e(m.avatar)}" alt=""/>`
        : `<span>${ini(m.name||m.email)}</span>`;
      const rb = {
        'mess-admin':    '<span class="badge b-admin">🔑 অ্যাডমিন</span>',
        'mess-co-admin': '<span class="badge b-coadmin">🛡 কো-অ্যাডমিন</span>',
        'member':        '<span class="badge b-member">👤 সদস্য</span>',
      }[m.role]||'';
      return `
<div class="mem-row">
  <div class="mem-av ${m.avatar?'':avColor(m.name||m.email)}">${av}</div>
  <div class="mem-info">
    <h3>${_e(m.name||'—')}${isMe?' <span style="font-size:10px;color:var(--ink4)">(আপনি)</span>':''}</h3>
    <p>${_e(m.email||'—')}</p>
  </div>
  ${rb}
  ${isAdmin&&!isMe
    ? `<button class="btn btn-xs btn-danger" data-remove="${m.uid}">বের করুন</button>`
    : ''}
</div>`;
    }).join('') || '<div style="padding:20px;text-align:center;color:var(--ink3)">কোনো সদস্য নেই</div>';
  } finally { uld(); }
}

async function _loadInvites(root) {
  const list = root.querySelector('#inv-list');
  if (!list) return;
  try {
    const snap = await getDocs(query(
      collection(db,'messes',_ctx.messId,'invites'), where('used','==',false)
    ));
    _invites = snap.docs.map(d=>({id:d.id,...d.data()}));
    if (!_invites.length) {
      list.innerHTML='<p style="font-size:12px;color:var(--ink3)">কোনো pending invite নেই</p>';
      return;
    }
    list.innerHTML = _invites.map(inv => {
      const exp = inv.expiresAt?.toDate
        ? inv.expiresAt.toDate()<new Date()
        : new Date((inv.expiresAt?.seconds||0)*1000)<new Date();
      return `
<div class="inv-row">
  <div>
    <p style="font-size:13px;font-weight:600;color:var(--ink)">${_e(inv.email||'—')}</p>
    <p style="font-size:11px;color:var(--ink3)">
      ${inv.role==='mess-co-admin'?'কো-অ্যাডমিন':'সদস্য'} ·
      ${exp?'<span style="color:var(--r1)">মেয়াদ শেষ</span>':'<span style="color:var(--g1)">সক্রিয়</span>'}
    </p>
  </div>
  <div style="display:flex;gap:6px">
    <button class="btn btn-xs btn-ghost" data-show-link="${inv.id}">🔗 Link</button>
    <button class="btn btn-xs btn-danger" data-del-invite="${inv.id}">🗑 বাতিল</button>
  </div>
</div>`;
    }).join('');
  } catch(err) {
    list.innerHTML='<p style="font-size:12px;color:var(--r1)">লোড ব্যর্থ</p>';
  }
}

async function _invite(root) {
  const email = root.querySelector('#inv-email')?.value.trim().toLowerCase();
  const role  = root.querySelector('#inv-role')?.value||'member';

  if (!email||!email.includes('@')) { toast('সঠিক Gmail দিন','er'); return; }
  if (_members.some(m=>m.email?.toLowerCase()===email)) { toast('এই email ইতিমধ্যে সদস্য','er'); return; }

  const btn = root.querySelector('#inv-btn');
  if (btn) { btn.disabled=true; btn.textContent='পাঠানো হচ্ছে…'; }

  ld('Invite পাঠানো হচ্ছে…');
  try {
    const token     = _genToken();
    const expiresAt = new Date(Date.now()+7*24*60*60*1000);

    // Firestore এ save
    await setDoc(doc(db,'messes',_ctx.messId,'invites',token), {
      email, role,
      invitedBy:     _ctx.profile.uid,
      invitedByName: _ctx.profile.name||'',
      messId:        _ctx.messId,
      messName:      _ctx.messData?.name||'',
      createdAt:     serverTimestamp(),
      expiresAt,
      used: false
    });

    // inviteIndex
    try {
      await setDoc(doc(db,'inviteIndex',_invKey(email)), {
        messId:_ctx.messId, token, role, email, expiresAt
      });
    } catch(e) { console.warn('inviteIndex write failed:', e.code); }

    // Invite link
    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/,'/');
    const url  = `${base}?invite=${token}&mess=${_ctx.messId}`;

    // ✅ EmailJS দিয়ে email পাঠাও
    let emailStatus = '';
    const ejsOk = await _loadEmailJS();
    if (ejsOk && window.emailjs) {
      try {
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_email:     email,
          inviter_name: _ctx.profile.name || _ctx.profile.email,
          mess_name:    _ctx.messData?.name || 'মেস',
          invite_link:  url,
          role_bn:      role==='mess-co-admin' ? 'কো-অ্যাডমিন' : 'সদস্য',
          expires_days: '৭ দিন',
        });
        emailStatus = `<p style="color:var(--g1);font-weight:600">✅ ${_e(email)} এ email পাঠানো হয়েছে</p>`;
      } catch(ejsErr) {
        console.warn('EmailJS error:', ejsErr);
        emailStatus = `<p style="color:var(--a0)">⚠️ Email পাঠানো যায়নি — link copy করে পাঠান</p>`;
      }
    } else {
      emailStatus = `<p style="color:var(--a0)">⚠️ EmailJS লোড হয়নি — link copy করে পাঠান</p>`;
    }

    // Show result box
    const box    = root.querySelector('#inv-result-box');
    const inp    = root.querySelector('#inv-link-inp');
    const status = root.querySelector('#inv-email-status');
    if (box)    { box.style.display='block'; box.scrollIntoView({behavior:'smooth',block:'nearest'}); }
    if (inp)    inp.value = url;
    if (status) status.innerHTML = emailStatus;

    root.querySelector('#inv-email').value = '';
    toast('Invite তৈরি হয়েছে!','ok');
    await _loadInvites(root);
  } catch(err) {
    toast('Invite ব্যর্থ: '+err.message,'er');
    console.error(err);
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='📤 Invite পাঠান'; }
    uld();
  }
}

function _copyLink(root) {
  const inp = root.querySelector('#inv-link-inp');
  if (!inp?.value) return;
  navigator.clipboard?.writeText(inp.value)
    .then(()=>toast('Link কপি হয়েছে! ✓','ok'))
    .catch(()=>{ inp.select(); document.execCommand('copy'); toast('Link কপি হয়েছে! ✓','ok'); });
}

function _showExistingLink(root, token) {
  const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/,'/');
  const url  = `${base}?invite=${token}&mess=${_ctx.messId}`;
  const box  = root.querySelector('#inv-result-box');
  const inp  = root.querySelector('#inv-link-inp');
  const status = root.querySelector('#inv-email-status');
  if (box) { box.style.display='block'; }
  if (inp) inp.value = url;
  if (status) status.innerHTML = '<p style="color:var(--ink3)">🔗 এই link টি copy করে পাঠান</p>';
}

async function _remove(root, uid) {
  const m = _members.find(x=>x.uid===uid);
  if (!window.confirm(`"${m?.name||uid}" কে বের করবেন?`)) return;
  ld('সরানো হচ্ছে…');
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db,'messes',_ctx.messId,'members',uid));
    batch.update(doc(db,'users',uid), { currentMessId:null, status:'pending' });
    await batch.commit();
    toast('সদস্য সরানো হয়েছে','ok');
    await _load(root);
  } catch(err) { toast('ব্যর্থ: '+err.message,'er'); }
  finally { uld(); }
}

async function _deleteInvite(root, inviteId) {
  if (!window.confirm('Invite বাতিল করবেন?')) return;
  try {
    const inv = _invites.find(i=>i.id===inviteId);
    const batch = writeBatch(db);
    batch.delete(doc(db,'messes',_ctx.messId,'invites',inviteId));
    if (inv?.email) {
      try { batch.delete(doc(db,'inviteIndex',_invKey(inv.email))); } catch(e) {}
    }
    await batch.commit();
    toast('Invite বাতিল হয়েছে','ok');
    const box = root.querySelector('#inv-result-box');
    if (box) box.style.display='none';
    await _loadInvites(root);
  } catch(err) { toast('ব্যর্থ: '+err.message,'er'); }
}

function _genToken() {
  if (typeof crypto!=='undefined'&&crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36)+Math.random().toString(36).slice(2);
}

const _e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

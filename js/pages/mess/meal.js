// meal.js — multiday calendar shows existing meals with color + toggle off

import { db } from '../../firebase.js';
import { toast, ld, uld, pad, dim, moName } from '../../utils.js';
import {
  collection, getDocs, doc, getDoc, setDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const TODAY = new Date();
let _ctx={}, _vy=TODAY.getFullYear(), _vm=TODAY.getMonth(), _members=[];

export async function render(root, ctx) {
  _ctx = ctx;
  const slots  = ctx.messSettings?.slots || ['সকাল','দুপুর','রাত'];
  const cutoff = ctx.messSettings?.cutoffHour ?? 10;
  const now    = TODAY.getHours();
  const isPast = now >= cutoff;

  const ENTRY_DATE = isPast
    ? new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()+1)
    : TODAY;
  const isToday = !isPast;

  const SICO = ['☀️','🌤','🌙','🍳','🍱','🌮'];

  root.innerHTML = `
<div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <button class="btn btn-ghost btn-sm" id="mp">◀</button>
    <span style="font-size:14px;font-weight:700;min-width:130px;text-align:center" id="m-lbl"></span>
    <button class="btn btn-ghost btn-sm" id="mn">▶</button>
    <button class="btn btn-ghost btn-sm" id="mt">আজ</button>
    <button class="btn btn-p btn-sm" id="mmd" style="margin-left:auto">📅 একাধিক দিন</button>
  </div>

  <div class="card" style="margin-bottom:14px;background:${isPast?'var(--r4)':'var(--g7)'};
    border-color:${isPast?'var(--r3)':'var(--g5)'}">
    <div class="cb" style="padding:12px 14px">
      <div>
        <p style="font-size:11px;font-weight:700;color:${isPast?'var(--r1)':'var(--g2)'};
          text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
          ${isPast?'🔒 আজকের মিল বন্ধ — আগামীকালের মিল চালু':'⏰ আজকের মিল এন্ট্রি চালু'}
        </p>
        <p style="font-size:13px;color:var(--ink)">
          ${isPast
            ? `আগামীকাল (${ENTRY_DATE.getDate()} ${moName(ENTRY_DATE.getMonth())}) এর মিল দিন`
            : `মিল বন্ধ হবে <strong>${cutoff}:00</strong> তে · ${TODAY.getDate()} ${moName(TODAY.getMonth())}`}
        </p>
      </div>
      <div class="slot-row" style="margin-top:12px" id="m-slots"></div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <label style="font-size:11px;font-weight:700;color:var(--ink3)">Guest মিল:</label>
        <input class="inp inp-sm" id="m-guest" type="number" min="0" max="20"
          placeholder="0" style="width:80px"/>
        <button class="btn btn-ghost btn-sm" id="m-guest-save">সেভ</button>
      </div>
      ${ctx.myMessRole !== 'member' ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.08)">
        <label class="lbl">অন্য সদস্যের মিল দিন</label>
        <select class="inp inp-sm" id="m-sel" style="max-width:220px"></select>
      </div>` : ''}
    </div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="ch">
      <h3>📋 আজকের মিল তালিকা — বুয়ার জন্য</h3>
      <span style="font-size:11px;color:var(--ink3)">${TODAY.getDate()} ${moName(TODAY.getMonth())}</span>
    </div>
    <div class="cb" id="m-slot-summary">লোড হচ্ছে…</div>
  </div>

  <div class="card">
    <div class="ch">
      <h3>📅 দিনের বিস্তারিত</h3>
      <input type="date" id="m-date" class="inp inp-sm" style="width:auto"/>
    </div>
    <div class="cb" style="overflow-x:auto" id="m-table">লোড হচ্ছে…</div>
  </div>
</div>

<!-- Multiday modal -->
<div style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);
  z-index:300;align-items:center;justify-content:center;padding:20px" id="md-mo">
  <div style="background:#fff;border-radius:16px;padding:22px;max-width:500px;
    width:100%;max-height:90vh;overflow-y:auto">
    <h3 style="font-size:15px;font-weight:700;margin-bottom:4px">📅 একাধিক দিনের মিল</h3>
    <p style="font-size:11px;color:var(--ink3);margin-bottom:12px">
      সবুজ = মিল আছে • সাদা = মিল নেই • ক্লিক করে toggle করুন
    </p>
    <div id="md-content"></div>
    <div id="md-legend" style="display:flex;gap:12px;margin:10px 0;flex-wrap:wrap">
      <span style="font-size:11px;display:flex;align-items:center;gap:4px">
        <span style="width:14px;height:14px;background:#146b40;border-radius:3px;display:inline-block"></span> মিল আছে
      </span>
      <span style="font-size:11px;display:flex;align-items:center;gap:4px">
        <span style="width:14px;height:14px;background:#f1f5f2;border:1.5px solid #b0ceb8;border-radius:3px;display:inline-block"></span> মিল নেই
      </span>
      <span style="font-size:11px;display:flex;align-items:center;gap:4px">
        <span style="width:14px;height:14px;background:#1fa860;border-radius:3px;display:inline-block"></span> আজ
      </span>
      <span style="font-size:11px;display:flex;align-items:center;gap:4px">
        <span style="width:14px;height:14px;background:#e8a838;border-radius:3px;display:inline-block"></span> আংশিক মিল
      </span>
    </div>
    <div id="md-slot-area" style="margin-top:10px"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-ghost" id="md-close">বাতিল</button>
      <button class="btn btn-p" id="md-apply">✓ প্রয়োগ</button>
    </div>
  </div>
</div>`;

  root.querySelector('#mp').addEventListener('click', ()=>{ _vm--; if(_vm<0){_vm=11;_vy--} _load(root); });
  root.querySelector('#mn').addEventListener('click', ()=>{ _vm++; if(_vm>11){_vm=0;_vy++} _load(root); });
  root.querySelector('#mt').addEventListener('click', ()=>{ _vy=TODAY.getFullYear();_vm=TODAY.getMonth(); _load(root); });
  root.querySelector('#mmd').addEventListener('click', ()=> _openMulti(root));
  root.querySelector('#m-guest-save').addEventListener('click', ()=> _saveGuest(root, ENTRY_DATE));
  root.querySelector('#md-close').addEventListener('click', ()=>{ root.querySelector('#md-mo').style.display='none'; });
  root.querySelector('#md-apply').addEventListener('click', ()=> _applyMulti(root));
  root.querySelector('#m-sel')?.addEventListener('change', e=> _renderSlots(root, e.target.value, ENTRY_DATE));

  root.querySelector('#m-slots').addEventListener('click', e=>{
    const btn = e.target.closest('[data-si]');
    if (btn) _toggle(root, btn.dataset.uid, parseInt(btn.dataset.si), ENTRY_DATE);
  });

  const dp = root.querySelector('#m-date');
  if (dp) dp.value = `${TODAY.getFullYear()}-${pad(TODAY.getMonth()+1)}-${pad(TODAY.getDate())}`;
  root.querySelector('#m-date').addEventListener('change', e=> _loadTable(root, e.target.value));

  root.querySelector('#m-lbl').textContent = `${moName(_vm)} ${_vy}`;
  await _load(root);
}

async function _load(root) {
  root.querySelector('#m-lbl').textContent = `${moName(_vm)} ${_vy}`;
  ld('সদস্য লোড হচ্ছে…');
  try {
    const snap = await getDocs(query(collection(db,'messes',_ctx.messId,'members'), orderBy('joinedAt')));
    _members = snap.docs.map(d=>({uid:d.id,...d.data()}));

    const sel = root.querySelector('#m-sel');
    if (sel) {
      sel.innerHTML = _members.map(m=>
        `<option value="${m.uid}">${_e(m.name||m.email)}${m.uid===_ctx.profile.uid?' (আমি)':''}</option>`
      ).join('');
      sel.value = _ctx.profile.uid;
    }

    const cutoff    = _ctx.messSettings?.cutoffHour ?? 10;
    const isPast    = TODAY.getHours() >= cutoff;
    const ENTRY_DATE = isPast
      ? new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()+1)
      : TODAY;

    _renderSlots(root, _ctx.profile.uid, ENTRY_DATE);

    const dp = root.querySelector('#m-date');
    if (dp) await _loadTable(root, dp.value);
    await _loadSlotSummary(root);
  } finally { uld(); }
}

async function _loadSlotSummary(root) {
  const el = root.querySelector('#m-slot-summary');
  if (!el) return;
  const slots = _ctx.messSettings?.slots || ['সকাল','দুপুর','রাত'];
  const SICO  = ['☀️','🌤','🌙','🍳','🍱','🌮'];
  const slotCounts = new Array(slots.length).fill(0);
  let guestTotal = 0;

  for (const m of _members) {
    const key  = `${TODAY.getFullYear()}_${pad(TODAY.getMonth()+1)}_${pad(TODAY.getDate())}_${m.uid}`;
    const snap = await getDoc(doc(db,'messes',_ctx.messId,'meals',key));
    if (!snap.exists()) continue;
    const data = snap.data();
    (data.slots||[]).forEach((on,i)=>{ if(on) slotCounts[i]++; });
    guestTotal += (data.guestSlots||[]).filter(Boolean).length;
  }

  const grandTotal = slotCounts.reduce((a,b)=>a+b,0) + guestTotal;

  el.innerHTML = `
<div style="margin-bottom:12px">
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
    ${slots.map((s,i)=>`
    <div style="background:${slotCounts[i]>0?'var(--g7)':'var(--paper)'};
      border:1px solid ${slotCounts[i]>0?'var(--g5)':'var(--line)'};
      border-radius:12px;padding:10px 16px;text-align:center;min-width:90px">
      <div style="font-size:20px;margin-bottom:4px">${SICO[i]||'🍽'}</div>
      <div style="font-size:12px;font-weight:600;color:var(--ink)">${_e(s)}</div>
      <div style="font-size:24px;font-weight:700;color:${slotCounts[i]>0?'var(--g1)':'var(--ink4)'}">
        ${slotCounts[i]}
      </div>
      <div style="font-size:10px;color:var(--ink4)">জন</div>
    </div>`).join('')}
    ${guestTotal>0?`
    <div style="background:var(--b4);border:1px solid var(--b3);
      border-radius:12px;padding:10px 16px;text-align:center;min-width:90px">
      <div style="font-size:20px;margin-bottom:4px">👥</div>
      <div style="font-size:12px;font-weight:600;color:var(--ink)">Guest</div>
      <div style="font-size:24px;font-weight:700;color:var(--b0)">${guestTotal}</div>
      <div style="font-size:10px;color:var(--ink4)">জন</div>
    </div>`:''}
  </div>
  <div style="background:var(--g2);color:#fff;border-radius:10px;
    padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:13px;font-weight:600">মোট মিল আজ</span>
    <span style="font-size:22px;font-weight:700;font-family:var(--mono)">${grandTotal}</span>
  </div>
</div>
<p style="font-size:11px;color:var(--ink4)">⚠️ এই তালিকা বুয়াকে দেখান — কোন বেলায় কতজনের রান্না করতে হবে</p>`;
}

function _renderSlots(root, uid, entryDate) {
  const slots  = _ctx.messSettings?.slots || ['সকাল','দুপুর','রাত'];
  const SICO   = ['☀️','🌤','🌙','🍳','🍱','🌮'];
  const cutoff = _ctx.messSettings?.cutoffHour ?? 10;
  const isPast = uid===_ctx.profile.uid && TODAY.getHours()>=cutoff
    && !['mess-admin','mess-co-admin'].includes(_ctx.myMessRole);

  root.querySelector('#m-slots').innerHTML = slots.map((s,i)=>
    `<button class="slt" data-uid="${uid}" data-si="${i}" id="ms-${uid}-${i}">
      ${SICO[i]||'🍽'} ${_e(s)}
    </button>`).join('');

  const d   = entryDate || TODAY;
  const key = `${d.getFullYear()}_${pad(d.getMonth()+1)}_${pad(d.getDate())}_${uid}`;
  getDoc(doc(db,'messes',_ctx.messId,'meals',key)).then(snap=>{
    const s = snap.exists()?(snap.data().slots||[]):[];
    slots.forEach((_,i)=>root.querySelector(`#ms-${uid}-${i}`)?.classList.toggle('on',!!s[i]));
    const gi = root.querySelector('#m-guest');
    if (gi) gi.value = snap.exists()?((snap.data().guestSlots||[]).filter(Boolean).length||''):'';
  });
}

async function _toggle(root, uid, i, entryDate) {
  const d   = entryDate || TODAY;
  const key = `${d.getFullYear()}_${pad(d.getMonth()+1)}_${pad(d.getDate())}_${uid}`;
  const ref = doc(db,'messes',_ctx.messId,'meals',key);
  const snap = await getDoc(ref);
  const slots = snap.exists() ? [...(snap.data().slots||[])] : [];
  slots[i] = !slots[i];
  const max = _ctx.messSettings?.maxMealsPerDay ?? 3;
  if (slots.filter(Boolean).length > max) { toast(`সর্বোচ্চ ${max}টি মিল`,'er'); return; }
  await setDoc(ref, { slots, memberId: uid }, { merge: true });
  root.querySelector(`#ms-${uid}-${i}`)?.classList.toggle('on', !!slots[i]);
  await _loadSlotSummary(root);
}

async function _saveGuest(root, entryDate) {
  const n   = parseInt(root.querySelector('#m-guest')?.value)||0;
  const uid = root.querySelector('#m-sel')?.value || _ctx.profile.uid;
  const d   = entryDate || TODAY;
  const key = `${d.getFullYear()}_${pad(d.getMonth()+1)}_${pad(d.getDate())}_${uid}`;
  await setDoc(doc(db,'messes',_ctx.messId,'meals',key),
    { guestSlots: Array(n).fill(true), memberId: uid }, { merge: true });
  toast('Guest মিল সেভ হয়েছে','ok');
  await _loadSlotSummary(root);
}

async function _loadTable(root, dateStr) {
  const wrap = root.querySelector('#m-table');
  if (!wrap||!_members.length) return;
  const [y,m,d] = dateStr.split('-').map(Number);
  const slots = _ctx.messSettings?.slots || ['সকাল','দুপুর','রাত'];
  const SICO  = ['☀️','🌤','🌙','🍳','🍱'];

  const snaps = await Promise.all(
    _members.map(mb=>getDoc(doc(db,'messes',_ctx.messId,'meals',`${y}_${pad(m)}_${pad(d)}_${mb.uid}`)))
  );
  const mealMap={};
  snaps.forEach((s,i)=>{ mealMap[_members[i].uid]=s.exists()?s.data():{}; });

  wrap.innerHTML = `<table class="dt">
<thead><tr>
  <th class="tl">সদস্য</th>
  ${slots.map((s,i)=>`<th>${SICO[i]||''} ${_e(s)}</th>`).join('')}
  <th>Guest</th><th>মোট</th>
</tr></thead><tbody>
${_members.map(mb=>{
  const md=mealMap[mb.uid]||{};
  const s=md.slots||[];
  const g=(md.guestSlots||[]).filter(Boolean).length;
  const t=s.filter(Boolean).length+g;
  return `<tr>
  <td class="tl" style="font-weight:600">${_e(mb.name||mb.email)}</td>
  ${slots.map((_,i)=>`<td><div class="mdot ${s[i]?'don':'doff'}">${s[i]?'✓':''}</div></td>`).join('')}
  <td>${g||'—'}</td>
  <td style="font-weight:700">${t||'—'}</td>
</tr>`;
}).join('')}
</tbody></table>`;
}

// ── Multi-day modal — existing meals load করে color দেখায় ──
async function _openMulti(root) {
  const slots     = _ctx.messSettings?.slots||['সকাল','দুপুর','রাত'];
  const days      = dim(_vy,_vm);
  const todayD    = TODAY.getDate();
  const isThisMonth = _vy===TODAY.getFullYear() && _vm===TODAY.getMonth();
  const uid       = root.querySelector('#m-sel')?.value || _ctx.profile.uid;

  // Modal দেখাও, loading দেখাও
  root.querySelector('#md-mo').style.display = 'flex';
  root.querySelector('#md-content').innerHTML = `
    <div style="padding:30px;text-align:center;color:var(--ink3)">
      <div style="font-size:24px;margin-bottom:8px">⏳</div>
      মিলের তথ্য লোড হচ্ছে…
    </div>`;
  root.querySelector('#md-slot-area').innerHTML = '';

  // সব দিনের meal data একসাথে load করো
  const mealData = {};
  await Promise.all(
    Array.from({length:days},(_,i)=>i+1).map(async d => {
      const key  = `${_vy}_${pad(_vm+1)}_${pad(d)}_${uid}`;
      const snap = await getDoc(doc(db,'messes',_ctx.messId,'meals',key));
      mealData[d] = snap.exists() ? (snap.data().slots||[]) : [];
    })
  );

  // প্রতিটা দিনের color ঠিক করো
  function _dayColor(d) {
    const s = mealData[d] || [];
    const total = s.filter(Boolean).length;
    const max   = _ctx.messSettings?.maxMealsPerDay ?? slots.length;

    if (d === todayD && isThisMonth) {
      // আজকের দিন — মিল থাকলে গাঢ় সবুজ, না থাকলে teal
      return total > 0 ? { bg:'#1fa860', color:'#fff', border:'#1fa860', label:'আজ ✓' }
                       : { bg:'#1a8a50', color:'#fff', border:'#1a8a50', label:'আজ' };
    }
    if (total === 0) return { bg:'#f1f5f2', color:'#243a2c', border:'#b0ceb8', label:'' };
    if (total < max) return { bg:'#e8a838', color:'#fff', border:'#d4922a', label:'আংশিক' };
    return { bg:'#146b40', color:'#fff', border:'#146b40', label:'✓' };
  }

  // Calendar render করো
  root.querySelector('#md-content').innerHTML = `
<div style="margin-bottom:8px">
  <label class="lbl">দিন নির্বাচন করুন (ক্লিক করে toggle করুন)</label>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:8px">
    ${Array.from({length:days},(_,i)=>i+1).map(d=>{
      const c = _dayColor(d);
      const hasMeal = (mealData[d]||[]).filter(Boolean).length > 0;
      // আগে মিল থাকলে selected=1 (off করতে পারবে), না থাকলে selected=0
      const initSelected = hasMeal ? '1' : '0';
      return `<button
        class="md-day"
        data-day="${d}"
        data-has-meal="${hasMeal?'1':'0'}"
        data-selected="${initSelected}"
        style="
          height:40px;
          background:${c.bg};
          color:${c.color};
          border:2px solid ${c.border};
          border-radius:8px;
          font-size:12px;
          font-weight:700;
          cursor:pointer;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:1px;
          transition:.1s;
          position:relative;
        "
        onclick="
          const wasSelected = this.dataset.selected === '1';
          const hasMeal = this.dataset.hasMeal === '1';
          this.dataset.selected = wasSelected ? '0' : '1';
          const now = this.dataset.selected === '1';
          if (hasMeal && !now) {
            this.style.background='#fee2e2';
            this.style.color='#cc0000';
            this.style.borderColor='#fca5a5';
          } else if (now && hasMeal) {
            this.style.background='${c.bg}';
            this.style.color='${c.color}';
            this.style.borderColor='${c.border}';
          } else if (now) {
            this.style.background='#146b40';
            this.style.color='#fff';
            this.style.borderColor='#146b40';
          } else {
            this.style.background='#f1f5f2';
            this.style.color='#243a2c';
            this.style.borderColor='#b0ceb8';
          }
        ">
        <span>${d}</span>
        ${c.label ? `<span style="font-size:8px;opacity:.85">${c.label}</span>` : ''}
      </button>`;
    }).join('')}
  </div>
  <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap">
    <span style="font-size:10px;color:var(--ink3)">🟢 সব বেলা আছে</span>
    <span style="font-size:10px;color:var(--ink3)">🟡 আংশিক মিল আছে</span>
    <span style="font-size:10px;color:var(--ink3)">⬜ মিল নেই</span>
    <span style="font-size:10px;color:#cc0000">🔴 বাদ দেওয়া হবে</span>
  </div>
</div>`;

  // Slot selection area
  root.querySelector('#md-slot-area').innerHTML = `
<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
  <label class="lbl">কোন বেলার মিল দেবেন?</label>
  <p style="font-size:11px;color:var(--ink3);margin-bottom:8px">
    নির্বাচিত দিনে এই বেলাগুলো যোগ হবে (বাদ দেওয়া দিনে মিল সরে যাবে)
  </p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">
    ${slots.map((s,i)=>`
    <button
      class="slt md-slot"
      data-idx="${i}"
      data-on="0"
      onclick="this.dataset.on=this.dataset.on==='1'?'0':'1';
               this.classList.toggle('on',this.dataset.on==='1')">
      ${_e(s)}
    </button>`).join('')}
  </div>
</div>`;
}

async function _applyMulti(root) {
  const allDayBtns = [...root.querySelectorAll('.md-day')];
  const slots      = [...root.querySelectorAll('.md-slot')].map(b=>b.dataset.on==='1');
  const uid        = root.querySelector('#m-sel')?.value || _ctx.profile.uid;

  // selected=1 মানে এই দিনে মিল দেবে
  // selected=0 AND has-meal=1 মানে মিল সরিয়ে দেবে
  const addDays    = allDayBtns.filter(b=>b.dataset.selected==='1').map(b=>parseInt(b.dataset.day));
  const removeDays = allDayBtns.filter(b=>b.dataset.selected==='0'&&b.dataset.hasMeal==='1').map(b=>parseInt(b.dataset.day));

  if (!addDays.length && !removeDays.length) { toast('কোনো পরিবর্তন নেই','er'); return; }
  if (addDays.length && !slots.some(Boolean)) { toast('কমপক্ষে একটি বেলা নির্বাচন করুন','er'); return; }

  const total = addDays.length + removeDays.length;
  ld(`${total}টি দিন আপডেট হচ্ছে…`);

  try {
    // মিল যোগ করো
    for (const d of addDays) {
      const key = `${_vy}_${pad(_vm+1)}_${pad(d)}_${uid}`;
      await setDoc(doc(db,'messes',_ctx.messId,'meals',key),
        { slots, memberId: uid }, { merge: true });
    }

    // মিল সরিয়ে দাও (সব slot false)
    for (const d of removeDays) {
      const key = `${_vy}_${pad(_vm+1)}_${pad(d)}_${uid}`;
      const emptySlots = new Array(_ctx.messSettings?.slots?.length||3).fill(false);
      await setDoc(doc(db,'messes',_ctx.messId,'meals',key),
        { slots: emptySlots, memberId: uid }, { merge: true });
    }

    const msg = [];
    if (addDays.length)    msg.push(`${addDays.length}টি দিনে মিল যোগ`);
    if (removeDays.length) msg.push(`${removeDays.length}টি দিন থেকে মিল বাদ`);
    toast(msg.join(', ') + ' ✓','ok');

    root.querySelector('#md-mo').style.display = 'none';
    await _loadSlotSummary(root);
  } finally { uld(); }
}

const _e = s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// home.js — fixed: slot-wise today summary for bua

import { db } from '../../firebase.js';
import { toast, ld, uld, taka, pad, moName } from '../../utils.js';
import {
  collection, getDocs, doc, getDoc, setDoc,
  query, where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const TODAY = new Date();
let _ctx={}, _vy=TODAY.getFullYear(), _vm=TODAY.getMonth(), _members=[];

export async function render(root, ctx) {
  _ctx = ctx;
  const slots  = ctx.messSettings?.slots || ['সকাল','দুপুর','রাত'];
  const cutoff = ctx.messSettings?.cutoffHour ?? 10;
  const isPast = TODAY.getHours() >= cutoff;
  const SICO   = ['☀️','🌤','🌙','🍳','🍱','🌮'];

  root.innerHTML = `
<div>
  <!-- Month nav -->
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <button class="btn btn-ghost btn-sm" id="h-prev">◀</button>
    <span style="font-size:14px;font-weight:700;min-width:130px;text-align:center" id="h-lbl"></span>
    <button class="btn btn-ghost btn-sm" id="h-next">▶</button>
    <button class="btn btn-ghost btn-sm" id="h-today">আজ</button>
    <button class="btn btn-ghost btn-sm" id="h-ref" style="margin-left:auto">🔄</button>
  </div>

  <!-- Summary cards -->
  <div class="gA" id="h-summary" style="margin-bottom:14px">
    <div class="sc sg"><div class="sl">মোট মিল</div><div class="sv" id="hc-meal">—</div><div class="ss">এই মাসে</div></div>
    <div class="sc sa"><div class="sl">মিলের দাম</div><div class="sv" id="hc-rate">—</div><div class="ss">প্রতি মিল</div></div>
    <div class="sc sb"><div class="sl">মোট বাজার</div><div class="sv" id="hc-bazar">—</div><div class="ss">এই মাসে</div></div>
    <div class="sc sr"><div class="sl">ব্যালেন্স</div><div class="sv" id="hc-bal">—</div><div class="ss">জমা − খরচ</div></div>
  </div>

  <!-- আজকের মিল — slot-wise (বুয়ার জন্য) -->
  <div class="card" style="margin-bottom:14px">
    <div class="ch">
      <h3>🍽 আজকের মিল — ${TODAY.getDate()} ${moName(TODAY.getMonth())}</h3>
      <span style="font-size:11px;font-weight:600;color:${isPast?'var(--r1)':'var(--g1)'}">
        ${isPast ? '🔒 বন্ধ' : `⏰ বন্ধ ${cutoff}:00 তে`}
      </span>
    </div>
    <div class="cb">
      <!-- Slot-wise count -->
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px" id="h-slot-cards">
        ${slots.map((s,i)=>`
        <div style="background:var(--paper);border:1px solid var(--line);
          border-radius:12px;padding:10px 14px;text-align:center;min-width:85px;flex:1">
          <div style="font-size:18px;margin-bottom:3px">${SICO[i]||'🍽'}</div>
          <div style="font-size:12px;font-weight:600;color:var(--ink)">${_e(s)}</div>
          <div style="font-size:26px;font-weight:700;color:var(--ink4);font-family:var(--mono)"
            id="hsc-${i}">—</div>
          <div style="font-size:10px;color:var(--ink4)">জন</div>
        </div>`).join('')}
        <div style="background:var(--g7);border:1px solid var(--g5);
          border-radius:12px;padding:10px 14px;text-align:center;min-width:85px;flex:1">
          <div style="font-size:18px;margin-bottom:3px">🍱</div>
          <div style="font-size:12px;font-weight:600;color:var(--g1)">মোট</div>
          <div style="font-size:26px;font-weight:700;color:var(--g1);font-family:var(--mono)"
            id="hsc-total">—</div>
          <div style="font-size:10px;color:var(--ink4)">মিল</div>
        </div>
      </div>

      <!-- My slot buttons -->
      <div style="border-top:1px solid var(--line);padding-top:12px">
        <p style="font-size:11px;font-weight:700;color:var(--ink3);
          text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
          আমার মিল
        </p>
        <div class="slot-row" id="h-my-slots">
          ${slots.map((s,i)=>`
          <button class="slt${isPast?' locked':''}" id="hms-${i}" data-si="${i}">
            ${SICO[i]||'🍽'} ${_e(s)}
          </button>`).join('')}
        </div>
        ${isPast?`<p style="font-size:11px;color:var(--r1)">🔒 আজকের মিল বন্ধ। মিল এন্ট্রি পেজ থেকে আগামীকালের মিল দিন।</p>`:''}
      </div>

      <!-- Member list -->
      <div style="border-top:1px solid var(--line);padding-top:12px;margin-top:10px">
        <p style="font-size:11px;font-weight:700;color:var(--ink3);
          text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
          সদস্যভিত্তিক
        </p>
        <div id="h-member-chips" style="display:flex;flex-wrap:wrap;gap:6px">
          <p style="font-size:12px;color:var(--ink4)">লোড হচ্ছে…</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Notices -->
  <div class="card">
    <div class="ch">
      <h3>📢 সর্বশেষ নোটিশ</h3>
      <button class="btn btn-ghost btn-sm" id="h-notice-all">সব দেখুন</button>
    </div>
    <div class="cb" id="h-notices">লোড হচ্ছে…</div>
  </div>
</div>`;

  root.querySelector('#h-prev').addEventListener('click',()=>{ _vm--; if(_vm<0){_vm=11;_vy--} _load(root); });
  root.querySelector('#h-next').addEventListener('click',()=>{ _vm++; if(_vm>11){_vm=0;_vy++} _load(root); });
  root.querySelector('#h-today').addEventListener('click',()=>{ _vy=TODAY.getFullYear();_vm=TODAY.getMonth(); _load(root); });
  root.querySelector('#h-ref').addEventListener('click',()=> _load(root));
  root.querySelector('#h-notice-all').addEventListener('click',()=>
    window.dispatchEvent(new CustomEvent('mm:navigate',{detail:{page:'notice'}}))
  );
  root.querySelector('#h-my-slots').addEventListener('click', e=>{
    const btn = e.target.closest('[data-si]');
    if (btn) _toggleMySlot(root, parseInt(btn.dataset.si));
  });

  await _load(root);
}

async function _load(root) {
  root.querySelector('#h-lbl').textContent = `${moName(_vm)} ${_vy}`;
  ld('ড্যাশবোর্ড লোড হচ্ছে…');
  try {
    const monthStr = `${_vy}-${pad(_vm+1)}`;
    const monthPfx = `${_vy}_${pad(_vm+1)}`;

    // Members
    const mSnap = await getDocs(collection(db,'messes',_ctx.messId,'members'));
    _members = mSnap.docs.map(d=>({uid:d.id,...d.data()}));

    // Meals count
    const allMeals = await getDocs(collection(db,'messes',_ctx.messId,'meals'));
    let totalMeals=0;
    allMeals.forEach(d=>{
      if(d.id.startsWith(monthPfx)){
        totalMeals+=(d.data().slots||[]).filter(Boolean).length;
        totalMeals+=(d.data().guestSlots||[]).filter(Boolean).length;
      }
    });

    // Expenses
    const expSnap = await getDocs(query(collection(db,'messes',_ctx.messId,'expenses'),where('status','==','approved')));
    let totalBazar=0;
    expSnap.forEach(d=>{ if(d.data().date?.startsWith(monthStr)) totalBazar+=parseFloat(d.data().amount)||0; });

    // Deposits
    const depSnap = await getDocs(query(collection(db,'messes',_ctx.messId,'deposits'),where('status','==','approved')));
    let totalDep=0;
    depSnap.forEach(d=>{ if(d.data().date?.startsWith(monthStr)) totalDep+=parseFloat(d.data().amount)||0; });

    const rate = totalMeals>0 ? totalBazar/totalMeals : 0;
    const _sv  = (id,v)=>{ const el=root.querySelector('#'+id); if(el) el.textContent=v; };
    _sv('hc-meal', String(totalMeals));
    _sv('hc-rate', taka(rate));
    _sv('hc-bazar', taka(totalBazar));
    _sv('hc-bal', taka(totalDep-totalBazar));

    // My slots for today
    const cutoff = _ctx.messSettings?.cutoffHour??10;
    const isPast = TODAY.getHours()>=cutoff;
    if (!isPast) {
      const tk   = `${TODAY.getFullYear()}_${pad(TODAY.getMonth()+1)}_${pad(TODAY.getDate())}_${_ctx.profile.uid}`;
      const ms   = await getDoc(doc(db,'messes',_ctx.messId,'meals',tk));
      const myS  = ms.exists()?(ms.data().slots||[]):[];
      (_ctx.messSettings?.slots||[]).forEach((_,i)=>{
        root.querySelector(`#hms-${i}`)?.classList.toggle('on',!!myS[i]);
      });
    }

    // Today slot-wise summary
    await _loadTodaySlotSummary(root);
    await _loadNotices(root);
  } catch(err) {
    console.error('Home load error:', err);
    toast('লোড ব্যর্থ','er');
  } finally { uld(); }
}

async function _loadTodaySlotSummary(root) {
  const slots = _ctx.messSettings?.slots || ['সকাল','দুপুর','রাত'];
  const SICO  = ['☀️','🌤','🌙','🍳','🍱','🌮'];
  const slotCounts = new Array(slots.length).fill(0);
  let guestTotal=0;
  const chips=[];

  for (const m of _members) {
    const key  = `${TODAY.getFullYear()}_${pad(TODAY.getMonth()+1)}_${pad(TODAY.getDate())}_${m.uid}`;
    const snap = await getDoc(doc(db,'messes',_ctx.messId,'meals',key));
    if (!snap.exists()) {
      chips.push({ name: m.name||m.email.split('@')[0], slots:[], g:0, t:0 });
      continue;
    }
    const data = snap.data();
    const s    = data.slots||[];
    const g    = (data.guestSlots||[]).filter(Boolean).length;
    const t    = s.filter(Boolean).length+g;
    s.forEach((on,i)=>{ if(on) slotCounts[i]++; });
    guestTotal+=g;
    chips.push({ name: m.name||m.email.split('@')[0], slots:s, g, t });
  }

  const grand = slotCounts.reduce((a,b)=>a+b,0)+guestTotal;

  // Update slot count cards
  slots.forEach((_,i)=>{
    const el = root.querySelector(`#hsc-${i}`);
    if (el) {
      el.textContent = slotCounts[i];
      el.style.color = slotCounts[i]>0 ? 'var(--g1)' : 'var(--ink4)';
      // Update card border
      const card = el.closest('div[style*="min-width:85px"]');
      if (card) {
        card.style.background   = slotCounts[i]>0 ? 'var(--g7)' : 'var(--paper)';
        card.style.borderColor  = slotCounts[i]>0 ? 'var(--g5)' : 'var(--line)';
      }
    }
  });
  const totalEl = root.querySelector('#hsc-total');
  if (totalEl) totalEl.textContent = grand;

  // Member chips
  const chipsEl = root.querySelector('#h-member-chips');
  if (chipsEl) {
    chipsEl.innerHTML = chips.map(c=>`
<div style="display:flex;align-items:center;gap:6px;
  background:${c.t>0?'var(--g7)':'var(--paper)'};
  border:1px solid ${c.t>0?'var(--g5)':'var(--line)'};
  border-radius:20px;padding:4px 11px;font-size:12px">
  <span style="font-weight:600;color:${c.t>0?'var(--g1)':'var(--ink3)'}">${_e(c.name)}</span>
  <span style="color:var(--ink3)">
    ${c.slots.map((on,i)=>on?SICO[i]||'🍽':'').filter(Boolean).join('')||'—'}
    ${c.g>0?`+${c.g}G`:''}
  </span>
  <span style="font-weight:700;font-family:var(--mono);color:${c.t>0?'var(--g1)':'var(--ink4)'}">${c.t}</span>
</div>`).join('');
  }
}

async function _loadNotices(root) {
  const el=root.querySelector('#h-notices');
  if(!el) return;
  try {
    const snap=await getDocs(collection(db,'messes',_ctx.messId,'notices'));
    const sorted=snap.docs
      .sort((a,b)=>(b.data().createdAt?.seconds||0)-(a.data().createdAt?.seconds||0))
      .slice(0,3);
    if(!sorted.length){
      el.innerHTML='<p style="font-size:12px;color:var(--ink4)">কোনো নোটিশ নেই</p>';
      return;
    }
    el.innerHTML=sorted.map(d=>{
      const n=d.data();
      return `<div style="padding:8px 0;border-bottom:.5px solid var(--line)">
<p style="font-size:13px;color:var(--ink);line-height:1.5">${_e(n.text||'')}</p>
<p style="font-size:10px;color:var(--ink4);margin-top:3px">— ${_e(n.addedByName||'—')}</p>
</div>`;
    }).join('');
  } catch(e){ el.innerHTML='<p style="font-size:12px;color:var(--r1)">লোড ব্যর্থ</p>'; }
}

async function _toggleMySlot(root, i) {
  const cutoff=_ctx.messSettings?.cutoffHour??10;
  if(TODAY.getHours()>=cutoff&&!['mess-admin','mess-co-admin'].includes(_ctx.myMessRole)){
    toast('মিল পরিবর্তনের সময় পার হয়েছে','er'); return;
  }
  const key=`${TODAY.getFullYear()}_${pad(TODAY.getMonth()+1)}_${pad(TODAY.getDate())}_${_ctx.profile.uid}`;
  const ref=doc(db,'messes',_ctx.messId,'meals',key);
  const snap=await getDoc(ref);
  const slots=[...(snap.exists()?(snap.data().slots||[]):[])];
  slots[i]=!slots[i];
  const max=_ctx.messSettings?.maxMealsPerDay??3;
  if(slots.filter(Boolean).length>max){toast(`সর্বোচ্চ ${max}টি মিল`,'er');return;}
  await setDoc(ref,{slots,memberId:_ctx.profile.uid},{merge:true});
  root.querySelector(`#hms-${i}`)?.classList.toggle('on',!!slots[i]);
  await _loadTodaySlotSummary(root);
}

const _e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

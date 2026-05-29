// মেস মিল ট্র্যাকার — profile.js (no storage needed)

import { db } from '../../firebase.js';
import { toast, taka, pad, moName, ini, avColor, LANG, setLang } from '../../utils.js';
import { isPaid, requestPayment } from '../../plan.js';
import {
  doc, updateDoc, collection, getDocs, query, where, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const TODAY = new Date();
let _ctx = {};

export async function render(root, ctx) {
  _ctx = ctx;
  const { profile } = ctx;
  const paid = isPaid(ctx.messData);

  root.innerHTML = `
<div>
  <h2 style="font-size:17px;font-weight:700;color:var(--ink);margin-bottom:14px">👤 আমার প্রোফাইল</h2>

  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:13px">

    <!-- Avatar — Google photo দেখাবে, change হবে না -->
    <div class="card">
      <div class="ch"><h3>🖼 প্রোফাইল ছবি</h3></div>
      <div class="cb" style="display:flex;flex-direction:column;align-items:center;gap:10px">
        <div style="width:80px;height:80px;border-radius:50%;border:3px solid var(--g4);
          overflow:hidden;display:flex;align-items:center;justify-content:center;
          font-size:28px;font-weight:700;background:var(--g7);color:var(--g1)">
          ${profile.avatar
            ? `<img src="${_e(profile.avatar)}" style="width:100%;height:100%;object-fit:cover" alt=""/>`
            : `<span>${ini(profile.name||profile.email)}</span>`}
        </div>
        <p style="font-size:12px;color:var(--ink3);text-align:center">
          Google account এর ছবি ব্যবহার হচ্ছে
        </p>
        <p style="font-size:11px;color:var(--ink4);text-align:center">
          ছবি পরিবর্তন করতে Google account এর photo পরিবর্তন করুন
        </p>
      </div>
    </div>

    <!-- Info -->
    <div class="card">
      <div class="ch"><h3>📝 মূল তথ্য</h3></div>
      <div class="cb">
        <div class="field">
          <label class="lbl">নাম</label>
          <input class="inp inp-sm" id="prof-name" value="${_e(profile.name||'')}" placeholder="আপনার নাম"/>
        </div>
        <div class="field">
          <label class="lbl">Email</label>
          <input class="inp inp-sm" value="${_e(profile.email||'')}" disabled style="opacity:.6"/>
        </div>
        <div class="field">
          <label class="lbl">ভাষা</label>
          <select class="inp inp-sm" id="prof-lang">
            <option value="bn" ${LANG==='bn'?'selected':''}>বাংলা</option>
            <option value="en" ${LANG==='en'?'selected':''}>English</option>
          </select>
        </div>
        <button class="btn btn-p btn-sm" id="prof-save-btn">✓ আপডেট করুন</button>
        <div id="prof-msg" style="font-size:12px;margin-top:6px"></div>
      </div>
    </div>

    <!-- Plan -->
    <div class="card" style="border-color:${paid?'var(--g4)':'var(--a2)'}">
      <div class="ch">
        <h3>${paid?'⭐ Pro Plan':'🆓 Free Plan'}</h3>
        ${paid
          ? `<span class="badge b-green">সক্রিয়</span>`
          : `<span class="badge b-amber">বিজ্ঞাপন সহ</span>`}
      </div>
      <div class="cb">
        ${paid
          ? `<p style="font-size:12px;color:var(--ink3)">মেয়াদ: ${_expiry(ctx.messData?.planExpiry)}</p>`
          : `<p style="font-size:12px;color:var(--ink3);margin-bottom:12px;line-height:1.6">
              Pro Plan এ upgrade করলে বিজ্ঞাপন থাকবে না।
            </p>
            <button class="btn btn-p btn-sm" id="upgrade-btn">⭐ Pro Upgrade — ৳199/মাস</button>`}
      </div>
    </div>

    <!-- Monthly summary -->
    <div class="card">
      <div class="ch">
        <h3>📊 এই মাসের হিসাব</h3>
        <span style="font-size:11px;color:var(--ink3)">${moName(TODAY.getMonth())} ${TODAY.getFullYear()}</span>
      </div>
      <div class="cb" id="prof-summary">লোড হচ্ছে…</div>
    </div>

    <!-- Leave mess -->
    <div class="card" style="border-color:var(--r3)">
      <div class="ch"><h3 style="color:var(--r1)">🚪 মেস ছাড়ুন</h3></div>
      <div class="cb">
        <p style="font-size:12px;color:var(--ink3);margin-bottom:12px;line-height:1.6">
          মেস ছাড়লে আপনার data থাকবে কিন্তু মেসে আর access থাকবে না।
        </p>
        <button class="btn btn-danger btn-sm" id="prof-leave-btn">মেস ছাড়ুন</button>
      </div>
    </div>
  </div>
</div>`;

  root.querySelector('#prof-save-btn').addEventListener('click', () => _save(root));
  root.querySelector('#prof-leave-btn').addEventListener('click', () => _leave());
  root.querySelector('#upgrade-btn')?.addEventListener('click', () =>
    requestPayment(ctx.messId, ctx.profile)
  );

  await _loadSummary(root);
}

async function _save(root) {
  const name = root.querySelector('#prof-name')?.value.trim();
  const lang = root.querySelector('#prof-lang')?.value || 'bn';
  if (!name) { toast('নাম দিন', 'er'); return; }

  const btn = root.querySelector('#prof-save-btn');
  if (btn) { btn.disabled=true; btn.textContent='সেভ হচ্ছে…'; }

  try {
    await Promise.all([
      updateDoc(doc(db,'users',_ctx.profile.uid), { name }),
      updateDoc(doc(db,'messes',_ctx.messId,'members',_ctx.profile.uid), { name }),
      updateDoc(doc(db,'messes',_ctx.messId,'settings','main'), { lang }),
    ]);
    _ctx.profile.name = name;
    setLang(lang);
    const msg = root.querySelector('#prof-msg');
    if (msg) { msg.textContent='✓ আপডেট হয়েছে'; msg.style.color='var(--g1)'; }
    toast('প্রোফাইল আপডেট হয়েছে', 'ok');
    // sidebar name update
    const sbName = document.getElementById('sb-mess-name');
    if (sbName && _ctx.messData?.name) sbName.textContent = _ctx.messData.name;
  } catch(err) {
    toast('ব্যর্থ: '+err.message, 'er');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='✓ আপডেট করুন'; }
  }
}

async function _loadSummary(root) {
  const el = root.querySelector('#prof-summary');
  if (!el) return;
  const monthStr    = `${TODAY.getFullYear()}-${pad(TODAY.getMonth()+1)}`;
  const monthPrefix = `${TODAY.getFullYear()}_${pad(TODAY.getMonth()+1)}`;

  try {
    const mealSnap = await getDocs(collection(db,'messes',_ctx.messId,'meals'));
    let myMeals = 0;
    mealSnap.forEach(d => {
      if (d.id.startsWith(monthPrefix) && d.id.endsWith('_'+_ctx.profile.uid)) {
        myMeals += (d.data().slots||[]).filter(Boolean).length;
        myMeals += (d.data().guestSlots||[]).filter(Boolean).length;
      }
    });

    const depSnap = await getDocs(query(
      collection(db,'messes',_ctx.messId,'deposits'),
      where('memberId','==',_ctx.profile.uid),
      where('status','==','approved')
    ));
    let myDeposit = 0;
    depSnap.forEach(d => {
      if (d.data().date?.startsWith(monthStr))
        myDeposit += parseFloat(d.data().amount)||0;
    });

    el.innerHTML = `
<div class="g2" style="gap:8px">
  <div class="sc sg">
    <div class="sl">আমার মিল</div>
    <div class="sv" style="font-size:20px">${myMeals}</div>
    <div class="ss">এই মাসে</div>
  </div>
  <div class="sc sb">
    <div class="sl">আমার জমা</div>
    <div class="sv" style="font-size:20px">${taka(myDeposit)}</div>
    <div class="ss">এই মাসে</div>
  </div>
</div>`;
  } catch(err) {
    el.innerHTML = '<p style="font-size:12px;color:var(--r1)">লোড ব্যর্থ</p>';
  }
}

async function _leave() {
  if (!window.confirm('আপনি কি সত্যিই এই মেস ছাড়তে চান?')) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db,'messes',_ctx.messId,'members',_ctx.profile.uid));
    batch.update(doc(db,'users',_ctx.profile.uid), { currentMessId:null, status:'pending' });
    await batch.commit();
    toast('আপনি মেস ছেড়েছেন', 'ok');
    setTimeout(() => location.reload(), 800);
  } catch(err) {
    toast('ব্যর্থ: '+err.message, 'er');
  }
}

function _expiry(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

const taka = n => `৳${(parseFloat(n)||0).toFixed(0)}`;
const _e   = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

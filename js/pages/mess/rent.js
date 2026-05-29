// ══════════════════════════════════════════════════════════
//  মেস মিল ট্র্যাকার — js/pages/mess/rent.js
//  বাড়ি ভাড়া: গ্যাস, বিদ্যুৎ, পানি, বুয়া — monthly entry
// ══════════════════════════════════════════════════════════

import { db } from '../../firebase.js';
import { toast, taka, pad, moName } from '../../utils.js';
import {
  doc, getDoc, setDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const TODAY = new Date();
let _ctx = {}, _vy = TODAY.getFullYear(), _vm = TODAY.getMonth();

export async function render(root, ctx) {
  _ctx = ctx;

  if (!ctx.messSettings?.rentEnabled) {
    root.innerHTML = `
<div class="card">
  <div class="cb" style="text-align:center;padding:30px;color:var(--ink3)">
    <div style="font-size:32px;margin-bottom:8px">🏡</div>
    <p style="font-size:13px;margin-bottom:10px">বাড়ি ভাড়া বিভাগ চালু নেই।</p>
    ${ctx.myMessRole === 'mess-admin'
      ? `<button class="btn btn-p btn-sm"
          onclick="window.dispatchEvent(new CustomEvent('mm:navigate',{detail:{page:'settings'}}))">
          ⚙️ Settings থেকে চালু করুন
        </button>`
      : '<p style="font-size:12px">Mess Admin-কে চালু করতে বলুন।</p>'
    }
  </div>
</div>`;
    return;
  }

  const isAdmin = ctx.myMessRole === 'mess-admin';

  root.innerHTML = `
<div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <button class="btn btn-ghost btn-sm" onclick="window.__rentMNav(-1)">◀</button>
    <span style="font-size:14px;font-weight:700;min-width:130px;text-align:center" id="rent-month-lbl"></span>
    <button class="btn btn-ghost btn-sm" onclick="window.__rentMNav(1)">▶</button>
  </div>

  <!-- Summary cards -->
  <div class="g4" id="rent-summary" style="margin-bottom:14px">
    <div class="sc sa"><div class="sl">🔥 গ্যাস</div><div class="sv" id="rc-gas">—</div></div>
    <div class="sc sb"><div class="sl">💡 বিদ্যুৎ</div><div class="sv" id="rc-elec">—</div></div>
    <div class="sc"><div class="sl">💧 পানি</div><div class="sv" id="rc-water">—</div></div>
    <div class="sc sg"><div class="sl">🧹 বুয়া</div><div class="sv" id="rc-bua">—</div></div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="ch">
      <h3>💵 মোট ভাড়া</h3>
      <span style="font-size:18px;font-weight:700;color:var(--g1);font-family:var(--mono)" id="rent-total">৳০</span>
    </div>
  </div>

  ${isAdmin ? `
  <!-- Edit form -->
  <div class="card">
    <div class="ch"><h3>✏️ ভাড়া আপডেট করুন</h3></div>
    <div class="cb">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="field"><label class="lbl">🔥 গ্যাস (৳)</label><input class="inp inp-sm" id="rent-gas" type="number" min="0"/></div>
        <div class="field"><label class="lbl">💡 বিদ্যুৎ (৳)</label><input class="inp inp-sm" id="rent-elec" type="number" min="0"/></div>
        <div class="field"><label class="lbl">💧 পানি (৳)</label><input class="inp inp-sm" id="rent-water" type="number" min="0"/></div>
        <div class="field"><label class="lbl">🧹 বুয়া (৳)</label><input class="inp inp-sm" id="rent-bua" type="number" min="0"/></div>
      </div>
      <button class="btn btn-p btn-sm" onclick="window.__rentSave()">✓ সংরক্ষণ</button>
      <div id="rent-msg" style="font-size:11px;margin-top:6px"></div>
    </div>
  </div>` : ''}
</div>`;

  window.__rentMNav = d => { _vm+=d; if(_vm>11){_vm=0;_vy++} if(_vm<0){_vm=11;_vy--} _load(); };
  window.__rentSave = () => _save();

  document.getElementById('rent-month-lbl').textContent = `${moName(_vm)} ${_vy}`;
  await _load();
}

async function _load() {
  document.getElementById('rent-month-lbl').textContent = `${moName(_vm)} ${_vy}`;
  const monthKey = `${_vy}_${pad(_vm+1)}`;

  try {
    const snap = await getDoc(doc(db,'messes',_ctx.messId,'rent',monthKey));
    const settings = _ctx.messSettings;

    const data = snap.exists() ? snap.data() : {
      gas:      settings.rentGas      || 0,
      electric: settings.rentElectric || 0,
      water:    settings.rentWater    || 0,
      bua:      settings.rentBua      || 0,
      enabled:  true
    };

    const _set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = taka(v); };
    _set('rc-gas',   data.gas      || 0);
    _set('rc-elec',  data.electric || 0);
    _set('rc-water', data.water    || 0);
    _set('rc-bua',   data.bua      || 0);

    const total = (data.gas||0) + (data.electric||0) + (data.water||0) + (data.bua||0);
    const totalEl = document.getElementById('rent-total');
    if (totalEl) totalEl.textContent = taka(total);

    // Fill form inputs
    const fillInp = (id, v) => { const el = document.getElementById(id); if(el) el.value = v||0; };
    fillInp('rent-gas',   data.gas);
    fillInp('rent-elec',  data.electric);
    fillInp('rent-water', data.water);
    fillInp('rent-bua',   data.bua);
  } catch (err) {
    toast('লোড ব্যর্থ: ' + err.message, 'er');
  }
}

async function _save() {
  const gas      = parseFloat(document.getElementById('rent-gas')?.value)   || 0;
  const electric = parseFloat(document.getElementById('rent-elec')?.value)  || 0;
  const water    = parseFloat(document.getElementById('rent-water')?.value) || 0;
  const bua      = parseFloat(document.getElementById('rent-bua')?.value)   || 0;

  const monthKey = `${_vy}_${pad(_vm+1)}`;
  try {
    await setDoc(doc(db,'messes',_ctx.messId,'rent',monthKey), {
      gas, electric, water, bua, enabled: true
    });
    const msgEl = document.getElementById('rent-msg');
    if (msgEl) { msgEl.textContent = '✓ সংরক্ষণ হয়েছে'; msgEl.style.color='var(--g1)'; }
    toast('ভাড়া সেভ হয়েছে', 'ok');
    await _load();
  } catch (err) {
    toast('ব্যর্থ: ' + err.message, 'er');
  }
}

// মেস মিল ট্র্যাকার — settings.js (fixed: root-scoped selectors)

import { db } from '../../firebase.js';
import { toast, setLang } from '../../utils.js';
import {
  doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let _ctx={}, _settings={}, _root=null;

export async function render(root, ctx) {
  _ctx     = ctx;
  _root    = root;
  _settings = { ...ctx.messSettings };

  if (ctx.myMessRole !== 'mess-admin') {
    root.innerHTML = `
<div class="card">
  <div class="cb" style="text-align:center;padding:30px;color:var(--ink3)">
    <div style="font-size:32px;margin-bottom:8px">🔒</div>
    <p>Settings শুধুমাত্র Mess Admin পরিবর্তন করতে পারবেন।</p>
  </div>
</div>`;
    return;
  }

  _renderAll(root, ctx);
}

function _renderAll(root, ctx) {
  root.innerHTML = `
<div>
  <h2 style="font-size:17px;font-weight:700;color:var(--ink);margin-bottom:14px">⚙️ সেটিংস</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:13px">

    <!-- Mess info -->
    <div class="card">
      <div class="ch"><h3>🏠 মেসের তথ্য</h3></div>
      <div class="cb">
        <div class="field"><label class="lbl">মেসের নাম</label>
          <input class="inp inp-sm" id="set-name" value="${_e(ctx.messData?.name||'')}"/>
        </div>
        <div class="field"><label class="lbl">ঠিকানা</label>
          <input class="inp inp-sm" id="set-addr" value="${_e(ctx.messData?.address||'')}"/>
        </div>
        <button class="btn btn-p btn-sm" id="btn-save-name">✓ সংরক্ষণ</button>
        <div id="name-msg" style="font-size:11px;margin-top:6px"></div>
      </div>
    </div>

    <!-- Slots -->
    <div class="card">
      <div class="ch"><h3>🍽 খাবারের বেলা</h3></div>
      <div class="cb">
        <p style="font-size:11px;color:var(--ink3);margin-bottom:10px">সর্বোচ্চ ৫টি বেলা</p>
        <div id="slot-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px"></div>
        <button class="btn btn-ghost btn-sm" style="width:100%" id="btn-add-slot">+ নতুন বেলা</button>
        <hr style="margin:12px 0;border-color:var(--line)"/>
        <div class="field"><label class="lbl">মিল বন্ধের সময় (ঘণ্টা ০-২৩)</label>
          <input class="inp inp-sm" id="set-cutoff" type="number" min="0" max="23" value="${_settings.cutoffHour??10}"/>
        </div>
        <div class="field"><label class="lbl">দিনে সর্বোচ্চ মিল</label>
          <input class="inp inp-sm" id="set-maxmeals" type="number" min="1" max="10" value="${_settings.maxMealsPerDay??3}"/>
        </div>
        <button class="btn btn-p btn-sm" id="btn-save-slots">✓ সংরক্ষণ</button>
        <div id="slot-msg" style="font-size:11px;margin-top:6px"></div>
      </div>
    </div>

    <!-- Rent -->
    <div class="card">
      <div class="ch"><h3>🏡 বাড়ি ভাড়া</h3></div>
      <div class="cb">
        <div style="display:flex;align-items:center;justify-content:space-between;
          margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line)">
          <span style="font-size:13px;font-weight:600">বাড়ি ভাড়া চালু করুন</span>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" id="rent-toggle"
              style="accent-color:var(--g2);width:16px;height:16px"
              ${_settings.rentEnabled?'checked':''}/>
            <span id="rent-lbl" style="font-size:12px;color:var(--ink3)">
              ${_settings.rentEnabled?'চালু':'বন্ধ'}
            </span>
          </label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          <div><label class="lbl">🔥 গ্যাস (৳)</label>
            <input class="inp inp-sm" id="set-gas" type="number" value="${_settings.rentGas||0}"/></div>
          <div><label class="lbl">💡 বিদ্যুৎ (৳)</label>
            <input class="inp inp-sm" id="set-elec" type="number" value="${_settings.rentElectric||0}"/></div>
          <div><label class="lbl">💧 পানি (৳)</label>
            <input class="inp inp-sm" id="set-water" type="number" value="${_settings.rentWater||0}"/></div>
          <div><label class="lbl">🧹 বুয়া (৳)</label>
            <input class="inp inp-sm" id="set-bua" type="number" value="${_settings.rentBua||0}"/></div>
        </div>
        <button class="btn btn-p btn-sm" id="btn-save-rent">✓ সংরক্ষণ</button>
        <div id="rent-msg" style="font-size:11px;margin-top:6px"></div>
      </div>
    </div>

    <!-- Language -->
    <div class="card">
      <div class="ch"><h3>🌐 ভাষা</h3></div>
      <div class="cb">
        <div class="field"><label class="lbl">অ্যাপের ভাষা</label>
          <select class="inp inp-sm" id="set-lang">
            <option value="bn" ${(_settings.lang||'bn')==='bn'?'selected':''}>বাংলা</option>
            <option value="en" ${(_settings.lang||'bn')==='en'?'selected':''}>English</option>
          </select>
        </div>
        <button class="btn btn-p btn-sm" id="btn-save-lang">✓ সংরক্ষণ</button>
      </div>
    </div>
  </div>
</div>`;

  // ✅ All event listeners — root scoped, no window globals
  _renderSlots(root);

  root.querySelector('#btn-save-name').addEventListener('click', () => _saveName(root));
  root.querySelector('#btn-save-slots').addEventListener('click', () => _saveSlots(root));
  root.querySelector('#btn-add-slot').addEventListener('click', () => _addSlot(root));
  root.querySelector('#btn-save-rent').addEventListener('click', () => _saveRent(root));
  root.querySelector('#btn-save-lang').addEventListener('click', () => _saveLang(root));
  root.querySelector('#rent-toggle').addEventListener('change', e => {
    root.querySelector('#rent-lbl').textContent = e.target.checked ? 'চালু' : 'বন্ধ';
  });

  // Slot delete — event delegation
  root.querySelector('#slot-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-del-slot]');
    if (btn) _delSlot(root, parseInt(btn.dataset.delSlot));
  });
}

function _renderSlots(root) {
  const slots  = _settings.slots || [];
  const listEl = root.querySelector('#slot-list');
  if (!listEl) return;
  listEl.innerHTML = slots.map((s,i) => `
<div style="display:flex;gap:6px;align-items:center">
  <input class="inp inp-sm slot-inp" style="flex:1" data-slot-i="${i}"
    value="${_e(s)}" placeholder="বেলার নাম"/>
  <button class="btn btn-xs btn-danger" data-del-slot="${i}">✕</button>
</div>`).join('');

  const addBtn = root.querySelector('#btn-add-slot');
  if (addBtn) addBtn.style.display = slots.length >= 5 ? 'none' : '';
}

function _addSlot(root) {
  const slots = _settings.slots || [];
  if (slots.length >= 5) { toast('সর্বোচ্চ ৫টি বেলা','er'); return; }
  slots.push('নতুন বেলা');
  _settings.slots = slots;
  _renderSlots(root);
}

function _delSlot(root, i) {
  const slots = _settings.slots || [];
  if (slots.length <= 1) { toast('কমপক্ষে ১টি বেলা রাখুন','er'); return; }
  slots.splice(i, 1);
  _settings.slots = slots;
  _renderSlots(root);
}

async function _saveName(root) {
  const name = root.querySelector('#set-name')?.value.trim();
  const addr = root.querySelector('#set-addr')?.value.trim();
  if (!name) { toast('মেসের নাম দিন','er'); return; }
  try {
    await updateDoc(doc(db,'messes',_ctx.messId), { name, address: addr||'' });
    if (_ctx.messData) { _ctx.messData.name=name; _ctx.messData.address=addr; }
    const msg = root.querySelector('#name-msg');
    if (msg) { msg.textContent='✓ সংরক্ষণ হয়েছে'; msg.style.color='var(--g1)'; }
    document.getElementById('sb-mess-name') && (document.getElementById('sb-mess-name').textContent=name);
    document.getElementById('sb-mess-addr') && (document.getElementById('sb-mess-addr').textContent=addr);
    toast('মেস তথ্য আপডেট হয়েছে','ok');
  } catch(err) { toast('ব্যর্থ: '+err.message,'er'); }
}

async function _saveSlots(root) {
  // ✅ FIXED: root-scoped selector
  const inputs = root.querySelectorAll('.slot-inp');
  const slots  = [...inputs].map(inp => inp.value.trim()).filter(Boolean);
  if (!slots.length) { toast('কমপক্ষে ১টি বেলা দিন','er'); return; }
  const cutoff   = parseInt(root.querySelector('#set-cutoff')?.value)||10;
  const maxMeals = parseInt(root.querySelector('#set-maxmeals')?.value)||3;
  try {
    await updateDoc(doc(db,'messes',_ctx.messId,'settings','main'), {
      slots, cutoffHour:cutoff, maxMealsPerDay:maxMeals
    });
    _settings.slots=slots; _settings.cutoffHour=cutoff; _settings.maxMealsPerDay=maxMeals;
    Object.assign(_ctx.messSettings, {slots, cutoffHour:cutoff, maxMealsPerDay:maxMeals});
    const msg = root.querySelector('#slot-msg');
    if (msg) { msg.textContent='✓ সংরক্ষণ হয়েছে'; msg.style.color='var(--g1)'; }
    toast('বেলা সেটিংস সেভ হয়েছে','ok');
  } catch(err) { toast('ব্যর্থ: '+err.message,'er'); }
}

async function _saveRent(root) {
  const enabled  = root.querySelector('#rent-toggle')?.checked||false;
  const gas      = parseFloat(root.querySelector('#set-gas')?.value)||0;
  const electric = parseFloat(root.querySelector('#set-elec')?.value)||0;
  const water    = parseFloat(root.querySelector('#set-water')?.value)||0;
  const bua      = parseFloat(root.querySelector('#set-bua')?.value)||0;
  try {
    await updateDoc(doc(db,'messes',_ctx.messId,'settings','main'), {
      rentEnabled:enabled, rentGas:gas, rentElectric:electric, rentWater:water, rentBua:bua
    });
    Object.assign(_settings, {rentEnabled:enabled,rentGas:gas,rentElectric:electric,rentWater:water,rentBua:bua});
    Object.assign(_ctx.messSettings, {rentEnabled:enabled});
    const msg = root.querySelector('#rent-msg');
    if (msg) { msg.textContent='✓ সংরক্ষণ হয়েছে'; msg.style.color='var(--g1)'; }
    toast('ভাড়া সেটিংস সেভ হয়েছে','ok');
  } catch(err) { toast('ব্যর্থ: '+err.message,'er'); }
}

async function _saveLang(root) {
  const lang = root.querySelector('#set-lang')?.value||'bn';
  try {
    await updateDoc(doc(db,'messes',_ctx.messId,'settings','main'), {lang});
    _settings.lang=lang; _ctx.messSettings.lang=lang;
    setLang(lang);
    toast('ভাষা পরিবর্তন হয়েছে','ok');
  } catch(err) { toast('ব্যর্থ: '+err.message,'er'); }
}

const _e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

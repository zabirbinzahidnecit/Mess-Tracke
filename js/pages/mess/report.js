// ══════════════════════════════════════════════════════════
//  মেস মিল ট্র্যাকার — js/pages/mess/report.js
//  মাসিক রিপোর্ট, member breakdown, meal calendar, Excel export
// ══════════════════════════════════════════════════════════

import { db } from '../../firebase.js';
import { toast, taka, takaF, pad, moName, dim } from '../../utils.js';
import {
  collection, getDocs, query, orderBy, where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const TODAY = new Date();
let _ctx = {}, _vy = TODAY.getFullYear(), _vm = TODAY.getMonth();
let _members = [], _meals = {}, _expenses = [], _deposits = [];

export async function render(root, ctx) {
  _ctx = ctx;
  root.innerHTML = `
<div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <button class="btn btn-ghost btn-sm" onclick="window.__repMNav(-1)">◀</button>
    <span style="font-size:14px;font-weight:700;min-width:130px;text-align:center" id="rep-month-lbl"></span>
    <button class="btn btn-ghost btn-sm" onclick="window.__repMNav(1)">▶</button>
    <button class="btn btn-p btn-sm" style="margin-left:auto" onclick="window.__repExcel()">📥 Excel</button>
  </div>

  <!-- Summary cards -->
  <div class="g4" id="rep-summary" style="margin-bottom:16px">
    <div class="sc sg"><div class="sl">মোট মিল</div><div class="sv" id="rc-meal">—</div></div>
    <div class="sc sa"><div class="sl">মিল রেট</div><div class="sv" id="rc-rate">—</div><div class="ss">প্রতি মিল</div></div>
    <div class="sc sb"><div class="sl">মোট বাজার</div><div class="sv" id="rc-bazar">—</div></div>
    <div class="sc sr"><div class="sl">মোট জমা</div><div class="sv" id="rc-dep">—</div></div>
  </div>

  <!-- Member breakdown -->
  <div class="card" style="margin-bottom:14px">
    <div class="ch"><h3>👥 সদস্য ভিত্তিক হিসাব</h3></div>
    <div style="overflow-x:auto" id="rep-member-table">লোড হচ্ছে…</div>
  </div>

  <!-- Meal calendar -->
  <div class="card">
    <div class="ch">
      <h3>📅 মিল ক্যালেন্ডার</h3>
      <select class="inp inp-sm" id="rep-cal-member" style="width:auto" onchange="window.__repCalMember()"></select>
    </div>
    <div id="rep-calendar" style="padding:10px;overflow-x:auto">লোড হচ্ছে…</div>
  </div>
</div>`;

  window.__repMNav      = d => { _vm+=d; if(_vm>11){_vm=0;_vy++} if(_vm<0){_vm=11;_vy--} _load(); };
  window.__repExcel     = () => _exportExcel();
  window.__repCalMember = () => _renderCalendar();

  document.getElementById('rep-month-lbl').textContent = `${moName(_vm)} ${_vy}`;
  await _load();
}

async function _load() {
  document.getElementById('rep-month-lbl').textContent = `${moName(_vm)} ${_vy}`;
  const monthPrefix = `${_vy}_${pad(_vm+1)}`;
  const monthStr    = `${_vy}-${pad(_vm+1)}`;

  try {
    // Members
    const mSnap = await getDocs(query(collection(db,'messes',_ctx.messId,'members'), orderBy('joinedAt')));
    _members = mSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

    // Meals
    const allMealSnap = await getDocs(collection(db,'messes',_ctx.messId,'meals'));
    _meals = {};
    allMealSnap.forEach(d => {
      if (d.id.startsWith(monthPrefix)) _meals[d.id] = d.data();
    });

    // Expenses (approved)
    const expSnap = await getDocs(query(collection(db,'messes',_ctx.messId,'expenses'), where('status','==','approved')));
    _expenses = expSnap.docs.map(d => d.data()).filter(e => e.date?.startsWith(monthStr));

    // Deposits (approved)
    const depSnap = await getDocs(query(collection(db,'messes',_ctx.messId,'deposits'), where('status','==','approved')));
    _deposits = depSnap.docs.map(d => d.data()).filter(d => d.date?.startsWith(monthStr));

    _render();
  } catch (err) {
    toast('রিপোর্ট লোড ব্যর্থ: ' + err.message, 'er');
  }
}

function _calcMemberMeals(uid) {
  let total = 0, guest = 0;
  Object.entries(_meals).forEach(([key, data]) => {
    if (key.endsWith('_' + uid)) {
      total += (data.slots || []).filter(Boolean).length;
      guest += (data.guestSlots || []).filter(Boolean).length;
    }
  });
  return { total, guest, all: total + guest };
}

function _render() {
  // Grand totals
  let grandMeals = 0;
  _members.forEach(m => { grandMeals += _calcMemberMeals(m.uid).all; });
  const totalBazar   = _expenses.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const totalDeposit = _deposits.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
  const mealRate     = grandMeals > 0 ? totalBazar / grandMeals : 0;

  const _set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  _set('rc-meal',  String(grandMeals));
  _set('rc-rate',  takaF(mealRate));
  _set('rc-bazar', taka(totalBazar));
  _set('rc-dep',   taka(totalDeposit));

  // Member table
  const tableEl = document.getElementById('rep-member-table');
  if (tableEl) {
    tableEl.innerHTML = `
<table class="dt">
<thead><tr>
  <th class="tl">সদস্য</th>
  <th>মিল</th>
  <th>Guest</th>
  <th>মোট মিল</th>
  <th>মিল খরচ</th>
  <th>জমা</th>
  <th>ব্যালেন্স</th>
</tr></thead>
<tbody>
${_members.map(m => {
  const { total, guest, all } = _calcMemberMeals(m.uid);
  const mealCost  = all * mealRate;
  const deposited = _deposits.filter(d => d.memberId === m.uid).reduce((s,d) => s+(parseFloat(d.amount)||0), 0);
  const balance   = deposited - mealCost;
  return `<tr>
    <td class="tl" style="font-weight:600">${_esc(m.name||m.email)}</td>
    <td>${total}</td>
    <td>${guest || '—'}</td>
    <td style="font-weight:700">${all}</td>
    <td style="font-family:var(--mono)">${takaF(mealCost)}</td>
    <td style="font-family:var(--mono)">${taka(deposited)}</td>
    <td style="font-weight:700;font-family:var(--mono);color:${balance >= 0 ? 'var(--g1)' : 'var(--r1)'}">${takaF(balance)}</td>
  </tr>`;
}).join('')}
<tr class="tf">
  <td class="tl">মোট</td>
  <td colspan="2"></td>
  <td>${grandMeals}</td>
  <td>${takaF(totalBazar)}</td>
  <td>${taka(totalDeposit)}</td>
  <td style="color:${totalDeposit-totalBazar>=0?'var(--g1)':'var(--r1)'}">${takaF(totalDeposit - totalBazar)}</td>
</tr>
</tbody>
</table>`;
  }

  // Calendar member select
  const calSel = document.getElementById('rep-cal-member');
  if (calSel) {
    calSel.innerHTML = _members.map(m =>
      `<option value="${m.uid}">${_esc(m.name||m.email)}</option>`
    ).join('');
    calSel.value = _ctx.profile.uid;
  }

  _renderCalendar();
}

function _renderCalendar() {
  const calEl = document.getElementById('rep-calendar');
  if (!calEl) return;
  const uid   = document.getElementById('rep-cal-member')?.value || _ctx.profile.uid;
  const days  = dim(_vy, _vm);
  const slots = _ctx.messSettings?.slots || ['সকাল','দুপুর','রাত'];

  let html = `<table class="dt" style="min-width:${100 + slots.length*50}px">
<thead><tr>
  <th class="tl">তারিখ</th>
  ${slots.map(s => `<th style="font-size:10px">${_esc(s)}</th>`).join('')}
  <th>Guest</th><th>মোট</th>
</tr></thead><tbody>`;

  let monthTotal = 0;
  for (let d = 1; d <= days; d++) {
    const key  = `${_vy}_${pad(_vm+1)}_${pad(d)}_${uid}`;
    const data = _meals[key] || {};
    const s    = data.slots || [];
    const g    = (data.guestSlots || []).filter(Boolean).length;
    const tot  = s.filter(Boolean).length + g;
    monthTotal += tot;
    html += `<tr class="${tot > 0 ? '' : ''}">
      <td class="tl">${d} ${moName(_vm)}</td>
      ${slots.map((_,i) => `<td><div class="mdot ${s[i] ? 'don' : 'doff'}">${s[i] ? '✓' : ''}</div></td>`).join('')}
      <td>${g || '—'}</td>
      <td style="font-weight:${tot>0?'700':'400'}">${tot || '—'}</td>
    </tr>`;
  }
  html += `<tr class="tf"><td class="tl">মোট</td>${slots.map(()=>'<td></td>').join('')}<td></td><td>${monthTotal}</td></tr>`;
  html += '</tbody></table>';
  calEl.innerHTML = html;
}

function _exportExcel() {
  if (typeof window.XLSX === "undefined") { toast('XLSX লাইব্রেরি লোড হয়নি','er'); return; }

  const slots    = _ctx.messSettings?.slots || ['সকাল','দুপুর','রাত'];
  const mealRate = (() => {
    let gm = 0;
    _members.forEach(m => { gm += _calcMemberMeals(m.uid).all; });
    const tb = _expenses.reduce((s,e) => s+(parseFloat(e.amount)||0), 0);
    return gm > 0 ? tb / gm : 0;
  })();

  // Summary sheet
  const summaryData = [
    ['সদস্য', 'মিল', 'Guest', 'মোট মিল', 'মিল খরচ', 'জমা', 'ব্যালেন্স'],
    ..._members.map(m => {
      const { total, guest, all } = _calcMemberMeals(m.uid);
      const mealCost  = all * mealRate;
      const deposited = _deposits.filter(d => d.memberId === m.uid).reduce((s,d) => s+(parseFloat(d.amount)||0), 0);
      return [m.name||m.email, total, guest, all, mealCost.toFixed(2), deposited, (deposited-mealCost).toFixed(2)];
    })
  ];

  // Expense sheet
  const expData = [
    ['তারিখ', 'বিভাগ', 'আইটেম', 'পরিমাণ', 'নোট', 'যোগকারী'],
    ..._expenses.map(e => [e.date, e.category, e.item, e.amount, e.note, e.addedByName])
  ];

  // Deposit sheet
  const depData = [
    ['তারিখ', 'সদস্য', 'পরিমাণ', 'নোট'],
    ..._deposits.map(d => [d.date, d.memberName, d.amount, d.note])
  ];

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(summaryData), 'Summary');
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(expData), 'Expenses');
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(depData), 'Deposits');

  const fname = `mess-report-${moName(_vm)}-${_vy}.xlsx`;
  window.XLSX.writeFile(wb, fname);
  toast('Excel ডাউনলোড হচ্ছে…', 'ok');
}

const _esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

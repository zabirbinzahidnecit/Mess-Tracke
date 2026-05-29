// admin-reports.js — Admin mess report view + Excel export

import { db } from '../../firebase.js';
import { toast, ld, uld, taka, takaF, pad, moName, dim } from '../../utils.js';
import {
  collection, getDocs, doc, getDoc, query, where, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const TODAY = new Date();
let _messes=[], _selMessId=null, _selMess=null;
let _vy=TODAY.getFullYear(), _vm=TODAY.getMonth();
let _members=[], _meals={}, _expenses=[], _deposits=[];

export async function render(root) {
  root.innerHTML = `
<div>
  <div class="adp-hd">
    <div><h2 class="adp-h">📊 মেস রিপোর্ট</h2>
    <p class="adp-sub">যেকোনো মেসের রিপোর্ট দেখুন ও Export করুন</p></div>
  </div>

  <!-- Mess + Month selector -->
  <div class="card" style="margin-bottom:14px">
    <div class="cb">
      <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div class="field" style="margin:0">
          <label class="lbl">মেস নির্বাচন করুন</label>
          <select class="inp inp-sm" id="rep-mess-sel">
            <option value="">— মেস বেছে নিন —</option>
          </select>
        </div>
        <div class="field" style="margin:0">
          <label class="lbl">মাস</label>
          <select class="inp inp-sm" id="rep-month-sel">
            ${Array.from({length:12},(_,i)=>
              `<option value="${i}" ${i===TODAY.getMonth()?'selected':''}>${moName(i)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="field" style="margin:0">
          <label class="lbl">বছর</label>
          <select class="inp inp-sm" id="rep-year-sel">
            ${[TODAY.getFullYear(), TODAY.getFullYear()-1].map(y=>
              `<option value="${y}" ${y===TODAY.getFullYear()?'selected':''}>${y}</option>`
            ).join('')}
          </select>
        </div>
        <button class="btn btn-p btn-sm" id="rep-load-btn" style="align-self:flex-end">📊 দেখুন</button>
      </div>
    </div>
  </div>

  <div id="rep-content">
    <div style="padding:40px;text-align:center;color:var(--ink3)">
      <div style="font-size:40px;margin-bottom:12px">📊</div>
      <p>মেস ও মাস নির্বাচন করুন</p>
    </div>
  </div>
</div>`;

  // Load messes
  ld('মেস লোড হচ্ছে…');
  try {
    const snap = await getDocs(query(collection(db,'messes'), orderBy('createdAt','desc')));
    _messes = snap.docs.map(d=>({id:d.id,...d.data()}));
    const sel = root.querySelector('#rep-mess-sel');
    sel.innerHTML = '<option value="">— মেস বেছে নিন —</option>' +
      _messes.map(m=>`<option value="${m.id}">${_e(m.name||'অজানা')} (${m.status==='active'?'সক্রিয়':'নিষ্ক্রিয়'})</option>`).join('');
  } catch(err) { toast('মেস লোড ব্যর্থ','er'); }
  finally { uld(); }

  root.querySelector('#rep-load-btn').addEventListener('click', () => {
    const messId = root.querySelector('#rep-mess-sel')?.value;
    const month  = parseInt(root.querySelector('#rep-month-sel')?.value);
    const year   = parseInt(root.querySelector('#rep-year-sel')?.value);
    if (!messId) { toast('মেস নির্বাচন করুন','er'); return; }
    _selMessId = messId;
    _selMess   = _messes.find(m=>m.id===messId);
    _vm = month; _vy = year;
    _loadReport(root);
  });
}

async function _loadReport(root) {
  const content = root.querySelector('#rep-content');
  if (!content) return;
  content.innerHTML = '<div style="padding:30px;text-align:center;color:var(--ink3)">রিপোর্ট লোড হচ্ছে…</div>';

  ld('রিপোর্ট লোড হচ্ছে…');
  try {
    const monthStr = `${_vy}-${pad(_vm+1)}`;
    const monthPfx = `${_vy}_${pad(_vm+1)}`;

    // Members
    const mSnap = await getDocs(query(collection(db,'messes',_selMessId,'members'), orderBy('joinedAt')));
    _members = mSnap.docs.map(d=>({uid:d.id,...d.data()}));

    // Meals
    const mealSnap = await getDocs(collection(db,'messes',_selMessId,'meals'));
    _meals = {};
    mealSnap.forEach(d=>{ if(d.id.startsWith(monthPfx)) _meals[d.id]=d.data(); });

    // Expenses
    const expSnap = await getDocs(query(collection(db,'messes',_selMessId,'expenses'), where('status','==','approved')));
    _expenses = expSnap.docs.map(d=>d.data()).filter(e=>e.date?.startsWith(monthStr));

    // Deposits
    const depSnap = await getDocs(query(collection(db,'messes',_selMessId,'deposits'), where('status','==','approved')));
    _deposits = depSnap.docs.map(d=>d.data()).filter(d=>d.date?.startsWith(monthStr));

    _renderReport(content);
  } catch(err) {
    content.innerHTML = `<div style="padding:30px;text-align:center;color:var(--r1)">⚠️ ${err.message}</div>`;
  } finally { uld(); }
}

function _calcMemberMeals(uid) {
  let total=0, guest=0;
  Object.entries(_meals).forEach(([key,data])=>{
    if(key.endsWith('_'+uid)){
      total+=(data.slots||[]).filter(Boolean).length;
      guest+=(data.guestSlots||[]).filter(Boolean).length;
    }
  });
  return { total, guest, all: total+guest };
}

function _renderReport(content) {
  // Totals
  let grandMeals=0;
  _members.forEach(m=>{ grandMeals+=_calcMemberMeals(m.uid).all; });
  const totalBazar   = _expenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const totalDeposit = _deposits.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
  const mealRate     = grandMeals>0 ? totalBazar/grandMeals : 0;

  content.innerHTML = `
<div>
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;
    margin-bottom:14px;flex-wrap:wrap;gap:8px">
    <div>
      <h3 style="font-size:15px;font-weight:700;color:var(--ink);margin:0">
        ${_e(_selMess?.name||'')} — ${moName(_vm)} ${_vy}
      </h3>
      <p style="font-size:12px;color:var(--ink3);margin:3px 0 0">
        ${_members.length}জন সদস্য · ${grandMeals}টি মিল
      </p>
    </div>
    <button class="btn btn-p btn-sm" id="rep-export-btn">📥 Excel Export</button>
  </div>

  <!-- Summary cards -->
  <div class="g4" style="margin-bottom:14px">
    <div class="sc sg"><div class="sl">মোট মিল</div><div class="sv">${grandMeals}</div></div>
    <div class="sc sa"><div class="sl">মিল রেট</div><div class="sv">${takaF(mealRate)}</div><div class="ss">প্রতি মিল</div></div>
    <div class="sc sb"><div class="sl">মোট বাজার</div><div class="sv">${taka(totalBazar)}</div></div>
    <div class="sc ${totalDeposit-totalBazar>=0?'sg':'sr'}">
      <div class="sl">ব্যালেন্স</div>
      <div class="sv">${taka(totalDeposit-totalBazar)}</div>
      <div class="ss">জমা − খরচ</div>
    </div>
  </div>

  <!-- Member breakdown -->
  <div class="card" style="margin-bottom:14px">
    <div class="ch"><h3>👥 সদস্যভিত্তিক হিসাব</h3></div>
    <div style="overflow-x:auto">
      <table class="dt">
      <thead><tr>
        <th class="tl">সদস্য</th>
        <th>মিল</th><th>Guest</th><th>মোট</th>
        <th>মিল খরচ</th><th>জমা</th>
        <th>ব্যালেন্স</th>
      </tr></thead>
      <tbody>
      ${_members.map(m=>{
        const {total,guest,all} = _calcMemberMeals(m.uid);
        const mealCost  = all*mealRate;
        const deposited = _deposits.filter(d=>d.memberId===m.uid).reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
        const balance   = deposited-mealCost;
        return `<tr>
          <td class="tl" style="font-weight:600">${_e(m.name||m.email)}</td>
          <td>${total}</td><td>${guest||'—'}</td>
          <td style="font-weight:700">${all}</td>
          <td style="font-family:var(--mono)">${takaF(mealCost)}</td>
          <td style="font-family:var(--mono)">${taka(deposited)}</td>
          <td style="font-weight:700;font-family:var(--mono);color:${balance>=0?'var(--g1)':'var(--r1)'}">
            ${takaF(balance)}
          </td>
        </tr>`;
      }).join('')}
      <tr class="tf">
        <td class="tl">মোট</td>
        <td colspan="2"></td>
        <td>${grandMeals}</td>
        <td>${takaF(totalBazar)}</td>
        <td>${taka(totalDeposit)}</td>
        <td style="color:${totalDeposit-totalBazar>=0?'var(--g1)':'var(--r1)'}">
          ${takaF(totalDeposit-totalBazar)}
        </td>
      </tr>
      </tbody>
      </table>
    </div>
  </div>

  <!-- Expenses -->
  <div class="card" style="margin-bottom:14px">
    <div class="ch">
      <h3>🛒 বাজার খরচ</h3>
      <span style="font-size:12px;font-weight:700;color:var(--g1)">${taka(totalBazar)}</span>
    </div>
    <div style="overflow-x:auto">
      <table class="dt">
      <thead><tr>
        <th class="tl">তারিখ</th><th class="tl">আইটেম</th>
        <th>পরিমাণ</th><th>যোগকারী</th>
      </tr></thead>
      <tbody>
      ${_expenses.length
        ? _expenses.map(e=>`<tr>
          <td class="tl">${e.date}</td>
          <td class="tl">${_e(e.item)}</td>
          <td style="font-family:var(--mono)">${taka(e.amount)}</td>
          <td style="font-size:11px;color:var(--ink3)">${_e(e.addedByName||'—')}</td>
        </tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center;color:var(--ink3);padding:16px">কোনো খরচ নেই</td></tr>'
      }
      </tbody>
      </table>
    </div>
  </div>

  <!-- Deposits -->
  <div class="card">
    <div class="ch">
      <h3>💰 ডিপোজিট</h3>
      <span style="font-size:12px;font-weight:700;color:var(--b0)">${taka(totalDeposit)}</span>
    </div>
    <div style="overflow-x:auto">
      <table class="dt">
      <thead><tr>
        <th class="tl">তারিখ</th><th class="tl">সদস্য</th>
        <th>পরিমাণ</th><th>নোট</th>
      </tr></thead>
      <tbody>
      ${_deposits.length
        ? _deposits.map(d=>`<tr>
          <td class="tl">${d.date}</td>
          <td class="tl">${_e(d.memberName||'—')}</td>
          <td style="font-family:var(--mono)">${taka(d.amount)}</td>
          <td style="font-size:11px;color:var(--ink3)">${_e(d.note||'—')}</td>
        </tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center;color:var(--ink3);padding:16px">কোনো ডিপোজিট নেই</td></tr>'
      }
      </tbody>
      </table>
    </div>
  </div>
</div>`;

  content.querySelector('#rep-export-btn').addEventListener('click', ()=> _export());
}

function _export() {
  if (!window.XLSX) { toast('XLSX লোড হয়নি','er'); return; }

  let grandMeals=0;
  _members.forEach(m=>{ grandMeals+=_calcMemberMeals(m.uid).all; });
  const totalBazar = _expenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const mealRate   = grandMeals>0 ? totalBazar/grandMeals : 0;

  // Summary sheet
  const summary = [
    [`মেস: ${_selMess?.name||''} | মাস: ${moName(_vm)} ${_vy}`],
    [],
    ['সদস্য','মিল','Guest','মোট মিল','মিল খরচ (৳)','জমা (৳)','ব্যালেন্স (৳)'],
    ..._members.map(m=>{
      const {total,guest,all}=_calcMemberMeals(m.uid);
      const mealCost  = parseFloat((all*mealRate).toFixed(2));
      const deposited = _deposits.filter(d=>d.memberId===m.uid).reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
      return [m.name||m.email, total, guest, all, mealCost, deposited, parseFloat((deposited-mealCost).toFixed(2))];
    }),
    ['মোট','','',grandMeals,parseFloat(totalBazar.toFixed(2)),
      _deposits.reduce((s,d)=>s+(parseFloat(d.amount)||0),0),''],
  ];

  const expenses = [
    ['তারিখ','বিভাগ','আইটেম','পরিমাণ (৳)','নোট','যোগকারী'],
    ..._expenses.map(e=>[e.date,e.category,e.item,e.amount,e.note,e.addedByName]),
  ];

  const deposits = [
    ['তারিখ','সদস্য','পরিমাণ (৳)','নোট'],
    ..._deposits.map(d=>[d.date,d.memberName,d.amount,d.note]),
  ];

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(summary), 'Summary');
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(expenses), 'Expenses');
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(deposits), 'Deposits');

  const fname = `${_selMess?.name||'mess'}-${moName(_vm)}-${_vy}.xlsx`;
  window.XLSX.writeFile(wb, fname);
  toast('Excel download হচ্ছে…','ok');
}

const _e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

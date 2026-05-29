// utils.js — fixed with loading bar support

export let LANG = localStorage.getItem('mm_lang') || 'bn';

export function setLang(l) {
  LANG = l;
  localStorage.setItem('mm_lang', l);
  document.getElementById('html-root')?.setAttribute('lang', l);
}

const TR = {
  bn: {
    months: ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'],
    days_short: ['রোব','সোম','মঙ্গল','বুধ','বৃহ','শুক্র','শনি'],
  },
  en: {
    months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    days_short: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
  }
};

export function t(key) { return TR[LANG]?.[key] ?? TR.bn[key] ?? key; }
export function moName(m) { return (TR[LANG]?.months || TR.bn.months)[m] ?? ''; }
export function dayName(d) { return (TR[LANG]?.days_short || TR.bn.days_short)[d] ?? ''; }

export const taka  = n => `৳${(parseFloat(n)||0).toFixed(0)}`;
export const takaF = n => `৳${(parseFloat(n)||0).toFixed(2)}`;
export const pad   = n => String(n).padStart(2,'0');
export const ini   = n => (n||'').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
export const avColor = name => 'av'+((name?.charCodeAt(0)||0)%10);
export const dim   = (y,m) => new Date(y,m+1,0).getDate();

export function formatDate(d) {
  if (!d) return '';
  const dt = d?.toDate ? d.toDate() : new Date(d);
  return `${dt.getDate()} ${moName(dt.getMonth())} ${dt.getFullYear()}`;
}
export function dateKey(date=new Date()) {
  return `${date.getFullYear()}_${pad(date.getMonth()+1)}_${pad(date.getDate())}`;
}

// ── Toast ─────────────────────────────────────────────────
let _tt = null;
export function toast(msg, type='ok', ms=2800) {
  let el = document.getElementById('toast');
  if (!el) { el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.className = `toast ${type}`;
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('on'));
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('on'), ms);
}

// ── Loading overlay with PROGRESS BAR ────────────────────
let _ldTimer = null;

export function ld(msg, progress=null) {
  const el = document.getElementById('lov');
  if (!el) return;
  el.classList.add('on');

  const p = document.getElementById('lov-msg');
  if (p) p.textContent = msg || 'লোড হচ্ছে…';

  // Progress bar
  const bar = document.getElementById('lov-bar-inner');
  if (bar) {
    if (progress !== null) {
      bar.style.width = Math.min(100, progress) + '%';
    } else {
      // Animated indeterminate progress
      bar.style.width = '0%';
      bar.style.transition = 'none';
      requestAnimationFrame(() => {
        bar.style.transition = 'width 2s ease-out';
        bar.style.width = '85%';
      });
    }
  }

  // Safety timeout — 10s পরেও spinner চললে বন্ধ করো
  clearTimeout(_ldTimer);
  _ldTimer = setTimeout(() => uld(), 10000);
}

export function uld() {
  clearTimeout(_ldTimer);
  const el = document.getElementById('lov');
  if (!el) return;

  // Bar 100% তারপর hide
  const bar = document.getElementById('lov-bar-inner');
  if (bar) {
    bar.style.transition = 'width .2s ease';
    bar.style.width = '100%';
  }
  setTimeout(() => {
    el.classList.remove('on');
    if (bar) bar.style.width = '0%';
  }, 200);
}

// ── Confirm ───────────────────────────────────────────────
export function confirm(msg) { return window.confirm(msg); }

// ── Role label ────────────────────────────────────────────
export function roleLabel(r) {
  return {'mess-admin':'মেস অ্যাডমিন','mess-co-admin':'কো-অ্যাডমিন','member':'সদস্য','admin':'Admin','co-admin':'Co-Admin'}[r] || r;
}

export const CATS = ['বাজার','রান্না','গ্যাস','বিদ্যুৎ','পানি','পরিষ্কার','অন্যান্য'];
export const CICO = { বাজার:'🛒',রান্না:'🍳',গ্যাস:'🔥',বিদ্যুৎ:'💡',পানি:'💧',পরিষ্কার:'🧹',অন্যান্য:'📦' };

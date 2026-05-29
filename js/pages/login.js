// ══════════════════════════════════════════════════════════
//  মেস মিল ট্র্যাকার — js/pages/login.js  (fixed v2)
//  সমস্যা সমাধান:
//  1. Mobile display — padding, font size ঠিক করা হয়েছে
//  2. Button re-enable করা হয় না — auth.js uld() handle করে
//  3. viewport height fix for mobile browsers
// ══════════════════════════════════════════════════════════

import { startAuth } from '../auth.js';
import { LANG, setLang } from '../utils.js';

export async function render(root) {
  root.innerHTML = `
<div class="lw">
  <div class="lw-orb o1"></div>
  <div class="lw-orb o2"></div>

  <div class="lc">
    <div class="ll">
      <div class="ll-ic">🍽</div>
      <div>
        <h1 class="ll-h">মেস মিল ট্র্যাকার</h1>
        <p class="ll-s">Mess Meal Tracker</p>
      </div>
    </div>

    <p class="ll-d" id="ll-desc">মেসের মিল, বাজার ও হিসাব এক জায়গায় সহজে ট্র্যাক করুন।</p>

    <div class="lf">
      <div class="lf-i"><span>🍚</span><span id="lf-meal">মিল ট্র্যাকিং</span></div>
      <div class="lf-i"><span>🛒</span><span id="lf-bazar">বাজার হিসাব</span></div>
      <div class="lf-i"><span>📊</span><span id="lf-report">মাসিক রিপোর্ট</span></div>
    </div>

    <button class="lg-btn" id="btn-login">
      <svg width="18" height="18" viewBox="0 0 48 48" style="flex-shrink:0">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.7 2.3 30.2 0 24 0 14.7 0 6.7 5.5 2.8 13.5l7.9 6.2C12.5 13.3 17.8 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.9 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.9c-.6 3-2.4 5.5-5 7.2l7.8 6C43.9 37.5 46.9 31.5 46.9 24.5z"/>
        <path fill="#FBBC05" d="M10.7 28.3A14.5 14.5 0 0 1 9.5 24c0-1.5.2-3 .6-4.3l-7.9-6.2A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.2-6.5z"/>
        <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.8-6c-2 1.4-4.6 2.2-7.4 2.2-6.2 0-11.5-3.8-13.3-9.2l-8.2 6.5C6.7 42.5 14.7 48 24 48z"/>
      </svg>
      <span id="ll-btn">Google দিয়ে লগইন করুন</span>
    </button>

    <div class="lang-row">
      <button class="lb" id="lb-bn">বাংলা</button>
      <span style="color:#8aaa90;font-size:12px">|</span>
      <button class="lb" id="lb-en">English</button>
    </div>

    <p class="ll-ft" id="ll-foot">Google অ্যাকাউন্ট দিয়ে নিরাপদে লগইন করুন</p>
  </div>
</div>

<style>
/* ── Login wrap: full viewport, dark green bg ─────────── */
.lw {
  min-height: 100vh;
  min-height: 100dvh; /* mobile browser address bar fix */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--g0);
  position: relative;
  overflow: hidden;
  padding: 16px;
}
.lw-orb {
  position: absolute; border-radius: 50%;
  filter: blur(80px); pointer-events: none;
}
.o1 { width: 360px; height: 360px; background: rgba(20,107,64,.3); top: -80px; right: -60px }
.o2 { width: 280px; height: 280px; background: rgba(31,168,96,.12); bottom: -40px; left: -40px }

/* ── Card ─────────────────────────────────────────────── */
.lc {
  position: relative; z-index: 1;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 20px;
  /* Mobile এ padding কম, desktop এ বেশি */
  padding: 24px 20px;
  width: 100%;
  max-width: 390px;
  backdrop-filter: blur(12px);
  box-shadow: 0 24px 80px rgba(0,0,0,.4);
}
@media (min-width: 480px) {
  .lc { padding: 34px 30px; }
}

/* ── Logo row ─────────────────────────────────────────── */
.ll { display: flex; align-items: center; gap: 12px; margin-bottom: 16px }
.ll-ic {
  width: 46px; height: 46px; border-radius: 13px;
  background: var(--g2); display: flex; align-items: center;
  justify-content: center; font-size: 24px; flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(20,107,64,.4);
}
.ll-h { color: var(--g6); font-size: 17px; font-weight: 700; margin: 0; line-height: 1.1 }
.ll-s { color: var(--g4); font-size: 11px; margin: 3px 0 0; font-family: var(--fe) }

/* ── Description ──────────────────────────────────────── */
.ll-d { color: var(--g5); font-size: 12px; margin-bottom: 16px; line-height: 1.6 }

/* ── Features ─────────────────────────────────────────── */
.lf { display: flex; gap: 7px; margin-bottom: 20px; flex-wrap: wrap }
.lf-i {
  display: flex; align-items: center; gap: 5px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 20px; padding: 4px 10px;
  font-size: 11px; color: var(--g5);
}

/* ── Google button ────────────────────────────────────── */
.lg-btn {
  width: 100%; height: 44px; border-radius: 11px;
  background: #fff; color: #1a1a1a; border: none;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  font-family: var(--fe);
  box-shadow: 0 2px 12px rgba(0,0,0,.18);
  margin-bottom: 14px;
  transition: transform .15s, box-shadow .15s;
  /* touch এ tap highlight সরাও */
  -webkit-tap-highlight-color: transparent;
}
.lg-btn:hover  { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,.25) }
.lg-btn:active { transform: translateY(0) }
.lg-btn:disabled { opacity: .55; cursor: not-allowed; transform: none }

/* ── Lang row ─────────────────────────────────────────── */
.lang-row {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; margin-bottom: 12px;
}
.lb {
  background: none; border: none; font-size: 11px; cursor: pointer;
  color: var(--g5); padding: 2px 6px; border-radius: 4px;
  transition: .12s; font-family: var(--fn);
  -webkit-tap-highlight-color: transparent;
}
.lb:hover  { color: #fff; background: rgba(255,255,255,.08) }
.lb.active { color: var(--g4); font-weight: 700 }

/* ── Footer text ──────────────────────────────────────── */
.ll-ft {
  text-align: center; font-size: 10px;
  color: rgba(255,255,255,.3); font-family: var(--fe);
  margin: 0;
}
</style>`;

  // Wire up button — click একবারই শুনবে
  const btn = document.getElementById('btn-login');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      await startAuth();
      // NOTE: button re-enable করা হবে না —
      // startAuth() error হলে auth.js এ uld() + btn.disabled=false হয়
      // success হলে onAuthStateChanged page পরিবর্তন করবে
    });
  }

  // Lang buttons
  document.getElementById('lb-bn')?.addEventListener('click', () => _setLang('bn'));
  document.getElementById('lb-en')?.addEventListener('click', () => _setLang('en'));

  _updateLang();
}

function _setLang(l) {
  setLang(l);
  _updateLang();
}

function _updateLang() {
  const l  = LANG;
  const $  = id => document.getElementById(id);
  const st = (id, t) => { const e = $(id); if (e) e.textContent = t; };

  if (l === 'en') {
    st('ll-desc',   'Track your mess meals, grocery expenses and monthly reports — all in one place.');
    st('lf-meal',   'Meal Tracking');
    st('lf-bazar',  'Grocery');
    st('lf-report', 'Monthly Report');
    st('ll-btn',    'Sign in with Google');
    st('ll-foot',   'Securely sign in with your Google account');
  } else {
    st('ll-desc',   'মেসের মিল, বাজার ও হিসাব এক জায়গায় সহজে ট্র্যাক করুন।');
    st('lf-meal',   'মিল ট্র্যাকিং');
    st('lf-bazar',  'বাজার হিসাব');
    st('lf-report', 'মাসিক রিপোর্ট');
    st('ll-btn',    'Google দিয়ে লগইন করুন');
    st('ll-foot',   'Google অ্যাকাউন্ট দিয়ে নিরাপদে লগইন করুন');
  }

  $('lb-bn')?.classList.toggle('active', l === 'bn');
  $('lb-en')?.classList.toggle('active', l === 'en');
}

import { db } from '../../firebase.js';
import { logout } from '../../auth.js';
import { toast, ld, uld, setLang, LANG } from '../../utils.js';
import { isPaid, showAdBanner } from '../../plan.js';
import {
  doc, getDoc, onSnapshot, collection, query, where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export let messId       = null;
export let messData     = null;
export let messSettings = { slots:['সকাল','দুপুর','রাত'], cutoffHour:10, maxMealsPerDay:3, rentEnabled:false, lang:'bn' };
export let myMessRole   = null;

export const isMessAdmin   = () => myMessRole === 'mess-admin';
export const isMessCoAdmin = () => ['mess-admin','mess-co-admin'].includes(myMessRole);

const NAV = [
  { id:'home',     ico:'🏠', lbl:'হোম' },
  { id:'meal',     ico:'🍚', lbl:'মিল এন্ট্রি' },
  { id:'bazar',    ico:'🛒', lbl:'বাজার হিসাব' },
  { id:'deposit',  ico:'💰', lbl:'ডিপোজিট' },
  { id:'report',   ico:'📊', lbl:'রিপোর্ট' },
  { id:'notice',   ico:'📢', lbl:'নোটিশ বোর্ড' },
  { id:'requests', ico:'✅', lbl:'অনুমোদন', badge:true },
  { id:'members',  ico:'👥', lbl:'সদস্য' },
  { id:'rent',     ico:'🏡', lbl:'বাড়ি ভাড়া', rentOnly:true },
  { id:'profile',  ico:'👤', lbl:'আমার প্রোফাইল' },
  { id:'settings', ico:'⚙️', lbl:'সেটিংস', adminOnly:true },
];

let _profile = null;

export async function render(root, { profile }) {
  _profile = profile;
  messId   = profile.currentMessId;

  ld('মেস লোড হচ্ছে…');
  await _loadMessContext();
  uld();

  // ✅ root কে flex container বানাও
  root.style.cssText = 'display:flex;min-height:100vh;width:100%;';
  document.body.style.margin  = '0';
  document.body.style.padding = '0';

  root.innerHTML = `
<style>
#mess-sb{
  position:fixed;top:0;left:0;bottom:0;
  width:228px;background:#011a0e;
  display:flex;flex-direction:column;
  z-index:100;box-shadow:2px 0 16px rgba(0,0,0,.18);
  transition:transform .26s cubic-bezier(.4,0,.2,1);
}
#mess-overlay{
  display:none;position:fixed;inset:0;
  background:rgba(0,0,0,.45);z-index:99;
}
#mess-overlay.on{display:block}
#mess-main{
  margin-left:228px;
  width:calc(100% - 228px);
  min-height:100vh;
  display:flex;flex-direction:column;
  background:#f1f5f2;
}
#mess-topbar{
  height:52px;background:#fff;
  border-bottom:1px solid #d8e8dc;
  display:flex;align-items:center;
  padding:0 16px;gap:8px;
  position:sticky;top:0;z-index:50;
  box-shadow:0 1px 6px rgba(10,30,18,.07);
}
#mess-hbtn{
  display:none;width:34px;height:34px;
  align-items:center;justify-content:center;
  font-size:22px;border-radius:8px;
  cursor:pointer;background:none;border:none;
  flex-shrink:0;color:#243a2c;
}
#mess-page{padding:15px;flex:1}
.sb-logo{
  padding:15px 13px 12px;
  border-bottom:1px solid rgba(255,255,255,.07);
  display:flex;align-items:center;gap:10px;
}
.sb-logo .ic{
  width:38px;height:38px;border-radius:11px;
  background:#146b40;display:flex;
  align-items:center;justify-content:center;
  font-size:20px;flex-shrink:0;
}
.sb-logo h2{color:#c0f0d8;font-size:13px;font-weight:700;margin:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-logo p{color:#3fcf85;font-size:10px;margin:2px 0 0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-user{
  margin:10px 10px 0;
  background:rgba(255,255,255,.07);
  border-radius:8px;padding:9px 12px;
  display:flex;align-items:center;gap:9px;
}
.sb-av{
  width:36px;height:36px;flex-shrink:0;
  border-radius:50%;border:2px solid rgba(255,255,255,.2);
  overflow:hidden;display:flex;align-items:center;
  justify-content:center;background:#146b40;
  font-size:15px;font-weight:700;color:#fff;
}
.sb-av img{width:100%;height:100%;object-fit:cover}
.sb-uname{color:#dff5ec;font-size:13px;font-weight:600;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-ubadge{margin-top:4px}
.sb-nav{flex:1;padding:8px 0;overflow-y:auto}
.nl{
  display:flex;align-items:center;gap:10px;
  padding:9px 14px;font-size:13px;color:#85e0b5;
  border:none;background:none;width:100%;
  text-align:left;cursor:pointer;
  border-left:3px solid transparent;
  transition:.12s;position:relative;
  font-family:'Hind Siliguri',sans-serif;
}
.nl:hover{background:rgba(255,255,255,.06);color:#fff}
.nl.active{background:rgba(31,168,96,.2);color:#3fcf85;border-left-color:#1fa860}
.nl .ico{font-size:15px;width:22px;text-align:center;flex-shrink:0}
.nl .bdot{
  position:absolute;right:12px;width:8px;height:8px;
  border-radius:50%;background:#b83030;
  border:1.5px solid #011a0e;display:none;
}
.nl .bdot.show{display:block}
.sb-foot{padding:11px;border-top:1px solid rgba(255,255,255,.07)}
.sb-credits{font-size:9px;color:rgba(255,255,255,.25);text-align:center;padding:6px 0 2px}

@media(max-width:760px){
  #mess-sb{transform:translateX(-228px)}
  #mess-sb.open{transform:translateX(0)}
  #mess-main{margin-left:0!important;width:100%!important}
  #mess-hbtn{display:flex!important}
}
</style>

<!-- SIDEBAR -->
<div id="mess-sb">
  <div class="sb-logo">
    <div class="ic">🍽</div>
    <div style="min-width:0">
      <h2 id="sb-mess-name">${_e(messData?.name||'মেস')}</h2>
      <p id="sb-mess-addr">${_e(messData?.address||'')}</p>
    </div>
  </div>

  <div class="sb-user">
    <div class="sb-av">
      ${profile.avatar ? `<img src="${_e(profile.avatar)}" alt=""/>` : (profile.name||'?')[0].toUpperCase()}
    </div>
    <div style="min-width:0">
      <div class="sb-uname">${_e(profile.name||profile.email)}</div>
      <div class="sb-ubadge">${_roleBadge(myMessRole)}</div>
    </div>
  </div>

  <nav class="sb-nav" id="mess-nav">
    ${_renderNav()}
  </nav>

  <div class="sb-foot">
    <button class="nl" id="btn-logout">
      <span class="ico">🚪</span><span>লগআউট</span>
    </button>
    <div class="sb-credits">মেস মিল ট্র্যাকার v3.0</div>
  </div>
</div>

<!-- OVERLAY -->
<div id="mess-overlay"></div>

<!-- MAIN -->
<div id="mess-main">
  <div id="mess-topbar">
    <button id="mess-hbtn">☰</button>
    <span style="font-size:15px;font-weight:700;color:#0a180e;flex:1" id="mess-title">হোম</span>
    <div id="mess-ctrl" style="display:flex;align-items:center;gap:5px"></div>
  </div>
  <div id="mess-page">
    <div style="padding:40px;text-align:center;color:#4a7055">লোড হচ্ছে…</div>
  </div>
</div>`;

  // Events
  document.getElementById('btn-logout').addEventListener('click', () => logout());
  document.getElementById('mess-hbtn').addEventListener('click', () => {
    document.getElementById('mess-sb').classList.add('open');
    document.getElementById('mess-overlay').classList.add('on');
  });
  document.getElementById('mess-overlay').addEventListener('click', () => {
    document.getElementById('mess-sb').classList.remove('open');
    document.getElementById('mess-overlay').classList.remove('on');
  });
  document.getElementById('mess-nav').addEventListener('click', e => {
    const btn = e.target.closest('[data-page]');
    if (btn) navigate(btn.dataset.page);
  });

  window.removeEventListener('mm:navigate', _onNav);
  window.addEventListener('mm:navigate', _onNav);

  await navigate('home');
  _watchBadge();
}

function _onNav(e) { navigate(e.detail.page, e.detail.params); }

function _renderNav() {
  return NAV.map(n => {
    if (n.adminOnly && !isMessAdmin()) return '';
    if (n.rentOnly  && !messSettings.rentEnabled) return '';
    return `<button class="nl" data-page="${n.id}" id="nl-${n.id}">
  <span class="ico">${n.ico}</span><span>${n.lbl}</span>
  ${n.badge ? '<span class="bdot" id="req-badge-dot"></span>' : ''}
</button>`;
  }).join('');
}

export async function navigate(pageId, params = {}) {
  NAV.forEach(n => document.getElementById(`nl-${n.id}`)?.classList.toggle('active', n.id===pageId));
  const nav   = NAV.find(n => n.id===pageId);
  const title = document.getElementById('mess-title');
  if (title && nav) title.textContent = nav.lbl;

  document.getElementById('mess-sb')?.classList.remove('open');
  document.getElementById('mess-overlay')?.classList.remove('on');

  const ctrl = document.getElementById('mess-ctrl');
  if (ctrl) ctrl.innerHTML = '';

  const page = document.getElementById('mess-page');
  if (!page) return;
  page.innerHTML = '<div style="padding:40px;text-align:center;color:#4a7055">লোড হচ্ছে…</div>';

  try {
    const mod = await import(`./${pageId}.js`);
    await mod.render(page, { messId, messData, messSettings, profile:_profile, myMessRole, params });
    if (!isPaid(messData) && ['home','bazar','report'].includes(pageId)) {
      showAdBanner(page);
    }
  } catch(err) {
    console.error('Page error:', pageId, err);
    page.innerHTML = `<div style="padding:30px;text-align:center;color:#b83030">
      <div style="font-size:28px;margin-bottom:8px">⚠️</div>
      <p style="font-size:13px;margin-bottom:12px">${_e(err.message)}</p>
      <button onclick="window.__messNav('${pageId}')"
        style="height:32px;padding:0 14px;background:#f1f5f2;border:1px solid #b0ceb8;
        border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">
        🔄 পুনরায় চেষ্টা
      </button>
    </div>`;
    window.__messNav = p => navigate(p);
  }
}

async function _loadMessContext() {
  try {
    const [mSnap, sSnap, mbSnap] = await Promise.all([
      getDoc(doc(db,'messes',messId)),
      getDoc(doc(db,'messes',messId,'settings','main')),
      getDoc(doc(db,'messes',messId,'members',_profile.uid)),
    ]);

    if (!mSnap.exists()) {
      const { updateDoc, doc:fDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      await updateDoc(fDoc(db,'users',_profile.uid), { currentMessId:null, status:'pending' });
      toast('এই মেস আর নেই', 'er');
      setTimeout(() => location.reload(), 1500);
      return;
    }

    messData     = { id:mSnap.id, ...mSnap.data() };
    messSettings = sSnap.exists() ? sSnap.data() : messSettings;
    myMessRole   = mbSnap.exists() ? mbSnap.data().role : 'member';

    if (messSettings.lang && messSettings.lang !== LANG) setLang(messSettings.lang);
  } catch(err) {
    console.error('Context error:', err);
    toast('মেস তথ্য লোড ব্যর্থ', 'er');
  }
}

function _watchBadge() {
  if (!isMessCoAdmin()) return;
  try {
    onSnapshot(
      query(collection(db,'messes',messId,'expenses'), where('status','==','pending')),
      snap => document.getElementById('req-badge-dot')?.classList.toggle('show', snap.size>0)
    );
  } catch(e) {}
}

function _roleBadge(role) {
  const s = {
    'mess-admin':    'font-size:9px;background:rgba(31,168,96,.2);color:#3fcf85;padding:2px 7px;border-radius:10px;font-weight:700',
    'mess-co-admin': 'font-size:9px;background:rgba(74,120,232,.2);color:#4a78e8;padding:2px 7px;border-radius:10px;font-weight:700',
    'member':        'font-size:9px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.5);padding:2px 7px;border-radius:10px;font-weight:700',
  };
  const l = {'mess-admin':'মেস অ্যাডমিন','mess-co-admin':'কো-অ্যাডমিন','member':'সদস্য'};
  return role && s[role] ? `<span style="${s[role]}">${l[role]}</span>` : '';
}

const _e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

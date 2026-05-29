import { logout } from '../../auth.js';
import { db } from '../../firebase.js';
import {
  getDocs, collection, query, where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const PAGES = [
  { id:'messes',   label:'সব মেস',       ico:'🏠' },
  { id:'requests', label:'মেস অনুরোধ',   ico:'📋', badge:true },
  { id:'reports',  label:'রিপোর্ট',       ico:'📊' },
  { id:'users',    label:'ব্যবহারকারী',   ico:'👥' },
];

let _cur='messes', _profile=null;

export async function render(root, { profile }) {
  _profile = profile;
  document.body.style.margin  = '0';
  document.body.style.padding = '0';
  root.style.cssText = 'display:block;width:100%;min-height:100vh';

  root.innerHTML = `
<style>
#adm-sb{position:fixed;top:0;left:0;bottom:0;width:228px;background:#011a0e;
  display:flex;flex-direction:column;z-index:100;
  box-shadow:2px 0 16px rgba(0,0,0,.18);
  transition:transform .26s cubic-bezier(.4,0,.2,1)}
#adm-main{margin-left:228px;width:calc(100% - 228px);min-height:100vh;
  display:flex;flex-direction:column;background:#f1f5f2}
#adm-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99}
#adm-overlay.on{display:block}
#adm-topbar{height:52px;background:#fff;border-bottom:1px solid #d8e8dc;
  display:flex;align-items:center;padding:0 16px;gap:10px;
  position:sticky;top:0;z-index:50;box-shadow:0 1px 6px rgba(10,30,18,.07)}
#adm-hbtn{display:none;width:34px;height:34px;align-items:center;justify-content:center;
  font-size:22px;color:#243a2c;border-radius:8px;cursor:pointer;
  background:none;border:none;flex-shrink:0}
#adm-page{padding:16px;flex:1}
.adm-logo{padding:15px 13px 12px;border-bottom:1px solid rgba(255,255,255,.07);
  display:flex;align-items:center;gap:10px}
.adm-logo .ic{width:38px;height:38px;border-radius:11px;background:#146b40;
  display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.adm-logo h2{color:#c0f0d8;font-size:13px;font-weight:700;margin:0}
.adm-logo p{color:#3fcf85;font-size:10px;margin:2px 0 0}
.adm-user-box{margin:10px 10px 0;background:rgba(255,255,255,.07);border-radius:8px;
  padding:9px 12px;display:flex;align-items:center;gap:9px}
.adm-av{width:36px;height:36px;flex-shrink:0;border-radius:50%;
  border:2px solid rgba(255,255,255,.2);overflow:hidden;display:flex;
  align-items:center;justify-content:center;background:#146b40;
  font-size:15px;font-weight:700;color:#fff}
.adm-av img{width:100%;height:100%;object-fit:cover}
.adm-uname{color:#dff5ec;font-size:13px;font-weight:600;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adm-ubadge{color:#3fcf85;font-size:10px;margin-top:3px}
.adm-nav{flex:1;padding:8px 0;overflow-y:auto}
.adm-nl{display:flex;align-items:center;gap:10px;padding:9px 14px;font-size:13px;
  color:#85e0b5;border:none;background:none;width:100%;text-align:left;cursor:pointer;
  border-left:3px solid transparent;transition:.12s;position:relative;
  font-family:'Hind Siliguri',sans-serif}
.adm-nl:hover{background:rgba(255,255,255,.06);color:#fff}
.adm-nl.active{background:rgba(31,168,96,.2);color:#3fcf85;border-left-color:#1fa860}
.adm-nl .ico{font-size:15px;width:22px;text-align:center;flex-shrink:0}
.adm-bdot{position:absolute;right:12px;width:8px;height:8px;border-radius:50%;
  background:#b83030;border:1.5px solid #011a0e;display:none}
.adm-bdot.show{display:block}
.adm-foot{padding:11px;border-top:1px solid rgba(255,255,255,.07)}
@media(max-width:760px){
  #adm-sb{transform:translateX(-228px)}
  #adm-sb.open{transform:translateX(0)}
  #adm-main{margin-left:0!important;width:100%!important}
  #adm-hbtn{display:flex!important}
}
</style>

<div id="adm-sb">
  <div class="adm-logo">
    <div class="ic">🍽</div>
    <div><h2>মেস মিল ট্র্যাকার</h2><p>Admin Panel</p></div>
  </div>
  <div class="adm-user-box">
    <div class="adm-av">
      ${profile.avatar?`<img src="${_e(profile.avatar)}" alt=""/>`:(profile.name||'A')[0].toUpperCase()}
    </div>
    <div style="min-width:0">
      <div class="adm-uname">${_e(profile.name||profile.email)}</div>
      <div class="adm-ubadge">${profile.platformRole==='admin'?'🔑 Admin':'🛡 Co-Admin'}</div>
    </div>
  </div>
  <nav class="adm-nav" id="adm-nav">
    ${PAGES.map(p=>`
    <button class="adm-nl${_cur===p.id?' active':''}" data-page="${p.id}">
      <span class="ico">${p.ico}</span><span>${p.label}</span>
      ${p.badge?'<span class="adm-bdot" id="req-badge"></span>':''}
    </button>`).join('')}
  </nav>
  <div class="adm-foot">
    <button class="adm-nl" id="adm-logout">
      <span class="ico">🚪</span><span>লগআউট</span>
    </button>
  </div>
</div>

<div id="adm-overlay"></div>

<div id="adm-main">
  <div id="adm-topbar">
    <button id="adm-hbtn">☰</button>
    <span style="font-size:15px;font-weight:700;color:#0a180e;flex:1" id="adm-title">সব মেস</span>
  </div>
  <div id="adm-page">
    <div style="padding:30px;text-align:center;color:#4a7055">লোড হচ্ছে…</div>
  </div>
</div>`;

  document.getElementById('adm-logout').addEventListener('click', ()=> logout());
  document.getElementById('adm-hbtn').addEventListener('click', ()=>{
    document.getElementById('adm-sb').classList.add('open');
    document.getElementById('adm-overlay').classList.add('on');
  });
  document.getElementById('adm-overlay').addEventListener('click', ()=>{
    document.getElementById('adm-sb').classList.remove('open');
    document.getElementById('adm-overlay').classList.remove('on');
  });
  document.getElementById('adm-nav').addEventListener('click', e=>{
    const btn = e.target.closest('[data-page]');
    if (btn) _go(btn.dataset.page);
  });

  await _go('messes');
  _badge();
}

async function _go(pageId) {
  _cur = pageId;
  document.querySelectorAll('#adm-nav [data-page]').forEach(b=>
    b.classList.toggle('active', b.dataset.page===pageId)
  );
  const lbl = PAGES.find(p=>p.id===pageId)?.label||'';
  const titleEl = document.getElementById('adm-title');
  if (titleEl) titleEl.textContent = lbl;

  document.getElementById('adm-sb')?.classList.remove('open');
  document.getElementById('adm-overlay')?.classList.remove('on');

  const page = document.getElementById('adm-page');
  if (!page) return;
  page.innerHTML = '<div style="padding:30px;text-align:center;color:#4a7055">লোড হচ্ছে…</div>';

  try {
    const fileMap = {
      messes:   'admin-messes',
      requests: 'admin-requests',
      reports:  'admin-reports',
      users:    'admin-users',
    };
    const mod = await import(`./${fileMap[pageId]||pageId}.js`);
    await mod.render(page, { profile: _profile });
  } catch(err) {
    page.innerHTML = `<div style="padding:30px;text-align:center;color:#b83030">⚠️ ${err.message}</div>`;
  }
}

async function _badge() {
  try {
    const snap = await getDocs(query(collection(db,'messRequests'), where('status','==','pending')));
    const dot  = document.getElementById('req-badge');
    if (dot && snap.size>0) dot.classList.add('show');
  } catch(e) {}
}

const _e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

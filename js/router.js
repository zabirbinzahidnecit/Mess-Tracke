import { isPlatformCoAdmin } from './auth.js';

const PAGE_LOADERS = {
  login:      () => import('./pages/login.js'),
  pending:    () => import('./pages/pending.js'),
  adminShell: () => import('./pages/admin/admin-shell.js'),
  messShell:  () => import('./pages/mess/mess-shell.js'),
};

let _currentPage = null;

export async function renderRouter(firebaseUser, profile) {
  const root = document.getElementById('app');
  if (!root) return;

  let targetPage;
  if (!firebaseUser || !profile)      targetPage = 'login';
  else if (isPlatformCoAdmin())        targetPage = 'adminShell';
  else if (profile.currentMessId)      targetPage = 'messShell';
  else                                 targetPage = 'pending';

  // সবসময় re-render — page change, auth change সব ক্ষেত্রে
  _currentPage = targetPage;
  root.innerHTML = '';   // পুরনো content মুছে ফেলো

  try {
    const mod = await PAGE_LOADERS[targetPage]?.();
    if (mod?.render) await mod.render(root, { firebaseUser, profile });
  } catch (err) {
    console.error('Router error:', err);
    root.innerHTML = `
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:100vh;gap:16px;font-family:'Hind Siliguri',sans-serif;padding:24px;text-align:center">
  <div style="font-size:40px">⚠️</div>
  <h2 style="font-size:18px;font-weight:700">পেজ লোড হয়নি</h2>
  <p style="font-size:13px;color:#4a7055">${err.message}</p>
  <button onclick="location.reload()"
    style="height:40px;padding:0 20px;background:#146b40;color:#fff;
    border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">
    🔄 পুনরায় লোড করুন
  </button>
</div>`;
  }
}

export function navigate(page, params = {}) {
  window.dispatchEvent(new CustomEvent('mm:navigate', { detail: { page, params } }));
}

export function resetRouter() { _currentPage = null; }

// ====================== CONFIG ======================
const SUPABASE_URL = 'https://supabase.com/dashboard/project/mcavvwlaehqxovfybcfm/sql/23493333-1f08-4895-8099-275d42c6088c';   // ← put your real URL
const SUPABASE_ANON_KEY = 'mcavvwlaehqxovfybcfm';                     // ← put your real key

let supabase = null;
try {
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error(e);
}

// ====================== PAGE SWITCH ======================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(pageId);
  if (el) el.classList.add('active');
}

// ====================== WIRE UP BUTTONS (this fixes the click problem) ======================
document.addEventListener('DOMContentLoaded', () => {
  // Landing buttons
  document.getElementById('btn-login')?.addEventListener('click', () => showPage('login'));
  document.getElementById('btn-signup')?.addEventListener('click', () => showPage('signup'));

  // Back buttons
  document.getElementById('back-from-login')?.addEventListener('click', () => showPage('landing'));
  document.getElementById('back-from-signup')?.addEventListener('click', () => showPage('landing'));

  // Switch between login ↔ signup
  document.getElementById('to-signup')?.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('signup');
  });
  document.getElementById('to-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('login');
  });

  // Forms
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('signup-form')?.addEventListener('submit', handleSignup);

  // Dashboard buttons
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('btn-mysites')?.addEventListener('click', showMySites);
  document.getElementById('btn-start')?.addEventListener('click', () => showHostForm());
  document.getElementById('btn-cancel')?.addEventListener('click', cancelHost);
  document.getElementById('btn-deploy')?.addEventListener('click', deploySite);
  document.getElementById('btn-copy')?.addEventListener('click', copyUrl);
  document.getElementById('btn-open')?.addEventListener('click', openLiveSite);
  document.getElementById('btn-download')?.addEventListener('click', downloadHTML);
  document.getElementById('btn-edit')?.addEventListener('click', editCurrent);
  document.getElementById('btn-another')?.addEventListener('click', resetHost);
  document.getElementById('btn-back-sites')?.addEventListener('click', backToStart);

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Start the app
  init();
});

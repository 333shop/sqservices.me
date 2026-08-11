// ====================== CONFIG ======================
// REPLACE THESE TWO VALUES WITH YOUR REAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://mcavvwlaehqxovfybcfm.supabase.co';
const SUPABASE_ANON_KEY = 'mcavvwlaehqxovfybcfm';

// Create client safely
let supabase = null;
try {
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (err) {
  console.error('Supabase init error:', err);
}

// ====================== STATE ======================
let currentUser = null;
let uploadedFiles = [];
let lastDeployedHTML = '';
let lastDeployedId = '';

// ====================== PAGE SWITCHING (always works) ======================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
}

// Make showPage available globally (important for onclick)
window.showPage = showPage;

// ====================== LOADING ======================
function showLoading(text = 'Loading...') {
  const el = document.getElementById('loading');
  const textEl = document.getElementById('loading-text');
  if (textEl) textEl.textContent = text;
  if (el) el.classList.remove('hidden');
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

// ====================== AUTH ======================
async function handleSignup(e) {
  e.preventDefault();

  if (!supabase) {
    alert('Supabase is not connected. Please add your Project URL and anon key in script.js');
    return;
  }

  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  if (!email || !password) {
    alert('Please fill in all fields');
    return;
  }

  showLoading('Creating account...');

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      alert(error.message);
      return;
    }

    alert('Account created successfully! You can now log in.');
    showPage('login');
  } catch (err) {
    alert('Signup failed: ' + err.message);
  } finally {
    hideLoading();
  }
}

async function handleLogin(e) {
  e.preventDefault();

  if (!supabase) {
    alert('Supabase is not connected. Please add your Project URL and anon key in script.js');
    return;
  }

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    alert('Please fill in all fields');
    return;
  }

  showLoading('Logging in...');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert(error.message);
      return;
    }

    currentUser = data.user;
    showPage('dashboard');
  } catch (err) {
    alert('Login failed: ' + err.message);
  } finally {
    hideLoading();
  }
}

async function handleLogout() {
  if (supabase) {
    await supabase.auth.signOut();
  }
  currentUser = null;
  showPage('landing');
  resetHost();
}

// Make auth functions global
window.handleSignup = handleSignup;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;

// ====================== FILE UPLOAD ======================
function initFileUpload() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileList = document.getElementById('file-list');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, e => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  fileInput.addEventListener('change', e => handleFiles(e.target.files));
}

function handleFiles(files) {
  uploadedFiles = Array.from(files);
  renderFileList();
}

function renderFileList() {
  const fileList = document.getElementById('file-list');
  if (!fileList) return;

  fileList.innerHTML = '';
  uploadedFiles.forEach((f, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <i class="fas fa-file-code"></i>
      <span>${f.name}</span>
      <button style="margin-left:auto;background:none;border:none;color:#94a3b8;cursor:pointer"
              onclick="removeFile(${i})">
        <i class="fas fa-times"></i>
      </button>`;
    fileList.appendChild(li);
  });
}

window.removeFile = function(index) {
  uploadedFiles.splice(index, 1);
  renderFileList();
};

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function buildHTMLFromFiles() {
  let htmlContent = '';
  let cssContent = '';
  let jsContent = '';

  for (const file of uploadedFiles) {
    const text = await readFile(file);
    const name = file.name.toLowerCase();

    if (name.endsWith('.html') || name.endsWith('.htm')) htmlContent = text;
    else if (name.endsWith('.css')) cssContent += text + '\n';
    else if (name.endsWith('.js')) jsContent += text + '\n';
  }

  if (!htmlContent) {
    htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>My Site</title></head><body><h1>Hello from sqservices.me</h1></body></html>`;
  }

  if (cssContent) {
    htmlContent = htmlContent.includes('</head>')
      ? htmlContent.replace('</head>', `<style>\n${cssContent}</style>\n</head>`)
      : `<style>\n${cssContent}</style>\n` + htmlContent;
  }

  if (jsContent) {
    htmlContent = htmlContent.includes('</body>')
      ? htmlContent.replace('</body>', `<script>\n${jsContent}<\/script>\n</body>`)
      : htmlContent + `\n<script>\n${jsContent}<\/script>`;
  }

  return htmlContent;
}

// ====================== DEPLOY ======================
function generateCode(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function showHostForm(editId = null) {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('my-sites').classList.add('hidden');
  document.getElementById('success-screen').classList.add('hidden');
  document.getElementById('host-form').classList.remove('hidden');

  document.getElementById('editing-id').value = editId || '';
  document.getElementById('form-title').textContent = editId ? 'Update your site' : 'Deploy your site';
  document.getElementById('deploy-text').textContent = editId ? 'Update Site' : 'Host Now';

  if (editId) {
    loadSiteForEdit(editId);
  } else {
    document.getElementById('code-input').value = '';
    uploadedFiles = [];
    renderFileList();
  }
}

window.showHostForm = showHostForm;

async function loadSiteForEdit(id) {
  if (!supabase) return;
  showLoading('Loading site...');
  const { data, error } = await supabase.from('sites').select('html').eq('id', id).single();
  hideLoading();

  if (error) {
    alert('Could not load site');
    return;
  }
  document.getElementById('code-input').value = data.html;
  switchTab('paste');
}

function cancelHost() {
  document.getElementById('host-form').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
}
window.cancelHost = cancelHost;

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

  if (tab === 'paste') {
    document.querySelectorAll('.tab')[0].classList.add('active');
    document.getElementById('paste-tab').classList.remove('hidden');
  } else {
    document.querySelectorAll('.tab')[1].classList.add('active');
    document.getElementById('upload-tab').classList.remove('hidden');
  }
}
window.switchTab = switchTab;

async function deploySite() {
  if (!currentUser) {
    alert('Please login first');
    return;
  }
  if (!supabase) {
    alert('Supabase is not connected');
    return;
  }

  let finalHTML = document.getElementById('code-input').value.trim();

  if (uploadedFiles.length > 0) {
    showLoading('Reading files...');
    try {
      finalHTML = await buildHTMLFromFiles();
    } catch {
      hideLoading();
      alert('Error reading files');
      return;
    }
  }

  if (!finalHTML) {
    alert('Please paste code or upload files');
    return;
  }

  const editingId = document.getElementById('editing-id').value;
  const id = editingId || generateCode();

  showLoading(editingId ? 'Updating site...' : 'Deploying site...');

  try {
    if (editingId) {
      const { error } = await supabase
        .from('sites')
        .update({ html: finalHTML, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', currentUser.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('sites')
        .insert({
          id,
          user_id: currentUser.id,
          html: finalHTML,
          title: 'My Site'
        });

      if (error) throw error;
    }

    lastDeployedHTML = finalHTML;
    lastDeployedId = id;

    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    const liveLink = `${base}?site=${id}`;

    document.getElementById('live-url').textContent = liveLink;
    document.getElementById('live-url').href = liveLink;

    document.getElementById('host-form').classList.add('hidden');
    document.getElementById('success-screen').classList.remove('hidden');
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    hideLoading();
  }
}
window.deploySite = deploySite;

// ====================== SUCCESS ACTIONS ======================
function openLiveSite() {
  window.open(`?site=${lastDeployedId}`, '_blank');
}
window.openLiveSite = openLiveSite;

function copyUrl() {
  navigator.clipboard.writeText(document.getElementById('live-url').textContent).then(() => {
    const icon = document.querySelector('.copy-btn i');
    if (icon) {
      icon.className = 'fas fa-check';
      setTimeout(() => icon.className = 'fas fa-copy', 1400);
    }
  });
}
window.copyUrl = copyUrl;

function downloadHTML() {
  const blob = new Blob([lastDeployedHTML], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'index.html';
  a.click();
}
window.downloadHTML = downloadHTML;

function editCurrent() {
  showHostForm(lastDeployedId);
}
window.editCurrent = editCurrent;

function resetHost() {
  document.getElementById('success-screen')?.classList.add('hidden');
  document.getElementById('host-form')?.classList.add('hidden');
  document.getElementById('my-sites')?.classList.add('hidden');
  document.getElementById('start-screen')?.classList.remove('hidden');
  document.getElementById('code-input').value = '';
  document.getElementById('editing-id').value = '';
  uploadedFiles = [];
  renderFileList();
}
window.resetHost = resetHost;

// ====================== MY SITES ======================
async function showMySites() {
  if (!currentUser || !supabase) return;

  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('host-form').classList.add('hidden');
  document.getElementById('success-screen').classList.add('hidden');
  document.getElementById('my-sites').classList.remove('hidden');

  showLoading('Loading your sites...');
  const { data, error } = await supabase
    .from('sites')
    .select('id, title, updated_at')
    .eq('user_id', currentUser.id)
    .order('updated_at', { ascending: false });

  hideLoading();

  const list = document.getElementById('sites-list');
  if (error || !data || data.length === 0) {
    list.innerHTML = `<p style="color:var(--muted);text-align:center;padding:1.5rem 0">No sites yet.</p>`;
    return;
  }

  list.innerHTML = data.map(s => {
    const date = new Date(s.updated_at).toLocaleString();
    return `
      <div class="site-item">
        <div class="info">
          <div class="code">${s.id}</div>
          <div class="date">Updated: ${date}</div>
        </div>
        <div class="site-actions">
          <button title="Open" onclick="window.open('?site=${s.id}', '_blank')">
            <i class="fas fa-external-link-alt"></i>
          </button>
          <button title="Edit" onclick="showHostForm('${s.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button title="Delete" onclick="deleteSite('${s.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>`;
  }).join('');
}
window.showMySites = showMySites;

async function deleteSite(id) {
  if (!confirm('Delete this site permanently?')) return;
  showLoading('Deleting...');
  await supabase.from('sites').delete().eq('id', id).eq('user_id', currentUser.id);
  hideLoading();
  showMySites();
}
window.deleteSite = deleteSite;

function backToStart() {
  document.getElementById('my-sites').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
}
window.backToStart = backToStart;

// ====================== PUBLIC VIEWER ======================
async function loadPublicSite(id) {
  showLoading('Loading site...');

  if (!supabase) {
    hideLoading();
    document.body.innerHTML = `<div style="padding:3rem;text-align:center;color:white">Supabase not connected</div>`;
    return;
  }

  const { data, error } = await supabase.from('sites').select('html').eq('id', id).single();
  hideLoading();

  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

  if (error || !data) {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                  background:#060b14;color:#e2e8f0;font-family:system-ui;text-align:center;padding:2rem">
        <div>
          <h2>Site not found</h2>
          <p style="color:#94a3b8;margin:1rem 0">This link is invalid or the site was deleted.</p>
          <a href="${window.location.pathname}" style="color:#3b82f6">← Back</a>
        </div>
      </div>`;
    return;
  }

  const viewer = document.getElementById('viewer');
  viewer.classList.remove('hidden');
  viewer.innerHTML = `<iframe srcdoc="${data.html.replace(/"/g, '&quot;')}" style="width:100%;height:100%;border:none;"></iframe>`;
}

// ====================== INIT ======================
async function init() {
  // Public site viewer
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get('site');
  if (siteId) {
    await loadPublicSite(siteId);
    return;
  }

  // Check session
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      showPage('dashboard');
    } else {
      showPage('landing');
    }

    supabase.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
    });
  } else {
    showPage('landing');
  }

  // Initialize file upload
  initFileUpload();
}

// Start everything
document.addEventListener('DOMContentLoaded', init);

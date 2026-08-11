// ====================== CONFIG ======================
// Paste your Supabase credentials here
const SUPABASE_URL = 'https://mcavvwlaehqxovfybcfm.supabase.co';
const SUPABASE_ANON_KEY = 'mcavvwlaehqxovfybcfm';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====================== STATE ======================
let currentUser = null;
let uploadedFiles = [];
let lastDeployedHTML = '';
let lastDeployedId = '';

// ====================== INIT ======================
async function init() {
  // Check if we are viewing a public site
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get('site');

  if (siteId) {
    await loadPublicSite(siteId);
    return;
  }

  // Check existing session
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    showPage('dashboard');
  } else {
    showPage('landing');
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
  });
}

// ====================== AUTH ======================
async function handleSignup(e) {
  e.preventDefault();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  showLoading('Creating account...');
  const { data, error } = await supabase.auth.signUp({ email, password });
  hideLoading();

  if (error) {
    alert(error.message);
    return;
  }

  alert('Account created! Check your email if confirmation is required, then login.');
  showPage('login');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  showLoading('Logging in...');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  hideLoading();

  if (error) {
    alert(error.message);
    return;
  }

  currentUser = data.user;
  showPage('dashboard');
}

async function handleLogout() {
  await supabase.auth.signOut();
  currentUser = null;
  showPage('landing');
  resetHost();
}

// ====================== UI HELPERS ======================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

function showLoading(text = 'Loading...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

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

// ====================== FILE UPLOAD ======================
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');

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

function handleFiles(files) {
  uploadedFiles = Array.from(files);
  renderFileList();
}

function renderFileList() {
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

function removeFile(index) {
  uploadedFiles.splice(index, 1);
  renderFileList();
}

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

// ====================== DEPLOY / UPDATE ======================
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
    // Load existing content
    loadSiteForEdit(editId);
  } else {
    document.getElementById('code-input').value = '';
    uploadedFiles = [];
    fileList.innerHTML = '';
  }
}

async function loadSiteForEdit(id) {
  showLoading('Loading site...');
  const { data, error } = await supabase
    .from('sites')
    .select('html')
    .eq('id', id)
    .single();

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

async function deploySite() {
  if (!currentUser) {
    alert('Please login first');
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

  if (editingId) {
    // Update
    const { error } = await supabase
      .from('sites')
      .update({ html: finalHTML, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) {
      hideLoading();
      alert('Update failed: ' + error.message);
      return;
    }
  } else {
    // Insert
    const { error } = await supabase
      .from('sites')
      .insert({
        id,
        user_id: currentUser.id,
        html: finalHTML,
        title: 'My Site'
      });

    if (error) {
      hideLoading();
      alert('Deploy failed: ' + error.message);
      return;
    }
  }

  lastDeployedHTML = finalHTML;
  lastDeployedId = id;

  const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
  const liveLink = `${base}?site=${id}`;

  document.getElementById('live-url').textContent = liveLink;
  document.getElementById('live-url').href = liveLink;

  document.getElementById('host-form').classList.add('hidden');
  document.getElementById('success-screen').classList.remove('hidden');
  hideLoading();
}

// ====================== SUCCESS ACTIONS ======================
function openLiveSite() {
  window.open(`?site=${lastDeployedId}`, '_blank');
}

function copyUrl() {
  navigator.clipboard.writeText(document.getElementById('live-url').textContent).then(() => {
    const icon = document.querySelector('.copy-btn i');
    icon.className = 'fas fa-check';
    setTimeout(() => icon.className = 'fas fa-copy', 1400);
  });
}

function downloadHTML() {
  const blob = new Blob([lastDeployedHTML], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'index.html';
  a.click();
}

function editCurrent() {
  showHostForm(lastDeployedId);
}

function resetHost() {
  document.getElementById('success-screen').classList.add('hidden');
  document.getElementById('host-form').classList.add('hidden');
  document.getElementById('my-sites').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('code-input').value = '';
  document.getElementById('editing-id').value = '';
  uploadedFiles = [];
  fileList.innerHTML = '';
  if (fileInput) fileInput.value = '';
}

// ====================== MY SITES ======================
async function showMySites() {
  if (!currentUser) return;

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

async function deleteSite(id) {
  if (!confirm('Delete this site permanently?')) return;

  showLoading('Deleting...');
  await supabase.from('sites').delete().eq('id', id).eq('user_id', currentUser.id);
  hideLoading();
  showMySites();
}

function backToStart() {
  document.getElementById('my-sites').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
}

// ====================== PUBLIC VIEWER ======================
async function loadPublicSite(id) {
  showLoading('Loading site...');

  const { data, error } = await supabase
    .from('sites')
    .select('html')
    .eq('id', id)
    .single();

  hideLoading();

  // Hide all app UI
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('loading').classList.add('hidden');

  if (error || !data) {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                  background:#060b14;color:#e2e8f0;font-family:system-ui;text-align:center;padding:2rem">
        <div>
          <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:#f59e0b;margin-bottom:1rem"></i>
          <h2>Site not found</h2>
          <p style="color:#94a3b8;margin:1rem 0 1.5rem">This link may be invalid or the site was deleted.</p>
          <a href="${window.location.pathname}" style="color:#3b82f6">← Back to sqservices.me</a>
        </div>
      </div>`;
    return;
  }

  // Render the hosted page
  const viewer = document.getElementById('viewer');
  viewer.classList.remove('hidden');
  viewer.innerHTML = `<iframe srcdoc="${data.html.replace(/"/g, '&quot;')}" style="width:100%;height:100%;border:none;"></iframe>`;
}

// ====================== START ======================
init();

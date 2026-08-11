/* ========== STATE ========== */
const state = {
  user: null,
  siteName: '',
  files: {},
  openTabs: [],
  activeTab: null,
  editors: {},
  sourceType: 'upload',
  uploadedFiles: []
};

/* ========== DOM ========== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const views = {
  landing: $('#landing'),
  auth: $('#auth'),
  dashboard: $('#dashboard'),
  setup: $('#setup'),
  loading: $('#loading'),
  ready: $('#ready'),
  editor: $('#editor')
};

/* ========== HELPERS ========== */
function showView(name) {
  Object.values(views).forEach(v => { if (v) v.classList.add('hidden'); });
  if (views[name]) views[name].classList.remove('hidden');
  const live = document.getElementById('live-viewer');
  if (live) live.remove();
}

function toast(msg, duration = 2400) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), duration);
}

function sanitizeName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'my-site';
}

function sanitizeUser(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
}

function getMode(path) {
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.js')) return 'javascript';
  if (path.endsWith('.html') || path.endsWith('.htm')) return 'htmlmixed';
  return 'htmlmixed';
}

function iconFor(path) {
  if (/\.(html|htm)$/i.test(path)) return 'fa-file-code';
  if (path.endsWith('.css')) return 'fa-file-code';
  if (path.endsWith('.js')) return 'fa-file-code';
  if (path.endsWith('.json')) return 'fa-file-code';
  if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(path)) return 'fa-file-image';
  return 'fa-file';
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return 'h' + Math.abs(h).toString(36);
}

/* ========== AUTH ========== */
function getUsers() {
  return JSON.parse(localStorage.getItem('sq_users') || '{}');
}
function saveUsers(users) {
  localStorage.setItem('sq_users', JSON.stringify(users));
}
function getSession() {
  try { return JSON.parse(localStorage.getItem('sq_session') || 'null'); } catch { return null; }
}
function setSession(user) {
  if (user) localStorage.setItem('sq_session', JSON.stringify(user));
  else localStorage.removeItem('sq_session');
  state.user = user;
}
function requireAuth() {
  if (!state.user) {
    showView('auth');
    switchAuthTab('login');
    return false;
  }
  return true;
}

/* ========== PROJECTS ========== */
function userKey() {
  return state.user ? 'sq_projects_' + state.user.username : null;
}
function saveProject() {
  if (!state.user || !state.siteName) return;
  const key = userKey();
  const projects = JSON.parse(localStorage.getItem(key) || '{}');
  projects[state.siteName] = {
    files: { ...state.files },
    owner: state.user.username,
    updated: Date.now()
  };
  localStorage.setItem(key, JSON.stringify(projects));

  const publicIndex = JSON.parse(localStorage.getItem('sq_public') || '{}');
  publicIndex[state.siteName] = { owner: state.user.username, updated: Date.now() };
  localStorage.setItem('sq_public', JSON.stringify(publicIndex));
}
function loadProject(name, username) {
  const projects = JSON.parse(localStorage.getItem('sq_projects_' + username) || '{}');
  return projects[name] || null;
}
function getUserProjects() {
  if (!state.user) return {};
  return JSON.parse(localStorage.getItem(userKey()) || '{}');
}
function getPublicOwner(siteName) {
  const publicIndex = JSON.parse(localStorage.getItem('sq_public') || '{}');
  return publicIndex[siteName]?.owner || null;
}

/* ========== URL ========== */
function getSiteNameFromURL() {
  const path = location.pathname.replace(/^\/+|\/+$/g, '');
  if (path && !path.includes('.') && path !== 'index.html' && path !== '404.html') {
    return sanitizeName(path);
  }
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash && !hash.includes('=')) return sanitizeName(hash);
  const params = new URLSearchParams(location.search);
  if (params.get('site')) return sanitizeName(params.get('site'));
  return null;
}
function buildLiveURL(siteName) {
  return location.origin + '/' + siteName;
}

/* ========== HTML BUILDER ========== */
function buildFullHTML(files) {
  let html = files['index.html'] || files['index.htm'] ||
    '<!DOCTYPE html><html><body><h1>No index.html</h1></body></html>';

  Object.keys(files).forEach(path => {
    if (path.endsWith('.css')) {
      const re = new RegExp('<link[^>]*(href=["\'][^"\']*' + path.replace('.', '\\.') + '[^"\']*["\'])[^>]*>', 'i');
      if (re.test(html)) {
        html = html.replace(re, '<style>/* ' + path + ' */\n' + files[path] + '</style>');
      } else if (path === 'style.css' || path === 'styles.css') {
        html = html.replace('</head>', '<style>/* ' + path + ' */\n' + files[path] + '</style></head>');
      }
    }
  });

  Object.keys(files).forEach(path => {
    if (path.endsWith('.js')) {
      const re = new RegExp('<script[^>]*src=["\'][^"\']*' + path.replace('.', '\\.') + '[^"\']*["\'][^>]*>\\s*<\\/script>', 'i');
      if (re.test(html)) {
        html = html.replace(re, '<script>/* ' + path + ' */\n' + files[path] + '<\\/script>');
      } else if (path === 'script.js' || path === 'app.js') {
        html = html.replace('</body>', '<script>/* ' + path + ' */\n' + files[path] + '<\\/script></body>');
      }
    }
  });
  return html;
}

/* ========== PUBLIC LIVE (pure, no buttons) ========== */
function showLiveSite(siteName) {
  const owner = getPublicOwner(siteName);
  if (!owner) {
    history.replaceState({}, '', '/');
    showView('landing');
    toast('Site not found');
    return;
  }
  const project = loadProject(siteName, owner);
  if (!project) {
    history.replaceState({}, '', '/');
    showView('landing');
    toast('Site not found');
    return;
  }

  Object.values(views).forEach(v => { if (v) v.classList.add('hidden'); });
  const old = document.getElementById('live-viewer');
  if (old) old.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'live-viewer';
  wrapper.innerHTML = '<iframe id="live-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>';
  document.body.appendChild(wrapper);
  document.getElementById('live-frame').srcdoc = buildFullHTML(project.files);
}

/* ========== AUTH UI ========== */
function switchAuthTab(tab) {
  $$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('#login-form').classList.toggle('hidden', tab !== 'login');
  $('#signup-form').classList.toggle('hidden', tab !== 'signup');
}

$$('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
});
$('#switch-to-signup')?.addEventListener('click', e => { e.preventDefault(); switchAuthTab('signup'); });
$('#switch-to-login')?.addEventListener('click', e => { e.preventDefault(); switchAuthTab('login'); });
$('#btn-show-login')?.addEventListener('click', () => { showView('auth'); switchAuthTab('login'); });
$('#btn-show-signup')?.addEventListener('click', () => { showView('auth'); switchAuthTab('signup'); });

$('#btn-get-started')?.addEventListener('click', () => {
  if (state.user) showDashboard();
  else { showView('auth'); switchAuthTab('signup'); }
});

$('#btn-signup')?.addEventListener('click', () => {
  const username = sanitizeUser($('#signup-user').value);
  const pass = $('#signup-pass').value;
  const pass2 = $('#signup-pass2').value;
  if (username.length < 3) return toast('Username must be at least 3 characters');
  if (pass.length < 4) return toast('Password must be at least 4 characters');
  if (pass !== pass2) return toast('Passwords do not match');
  const users = getUsers();
  if (users[username]) return toast('Username already taken');
  users[username] = { pass: simpleHash(pass), created: Date.now() };
  saveUsers(users);
  setSession({ username });
  toast('Account created');
  showDashboard();
});

$('#btn-login')?.addEventListener('click', () => {
  const username = sanitizeUser($('#login-user').value);
  const pass = $('#login-pass').value;
  const users = getUsers();
  if (!users[username] || users[username].pass !== simpleHash(pass)) {
    return toast('Wrong username or password');
  }
  setSession({ username });
  toast('Welcome back');
  showDashboard();
});

$('#btn-logout')?.addEventListener('click', () => {
  setSession(null);
  history.pushState({}, '', '/');
  showView('landing');
  renderRecentSites();
  toast('Logged out');
});

/* ========== DASHBOARD ========== */
function showDashboard() {
  if (!requireAuth()) return;
  showView('dashboard');
  $('#user-badge').textContent = '@' + state.user.username;
  renderSitesList();
}

function renderSitesList() {
  const projects = getUserProjects();
  const names = Object.keys(projects).sort((a, b) => projects[b].updated - projects[a].updated);
  const list = $('#sites-list');
  const empty = $('#no-sites');
  if (names.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = names.map(name => `
    <div class="site-card">
      <div class="site-card-left">
        <div class="site-card-name">${name}</div>
        <div class="site-card-url">sqservices.me/${name}</div>
      </div>
      <div class="site-card-actions">
        <button class="btn btn-ghost btn-sm" data-action="view" data-site="${name}">
          <i class="fas fa-external-link-alt"></i> View
        </button>
        <button class="btn btn-primary btn-sm" data-action="edit" data-site="${name}">
          <i class="fas fa-pen"></i> Edit
        </button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.site;
      if (btn.dataset.action === 'view') {
        history.pushState({ site: name }, '', '/' + name);
        showLiveSite(name);
      } else {
        openSiteInEditor(name);
      }
    });
  });
}

function openSiteInEditor(name) {
  if (!requireAuth()) return;
  const project = loadProject(name, state.user.username);
  if (!project) return toast('Site not found');
  state.siteName = name;
  state.files = project.files;
  openEditor();
}

$('#btn-new-site')?.addEventListener('click', () => {
  if (!requireAuth()) return;
  showView('setup');
  $('#site-name').value = '';
  $('#site-name').focus();
});
$('#btn-new-site-empty')?.addEventListener('click', () => {
  if (!requireAuth()) return;
  showView('setup');
});
$('#btn-back-dash')?.addEventListener('click', showDashboard);
$('#btn-go-dashboard')?.addEventListener('click', showDashboard);
$('#btn-editor-back')?.addEventListener('click', showDashboard);

/* ========== SETUP ========== */
$$('.source-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.source-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.sourceType = btn.dataset.source;
    $('#upload-area').classList.toggle('hidden', state.sourceType !== 'upload');
    $('#paste-area').classList.toggle('hidden', state.sourceType !== 'paste');
    $('#blank-area').classList.toggle('hidden', state.sourceType !== 'blank');
    updateDeployButton();
  });
});
$('#site-name')?.addEventListener('input', updateDeployButton);
$('#paste-html')?.addEventListener('input', updateDeployButton);

function updateDeployButton() {
  const name = sanitizeName($('#site-name')?.value);
  let hasContent = false;
  if (state.sourceType === 'upload') hasContent = state.uploadedFiles.length > 0;
  else if (state.sourceType === 'paste') hasContent = ($('#paste-html')?.value || '').trim().length > 10;
  else hasContent = true;
  const btn = $('#btn-deploy');
  if (btn) btn.disabled = !(name.length > 0 && hasContent);
}

const dropzone = $('#dropzone');
const fileInput = $('#file-input');
const fileInputMulti = $('#file-input-multi');

if (dropzone) {
  dropzone.addEventListener('click', () => fileInputMulti?.click());
  $('#btn-pick-folder')?.addEventListener('click', e => { e.stopPropagation(); fileInput?.click(); });
  $('#btn-pick-files')?.addEventListener('click', e => { e.stopPropagation(); fileInputMulti?.click(); });
  ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
  dropzone.addEventListener('drop', e => {
    if (e.dataTransfer.items) handleDataTransferItems(e.dataTransfer.items);
    else handleFileList(e.dataTransfer.files);
  });
}
fileInput?.addEventListener('change', () => handleFileList(fileInput.files));
fileInputMulti?.addEventListener('change', () => handleFileList(fileInputMulti.files));

async function handleDataTransferItems(items) {
  const files = [];
  const entries = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  for (const entry of entries) await traverseEntry(entry, '', files);
  state.uploadedFiles = files;
  renderFileList();
  updateDeployButton();
}
function traverseEntry(entry, path, files) {
  return new Promise(resolve => {
    if (entry.isFile) entry.file(file => { files.push({ path: path + file.name, file }); resolve(); });
    else if (entry.isDirectory) {
      entry.createReader().readEntries(async entries => {
        for (const e of entries) await traverseEntry(e, path + entry.name + '/', files);
        resolve();
      });
    } else resolve();
  });
}
function handleFileList(fileList) {
  const files = [];
  for (const file of fileList) files.push({ path: file.webkitRelativePath || file.name, file });
  state.uploadedFiles = files;
  renderFileList();
  updateDeployButton();
}
function renderFileList() {
  const list = $('#file-list');
  if (!list) return;
  list.innerHTML = '';
  state.uploadedFiles.slice(0, 30).forEach(({ path }) => {
    const row = document.createElement('div');
    row.className = 'file-item-row';
    row.innerHTML = '<i class="fas ' + iconFor(path) + '"></i> ' + path;
    list.appendChild(row);
  });
}

$('#btn-deploy')?.addEventListener('click', startDeploy);

async function startDeploy() {
  if (!requireAuth()) return;
  state.siteName = sanitizeName($('#site-name').value);
  if (!state.siteName) return;

  const existingOwner = getPublicOwner(state.siteName);
  if (existingOwner && existingOwner !== state.user.username) {
    return toast('This site name is already taken');
  }

  showView('loading');
  const bar = $('#progress-bar');
  const msg = $('#loading-msg');
  const steps = [
    { pct: 20, text: 'Validating files…' },
    { pct: 45, text: 'Building project…' },
    { pct: 70, text: 'Optimizing…' },
    { pct: 90, text: 'Publishing…' },
    { pct: 100, text: 'Done' }
  ];

  state.files = {};
  if (state.sourceType === 'upload') {
    for (const { path, file } of state.uploadedFiles) {
      if (file.type.startsWith('image/') || file.type.startsWith('font/') || file.size > 500000) continue;
      try {
        const text = await file.text();
        let clean = path.replace(/^[^/]+\//, '') || path;
        state.files[clean] = text;
      } catch (e) {}
    }
    if (Object.keys(state.files).length === 0) state.files['index.html'] = blankHTML(state.siteName);
  } else if (state.sourceType === 'paste') {
    state.files['index.html'] = $('#paste-html').value.trim();
  } else {
    state.files['index.html'] = blankHTML(state.siteName);
    state.files['style.css'] = blankCSS();
    state.files['script.js'] = '// Your JavaScript here\nconsole.log("Hello from sqservices.me");\n';
  }

  if (!state.files['index.html'] && !state.files['index.htm']) {
    const firstHtml = Object.keys(state.files).find(k => k.endsWith('.html'));
    if (firstHtml) state.files['index.html'] = state.files[firstHtml];
    else state.files['index.html'] = blankHTML(state.siteName);
  }

  for (const step of steps) {
    if (bar) bar.style.width = step.pct + '%';
    if (msg) msg.textContent = step.text;
    await sleep(450 + Math.random() * 250);
  }
  saveProject();
  showReady();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function blankHTML(name) {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>' + name + '</title>\n  <link rel="stylesheet" href="style.css" />\n</head>\n<body>\n  <h1>Welcome to ' + name + '</h1>\n  <p>Your site is live on sqservices.me</p>\n  <script src="script.js"><\\/script>\n</body>\n</html>';
}
function blankCSS() {
  return '* { margin: 0; padding: 0; box-sizing: border-box; }\nbody {\n  font-family: system-ui, -apple-system, sans-serif;\n  background: #0f172a;\n  color: #e2e8f0;\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  text-align: center;\n  padding: 2rem;\n}\nh1 {\n  font-size: 2.5rem;\n  margin-bottom: 0.75rem;\n  background: linear-gradient(90deg, #60a5fa, #a78bfa);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n}\np { color: #94a3b8; font-size: 1.1rem; }';
}

/* ========== READY ========== */
function showReady() {
  const display = 'sqservices.me/' + state.siteName;
  const url = buildLiveURL(state.siteName);
  $('#live-url').textContent = display;
  $('#live-url').href = url;
  $('#live-url').onclick = e => {
    e.preventDefault();
    history.pushState({ site: state.siteName }, '', '/' + state.siteName);
    showLiveSite(state.siteName);
  };
  showView('ready');
}
$('#btn-copy-url')?.addEventListener('click', () => {
  navigator.clipboard.writeText(buildLiveURL(state.siteName)).then(() => toast('Link copied'));
});
$('#btn-open-editor')?.addEventListener('click', openEditor);
$('#btn-view-site')?.addEventListener('click', () => {
  history.pushState({ site: state.siteName }, '', '/' + state.siteName);
  showLiveSite(state.siteName);
});

/* ========== EDITOR ========== */
function openEditor() {
  if (!requireAuth()) return;
  showView('editor');
  $('#editor-sitename').textContent = state.siteName;
  const url = buildLiveURL(state.siteName);
  $('#editor-url').textContent = 'sqservices.me/' + state.siteName;
  $('#editor-url').href = url;
  $('#editor-url').onclick = e => {
    e.preventDefault();
    history.pushState({ site: state.siteName }, '', '/' + state.siteName);
    showLiveSite(state.siteName);
  };

  state.openTabs = [];
  state.activeTab = null;
  state.editors = {};
  $('#tabs').innerHTML = '';
  $('#editors-container').innerHTML = '';
  renderFileTree();
  const startFile = state.files['index.html'] ? 'index.html' : Object.keys(state.files)[0];
  if (startFile) openFile(startFile);
}

function renderFileTree() {
  const tree = $('#file-tree');
  if (!tree) return;
  tree.innerHTML = '';
  Object.keys(state.files).sort().forEach(path => {
    const item = document.createElement('div');
    item.className = 'tree-item file';
    item.dataset.path = path;
    item.innerHTML = '<i class="fas ' + iconFor(path) + '"></i> ' + path;
    item.addEventListener('click', () => openFile(path));
    tree.appendChild(item);
  });
}

function openFile(path) {
  if (!state.files[path]) return;
  if (!state.openTabs.includes(path)) {
    state.openTabs.push(path);
    createTab(path);
    createEditor(path);
  }
  setActiveTab(path);
}

function createTab(path) {
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.dataset.path = path;
  tab.innerHTML = '<span>' + path + '</span><i class="fas fa-times close"></i>';
  tab.addEventListener('click', e => {
    if (e.target.classList.contains('close')) closeTab(path);
    else setActiveTab(path);
  });
  $('#tabs').appendChild(tab);
}

function createEditor(path) {
  const wrap = document.createElement('div');
  wrap.className = 'editor-instance';
  wrap.dataset.path = path;
  $('#editors-container').appendChild(wrap);
  const cm = CodeMirror(wrap, {
    value: state.files[path] || '',
    mode: getMode(path),
    theme: 'material-darker',
    lineNumbers: true,
    tabSize: 2
  });
  cm.on('change', () => {
    state.files[path] = cm.getValue();
    updatePreviewDebounced();
  });
  state.editors[path] = cm;
}

function setActiveTab(path) {
  state.activeTab = path;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.path === path));
  $$('.tree-item').forEach(t => t.classList.toggle('active', t.dataset.path === path));
  $$('.editor-instance').forEach(e => e.classList.toggle('active', e.dataset.path === path));
  if (state.editors[path]) setTimeout(() => state.editors[path].refresh(), 10);
  updatePreview();
}

function closeTab(path) {
  const idx = state.openTabs.indexOf(path);
  if (idx === -1) return;
  state.openTabs.splice(idx, 1);
  delete state.editors[path];
  $('.tab[data-path="' + path + '"]')?.remove();
  $('.editor-instance[data-path="' + path + '"]')?.remove();
  if (state.activeTab === path) {
    const next = state.openTabs[Math.max(0, idx - 1)] || state.openTabs[0];
    if (next) setActiveTab(next);
    else { state.activeTab = null; updatePreview(); }
  }
}

$('#btn-new-file')?.addEventListener('click', () => {
  const name = prompt('File name (e.g. about.html, style.css):');
  if (!name) return;
  const path = name.trim().replace(/^\/+/, '');
  if (!path) return;
  if (state.files[path]) { toast('File already exists'); openFile(path); return; }
  state.files[path] = path.endsWith('.css') ? '/* new */\n' :
                      path.endsWith('.js') ? '// new\n' :
                      '<!DOCTYPE html>\n<html><head><title>' + path + '</title></head><body><h1>' + path + '</h1></body></html>';
  renderFileTree();
  openFile(path);
  saveProject();
  toast('File created');
});

$('#btn-save')?.addEventListener('click', () => { saveProject(); toast('Saved'); });
$('#btn-publish')?.addEventListener('click', () => { saveProject(); toast('Published → sqservices.me/' + state.siteName); });

let previewTimer = null;
function updatePreviewDebounced() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 400);
}
function updatePreview() {
  const frame = $('#preview-frame');
  if (frame) frame.srcdoc = buildFullHTML(state.files);
}
$('#btn-refresh-preview')?.addEventListener('click', updatePreview);

/* ========== RECENT ========== */
function renderRecentSites() {
  const publicIndex = JSON.parse(localStorage.getItem('sq_public') || '{}');
  const names = Object.keys(publicIndex).sort((a, b) => publicIndex[b].updated - publicIndex[a].updated);
  const container = $('#recent-sites');
  if (!container) return;
  if (names.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = '<p class="muted" style="margin-top:48px;margin-bottom:12px;font-size:0.85rem;">Recently published</p><div class="recent-list">' +
    names.slice(0, 6).map(name =>
      '<a class="recent-item" href="/' + name + '" data-site="' + name + '"><i class="fas fa-globe"></i><span>sqservices.me/' + name + '</span></a>'
    ).join('') + '</div>';
  container.querySelectorAll('.recent-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      history.pushState({ site: el.dataset.site }, '', '/' + el.dataset.site);
      showLiveSite(el.dataset.site);
    });
  });
}

/* ========== BOOT ========== */
window.addEventListener('popstate', () => {
  const name = getSiteNameFromURL();
  if (name) showLiveSite(name);
  else {
    const live = document.getElementById('live-viewer');
    if (live) live.remove();
    if (state.user) showDashboard();
    else { showView('landing'); renderRecentSites(); }
  }
});

(function boot() {
  state.user = getSession();
  const name = getSiteNameFromURL();
  if (name) {
    showLiveSite(name);
  } else if (state.user) {
    showDashboard();
  } else {
    showView('landing');
    renderRecentSites();
  }
})();

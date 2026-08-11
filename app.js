/* ========== STATE ========== */
const state = {
  siteName: '',
  files: {},          // { path: content }
  openTabs: [],
  activeTab: null,
  editors: {},
  sourceType: 'upload',
  uploadedFiles: [],
  mode: 'app'         // 'app' | 'live'
};

/* ========== DOM REFS ========== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const views = {
  landing: $('#landing'),
  setup: $('#setup'),
  loading: $('#loading'),
  ready: $('#ready'),
  editor: $('#editor'),
  live: null            // created dynamically
};

/* ========== HELPERS ========== */
function showView(name) {
  Object.values(views).forEach(v => {
    if (v) v.classList.add('hidden');
  });
  if (views[name]) views[name].classList.remove('hidden');
  // hide live viewer if switching back to app
  const liveEl = document.getElementById('live-viewer');
  if (liveEl && name !== 'live') liveEl.remove();
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
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'my-site';
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

/* ========== URL / ROUTING ========== */
function getSiteNameFromURL() {
  // 1. Pathname: /my-site  or /my-site/
  const path = location.pathname.replace(/^\/+|\/+$/g, '');
  // ignore common static file paths
  if (path && !path.includes('.') && path !== 'index.html' && path !== '404.html') {
    return sanitizeName(path);
  }

  // 2. Hash: #/my-site  or #my-site
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash && !hash.includes('=')) {
    return sanitizeName(hash);
  }

  // 3. Query: ?site=my-site
  const params = new URLSearchParams(location.search);
  if (params.get('site')) {
    return sanitizeName(params.get('site'));
  }

  return null;
}

function buildLiveURL(siteName) {
  // Prefer clean path. Works with 404.html fallback on most static hosts.
  const origin = location.origin;
  const base = location.pathname.endsWith('/') 
    ? location.pathname 
    : location.pathname.replace(/\/[^/]*$/, '/');

  // If we are already on a clean path host, use path
  // Always generate clean looking URL
  return `${origin}/${siteName}`;
}

function navigateToLive(siteName) {
  // Update the browser URL without reload so the link becomes real
  const url = `/${siteName}`;
  history.pushState({ site: siteName }, '', url);
  showLiveSite(siteName);
}

/* ========== STORAGE ========== */
function saveProject() {
  if (!state.siteName) return;
  const projects = JSON.parse(localStorage.getItem('sq_projects') || '{}');
  projects[state.siteName] = {
    files: { ...state.files },
    updated: Date.now()
  };
  localStorage.setItem('sq_projects', JSON.stringify(projects));
}

function loadProject(name) {
  const projects = JSON.parse(localStorage.getItem('sq_projects') || '{}');
  return projects[name] || null;
}

function getAllProjects() {
  return JSON.parse(localStorage.getItem('sq_projects') || '{}');
}

/* ========== BUILD HTML FOR PREVIEW / LIVE ========== */
function buildFullHTML(files) {
  let html = files['index.html'] || files['index.htm'] || 
    '<!DOCTYPE html><html><body><h1>No index.html</h1></body></html>';

  // Inline CSS
  Object.keys(files).forEach(path => {
    if (path.endsWith('.css')) {
      const re = new RegExp(`<link[^>]*(href=["'][^"']*${path.replace('.', '\\.')}[^"']*["'])[^>]*>`, 'i');
      if (re.test(html)) {
        html = html.replace(re, `<style>/* ${path} */\n${files[path]}</style>`);
      } else if (path === 'style.css' || path === 'styles.css') {
        // inject before </head>
        html = html.replace('</head>', `<style>/* ${path} */\n${files[path]}</style></head>`);
      }
    }
  });

  // Inline JS
  Object.keys(files).forEach(path => {
    if (path.endsWith('.js')) {
      const re = new RegExp(`<script[^>]*src=["'][^"']*${path.replace('.', '\\.')}[^"']*["'][^>]*>\\s*<\\/script>`, 'i');
      if (re.test(html)) {
        html = html.replace(re, `<script>/* ${path} */\n${files[path]}<\/script>`);
      } else if (path === 'script.js' || path === 'app.js') {
        html = html.replace('</body>', `<script>/* ${path} */\n${files[path]}<\/script></body>`);
      }
    }
  });

  return html;
}

/* ========== LIVE SITE VIEWER ========== */
function showLiveSite(siteName) {
  const project = loadProject(siteName);
  if (!project) {
    // Site not found → go home
    history.replaceState({}, '', '/');
    showView('landing');
    toast('Site not found: ' + siteName);
    return;
  }

  state.siteName = siteName;
  state.files = project.files;
  state.mode = 'live';

  // Hide all app views
  Object.values(views).forEach(v => { if (v) v.classList.add('hidden'); });

  // Remove old live viewer if any
  const old = document.getElementById('live-viewer');
  if (old) old.remove();

  const html = buildFullHTML(project.files);

  // Create a full-page iframe that looks like a real site
  const wrapper = document.createElement('div');
  wrapper.id = 'live-viewer';
  wrapper.innerHTML = `
    <div class="live-bar">
      <div class="live-bar-left">
        <i class="fas fa-globe"></i>
        <span>sqservices.me/${siteName}</span>
      </div>
      <div class="live-bar-right">
        <button class="btn btn-ghost btn-sm" id="btn-edit-live">
          <i class="fas fa-pen"></i> Edit
        </button>
        <button class="btn btn-ghost btn-sm" id="btn-back-home">
          <i class="fas fa-home"></i> Home
        </button>
      </div>
    </div>
    <iframe id="live-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
  `;
  document.body.appendChild(wrapper);

  const frame = document.getElementById('live-frame');
  frame.srcdoc = html;

  document.getElementById('btn-edit-live').onclick = () => {
    document.getElementById('live-viewer').remove();
    history.pushState({}, '', '/');
    openEditor();
  };

  document.getElementById('btn-back-home').onclick = () => {
    document.getElementById('live-viewer').remove();
    history.pushState({}, '', '/');
    showView('landing');
    renderRecentSites();
  };
}

/* ========== LANDING ========== */
function renderRecentSites() {
  const projects = getAllProjects();
  const names = Object.keys(projects).sort((a, b) => projects[b].updated - projects[a].updated);
  let container = document.getElementById('recent-sites');
  if (!container) {
    // inject into landing
    const hero = document.querySelector('.hero');
    if (!hero) return;
    container = document.createElement('div');
    container.id = 'recent-sites';
    container.className = 'recent-sites';
    hero.appendChild(container);
  }

  if (names.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <p class="muted" style="margin-top:48px;margin-bottom:12px;font-size:0.85rem;">Your sites</p>
    <div class="recent-list">
      ${names.slice(0, 8).map(name => `
        <a class="recent-item" href="/${name}" data-site="${name}">
          <i class="fas fa-globe"></i>
          <span>sqservices.me/${name}</span>
        </a>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.recent-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const name = el.dataset.site;
      navigateToLive(name);
    });
  });
}

$('#btn-get-started').addEventListener('click', () => {
  showView('setup');
  $('#site-name').focus();
});

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

$('#site-name').addEventListener('input', updateDeployButton);

function updateDeployButton() {
  const name = sanitizeName($('#site-name').value);
  const hasName = name.length > 0;
  let hasContent = false;

  if (state.sourceType === 'upload') {
    hasContent = state.uploadedFiles.length > 0;
  } else if (state.sourceType === 'paste') {
    hasContent = $('#paste-html').value.trim().length > 10;
  } else {
    hasContent = true;
  }

  $('#btn-deploy').disabled = !(hasName && hasContent);
}

$('#paste-html').addEventListener('input', updateDeployButton);

/* File upload */
const dropzone = $('#dropzone');
const fileInput = $('#file-input');
const fileInputMulti = $('#file-input-multi');

dropzone.addEventListener('click', () => fileInputMulti.click());
$('#btn-pick-folder').addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});
$('#btn-pick-files').addEventListener('click', (e) => {
  e.stopPropagation();
  fileInputMulti.click();
});

['dragenter', 'dragover'].forEach(ev => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(ev => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const items = e.dataTransfer.items;
  if (items) {
    handleDataTransferItems(items);
  } else {
    handleFileList(e.dataTransfer.files);
  }
});

fileInput.addEventListener('change', () => handleFileList(fileInput.files));
fileInputMulti.addEventListener('change', () => handleFileList(fileInputMulti.files));

async function handleDataTransferItems(items) {
  const files = [];
  const entries = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (entries.length) {
    for (const entry of entries) {
      await traverseEntry(entry, '', files);
    }
    state.uploadedFiles = files;
    renderFileList();
    updateDeployButton();
  }
}

function traverseEntry(entry, path, files) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(file => {
        files.push({ path: path + file.name, file });
        resolve();
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      reader.readEntries(async (entries) => {
        for (const e of entries) {
          await traverseEntry(e, path + entry.name + '/', files);
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function handleFileList(fileList) {
  const files = [];
  for (const file of fileList) {
    const path = file.webkitRelativePath || file.name;
    files.push({ path, file });
  }
  state.uploadedFiles = files;
  renderFileList();
  updateDeployButton();
}

function renderFileList() {
  const list = $('#file-list');
  list.innerHTML = '';
  state.uploadedFiles.slice(0, 30).forEach(({ path }) => {
    const row = document.createElement('div');
    row.className = 'file-item-row';
    row.innerHTML = `<i class="fas ${iconFor(path)}"></i> ${path}`;
    list.appendChild(row);
  });
  if (state.uploadedFiles.length > 30) {
    const more = document.createElement('div');
    more.className = 'file-item-row muted';
    more.textContent = `… and ${state.uploadedFiles.length - 30} more`;
    list.appendChild(more);
  }
}

/* Deploy */
$('#btn-deploy').addEventListener('click', startDeploy);

async function startDeploy() {
  state.siteName = sanitizeName($('#site-name').value);
  if (!state.siteName) return;

  showView('loading');
  const bar = $('#progress-bar');
  const msg = $('#loading-msg');

  const steps = [
    { pct: 15, text: 'Validating files…' },
    { pct: 40, text: 'Building project…' },
    { pct: 70, text: 'Optimizing assets…' },
    { pct: 90, text: 'Publishing to edge…' },
    { pct: 100, text: 'Almost done…' }
  ];

  state.files = {};

  if (state.sourceType === 'upload') {
    for (const { path, file } of state.uploadedFiles) {
      if (file.type.startsWith('image/') || file.type.startsWith('font/') || file.size > 500000) {
        continue;
      }
      try {
        const text = await file.text();
        let clean = path.replace(/^[^/]+\//, '') || path;
        state.files[clean] = text;
      } catch (e) {}
    }
    if (Object.keys(state.files).length === 0) {
      state.files['index.html'] = blankHTML(state.siteName);
    }
  } else if (state.sourceType === 'paste') {
    state.files['index.html'] = $('#paste-html').value.trim();
  } else {
    state.files['index.html'] = blankHTML(state.siteName);
    state.files['style.css'] = blankCSS();
    state.files['script.js'] = '// Your JavaScript here\nconsole.log("Hello from sqservices.me");\n';
  }

  if (!state.files['index.html'] && !state.files['index.htm']) {
    const firstHtml = Object.keys(state.files).find(k => k.endsWith('.html'));
    if (firstHtml) {
      state.files['index.html'] = state.files[firstHtml];
    } else {
      state.files['index.html'] = blankHTML(state.siteName);
    }
  }

  for (const step of steps) {
    bar.style.width = step.pct + '%';
    msg.textContent = step.text;
    await sleep(500 + Math.random() * 300);
  }

  saveProject();
  showReady();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function blankHTML(name) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1>Welcome to ${name}</h1>
  <p>Your site is live on sqservices.me</p>
  <script src="script.js"><\/script>
</body>
</html>`;
}

function blankCSS() {
  return `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

p {
  color: #94a3b8;
  font-size: 1.1rem;
}`;
}

/* ========== READY ========== */
function showReady() {
  const url = buildLiveURL(state.siteName);
  const display = `sqservices.me/${state.siteName}`;

  $('#live-url').textContent = display;
  $('#live-url').href = url;
  $('#live-url').onclick = (e) => {
    e.preventDefault();
    navigateToLive(state.siteName);
  };

  showView('ready');
}

$('#btn-copy-url').addEventListener('click', () => {
  const url = buildLiveURL(state.siteName);
  navigator.clipboard.writeText(url).then(() => toast('Link copied!'));
});

$('#btn-open-editor').addEventListener('click', () => {
  history.pushState({}, '', '/');
  openEditor();
});

$('#btn-view-site').addEventListener('click', () => {
  navigateToLive(state.siteName);
});

/* ========== EDITOR ========== */
function openEditor() {
  showView('editor');
  $('#editor-sitename').textContent = state.siteName;
  const liveUrl = buildLiveURL(state.siteName);
  $('#editor-url').textContent = `sqservices.me/${state.siteName}`;
  $('#editor-url').href = liveUrl;
  $('#editor-url').onclick = (e) => {
    e.preventDefault();
    navigateToLive(state.siteName);
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
  tree.innerHTML = '';
  const paths = Object.keys(state.files).sort();

  paths.forEach(path => {
    const item = document.createElement('div');
    item.className = 'tree-item file';
    item.dataset.path = path;
    item.innerHTML = `<i class="fas ${iconFor(path)}"></i> ${path}`;
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
  tab.innerHTML = `
    <span>${path}</span>
    <i class="fas fa-times close"></i>
  `;
  tab.addEventListener('click', (e) => {
    if (e.target.classList.contains('close')) {
      closeTab(path);
    } else {
      setActiveTab(path);
    }
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
    lineWrapping: false,
    tabSize: 2,
    indentWithTabs: false,
    autofocus: false
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

  if (state.editors[path]) {
    setTimeout(() => state.editors[path].refresh(), 10);
  }

  updatePreview();
}

function closeTab(path) {
  const idx = state.openTabs.indexOf(path);
  if (idx === -1) return;

  state.openTabs.splice(idx, 1);
  delete state.editors[path];

  const tabEl = $(`.tab[data-path="${path}"]`);
  if (tabEl) tabEl.remove();
  const edEl = $(`.editor-instance[data-path="${path}"]`);
  if (edEl) edEl.remove();

  if (state.activeTab === path) {
    const next = state.openTabs[Math.max(0, idx - 1)] || state.openTabs[0];
    if (next) setActiveTab(next);
    else {
      state.activeTab = null;
      updatePreview();
    }
  }
}

/* New file */
$('#btn-new-file').addEventListener('click', () => {
  const name = prompt('File name (e.g. about.html, style.css, app.js):');
  if (!name) return;
  const path = name.trim().replace(/^\/+/, '');
  if (!path) return;
  if (state.files[path]) {
    toast('File already exists');
    openFile(path);
    return;
  }
  state.files[path] = path.endsWith('.css') ? '/* new stylesheet */\n' :
                      path.endsWith('.js') ? '// new script\n' :
                      `<!DOCTYPE html>\n<html>\n<head><title>${path}</title></head>\n<body>\n  <h1>${path}</h1>\n</body>\n</html>`;
  renderFileTree();
  openFile(path);
  saveProject();
  toast('File created');
});

/* Save */
$('#btn-save').addEventListener('click', () => {
  saveProject();
  toast('Project saved');
});

/* Publish */
$('#btn-publish').addEventListener('click', () => {
  saveProject();
  toast('Published → sqservices.me/' + state.siteName);
});

/* Preview */
let previewTimer = null;
function updatePreviewDebounced() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 400);
}

function updatePreview() {
  const frame = $('#preview-frame');
  if (!frame) return;
  frame.srcdoc = buildFullHTML(state.files);
}

$('#btn-refresh-preview').addEventListener('click', updatePreview);

/* ========== BOOT + HISTORY ========== */
window.addEventListener('popstate', () => {
  const name = getSiteNameFromURL();
  if (name) {
    showLiveSite(name);
  } else {
    const live = document.getElementById('live-viewer');
    if (live) live.remove();
    showView('landing');
    renderRecentSites();
  }
});

// Initial load
(function boot() {
  const name = getSiteNameFromURL();
  if (name) {
    showLiveSite(name);
  } else {
    showView('landing');
    renderRecentSites();
  }
})();

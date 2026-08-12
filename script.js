/* ===== UTILITIES ===== */
function generateId() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('sq_user')) || null;
  } catch {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem('sq_user', JSON.stringify(user));
}

function requireAuth() {
  const user = getUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

function logout() {
  localStorage.removeItem('sq_user');
  window.location.href = 'index.html';
}

function getSites() {
  try {
    return JSON.parse(localStorage.getItem('sq_sites')) || [];
  } catch {
    return [];
  }
}

function saveSites(sites) {
  localStorage.setItem('sq_sites', JSON.stringify(sites));
}

function getSiteById(id) {
  return getSites().find(s => s.id === id) || null;
}

/* ===== AUTH ===== */
function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const errorEl = document.getElementById('error');
  if (!name || !email || !password) {
    errorEl.textContent = 'Please fill in all fields.';
    errorEl.style.display = 'block';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters.';
    errorEl.style.display = 'block';
    return;
  }

  setUser({ name, email });
  window.location.href = 'dashboard.html';
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const errorEl = document.getElementById('error');
  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password.';
    errorEl.style.display = 'block';
    return;
  }

  // Demo: accept any credentials and create a session
  const existing = getUser();
  if (existing && existing.email === email) {
    window.location.href = 'dashboard.html';
    return;
  }

  // Create a new demo user
  setUser({ name: email.split('@')[0], email });
  window.location.href = 'dashboard.html';
}

/* ===== DASHBOARD ===== */
function initDashboard() {
  const user = requireAuth();
  if (!user) return;

  const avatar = document.getElementById('avatar');
  const username = document.getElementById('username');
  if (avatar) avatar.textContent = (user.name || 'U').charAt(0).toUpperCase();
  if (username) username.textContent = user.name || user.email;

  renderSitesList();
}

function renderSitesList() {
  const list = document.getElementById('sites-list');
  if (!list) return;

  const sites = getSites();
  if (sites.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:0.95rem;">No sites yet. Start hosting to create your first one.</p>';
    return;
  }

  list.innerHTML = sites.map(site => `
    <div class="site-item">
      <div class="site-info">
        <h4>${escapeHtml(site.name)}</h4>
        <a href="view.html?id=${site.id}" target="_blank">${site.url}</a>
      </div>
      <div class="site-actions">
        <button class="icon-btn" title="Edit" onclick="editSite('${site.id}')">
          <i class="fas fa-pen"></i>
        </button>
        <button class="icon-btn" title="Open" onclick="window.open('view.html?id=${site.id}', '_blank')">
          <i class="fas fa-external-link-alt"></i>
        </button>
        <button class="icon-btn danger" title="Delete" onclick="deleteSite('${site.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function deleteSite(id) {
  if (!confirm('Delete this site permanently?')) return;
  const sites = getSites().filter(s => s.id !== id);
  saveSites(sites);
  renderSitesList();
}

function editSite(id) {
  window.location.href = `editor.html?id=${id}`;
}

/* ===== EDITOR ===== */
function initEditor() {
  const user = requireAuth();
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const editId = params.get('id');

  if (editId) {
    const site = getSiteById(editId);
    if (site) {
      document.getElementById('site-name').value = site.name;
      document.getElementById('code').value = site.code;
      document.getElementById('editor-title').textContent = 'Edit Site';
      document.getElementById('deploy-btn').innerHTML = '<i class="fas fa-save"></i> Update Site';
      window._editId = editId;
    }
  }

  // File drop
  const drop = document.getElementById('file-drop');
  const fileInput = document.getElementById('file-input');

  if (drop && fileInput) {
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', e => {
      e.preventDefault();
      drop.classList.add('dragover');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', e => handleFiles(e.target.files));
  }
}

function handleFiles(files) {
  if (!files || !files.length) return;
  const file = files[0];
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('code').value = e.target.result;
  };
  reader.readAsText(file);
}

function deploySite() {
  const name = document.getElementById('site-name').value.trim();
  const code = document.getElementById('code').value;

  if (!name) {
    alert('Please enter a site name.');
    return;
  }
  if (!code.trim()) {
    alert('Please add some code.');
    return;
  }

  // Show loading
  const overlay = document.getElementById('overlay');
  const content = document.getElementById('overlay-content');
  overlay.classList.add('active');
  content.innerHTML = `
    <div class="spinner"></div>
    <h2>Deploying your site...</h2>
    <p>Setting up subdomain & SSL</p>
  `;

  // Simulate deploy
  setTimeout(() => {
    const id = window._editId || generateId();
    const subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '') + id;
    const url = `https://${subdomain}.sqservices.me`;

    const sites = getSites();
    const existingIdx = sites.findIndex(s => s.id === id);

    const siteData = {
      id,
      name,
      code,
      url,
      createdAt: existingIdx >= 0 ? sites[existingIdx].createdAt : Date.now(),
      updatedAt: Date.now()
    };

    if (existingIdx >= 0) {
      sites[existingIdx] = siteData;
    } else {
      sites.unshift(siteData);
    }
    saveSites(sites);

    // Success
    content.innerHTML = `
      <div class="checkmark"><i class="fas fa-check"></i></div>
      <h2>Site is live!</h2>
      <p>Your website is ready and shareable with anyone.</p>
      <div class="url-box">
        <span id="live-url">${url}</span>
        <button onclick="copyUrl()" title="Copy"><i class="fas fa-copy"></i></button>
      </div>
      <div class="overlay-actions">
        <a href="view.html?id=${id}" target="_blank" class="btn-primary">
          <i class="fas fa-external-link-alt"></i> Open Site
        </a>
        <a href="dashboard.html" class="btn-ghost">
          <i class="fas fa-th-large"></i> Dashboard
        </a>
        <button class="btn-ghost" onclick="closeOverlay()">
          <i class="fas fa-pen"></i> Keep Editing
        </button>
      </div>
    `;
  }, 2200);
}

function copyUrl() {
  const url = document.getElementById('live-url')?.textContent;
  if (url) {
    navigator.clipboard.writeText(url).then(() => {
      alert('URL copied to clipboard!');
    });
  }
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('active');
}

/* ===== VIEW PAGE ===== */
function initView() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#9a9ab0;font-family:system-ui;">Site not found.</div>';
    return;
  }

  const site = getSiteById(id);
  if (!site) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#9a9ab0;font-family:system-ui;">This site does not exist or has been deleted.</div>';
    return;
  }

  // Render the user's HTML
  document.open();
  document.write(site.code);
  document.close();
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;

  if (path.includes('dashboard')) {
    initDashboard();
  } else if (path.includes('editor')) {
    initEditor();
  } else if (path.includes('view')) {
    initView();
  }
});

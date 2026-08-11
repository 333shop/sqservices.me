// Simple page switcher
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

function handleAuth(e, target) {
  e.preventDefault();
  // Fake auth – just go to dashboard
  showPage(target);
}

function logout() {
  showPage('landing');
  resetHost();
}

// Hosting flow
function showHostForm() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('host-form').classList.remove('hidden');
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

  if (tab === 'paste') {
    document.querySelector('.tab:nth-child(1)').classList.add('active');
    document.getElementById('paste-tab').classList.remove('hidden');
  } else {
    document.querySelector('.tab:nth-child(2)').classList.add('active');
    document.getElementById('upload-tab').classList.remove('hidden');
  }
}

// File upload handling
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
let uploadedFiles = [];

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

function handleFiles(files) {
  uploadedFiles = Array.from(files);
  fileList.innerHTML = '';
  uploadedFiles.forEach(f => {
    const li = document.createElement('li');
    li.innerHTML = `<i class="fas fa-file-code"></i> ${f.name}`;
    fileList.appendChild(li);
  });
}

// Generate random code
function generateCode(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function deploySite() {
  const code = document.getElementById('code-input').value.trim();
  const hasFiles = uploadedFiles.length > 0;

  if (!code && !hasFiles) {
    alert('Please paste some code or upload files first.');
    return;
  }

  // Simulate hosting delay
  const btn = document.querySelector('#host-form .btn-primary');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Hosting...';
  btn.disabled = true;

  setTimeout(() => {
    const randomCode = generateCode();
    const liveUrl = `https://sqservices.me/${randomCode}`;

    document.getElementById('live-url').textContent = liveUrl;
    document.getElementById('live-url').href = liveUrl;

    // For demo: if user pasted HTML, open it in a new tab as a data URL
    if (code) {
      const blob = new Blob([code], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      document.getElementById('live-url').href = blobUrl;
    }

    document.getElementById('host-form').classList.add('hidden');
    document.getElementById('success-screen').classList.remove('hidden');

    btn.innerHTML = originalText;
    btn.disabled = false;
  }, 1400);
}

function copyUrl() {
  const url = document.getElementById('live-url').textContent;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.querySelector('.copy-btn');
    btn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-copy"></i>';
    }, 1500);
  });
}

function resetHost() {
  document.getElementById('success-screen').classList.add('hidden');
  document.getElementById('host-form').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('code-input').value = '';
  fileList.innerHTML = '';
  uploadedFiles = [];
  fileInput.value = '';
}

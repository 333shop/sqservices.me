(() => {
  const titleEl = document.getElementById('ticket-title');
  const idEl = document.getElementById('ticket-id');
  const bodyEl = document.getElementById('ticket-body');

  function showError(msg) {
    titleEl.textContent = 'Ticket Error';
    idEl.textContent = '';
    bodyEl.innerHTML = `<p class="hint">${msg}</p>`;
  }

  // Get the data from the URL
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('d');

  if (!encoded) {
    showError('No ticket data found in the link.');
    return;
  }

  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const data = JSON.parse(json);

    titleEl.textContent = data.subject || 'Support Ticket';
    idEl.textContent = `#${data.id} • ${data.username}`;

    bodyEl.innerHTML = `
      <div class="field">
        <div class="field-label">User</div>
        <div class="field-value">${escapeHtml(data.username)}</div>
      </div>
      <div class="field">
        <div class="field-label">Subject</div>
        <div class="field-value">${escapeHtml(data.subject)}</div>
      </div>
      <div class="field">
        <div class="field-label">Description</div>
        <div class="field-value">${escapeHtml(data.description)}</div>
      </div>
      <div class="field">
        <div class="field-label">Created</div>
        <div class="field-value">${new Date(data.created).toLocaleString()}</div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    showError('This ticket link is invalid or broken.');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Pixel Cat
  const canvas = document.getElementById('pixel-cat');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const SCALE = 4;
    let catX = 30, direction = 1, frame = 0, frameTimer = 0;

    const colors = {
      body: '#e8c070', dark: '#c49a4a', outline: '#5c4030',
      eye: '#2a1a10', nose: '#d06060', white: '#f5e6c8',
    };

    function px(x, y, w, h, c) {
      ctx.fillStyle = c;
      ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
    }

    function drawCat(facingRight, walkFrame) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      if (!facingRight) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      px(3, 4, 9, 5, colors.body);
      px(2, 5, 1, 3, colors.dark);
      px(11, 5, 1, 3, colors.dark);
      px(10, 2, 5, 5, colors.body);
      px(11, 3, 2, 2, colors.white);
      px(13, 4, 1, 1, colors.nose);
      px(12, 3, 1, 1, colors.eye);
      px(10, 1, 2, 2, colors.body);
      px(13, 1, 2, 2, colors.body);
      px(10, 1, 1, 1, colors.outline);
      px(14, 1, 1, 1, colors.outline);
      px(1, 3, 2, 2, colors.body);
      px(0, 2, 2, 2, colors.dark);

      const leg = walkFrame % 2 === 0 ? 0 : 1;
      px(9, 9, 2, 2, colors.body); px(9, 11, 2, 1, colors.outline);
      px(11 + leg, 9, 2, 2, colors.dark); px(11 + leg, 11, 2, 1, colors.outline);
      px(3, 9, 2, 2, colors.body); px(3, 11, 2, 1, colors.outline);
      px(5 - leg, 9, 2, 2, colors.dark); px(5 - leg, 11, 2, 1, colors.outline);

      ctx.restore();
    }

    function animate() {
      catX += 0.85 * direction;
      const maxX = window.innerWidth - 80;
      if (catX > maxX) { catX = maxX; direction = -1; }
      if (catX < 20)  { catX = 20; direction = 1; }
      canvas.style.left = catX + 'px';
      frameTimer++;
      if (frameTimer >= 8) { frameTimer = 0; frame = (frame + 1) % 4; }
      drawCat(direction === 1, frame);
      requestAnimationFrame(animate);
    }

    drawCat(true, 0);
    requestAnimationFrame(animate);
  }
})();

(() => {
  const form = document.getElementById('ticket-form');
  const submitBtn = document.getElementById('submit-btn');
  const viewHome = document.getElementById('view-home');
  const viewSuccess = document.getElementById('view-success');
  const ticketNumberEl = document.getElementById('ticket-number');
  const ticketLinkEl = document.getElementById('ticket-link');
  const openTicketBtn = document.getElementById('open-ticket-btn');
  const copyBtn = document.getElementById('copy-btn');
  const toastEl = document.getElementById('toast');

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  function generateId() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function encodeTicket(data) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const description = document.getElementById('description').value.trim();

    if (!username || !subject || !description) return;

    if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes('YOUR_WEBHOOK')) {
      toast('Please set your Discord webhook in config.js');
      return;
    }

    const ticketId = generateId();
    const ticketData = {
      id: ticketId,
      username,
      subject,
      description,
      created: new Date().toISOString()
    };

    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Sending...';

    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '🎫 New Support Ticket',
            color: 0x4a6cf7,
            fields: [
              { name: 'Ticket ID', value: `#${ticketId}`, inline: true },
              { name: 'User', value: username, inline: true },
              { name: 'Subject', value: subject },
              { name: 'Description', value: description.slice(0, 1000) },
              {
                name: 'Open Ticket Link',
                value: `[Click to view ticket](${window.location.origin}${window.location.pathname.replace('index.html', '')}ticket.html?d=${encodeTicket(ticketData)})`
              }
            ],
            footer: { text: SITE_NAME || 'Support Portal' },
            timestamp: new Date().toISOString()
          }]
        })
      });

      const link = `ticket.html?d=${encodeTicket(ticketData)}`;

      ticketNumberEl.textContent = ticketId;
      ticketLinkEl.textContent = window.location.href.replace(/index\.html.*/, '') + link;
      ticketLinkEl.href = link;
      openTicketBtn.onclick = () => window.location.href = link;

      viewHome.classList.remove('active');
      viewSuccess.classList.add('active');

    } catch (err) {
      console.error(err);
      toast('Failed to send ticket. Check your webhook URL.');
      submitBtn.disabled = false;
      submitBtn.querySelector('span').textContent = 'Create Ticket';
    }
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(ticketLinkEl.textContent).then(() => {
      toast('Link copied!');
    });
  });

  // Pixel Cat
  const canvas = document.getElementById('pixel-cat');
  const ctx = canvas.getContext('2d');
  const SCALE = 4;

  let catX = 30;
  let direction = 1;
  let frame = 0;
  let frameTimer = 0;

  const colors = {
    body: '#e8c070',
    dark: '#c49a4a',
    outline: '#5c4030',
    eye: '#2a1a10',
    nose: '#d06060',
    white: '#f5e6c8',
  };

  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
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
    px(9, 9, 2, 2, colors.body);
    px(9, 11, 2, 1, colors.outline);
    px(11 + leg, 9, 2, 2, colors.dark);
    px(11 + leg, 11, 2, 1, colors.outline);
    px(3, 9, 2, 2, colors.body);
    px(3, 11, 2, 1, colors.outline);
    px(5 - leg, 9, 2, 2, colors.dark);
    px(5 - leg, 11, 2, 1, colors.outline);

    ctx.restore();
  }

  function animate() {
    catX += 0.85 * direction;
    const maxX = window.innerWidth - 80;
    if (catX > maxX) { catX = maxX; direction = -1; }
    if (catX < 20)  { catX = 20;  direction = 1; }

    canvas.style.left = catX + 'px';

    frameTimer++;
    if (frameTimer >= 8) {
      frameTimer = 0;
      frame = (frame + 1) % 4;
    }

    drawCat(direction === 1, frame);
    requestAnimationFrame(animate);
  }

  drawCat(true, 0);
  requestAnimationFrame(animate);
})();

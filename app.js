/* ============================================================
   Ticket Portal Frontend
   Handles views, pixel cat animation, and Socket.io chat
   ============================================================ */

(() => {
  // ---------- DOM refs ----------
  const views = {
    auth: document.getElementById('view-auth'),
    create: document.getElementById('view-create'),
    chat: document.getElementById('view-chat'),
  };

  const authForm = document.getElementById('auth-form');
  const ticketForm = document.getElementById('ticket-form');
  const messageForm = document.getElementById('message-form');
  const messagesEl = document.getElementById('messages');
  const messageInput = document.getElementById('message-input');
  const ticketTitle = document.getElementById('ticket-title');
  const ticketIdEl = document.getElementById('ticket-id');
  const toastEl = document.getElementById('toast');
  const canvas = document.getElementById('pixel-cat');
  const ctx = canvas.getContext('2d');

  // ---------- State ----------
  let username = localStorage.getItem('ticket_username') || '';
  let email = localStorage.getItem('ticket_email') || '';
  let currentTicketId = null;
  let socket = null;

  // ---------- View switching ----------
  function showView(name) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[name].classList.add('active');
  }

  function toast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('error', isError);
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  // ---------- Auth ----------
  if (username) {
    showView('create');
  } else {
    showView('auth');
  }

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('username').value.trim();
    const mail = document.getElementById('email').value.trim();
    if (name.length < 2) return;

    username = name;
    email = mail;
    localStorage.setItem('ticket_username', username);
    localStorage.setItem('ticket_email', email);
    showView('create');
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('ticket_username');
    localStorage.removeItem('ticket_email');
    username = '';
    email = '';
    showView('auth');
  });

  // ---------- Ticket creation ----------
  ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = document.getElementById('subject').value.trim();
    const description = document.getElementById('description').value.trim();
    if (!subject || !description) return;

    const btn = document.getElementById('create-btn');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Creating...';

    try {
      // Connect socket if not already
      if (!socket) connectSocket();

      socket.emit('create_ticket', {
        username,
        email,
        subject,
        description,
      });
    } catch (err) {
      toast('Failed to create ticket. Is the server running?', true);
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Open Ticket';
    }
  });

  // ---------- Socket.io ----------
  function connectSocket() {
    socket = io({
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[socket] connected');
    });

    socket.on('disconnect', () => {
      toast('Disconnected from server', true);
    });

    socket.on('ticket_created', (data) => {
      currentTicketId = data.ticketId;
      ticketTitle.textContent = data.subject;
      ticketIdEl.textContent = `ID: ${data.ticketId}`;
      showView('chat');
      messagesEl.innerHTML = '';
      addSystemMessage('Ticket created. Staff will be with you shortly :)');
      addSystemMessage('Messages are synced live with Discord.');

      // re-enable create button in case user returns
      const btn = document.getElementById('create-btn');
      if (btn) {
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Open Ticket';
      }
    });

    socket.on('ticket_error', (data) => {
      toast(data.message || 'Could not create ticket', true);
      const btn = document.getElementById('create-btn');
      if (btn) {
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Open Ticket';
      }
    });

    socket.on('message', (data) => {
      addMessage(data);
    });

    socket.on('ticket_closed', () => {
      addSystemMessage('This ticket has been closed by staff.');
      messageInput.disabled = true;
      toast('Ticket closed');
    });
  }

  // ---------- Chat UI ----------
  function addMessage({ from, author, content, timestamp }) {
    const div = document.createElement('div');
    div.className = `msg ${from}`;

    if (from !== 'system') {
      const authorEl = document.createElement('span');
      authorEl.className = 'author';
      authorEl.textContent = author || (from === 'user' ? username : 'Staff');
      div.appendChild(authorEl);
    }

    const text = document.createTextNode(content);
    div.appendChild(text);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addSystemMessage(text) {
    addMessage({ from: 'system', content: text });
  }

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content || !currentTicketId || !socket) return;

    socket.emit('send_message', {
      ticketId: currentTicketId,
      content,
    });

    // Optimistic UI
    addMessage({
      from: 'user',
      author: username,
      content,
    });

    messageInput.value = '';
    messageInput.focus();
  });

  document.getElementById('close-ticket-btn').addEventListener('click', () => {
    if (!currentTicketId || !socket) return;
    if (!confirm('Close this ticket?')) return;
    socket.emit('close_ticket', { ticketId: currentTicketId });
    showView('create');
    currentTicketId = null;
    ticketForm.reset();
  });

  // ============================================================
  //  PIXEL CAT — pure canvas 2D walking animation
  // ============================================================
  const CAT_W = 16;   // logical pixels
  const CAT_H = 12;
  const SCALE = 4;    // display scale → 64×48 canvas

  let catX = 40;          // world x position
  let direction = 1;      // 1 = right, -1 = left
  let frame = 0;
  let frameTimer = 0;
  const WALK_SPEED = 0.9;
  const FRAME_SPEED = 8;  // frames before next leg cycle

  // Simple pixel cat frames (body + legs)
  // Each frame is an array of [x, y, w, h, color]
  const palette = {
    body: '#e8c070',
    dark: '#c49a4a',
    outline: '#5c4030',
    eye: '#2a1a10',
    nose: '#d06060',
    white: '#f5e6c8',
  };

  function drawPixel(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
  }

  function drawCat(facingRight, walkFrame) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Flip for left direction
    if (!facingRight) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    // --- Body ---
    drawPixel(3, 4, 9, 5, palette.body);       // main body
    drawPixel(2, 5, 1, 3, palette.dark);       // belly shade
    drawPixel(11, 5, 1, 3, palette.dark);

    // --- Head ---
    drawPixel(10, 2, 5, 5, palette.body);
    drawPixel(11, 3, 2, 2, palette.white);     // muzzle
    drawPixel(13, 4, 1, 1, palette.nose);      // nose
    drawPixel(12, 3, 1, 1, palette.eye);       // eye

    // --- Ears ---
    drawPixel(10, 1, 2, 2, palette.body);
    drawPixel(13, 1, 2, 2, palette.body);
    drawPixel(10, 1, 1, 1, palette.outline);
    drawPixel(14, 1, 1, 1, palette.outline);

    // --- Tail ---
    drawPixel(1, 3, 2, 2, palette.body);
    drawPixel(0, 2, 2, 2, palette.dark);

    // --- Legs (walk cycle) ---
    const legOffset = walkFrame % 2 === 0 ? 0 : 1;

    // Front legs
    drawPixel(9, 9, 2, 2, palette.body);
    drawPixel(9, 11, 2, 1, palette.outline);
    drawPixel(11 + legOffset, 9, 2, 2, palette.dark);
    drawPixel(11 + legOffset, 11, 2, 1, palette.outline);

    // Back legs
    drawPixel(3, 9, 2, 2, palette.body);
    drawPixel(3, 11, 2, 1, palette.outline);
    drawPixel(5 - legOffset, 9, 2, 2, palette.dark);
    drawPixel(5 - legOffset, 11, 2, 1, palette.outline);

    ctx.restore();
  }

  function animateCat() {
    // Move
    catX += WALK_SPEED * direction;

    // Bounce at edges of viewport
    const maxX = window.innerWidth - canvas.width - 20;
    if (catX > maxX) {
      catX = maxX;
      direction = -1;
    } else if (catX < 20) {
      catX = 20;
      direction = 1;
    }

    canvas.style.left = `${catX}px`;

    // Walk frame
    frameTimer++;
    if (frameTimer >= FRAME_SPEED) {
      frameTimer = 0;
      frame = (frame + 1) % 4;
    }

    drawCat(direction === 1, frame);
    requestAnimationFrame(animateCat);
  }

  // Start cat
  drawCat(true, 0);
  requestAnimationFrame(animateCat);

  // Handle resize so cat stays in bounds
  window.addEventListener('resize', () => {
    const maxX = window.innerWidth - canvas.width - 20;
    if (catX > maxX) catX = maxX;
  });
})();

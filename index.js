/**
 * ============================================================
 *  Discord Ticket Web Portal — Backend
 *  Express + Socket.io + Discord.js
 *
 *  Flow:
 *  1. User opens ticket on website
 *  2. Bot creates a private channel under your Ticket Category
 *  3. Messages flow both ways in real-time
 * ============================================================
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  Partials,
} = require('discord.js');

// ---------- Config ----------
const PORT = process.env.PORT || 3000;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null; // optional

if (!DISCORD_TOKEN || !GUILD_ID || !TICKET_CATEGORY_ID) {
  console.error('❌ Missing required environment variables.');
  console.error('   Copy .env.example → .env and fill in the values.');
  process.exit(1);
}

// ---------- Express + Socket.io ----------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ---------- Discord Bot ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// ticketId → { channelId, username, subject, socketIds: Set }
const tickets = new Map();

// channelId → ticketId  (fast reverse lookup)
const channelToTicket = new Map();

client.once('ready', () => {
  console.log(`✅ Discord bot online as ${client.user.tag}`);
});

// ---------- When staff writes in a ticket channel ----------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== GUILD_ID) return;

  const ticketId = channelToTicket.get(message.channel.id);
  if (!ticketId) return;

  const ticket = tickets.get(ticketId);
  if (!ticket) return;

  // Relay to all connected website clients for this ticket
  io.to(ticketId).emit('message', {
    from: 'staff',
    author: message.member?.displayName || message.author.username,
    content: message.content,
    timestamp: Date.now(),
  });
});

// ---------- Socket handlers ----------
io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // ---- Create Ticket ----
  socket.on('create_ticket', async (data) => {
    const { username, email, subject, description } = data;

    if (!username || !subject || !description) {
      socket.emit('ticket_error', { message: 'Missing required fields.' });
      return;
    }

    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const category = await guild.channels.fetch(TICKET_CATEGORY_ID);

      if (!category || category.type !== ChannelType.GuildCategory) {
        socket.emit('ticket_error', { message: 'Ticket category not found. Check TICKET_CATEGORY_ID.' });
        return;
      }

      const ticketId = uuidv4().slice(0, 8);
      const channelName = `ticket-${username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}-${ticketId}`;

      // Permission overwrites
      const overwrites = [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: client.user.id, // bot
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ];

      // Allow staff role if configured
      if (STAFF_ROLE_ID) {
        overwrites.push({
          id: STAFF_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        topic: `Web ticket from ${username}${email ? ` (${email})` : ''} | Subject: ${subject}`,
        permissionOverwrites: overwrites,
      });

      // Initial message in Discord
      await channel.send({
        content:
          `🎫 **New Web Ticket**\n` +
          `**User:** ${username}${email ? ` • ${email}` : ''}\n` +
          `**Subject:** ${subject}\n` +
          `**Ticket ID:** \`${ticketId}\`\n\n` +
          `**Description:**\n${description}\n\n` +
          `*Reply in this channel — messages are sent live to the website.*`,
      });

      // Store ticket
      tickets.set(ticketId, {
        channelId: channel.id,
        username,
        subject,
        socketIds: new Set([socket.id]),
      });
      channelToTicket.set(channel.id, ticketId);

      // Join socket room
      socket.join(ticketId);

      socket.emit('ticket_created', {
        ticketId,
        subject,
        channelId: channel.id,
      });

      console.log(`[ticket] created ${ticketId} → #${channel.name}`);
    } catch (err) {
      console.error('[ticket] create failed:', err);
      socket.emit('ticket_error', {
        message: 'Server error while creating ticket. Check bot permissions.',
      });
    }
  });

  // ---- Send message from website ----
  socket.on('send_message', async (data) => {
    const { ticketId, content } = data;
    if (!ticketId || !content) return;

    const ticket = tickets.get(ticketId);
    if (!ticket) return;

    // Make sure this socket is part of the ticket
    ticket.socketIds.add(socket.id);
    socket.join(ticketId);

    try {
      const channel = await client.channels.fetch(ticket.channelId);
      if (channel) {
        await channel.send(`💬 **${ticket.username}** (web):\n${content}`);
      }
    } catch (err) {
      console.error('[message] failed to send to Discord:', err);
    }
  });

  // ---- Close ticket ----
  socket.on('close_ticket', async (data) => {
    const { ticketId } = data;
    const ticket = tickets.get(ticketId);
    if (!ticket) return;

    try {
      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (channel) {
        await channel.send('🔒 Ticket closed by user from the website.');
        // Optional: delete after a delay or leave it
        // await channel.delete().catch(() => {});
      }
    } catch (_) {}

    io.to(ticketId).emit('ticket_closed');
    tickets.delete(ticketId);
    channelToTicket.delete(ticket.channelId);
    console.log(`[ticket] closed ${ticketId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// ---------- Start ----------
client.login(DISCORD_TOKEN).then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Ticket portal running at http://localhost:${PORT}`);
    console.log(`   Serving frontend from /public`);
  });
}).catch((err) => {
  console.error('❌ Failed to login Discord bot:', err.message);
  process.exit(1);
});

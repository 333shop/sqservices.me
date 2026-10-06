// Run: npm install && npm start   (Node 18+)
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "db.json");
const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : { users: {}, games: [] };
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db));
const rand = (n = 24) => crypto.randomBytes(n).toString("hex");
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString("hex");

const app = express();
app.use(express.json({ limit: "8mb" }));
// CORS so the page can live on a different domain than the server (optional)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
// Only the public/ folder is served, so db.json and server.js are never exposed
app.use(express.static(path.join(__dirname, "public")));

const SESS_FILE = path.join(__dirname, "sessions.json");
const sessions = fs.existsSync(SESS_FILE) ? JSON.parse(fs.readFileSync(SESS_FILE, "utf8")) : {};
const saveSessions = () => fs.writeFileSync(SESS_FILE, JSON.stringify(sessions));
const auth = (req, res, next) => {
  const user = sessions[(req.headers.authorization || "").replace("Bearer ", "")];
  if (!user) return res.status(401).json({ error: "Please log in again." });
  req.user = user; next();
};

app.post("/api/signup", (req, res) => {
  const { username, password } = req.body || {};
  if (!/^[\w]{3,20}$/.test(username || "")) return res.status(400).json({ error: "Username must be 3-20 letters, numbers or underscores." });
  if ((password || "").length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (db.users[username.toLowerCase()]) return res.status(409).json({ error: "That username is taken." });
  const salt = rand(16);
  db.users[username.toLowerCase()] = { username, salt, hash: hash(password, salt), apiKey: "gv_" + rand(20) };
  save();
  const token = rand(); sessions[token] = username.toLowerCase(); saveSessions();
  res.json({ token });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const u = db.users[(username || "").toLowerCase()];
  if (!u || hash(password || "", u.salt) !== u.hash) return res.status(401).json({ error: "Wrong username or password." });
  const token = rand(); sessions[token] = username.toLowerCase(); saveSessions();
  res.json({ token });
});

app.get("/api/me", auth, (req, res) => {
  const u = db.users[req.user];
  res.json({ username: u.username, apiKey: u.apiKey });
});

app.get("/api/games", auth, (req, res) => {
  res.json(db.games.filter(g => g.owner === req.user).map(({ files, ...g }) => ({ ...g, fileCount: files.length })));
});

app.get("/api/games/:id", auth, (req, res) => {
  const g = db.games.find(g => g.id === req.params.id && g.owner === req.user);
  g ? res.json(g) : res.status(404).json({ error: "Game not found." });
});

// The "webhook" your Lua script posts to. Auth = the account's API key.
app.post("/api/ingest", async (req, res) => {
  const owner = Object.keys(db.users).find(k => db.users[k].apiKey === req.headers["x-api-key"]);
  if (!owner) return res.status(401).json({ error: "Invalid API key." });
  const { placeId, universeId, name, files } = req.body || {};
  if (!name || !Array.isArray(files)) return res.status(400).json({ error: "Missing name or files." });
  let image = "";
  try {
    const r = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${Number(universeId)}&size=256x256&format=Png`);
    image = (await r.json()).data?.[0]?.imageUrl || "";
  } catch {}
  const clean = files.slice(0, 2000).map(f => ({ path: String(f.path).slice(0, 300), type: String(f.type || "").slice(0, 40), content: String(f.content || "").slice(0, 200000) }));
  const existing = db.games.find(g => g.owner === owner && g.placeId === placeId);
  const rec = { id: existing?.id || rand(8), owner, placeId, name: String(name).slice(0, 100), image, files: clean, updated: Date.now() };
  existing ? Object.assign(existing, rec) : db.games.push(rec);
  save();
  res.json({ ok: true, id: rec.id });
});

app.listen(process.env.PORT || 3000, () => console.log("SQ Services running on http://localhost:3000"));

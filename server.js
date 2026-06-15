require('dotenv').config();

const path = require('path');
const http = require('http');
const fs = require('fs');
const express = require('express');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const multer = require('multer');
const cookieParser = require('cookie-parser');

const formatMessage = require('./utils/messages');
const { generateToken, verifyToken } = require('./utils/auth');
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require('./utils/users');
const Message = require('./models/Message');
const User = require('./models/User');
const PrivateMessage = require('./models/PrivateMessage');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB error:', err));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());

// ── File upload ──
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only images allowed'));
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ── Auth routes ──
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: 'All fields required' });

    const exists = await User.findOne({ username });
    if (exists)
      return res.status(400).json({ error: 'Username already taken' });

    const user = await User.create({ username, password });
    const token = generateToken(user._id);

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user._id);

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });
  res.json({ userId: decoded.id });
});

// ── Private messages history ──
app.get('/api/pm/:otherUser', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not logged in' });
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const me = await User.findById(decoded.id);
    if (!me) return res.status(401).json({ error: 'User not found' });

    const other = req.params.otherUser;

    const messages = await PrivateMessage.find({
      $or: [
        { from: me.username, to: other },
        { from: other, to: me.username }
      ]
    }).sort({ createdAt: 1 }).limit(50);

    res.json(messages);
  } catch (err) {
    console.error('PM history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const botName = 'ChatCord Bot';
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('New WS connection:', socket.id);

  socket.emit('roomCounts', getRoomCounts());

  socket.on('joinRoom', async ({ username, room }) => {
    if (!username || !room) return;

    onlineUsers.set(socket.id, username);

    const user = userJoin(socket.id, username, room);
    socket.join(user.room);

    socket.emit('message', formatMessage(botName, 'Welcome to ChatCord!'));

    socket.broadcast
      .to(user.room)
      .emit('message', formatMessage(botName, `${user.username} has joined the chat`));

    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });

    io.emit('roomCounts', getRoomCounts());

    try {
      const messages = await Message.find({ room }).sort({ createdAt: 1 }).limit(50);
      socket.emit('chatHistory', messages);
    } catch (err) {
      console.error('History error:', err);
    }
  });

  socket.on('chatMessage', async (msg) => {
    const user = getCurrentUser(socket.id);
    if (!user) return;

    const message = formatMessage(user.username, msg);
    message.id = `${socket.id}-${Date.now()}`;

    try {
      const saved = await Message.create({
        username: user.username,
        room: user.room,
        text: msg,
        time: message.time,
        readBy: [user.username]
      });
      message.id = saved._id.toString();
    } catch (err) {
      console.error('Save error:', err);
    }

    io.to(user.room).emit('message', message);
  });

  socket.on('imageMessage', async ({ url }) => {
    const user = getCurrentUser(socket.id);
    if (!user) return;

    const message = formatMessage(user.username, `<img src="${url}" class="chat-img" />`);
    message.isImage = true;

    try {
      const saved = await Message.create({
        username: user.username,
        room: user.room,
        text: `<img src="${url}" class="chat-img" />`,
        time: message.time,
        readBy: [user.username]
      });
      message.id = saved._id.toString();
    } catch (err) {
      console.error('Image save error:', err);
    }

    io.to(user.room).emit('message', message);
  });

  socket.on('privateMessage', async ({ to, text }) => {
    const from = onlineUsers.get(socket.id);
    if (!from || !to || !text) return;

    const time = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });

    try {
      const saved = await PrivateMessage.create({ from, to, text, time });

      const payload = {
        id: saved._id.toString(),
        from,
        to,
        text,
        time
      };

      socket.emit('privateMessage', payload);

      for (const [sid, uname] of onlineUsers.entries()) {
        if (uname === to) {
          io.to(sid).emit('privateMessage', payload);
          break;
        }
      }
    } catch (err) {
      console.error('PM error:', err);
    }
  });

  socket.on('typing', () => {
    const user = getCurrentUser(socket.id);
    if (!user) return;
    socket.broadcast.to(user.room).emit('typing', user.username);
  });

  socket.on('stopTyping', () => {
    const user = getCurrentUser(socket.id);
    if (!user) return;
    socket.broadcast.to(user.room).emit('stopTyping');
  });

  socket.on('addReaction', async ({ messageId, emoji }) => {
    const user = getCurrentUser(socket.id);
    if (!user) return;

    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      const current = msg.reactions.get(emoji) || 0;
      if (current > 0) {
        msg.reactions.set(emoji, current - 1);
        if (current - 1 === 0) msg.reactions.delete(emoji);
      } else {
        msg.reactions.set(emoji, 1);
      }

      await msg.save();

      const counts = {};
      msg.reactions.forEach((val, key) => { counts[key] = val; });

      io.to(user.room).emit('reactionUpdate', { messageId, reactions: counts });
    } catch (err) {
      console.error('Reaction error:', err);
    }
  });

  socket.on('markRead', async ({ messageId }) => {
    const user = getCurrentUser(socket.id);
    if (!user) return;

    try {
      const msg = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { readBy: user.username } },
        { returnDocument: 'after' }
      );
      if (msg) {
        io.to(user.room).emit('readReceipt', { messageId, readBy: msg.readBy });
      }
    } catch (err) {
      console.error('Read receipt error:', err);
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    const user = userLeave(socket.id);
    if (user) {
      io.to(user.room).emit('message', formatMessage(botName, `${user.username} has left the chat`));
      io.to(user.room).emit('roomUsers', { room: user.room, users: getRoomUsers(user.room) });
      io.emit('roomCounts', getRoomCounts());
    }
  });
});

function getRoomCounts() {
  const rooms = ['JavaScript', 'Python', 'PHP', 'C#', 'Ruby', 'Java'];
  const counts = {};
  rooms.forEach((room) => { counts[room] = getRoomUsers(room).length; });
  return counts;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
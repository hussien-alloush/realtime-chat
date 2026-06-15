const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const typingEl = document.getElementById('typing-indicator');
const userCountEl = document.getElementById('user-count');
const scrollBtn = document.getElementById('scroll-btn');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
const msgInput = document.getElementById('msg');
const fileInput = document.getElementById('file-input');
const fileBtn = document.getElementById('file-btn');
const pmPanel = document.getElementById('pm-panel');
const pmMessages = document.getElementById('pm-messages');
const pmInput = document.getElementById('pm-input');
const pmSend = document.getElementById('pm-send');
const pmClose = document.getElementById('pm-close');
const pmTargetName = document.getElementById('pm-target-name');

const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

// Redirect if not logged in
if (!username) window.location = 'auth.html';

const socket = io();

// ── Auto-scroll ──
let autoScroll = true;

chatMessages.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = chatMessages;
  autoScroll = scrollTop + clientHeight >= scrollHeight - 10;
  scrollBtn.style.display = autoScroll ? 'none' : 'flex';
});

scrollBtn.addEventListener('click', () => {
  chatMessages.scrollTop = chatMessages.scrollHeight;
  autoScroll = true;
  scrollBtn.style.display = 'none';
});

// ── Sound ──
function playPing() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = 'sine';
  o.frequency.value = 880;
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.4);
}

// ── Emoji Picker ──
const emojis = [
  '😀','😂','😍','🥰','😎','😢','😡','🤔','👍','👎',
  '❤️','🔥','🎉','✅','❌','🙏','💯','🚀','👀','💀',
  '😭','🤣','😅','🥹','😱','🤯','🫡','💪','🎯','⚡'
];

emojis.forEach((emoji) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('emoji-item');
  btn.textContent = emoji;
  btn.addEventListener('click', () => {
    const pos = msgInput.selectionStart;
    const val = msgInput.value;
    msgInput.value = val.slice(0, pos) + emoji + val.slice(pos);
    msgInput.focus();
    msgInput.selectionStart = msgInput.selectionEnd = pos + emoji.length;
    emojiPicker.classList.remove('open');
  });
  emojiPicker.appendChild(btn);
});

emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPicker.classList.toggle('open');
});

document.addEventListener('click', () => {
  emojiPicker.classList.remove('open');
  document.querySelectorAll('.react-menu.open').forEach(m => m.classList.remove('open'));
});

emojiPicker.addEventListener('click', (e) => e.stopPropagation());

// ── File upload ──
fileBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.url) socket.emit('imageMessage', { url: data.url });
  } catch (err) {
    console.error('Upload error:', err);
  }

  fileInput.value = '';
});

// ── Private Messaging ──
let pmTarget = null;

function openPM(targetUsername) {
  pmTarget = targetUsername;
  pmTargetName.textContent = targetUsername;
  pmMessages.innerHTML = '';
  pmPanel.classList.add('open');

  // Load PM history
  fetch(`/api/pm/${targetUsername}`)
    .then(r => r.json())
    .then(messages => {
      messages.forEach(msg => renderPM(msg));
      pmMessages.scrollTop = pmMessages.scrollHeight;
    })
    .catch(console.error);
}

pmClose.addEventListener('click', () => {
  pmPanel.classList.remove('open');
  pmTarget = null;
});

function renderPM(msg) {
  const div = document.createElement('div');
  div.classList.add('pm-msg');
  div.classList.add(msg.from === username ? 'pm-mine' : 'pm-theirs');
  div.innerHTML = `
    <p>${msg.text}</p>
    <span>${msg.time}</span>
  `;
  pmMessages.appendChild(div);
}

pmSend.addEventListener('click', sendPM);
pmInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendPM();
});

function sendPM() {
  const text = pmInput.value.trim();
  if (!text || !pmTarget) return;
  socket.emit('privateMessage', { to: pmTarget, text });
  pmInput.value = '';
  pmInput.focus();
}

socket.on('privateMessage', (msg) => {
  if (msg.from === pmTarget || msg.to === pmTarget) {
    renderPM(msg);
    pmMessages.scrollTop = pmMessages.scrollHeight;
  }

  // Notification if PM panel is closed
  if (msg.from !== username && msg.from !== pmTarget) {
    showPMNotification(msg.from);
  }
});

function showPMNotification(from) {
  const notif = document.createElement('div');
  notif.classList.add('pm-notif');
  notif.innerHTML = `<i class="fas fa-envelope"></i> DM from <strong>${from}</strong>`;
  notif.addEventListener('click', () => {
    openPM(from);
    notif.remove();
  });
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 4000);
}

// ── Render message ──
function renderMessage(message, prepend = false) {
  const isBot = message.username === 'ChatCord Bot';
  const div = document.createElement('div');
  div.classList.add('message');

  if (isBot) {
    div.classList.add('system-msg');
    div.innerHTML = `<p>${message.text}</p>`;
  } else {
    div.setAttribute('data-id', message.id || message._id || '');
    div.innerHTML = `
      <div class="meta">
        <p>${message.username}</p>
        <span>${message.time}</span>
        <div class="react-btns">
          <button class="react-trigger" title="React">
            <i class="fas fa-smile"></i>
          </button>
          <div class="react-menu">
            ${['👍','❤️','😂','🔥','😮','😢'].map(e =>
              `<button class="react-opt" data-emoji="${e}">${e}</button>`
            ).join('')}
          </div>
        </div>
      </div>
      <p class="msg-text">${message.text}</p>
      <div class="reactions-bar"></div>
      <div class="read-receipt"></div>
    `;

    // Existing reactions
    if (message.reactions) {
      const bar = div.querySelector('.reactions-bar');
      const entries = message.reactions instanceof Map
        ? [...message.reactions.entries()]
        : Object.entries(message.reactions);

      entries.forEach(([emoji, count]) => {
        if (count > 0) {
          const span = document.createElement('span');
          span.classList.add('reaction-badge');
          span.innerHTML = `${emoji} <small>${count}</small>`;
          span.addEventListener('click', () => {
            socket.emit('addReaction', {
              messageId: div.getAttribute('data-id'),
              emoji,
            });
          });
          bar.appendChild(span);
        }
      });
    }

    // Read receipts
    if (message.readBy && message.readBy.length > 0) {
      const receipt = div.querySelector('.read-receipt');
      receipt.innerHTML = `<span>Seen by ${message.readBy.join(', ')}</span>`;
    }

    // Reaction trigger
    const trigger = div.querySelector('.react-trigger');
    const menu = div.querySelector('.react-menu');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.react-menu.open').forEach(m => {
        if (m !== menu) m.classList.remove('open');
      });
      menu.classList.toggle('open');
    });

    div.querySelectorAll('.react-opt').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        socket.emit('addReaction', {
          messageId: div.getAttribute('data-id'),
          emoji: btn.getAttribute('data-emoji'),
        });
        menu.classList.remove('open');
      });
    });

    // Click username to DM
    div.querySelector('.meta p').addEventListener('click', () => {
      if (message.username !== username) openPM(message.username);
    });

    // Mark as read
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = div.getAttribute('data-id');
          if (id) socket.emit('markRead', { messageId: id });
          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });

    observer.observe(div);

    if (message.username !== username) playPing();
  }

  if (prepend) {
    chatMessages.insertBefore(div, chatMessages.firstChild);
  } else {
    chatMessages.appendChild(div);
  }

  return div;
}

// ── Join room ──
socket.on('connect', () => {
  socket.emit('joinRoom', { username, room });
});

// ── Chat history ──
socket.on('chatHistory', (messages) => {
  chatMessages.innerHTML = '';
  messages.forEach((msg) => {
    renderMessage({
      id: msg._id,
      username: msg.username,
      text: msg.text,
      time: msg.time,
      reactions: msg.reactions,
      readBy: msg.readBy,
    });
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// ── Room users ──
socket.on('roomUsers', ({ room, users }) => {
  roomName.innerText = room;
  userCountEl.innerText = users.length;
  userList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerText = user.username;
    li.setAttribute('data-initial', user.username.charAt(0).toUpperCase());
    if (user.username !== username) {
      li.style.cursor = 'pointer';
      li.title = `DM ${user.username}`;
      li.addEventListener('click', () => openPM(user.username));
    }
    userList.appendChild(li);
  });
});

// ── New message ──
socket.on('message', (message) => {
  renderMessage(message);
  if (autoScroll) chatMessages.scrollTop = chatMessages.scrollHeight;
});

// ── Reaction updates ──
socket.on('reactionUpdate', ({ messageId, reactions }) => {
  const msgEl = document.querySelector(`[data-id="${messageId}"]`);
  if (!msgEl) return;
  const bar = msgEl.querySelector('.reactions-bar');
  bar.innerHTML = '';
  Object.entries(reactions).forEach(([emoji, count]) => {
    if (count === 0) return;
    const span = document.createElement('span');
    span.classList.add('reaction-badge');
    span.innerHTML = `${emoji} <small>${count}</small>`;
    span.addEventListener('click', () => {
      socket.emit('addReaction', { messageId, emoji });
    });
    bar.appendChild(span);
  });
});

// ── Read receipts ──
socket.on('readReceipt', ({ messageId, readBy }) => {
  const msgEl = document.querySelector(`[data-id="${messageId}"]`);
  if (!msgEl) return;
  const receipt = msgEl.querySelector('.read-receipt');
  if (receipt) receipt.innerHTML = `<span>Seen by ${readBy.join(', ')}</span>`;
});

// ── Typing ──
let typingTimeout;

msgInput.addEventListener('input', () => {
  socket.emit('typing');
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit('stopTyping'), 1500);
});

socket.on('typing', (user) => {
  typingEl.innerHTML = `<span>${user} is typing<span class="dots"><span>.</span><span>.</span><span>.</span></span></span>`;
  typingEl.style.display = 'block';
});

socket.on('stopTyping', () => {
  typingEl.style.display = 'none';
});

// ── Send message ──
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  let msg = msgInput.value.trim();
  if (!msg) return;
  socket.emit('chatMessage', msg);
  socket.emit('stopTyping');
  msgInput.value = '';
  msgInput.focus();
});

// ── Leave room ──
document.getElementById('leave-btn').addEventListener('click', () => {
  window.location = 'index.html';
});
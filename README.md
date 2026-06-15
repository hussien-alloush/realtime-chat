💬 ChatCord — Real-Time Chat Application

A modern real-time chat application built with Node.js, Express, Socket.io, and MongoDB.
ChatCord supports live messaging, rooms, typing indicators, file uploads, reactions, and message history.

📌 Overview

ChatCord is a scalable real-time chat system that allows users to join different rooms and communicate instantly.
It uses WebSockets (Socket.io) for real-time communication and MongoDB for persistent message storage.

✨ Features
💬 Real-Time Chat
Instant messaging using Socket.io
Multi-room support (JavaScript, Python, Java, etc.)
Live user join/leave notifications
⌨️ User Experience
Typing indicators
Auto-scroll chat window
Sound notifications for new messages
😀 Message Features
Emoji support
Message reactions (like 👍 ❤️ 😂)
Read receipts (see who read messages)
🖼️ Media Support
Image uploads (Multer)
Preview images inside chat
5MB file size limit
🗄️ Backend Features
MongoDB message storage
Load last 50 messages on join
Room-based message filtering
🚀 Tech Stack
Layer	Technology
Backend	Node.js, Express
Realtime	Socket.io
Database	MongoDB + Mongoose
Uploads	Multer
Frontend	HTML, CSS, Vanilla JS
📁 Project Structure
realtime-chat-app/
│
├── models/
│   └── Message.js
│
├── public/
│   ├── css/
│   ├── js/
│   ├── uploads/
│   ├── index.html
│   ├── chat.html
│   └── auth.html
│
├── utils/
│   ├── messages.js
│   └── users.js
│
├── server.js
├── package.json
└── .env
⚙️ Installation
1. Clone the repository
2.cd realtime-chat-app
3. Install dependencies
4.npm install
5. Setup environment variables

Create a .env file:

MONGO_URI=mongodb://127.0.0.1:27017/chatapp
PORT=3000

If using MongoDB Atlas:

MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/chatapp
4. Run the project
npm run dev

Then open:

http://localhost:3000

#live demo:
https://realtime-chat-b2y5.onrender.com

📡 Available Chat Rooms
JavaScript
Python
PHP
C#
Ruby
Java
🔒 Security Features
Input validation on messages
File type restrictions (images only)
File size limit (5MB)
MongoDB sanitization via Mongoose

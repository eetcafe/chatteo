const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

// 1. Express CORS engedélyezése
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const server = http.createServer(app);

// 2. Socket.IO CORS engedélyezése
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('ChatTEO Backend Running!');
});

const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Kliens csatlakozott: ${socket.id}`);

  socket.on('joinRoom', ({ userId, email }) => {
    socket.join(userId);
    activeUsers.set(socket.id, { userId, email });
    io.emit('userConnected', { userId, email, socketId: socket.id });
  });

  socket.on('chatMessage', (data) => {
    if (typeof data === 'string') {
      const userInfo = activeUsers.get(socket.id);
      if (userInfo) {
        io.to(userInfo.userId).emit('message', {
          sender: userInfo.email,
          text: data,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      const { targetUserId, text, sender } = data;
      io.to(targetUserId).emit('message', {
        sender: sender || 'Admin',
        text: text,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('disconnect', () => {
    const userInfo = activeUsers.get(socket.id);
    if (userInfo) {
      io.emit('userDisconnected', { userId: userInfo.userId });
      activeUsers.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Szerver fut a ${PORT} porton`);
});

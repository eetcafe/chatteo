const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Express fejlécek a CORS-hoz
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

// Socket.IO CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('ChatTEO Backend fut!');
});

const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Kliens csatlakozott: ${socket.id}`);

  socket.on('joinRoom', ({ userId, email, role }) => {
    socket.join(userId);
    
    if (role === 'admin' || role === 'ai') {
      socket.join('adminGroup');
    }

    activeUsers.set(socket.id, { userId, email, role });
    io.to('adminGroup').emit('userConnected', { userId, email, socketId: socket.id });
  });

  socket.on('chatMessage', (data) => {
    const userInfo = activeUsers.get(socket.id);

    if (typeof data === 'string') {
      if (userInfo) {
        const msgPayload = {
          sender: userInfo.email,
          senderId: userInfo.userId,
          text: data,
          timestamp: new Date().toISOString()
        };

        io.to(userInfo.userId).emit('message', msgPayload);
        io.to('adminGroup').emit('messageToAdmin', msgPayload);
      }
    } else {
      const { targetUserId, text, sender } = data;
      const msgPayload = {
        sender: sender || 'AI Bot',
        text: text,
        timestamp: new Date().toISOString()
      };

      io.to(targetUserId).emit('message', msgPayload);
      io.to('adminGroup').emit('messageToAdmin', { ...msgPayload, senderId: targetUserId });
    }
  });

  socket.on('disconnect', () => {
    const userInfo = activeUsers.get(socket.id);
    if (userInfo) {
      io.to('adminGroup').emit('userDisconnected', { userId: userInfo.userId });
      activeUsers.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Szerver elindult a ${PORT} porton`);
});

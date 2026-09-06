const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS engedélyezése a Netlify domain-nek és helyi tesztelésnek
const io = new Server(server, {
  cors: {
    origin: ["https://chatteo.netlify.app", "http://localhost:3000", "*"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(express.json());

// Egyszerű Health Check végpont a Rendernek
app.get('/', (req, res) => {
  res.send('ChatTEO Backend Server is Running!');
});

// Aktív szobák és felhasználók tárolása a memóriában
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Új kliens csatlakozott: ${socket.id}`);

  // Felhasználó csatlakozása a saját szobájához
  socket.on('joinRoom', ({ userId, email }) => {
    socket.join(userId);
    activeUsers.set(socket.id, { userId, email });
    
    // Értesítjük az adminokat az új aktív userről
    io.emit('userConnected', { userId, email, socketId: socket.id });
    console.log(`User csatlakozott szobához: ${userId} (${email})`);
  });

  // Üzenetküldés kezelése
  socket.on('chatMessage', (data) => {
    // Ha sima string érkezik a kliensről
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
      // Ha objektum érkezik (pl. Admin küld üzenetet egy specifikus user szobájába)
      const { targetUserId, text, sender } = data;
      io.to(targetUserId).emit('message', {
        sender: sender || 'Admin',
        text: text,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Kijelentkezés / Kapcsolat bontása
  socket.on('disconnect', () => {
    const userInfo = activeUsers.get(socket.id);
    if (userInfo) {
      io.emit('userDisconnected', { userId: userInfo.userId });
      activeUsers.delete(socket.id);
    }
    console.log(`Kliens lekapcsolódott: ${socket.id}`);
  });
});

// Port beállítása (Render automatikusan megadja a process.env.PORT-ot)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ChatTEO szerver fut a következő porton: ${PORT}`);
});

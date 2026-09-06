// ... felette a CORS és Express beállítások ...

io.on('connection', (socket) => {
  console.log(`Kliens csatlakozott: ${socket.id}`);

  // CSATLAKOZÁS
  socket.on('joinRoom', ({ userId, email, role }) => {
    socket.join(userId);
    
    // Ha admin vagy AI lép be, betesszük a közös "adminGroup" szobába is
    if (role === 'admin' || role === 'ai') {
      socket.join('adminGroup');
    }

    activeUsers.set(socket.id, { userId, email, role });
    
    // Értesítjük az AI-t / Admint az új userről
    io.to('adminGroup').emit('userConnected', { userId, email, socketId: socket.id });
  });

  // ÜZENETKÜLDÉS
  socket.on('chatMessage', (data) => {
    const userInfo = activeUsers.get(socket.id);

    if (typeof data === 'string') {
      // Sima User küld üzenetet -> Továbbítjuk a user saját szobájába ÉS az Admin/AI szobába!
      if (userInfo) {
        const msgPayload = {
          sender: userInfo.email,
          senderId: userInfo.userId,
          text: data,
          timestamp: new Date().toISOString()
        };

        // Kliens saját maga is megkapja
        io.to(userInfo.userId).emit('message', msgPayload);
        
        // Az AI / Admin is megkapja!
        io.to('adminGroup').emit('messageToAdmin', msgPayload);
      }
    } else {
      // Admin / AI válaszol egy adott usernek
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

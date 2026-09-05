const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// Tároljuk az aktív usereket és a bannoltakat
const activeUsers = {}; // socket.id -> { name, email, socketId }
const bannedUsers = {}; // email -> reason

io.on('connection', (socket) => {

    // Bejelentkezéskor megkapjuk a user adatait
    socket.on('externalLogin', (data) => {
        const email = data.email ? data.email.toLowerCase().trim() : '';

        // Ellenőrizzük, hogy ki van-e bannolva
        if (bannedUsers[email]) {
            socket.emit('bannedNotification', { reason: bannedUsers[email] });
            return;
        }

        activeUsers[socket.id] = {
            name: data.name,
            email: email,
            socketId: socket.id
        };

        // Jelzzük az Admin/AI felületnek az új belépőt
        io.emit('adminUserJoined', {
            userId: socket.id,
            user: activeUsers[socket.id]
        });
    });

    // Felhasználói üzenet fogadása
    socket.on('userMessage', (data) => {
        const user = activeUsers[socket.id];
        if (!user) return;

        if (bannedUsers[user.email]) {
            socket.emit('bannedNotification', { reason: bannedUsers[user.email] });
            return;
        }

        // Továbbítjuk az Admin/AI felületre a szobájának az üzenetét
        io.emit('adminReceiveMessage', {
            userId: socket.id,
            username: user.name,
            email: user.email,
            message: data.message
        });
    });

    // AI/Admin válasz küldése konkrét felhasználónak
    socket.on('aiResponse', (data) => {
        const targetSocket = io.sockets.sockets.get(data.userId);
        if (targetSocket) {
            targetSocket.emit('aiReceiveMessage', { message: data.message });
        }
    });

    // FELHASZNÁLÓ BANNOLÁSA
    socket.on('banUser', (data) => {
        const banEmail = data.email ? data.email.toLowerCase().trim() : '';
        const reason = data.reason || 'Szegted a szabályzatot.';

        if (!banEmail) return;

        bannedUsers[banEmail] = reason;

        // Kikeressük az aktív socketek közül a bannolt usert
        for (const [sId, uData] of Object.entries(activeUsers)) {
            if (uData.email === banEmail) {
                const targetSocket = io.sockets.sockets.get(sId);
                if (targetSocket) {
                    targetSocket.emit('bannedNotification', { reason: reason });
                }
                io.emit('adminUserLeft', { userId: sId });
                delete activeUsers[sId];
            }
        }
    });

    // Kilépés kezelése
    socket.on('disconnect', () => {
        if (activeUsers[socket.id]) {
            io.emit('adminUserLeft', { userId: socket.id });
            delete activeUsers[socket.id];
        }
    });
});

http.listen(3000, () => {
    console.log('A szerver fut a http://localhost:3000 címen');
});
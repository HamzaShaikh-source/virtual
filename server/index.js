const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

// Resolve GameRoom from ./game.js (owned by T2)
let GameRoom;
try {
  const gameModule = require('./game');
  GameRoom = gameModule.GameRoom || gameModule;
} catch (err) {
  if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('./game')) {
    // Scaffold fallback until T2 merges server/game.js
    GameRoom = class GameRoom {
      constructor() {
        this.players = [];
        this.status = 'lobby';
        this.pipes = [];
        this.eliminated = [];
        this.winnerId = null;
      }
      addPlayer(socketId, name) {
        const isHost = this.players.length === 0;
        const colors = [
          '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
          '#9b59b6', '#e67e22', '#1abc9c', '#e84393'
        ];
        const color = colors[this.players.length % colors.length];
        const player = {
          id: socketId,
          name: name || `Player ${this.players.length + 1}`,
          color,
          y: 250,
          vy: 0,
          alive: true
        };
        this.players.push(player);
        return { id: player.id, color: player.color, isHost };
      }
      removePlayer(id) {
        this.players = this.players.filter((p) => p.id !== id);
      }
      flap(id) {}
      startRound() {
        this.status = 'playing';
      }
      tick(dtMs) {}
      reset() {
        this.status = 'lobby';
        this.eliminated = [];
        this.winnerId = null;
      }
      getState() {
        return {
          status: this.status,
          players: this.players,
          pipes: this.pipes,
          eliminated: this.eliminated,
          winnerId: this.winnerId
        };
      }
    };
  } else {
    throw err;
  }
}

// Fallback helper to get join info when server/qrcode.js is not yet available
async function fallbackGetJoinInfo(port) {
  const QRCode = require('qrcode');
  const os = require('os');
  let lanIp = 'localhost';
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        lanIp = iface.address;
        break;
      }
    }
    if (lanIp !== 'localhost') break;
  }
  const url = `http://${lanIp}:${port}/controller.html`;
  const qrDataUrl = await QRCode.toDataURL(url);
  return { url, qrDataUrl };
}

// Resolve getJoinInfo from ./qrcode.js (owned by T5)
async function fetchJoinInfo(port) {
  try {
    const qrcodeModule = require('./qrcode');
    const fn = qrcodeModule.getJoinInfo || qrcodeModule;
    return await fn(port);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('./qrcode')) {
      return await fallbackGetJoinInfo(port);
    }
    throw err;
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve static assets from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount GET /api/join-info using server/qrcode.js
app.get('/api/join-info', async (req, res) => {
  try {
    const currentPort = server.address() ? server.address().port : PORT;
    const info = await fetchJoinInfo(currentPort);
    res.json(info);
  } catch (err) {
    console.error('Error getting join info:', err);
    res.status(500).json({ error: 'Failed to retrieve join info' });
  }
});

// Single shared GameRoom instance drives the game state
const gameRoom = new GameRoom();

// Socket.io event handling
io.on('connection', (socket) => {
  let playerId = null;
  let isHost = false;

  socket.on('join', (data, callback) => {
    try {
      const name = (data && data.name) ? String(data.name).trim() : 'Player';
      const playerInfo = gameRoom.addPlayer(socket.id, name);
      if (playerInfo) {
        playerId = playerInfo.id;
        isHost = Boolean(playerInfo.isHost);
        socket.data.playerId = playerId;
        socket.data.isHost = isHost;
        socket.emit('joined', playerInfo);
        if (typeof callback === 'function') {
          callback(playerInfo);
        }
      }
    } catch (err) {
      console.error(`Socket [${socket.id}] error on join:`, err);
    }
  });

  socket.on('flap', () => {
    try {
      const idToFlap = playerId || socket.data.playerId || socket.id;
      gameRoom.flap(idToFlap);
    } catch (err) {
      console.error(`Socket [${socket.id}] error on flap:`, err);
    }
  });

  socket.on('startRound', () => {
    try {
      if (isHost || socket.data.isHost) {
        gameRoom.startRound();
      }
    } catch (err) {
      console.error(`Socket [${socket.id}] error on startRound:`, err);
    }
  });

  socket.on('restart', () => {
    try {
      if (isHost || socket.data.isHost) {
        if (typeof gameRoom.reset === 'function') {
          gameRoom.reset();
        } else if (typeof gameRoom.restart === 'function') {
          gameRoom.restart();
        }
      }
    } catch (err) {
      console.error(`Socket [${socket.id}] error on restart:`, err);
    }
  });

  socket.on('disconnect', () => {
    try {
      const idToRemove = playerId || socket.data.playerId || socket.id;
      gameRoom.removePlayer(idToRemove);
    } catch (err) {
      console.error(`Socket [${socket.id}] error on disconnect:`, err);
    }
  });
});

// Run a ~50ms tick loop broadcasting 'state'
const TICK_INTERVAL_MS = 50;
let lastTickTime = Date.now();

const tickInterval = setInterval(() => {
  const now = Date.now();
  const dtMs = now - lastTickTime;
  lastTickTime = now;

  gameRoom.tick(dtMs);
  io.emit('state', gameRoom.getState());
}, TICK_INTERVAL_MS);

// Start listening on configured port
server.listen(PORT, () => {
  console.log(`Flappy Royale server listening on port ${PORT}`);
});

function stop() {
  clearInterval(tickInterval);
  return new Promise((resolve) => {
    io.close(() => {
      server.close(resolve);
    });
  });
}

module.exports = {
  app,
  server,
  io,
  gameRoom,
  tickInterval,
  stop
};

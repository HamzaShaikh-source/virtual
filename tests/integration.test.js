const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const { io: Client } = require('socket.io-client');

describe('Integration smoke test (server + sockets)', () => {
  let server;
  let stop;
  let port;
  let clientSocket;

  before(async () => {
    // Force ephemeral port
    process.env.PORT = '0';
    const serverModule = require('../server/index.js');
    server = serverModule.server;
    stop = serverModule.stop;

    if (!server.listening) {
      await new Promise((resolve) => server.once('listening', resolve));
    }
    port = server.address().port;
  });

  after(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (typeof stop === 'function') {
      await stop();
    }
  });

  test('connects, joins, emits startRound, and asserts valid contract state broadcast', async () => {
    // 1. Connect client to ephemeral port
    clientSocket = Client(`http://localhost:${port}`, {
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 4000);
      clientSocket.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      clientSocket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    assert.ok(clientSocket.connected, 'Client socket should be connected');

    // 2. Emit 'join' and receive 'joined'
    const playerName = 'SmokeTester';
    const joinedPlayer = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Join response timed out')), 4000);
      clientSocket.emit('join', { name: playerName });
      clientSocket.on('joined', (info) => {
        clearTimeout(timer);
        resolve(info);
      });
    });

    assert.ok(joinedPlayer, 'Must receive joined payload');
    assert.strictEqual(typeof joinedPlayer.id, 'string', 'Player id must be a string');
    assert.strictEqual(typeof joinedPlayer.color, 'string', 'Player color must be a string');
    assert.strictEqual(joinedPlayer.isHost, true, 'First player must be host');

    // 3. Emit 'startRound'
    clientSocket.emit('startRound');

    // 4. Assert valid 'state' broadcast received with status 'playing'
    const state = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Waiting for playing state timed out')), 6000);
      const onState = (s) => {
        if (s && s.status === 'playing') {
          clearTimeout(timer);
          clientSocket.off('state', onState);
          resolve(s);
        }
      };
      clientSocket.on('state', onState);
    });

    // 5. Strict contract assertion on state shape
    assert.strictEqual(state.status, 'playing', 'State status must be playing');

    // players: [{id, name, color, y, vy, alive}]
    assert.ok(Array.isArray(state.players), 'state.players must be an array');
    assert.ok(state.players.length >= 1, 'state.players must contain at least one player');

    const matchedPlayer = state.players.find((p) => p.id === joinedPlayer.id);
    assert.ok(matchedPlayer, 'Joined player must be in state.players');
    assert.strictEqual(matchedPlayer.name, playerName, 'Player name should match');
    assert.strictEqual(matchedPlayer.color, joinedPlayer.color, 'Player color should match');
    assert.strictEqual(typeof matchedPlayer.y, 'number', 'Player y must be a number');
    assert.strictEqual(typeof matchedPlayer.vy, 'number', 'Player vy must be a number');
    assert.strictEqual(matchedPlayer.alive, true, 'Player alive must be true at start of round');

    // pipes: [{x, gapY, gapHeight}]
    assert.ok(Array.isArray(state.pipes), 'state.pipes must be an array');
    assert.ok(state.pipes.length > 0, 'state.pipes must contain generated pipes');
    for (const pipe of state.pipes) {
      assert.strictEqual(typeof pipe.x, 'number', 'pipe.x must be a number');
      assert.strictEqual(typeof pipe.gapY, 'number', 'pipe.gapY must be a number');
      assert.strictEqual(typeof pipe.gapHeight, 'number', 'pipe.gapHeight must be a number');
    }

    // eliminated: [id,...]
    assert.ok(Array.isArray(state.eliminated), 'state.eliminated must be an array');

    // winnerId: string|null
    assert.ok(
      state.winnerId === null || typeof state.winnerId === 'string',
      'state.winnerId must be string or null'
    );
  });
});

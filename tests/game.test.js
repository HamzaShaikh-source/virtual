const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const GameRoom = require('../server/game.js');

describe('GameRoom Unit Tests', () => {
  let room;

  beforeEach(() => {
    room = new GameRoom({ seed: 42 });
  });

  describe('Scenario 1: Player Management (addPlayer & removePlayer)', () => {
    it('assigns host status to the first player and non-host to subsequent players', () => {
      const p1 = room.addPlayer('socket-1', 'Alice');
      assert.ok(p1, 'First player should be added');
      assert.equal(p1.id, 'socket-1');
      assert.equal(p1.isHost, true, 'First player must be host');
      assert.equal(p1.color, '#FF3B30', 'First player gets first color');

      const p2 = room.addPlayer('socket-2', 'Bob');
      assert.ok(p2, 'Second player should be added');
      assert.equal(p2.id, 'socket-2');
      assert.equal(p2.isHost, false, 'Second player must not be host');
      assert.notEqual(p2.color, p1.color, 'Second player must get distinct color');

      const state = room.getState();
      assert.equal(state.players.length, 2);
    });

    it('enforces maximum player limit (MAX_PLAYERS = 8)', () => {
      for (let i = 1; i <= 8; i++) {
        const added = room.addPlayer(`socket-${i}`, `Player ${i}`);
        assert.ok(added, `Player ${i} should be successfully added`);
      }
      assert.equal(room.players.length, 8);

      const ninth = room.addPlayer('socket-9', 'Extra Player');
      assert.equal(ninth, null, '9th player should be rejected');
      assert.equal(room.players.length, 8);
    });

    it('removes players and transfers host when host leaves', () => {
      room.addPlayer('host-socket', 'Host');
      room.addPlayer('player-2', 'Player 2');
      room.addPlayer('player-3', 'Player 3');

      assert.equal(room.players[0].isHost, true);

      // Remove host
      room.removePlayer('host-socket');
      assert.equal(room.players.length, 2);
      assert.equal(room.players[0].id, 'player-2');
      assert.equal(room.players[0].isHost, true, 'Host should be transferred to next player');

      // Remove regular player
      room.removePlayer('player-3');
      assert.equal(room.players.length, 1);
      assert.equal(room.players[0].id, 'player-2');
    });

    it('returns existing player info if socketId is already added', () => {
      const first = room.addPlayer('socket-dup', 'Original');
      const second = room.addPlayer('socket-dup', 'Duplicate');
      assert.equal(first.id, second.id);
      assert.equal(first.color, second.color);
      assert.equal(room.players.length, 1);
    });
  });

  describe('Scenario 2: Flap Action and Velocity Physics', () => {
    it('ignores flap actions when room status is lobby', () => {
      room.addPlayer('p1', 'Alice');
      assert.equal(room.status, 'lobby');

      const player = room.players[0];
      assert.equal(player.vy, 0);

      room.flap('p1');
      assert.equal(player.vy, 0, 'Flap should do nothing in lobby');
    });

    it('sets upward velocity on flap when round is playing and gravity pulls bird down', () => {
      room.addPlayer('p1', 'Alice');
      room.startRound();
      assert.equal(room.status, 'playing');

      const player = room.players[0];
      assert.equal(player.vy, 0);
      assert.equal(player.y, 250);

      // Flap raises velocity to FLAP_VELOCITY (-300)
      room.flap('p1');
      assert.equal(player.vy, -300, 'Flap should set velocity to FLAP_VELOCITY (-300)');

      // Advance physics with tick (dtMs = 100ms)
      // dt = 0.1s. Gravity = 800. Expected vy = -300 + 800 * 0.1 = -220
      room.tick(100);
      assert.equal(player.vy, -220, 'Gravity should increase velocity downward');
      assert.ok(player.y < 250, 'Bird y position should have moved upward due to negative vy');

      // Subsequent flap resets vy back to -300
      room.flap('p1');
      assert.equal(player.vy, -300);
    });

    it('clamps bird at ceiling and resets vertical velocity to 0', () => {
      room.addPlayer('p1', 'Alice');
      room.startRound();

      const player = room.players[0];
      player.y = 10;
      player.vy = -300;

      // dt = 0.1s, y becomes 10 + (-300 * 0.1) = -20 < BIRD_RADIUS (15)
      room.tick(100);
      assert.equal(player.y, 15, 'Player y should be clamped to BIRD_RADIUS');
      assert.equal(player.vy, 0, 'Velocity should reset to 0 upon ceiling collision');
    });

    it('does not allow eliminated players to flap', () => {
      room.addPlayer('p1', 'Alice');
      room.startRound();

      const player = room.players[0];
      player.alive = false;
      player.vy = 100;

      room.flap('p1');
      assert.equal(player.vy, 100, 'Dead bird should not be able to flap');
    });
  });

  describe('Scenario 3: Real Collision Causing Elimination', () => {
    it('eliminates player on ground collision', () => {
      room.addPlayer('p1', 'Alice');
      room.startRound();

      const player = room.players[0];
      assert.equal(player.alive, true);
      assert.equal(room.eliminated.length, 0);

      // Place bird near the ground (GROUND_Y = 560, BIRD_RADIUS = 15)
      player.y = 550;
      player.vy = 200;

      // Tick advances y past 560 -> ground collision
      room.tick(100);

      assert.equal(player.alive, false, 'Player should be eliminated upon ground collision');
      assert.deepEqual(room.eliminated, ['p1'], 'Eliminated list should contain player id');
      assert.equal(player.y, 545, 'Player should be clamped to GROUND_Y - BIRD_RADIUS');
    });

    it('eliminates player when colliding with top pipe', () => {
      room.addPlayer('p1', 'Alice');
      room.startRound();

      // BIRD_X is 150, BIRD_RADIUS is 15 -> bird spans x: [135, 165]
      // Place a pipe directly overlapping bird horizontally: x = 140, PIPE_WIDTH = 60 -> pipe spans [140, 200]
      // Set pipe gap from y=300 to y=440
      room.pipes = [
        { x: 140, gapY: 300, gapHeight: 140 }
      ];

      const player = room.players[0];
      // Position bird above gap: birdTop = y - 15 = 185 < gapY (300)
      player.y = 200;
      player.vy = 0;

      room.tick(16);

      assert.equal(player.alive, false, 'Player should collide with top pipe and be eliminated');
      assert.deepEqual(room.eliminated, ['p1']);
    });

    it('eliminates player when colliding with bottom pipe', () => {
      room.addPlayer('p1', 'Alice');
      room.startRound();

      // Pipe spans x: [140, 200], gap spans y: [150, 290]
      room.pipes = [
        { x: 140, gapY: 150, gapHeight: 140 }
      ];

      const player = room.players[0];
      // Position bird below gap: birdBottom = y + 15 = 365 > gapBottom (290)
      player.y = 350;
      player.vy = 0;

      room.tick(16);

      assert.equal(player.alive, false, 'Player should collide with bottom pipe and be eliminated');
      assert.deepEqual(room.eliminated, ['p1']);
    });

    it('allows player to survive when cleanly passing through the pipe gap', () => {
      room.addPlayer('p1', 'Alice');
      room.startRound();

      // Pipe spans x: [140, 200], gap spans y: [150, 290]
      room.pipes = [
        { x: 140, gapY: 150, gapHeight: 140 }
      ];

      const player = room.players[0];
      // Safely in the middle of gap: y = 220 -> birdTop = 205 (> 150), birdBottom = 235 (< 290)
      player.y = 220;
      player.vy = 0;

      room.tick(16);

      assert.equal(player.alive, true, 'Bird inside gap should survive without collision');
      assert.equal(room.eliminated.length, 0);
    });

    it('tracks elimination order accurately when multiple players are eliminated sequentially', () => {
      room.addPlayer('p1', 'Alice');
      room.addPlayer('p2', 'Bob');
      room.addPlayer('p3', 'Charlie');
      room.startRound();

      // Move pipes far away so only intentional actions trigger collisions
      room.pipes = [{ x: 1000, gapY: 200, gapHeight: 150 }];

      // Step 1: Eliminate Bob (p2) first
      room.players[1].y = 550;
      room.players[1].vy = 200;
      room.players[0].y = 200; // keep Alice safe
      room.players[0].vy = 0;
      room.players[2].y = 200; // keep Charlie safe
      room.players[2].vy = 0;

      room.tick(100);

      assert.equal(room.players[1].alive, false);
      assert.deepEqual(room.eliminated, ['p2']);

      // Step 2: Eliminate Alice (p1) second
      room.players[0].y = 550;
      room.players[0].vy = 200;
      room.players[2].y = 200; // keep Charlie safe
      room.players[2].vy = 0;

      room.tick(100);

      assert.equal(room.players[0].alive, false);
      assert.deepEqual(room.eliminated, ['p2', 'p1'], 'Elimination order must record p2 first, then p1');
    });
  });

  describe('Scenario 4: Round Ending and Winner Determination', () => {
    it('ends round and sets winnerId when only one bird remains in multiplayer game', () => {
      room.addPlayer('p1', 'Alice');
      room.addPlayer('p2', 'Bob');
      room.addPlayer('p3', 'Charlie');
      room.startRound();

      assert.equal(room.status, 'playing');
      assert.equal(room.winnerId, null);

      // Move pipes out of way
      room.pipes = [{ x: 1000, gapY: 200, gapHeight: 150 }];

      // Eliminate Alice (p1)
      room.players[0].y = 550;
      room.players[0].vy = 200;
      room.players[1].y = 200;
      room.players[1].vy = 0;
      room.players[2].y = 200;
      room.players[2].vy = 0;
      room.tick(100);

      assert.equal(room.status, 'playing', 'Game should continue with 2 players remaining');
      assert.equal(room.winnerId, null);

      // Eliminate Charlie (p3), leaving Bob (p2) as the last survivor
      room.players[2].y = 550;
      room.players[2].vy = 200;
      room.players[1].y = 200;
      room.players[1].vy = 0;
      room.tick(100);

      assert.equal(room.status, 'ended', 'Game should end when only one player remains');
      assert.equal(room.winnerId, 'p2', 'Sole surviving player should be the winner');

      const state = room.getState();
      assert.equal(state.status, 'ended');
      assert.equal(state.winnerId, 'p2');
      assert.deepEqual(state.eliminated, ['p1', 'p3']);
    });

    it('ends round with winnerId null when all players are eliminated simultaneously', () => {
      room.addPlayer('p1', 'Alice');
      room.addPlayer('p2', 'Bob');
      room.startRound();

      // Drop both players onto ground in the same tick
      room.players[0].y = 550;
      room.players[0].vy = 200;
      room.players[1].y = 550;
      room.players[1].vy = 200;

      room.tick(100);

      assert.equal(room.status, 'ended');
      assert.equal(room.winnerId, null, 'Simultaneous elimination should result in no winner');
      assert.equal(room.eliminated.length, 2);
    });

    it('ends round with winnerId null when single-player (solo) host is eliminated', () => {
      room.addPlayer('host', 'Solo Host');
      room.startRound();

      assert.equal(room.status, 'playing');

      // Solo player collides with ground
      room.players[0].y = 550;
      room.players[0].vy = 200;

      room.tick(100);

      assert.equal(room.status, 'ended');
      assert.equal(room.winnerId, null, 'Solo round elimination ends with winnerId null');
    });

    it('resets game back to lobby state with revived players and cleared winner', () => {
      room.addPlayer('p1', 'Alice');
      room.addPlayer('p2', 'Bob');
      room.startRound();

      // Eliminate p1 to end game
      room.players[0].y = 550;
      room.players[0].vy = 200;
      room.tick(100);

      assert.equal(room.status, 'ended');
      assert.equal(room.winnerId, 'p2');

      // Call reset()
      room.reset();

      assert.equal(room.status, 'lobby');
      assert.equal(room.winnerId, null);
      assert.deepEqual(room.eliminated, []);

      // All players restored
      for (const p of room.players) {
        assert.equal(p.alive, true);
        assert.equal(p.y, 250);
        assert.equal(p.vy, 0);
      }

      const state = room.getState();
      assert.equal(state.status, 'lobby');
      assert.equal(state.winnerId, null);
      assert.deepEqual(state.eliminated, []);
    });
  });
});

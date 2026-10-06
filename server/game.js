const generatePipes = require('./pipes.js');

const MAX_PLAYERS = 8;
const COLORS = [
  '#FF3B30', // Red
  '#007AFF', // Blue
  '#34C759', // Green
  '#FF9500', // Orange
  '#AF52DE', // Purple
  '#FFCC00', // Yellow
  '#5856D6', // Indigo
  '#00C7BE', // Teal
];

// Physics and coordinate constants
const BIRD_X = 150;
const BIRD_RADIUS = 15;
const PIPE_WIDTH = 60;
const CANVAS_HEIGHT = 600;
const GROUND_Y = 560;
const DEFAULT_Y = 250;
const GRAVITY = 800; // px/s^2
const FLAP_VELOCITY = -300; // px/s
const PIPE_SPEED = 150; // px/s
const MAX_FALL_SPEED = 600; // px/s
const PIPE_SPACING = 250;
const PIPE_START_X = 600;

class GameRoom {
  /**
   * @param {number|object} [options] - Initial seed or options object
   */
  constructor(options = {}) {
    const seed = (typeof options === 'number')
      ? options
      : (options && options.seed !== undefined ? options.seed : 12345);

    this.seed = seed;
    this.status = (options && options.status) || 'lobby';
    this.players = [];
    this.pipes = (typeof generatePipes === 'function' ? generatePipes(this.seed) : generatePipes.generatePipes(this.seed));
    this.eliminated = [];
    this.winnerId = null;
    this.roundStartedWith = 0;
  }

  /**
   * Add a player to the room.
   * First player joining is host.
   *
   * @param {string} socketId - Unique socket identifier
   * @param {string} [name] - Player display name
   * @returns {{id: string, color: string, isHost: boolean}|null}
   */
  addPlayer(socketId, name) {
    if (this.players.length >= MAX_PLAYERS) {
      return null;
    }

    const existing = this.players.find(p => p.id === socketId);
    if (existing) {
      return {
        id: existing.id,
        color: existing.color,
        isHost: existing.isHost,
      };
    }

    const isHost = this.players.length === 0;

    // Pick next unused color in join order
    const usedColors = new Set(this.players.map(p => p.color));
    const color = COLORS.find(c => !usedColors.has(c)) || COLORS[this.players.length % COLORS.length];

    const player = {
      id: socketId,
      name: name || `Player ${this.players.length + 1}`,
      color,
      isHost,
      y: DEFAULT_Y,
      vy: 0,
      alive: true,
    };

    this.players.push(player);

    return {
      id: player.id,
      color: player.color,
      isHost: player.isHost,
    };
  }

  /**
   * Remove a player by id.
   * Transfers host if the host leaves.
   *
   * @param {string} id - Player id
   */
  removePlayer(id) {
    const index = this.players.findIndex(p => p.id === id);
    if (index === -1) return;

    const wasHost = this.players[index].isHost;
    this.players.splice(index, 1);

    if (wasHost && this.players.length > 0) {
      this.players[0].isHost = true;
    }

    if (this.status === 'playing') {
      this._checkWinCondition();
    }
  }

  /**
   * Flap action for a player.
   *
   * @param {string} id - Player id
   */
  flap(id) {
    if (this.status !== 'playing') return;

    const player = this.players.find(p => p.id === id);
    if (!player || !player.alive) return;

    player.vy = FLAP_VELOCITY;
  }

  /**
   * Start a new round.
   *
   * @param {number} [seed] - Optional seed for new pipes
   */
  startRound(seed) {
    if (seed !== undefined && seed !== null) {
      this.seed = seed;
    }

    this.status = 'playing';
    const gen = typeof generatePipes === 'function' ? generatePipes : generatePipes.generatePipes;
    this.pipes = gen(this.seed);
    this.eliminated = [];
    this.winnerId = null;
    this.roundStartedWith = this.players.length;

    for (const player of this.players) {
      player.alive = true;
      player.y = DEFAULT_Y;
      player.vy = 0;
    }
  }

  /**
   * Reset game to lobby state.
   */
  reset() {
    this.status = 'lobby';
    this.eliminated = [];
    this.winnerId = null;
    this.roundStartedWith = 0;

    const gen = typeof generatePipes === 'function' ? generatePipes : generatePipes.generatePipes;
    this.pipes = gen(this.seed);

    for (const player of this.players) {
      player.alive = true;
      player.y = DEFAULT_Y;
      player.vy = 0;
    }
  }

  /**
   * Advance physics, detect collisions and eliminations, update status.
   *
   * @param {number} [dtMs=16.666] - Delta time in milliseconds
   */
  tick(dtMs) {
    if (this.status !== 'playing') return;

    const dt = (typeof dtMs === 'number' && dtMs > 0 ? dtMs : 16.666) / 1000;
    const clampedDt = Math.min(dt, 0.1);

    // Advance pipes to the left
    for (const pipe of this.pipes) {
      pipe.x -= PIPE_SPEED * clampedDt;
    }

    // Remove pipes that moved past left screen edge
    while (this.pipes.length > 0 && this.pipes[0].x < -PIPE_WIDTH - 50) {
      this.pipes.shift();
    }

    // Generate more pipes if running low
    if (this.pipes.length < 20) {
      const lastX = this.pipes.length > 0 ? this.pipes[this.pipes.length - 1].x : PIPE_START_X;
      const gen = typeof generatePipes === 'function' ? generatePipes : generatePipes.generatePipes;
      const morePipes = gen(this.seed + this.pipes.length, 50);
      for (let i = 0; i < morePipes.length; i++) {
        this.pipes.push({
          x: lastX + (i + 1) * PIPE_SPACING,
          gapY: morePipes[i].gapY,
          gapHeight: morePipes[i].gapHeight,
        });
      }
    }

    // Update physics for each player
    for (const player of this.players) {
      if (player.alive) {
        player.vy += GRAVITY * clampedDt;
        if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;
        player.y += player.vy * clampedDt;

        // Ceiling clamp
        if (player.y - BIRD_RADIUS < 0) {
          player.y = BIRD_RADIUS;
          player.vy = 0;
        }
      } else {
        // Eliminated birds fall to ground
        if (player.y + BIRD_RADIUS < GROUND_Y) {
          player.vy += GRAVITY * clampedDt;
          player.y += player.vy * clampedDt;
          if (player.y + BIRD_RADIUS > GROUND_Y) {
            player.y = GROUND_Y - BIRD_RADIUS;
            player.vy = 0;
          }
        }
      }
    }

    // Collision detection for alive players
    const newlyEliminated = [];
    const birdLeft = BIRD_X - BIRD_RADIUS;
    const birdRight = BIRD_X + BIRD_RADIUS;

    for (const player of this.players) {
      if (!player.alive) continue;

      let collided = false;

      // Ground collision
      if (player.y + BIRD_RADIUS >= GROUND_Y) {
        collided = true;
        player.y = GROUND_Y - BIRD_RADIUS;
        player.vy = 0;
      } else {
        // Pipe collision
        const birdTop = player.y - BIRD_RADIUS;
        const birdBottom = player.y + BIRD_RADIUS;

        for (const pipe of this.pipes) {
          const pipeLeft = pipe.x;
          const pipeRight = pipe.x + PIPE_WIDTH;

          if (birdRight > pipeLeft && birdLeft < pipeRight) {
            const gapTop = pipe.gapY;
            const gapBottom = pipe.gapY + pipe.gapHeight;

            if (birdTop < gapTop || birdBottom > gapBottom) {
              collided = true;
              break;
            }
          }
        }
      }

      if (collided) {
        newlyEliminated.push(player);
      }
    }

    // Eliminate collided players
    for (const player of newlyEliminated) {
      player.alive = false;
      this.eliminated.push(player.id);
    }

    // Check winner / game-over
    this._checkWinCondition();
  }

  /**
   * Internal check for game over and winner determination.
   * @private
   */
  _checkWinCondition() {
    if (this.status !== 'playing') return;

    const total = this.roundStartedWith || this.players.length;
    const alivePlayers = this.players.filter(p => p.alive);

    if (total >= 2) {
      if (alivePlayers.length === 1) {
        this.winnerId = alivePlayers[0].id;
        this.status = 'ended';
      } else if (alivePlayers.length === 0) {
        this.winnerId = null;
        this.status = 'ended';
      }
    } else if (total === 1) {
      if (alivePlayers.length === 0) {
        this.winnerId = null;
        this.status = 'ended';
      }
    }
  }

  /**
   * Return game state matching the contract.
   *
   * @returns {{
   *   status: 'lobby'|'playing'|'ended',
   *   players: Array<{id: string, name: string, color: string, y: number, vy: number, alive: boolean}>,
   *   pipes: Array<{x: number, gapY: number, gapHeight: number}>,
   *   eliminated: string[],
   *   winnerId: string|null
   * }}
   */
  getState() {
    return {
      status: this.status,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        y: p.y,
        vy: p.vy,
        alive: p.alive,
      })),
      pipes: this.pipes.map(pipe => ({
        x: pipe.x,
        gapY: pipe.gapY,
        gapHeight: pipe.gapHeight,
      })),
      eliminated: [...this.eliminated],
      winnerId: this.winnerId,
    };
  }
}

// Attach static properties for convenience
GameRoom.GameRoom = GameRoom;
GameRoom.MAX_PLAYERS = MAX_PLAYERS;
GameRoom.COLORS = COLORS;
GameRoom.BIRD_X = BIRD_X;
GameRoom.BIRD_RADIUS = BIRD_RADIUS;
GameRoom.PIPE_WIDTH = PIPE_WIDTH;
GameRoom.GROUND_Y = GROUND_Y;
GameRoom.CANVAS_HEIGHT = CANVAS_HEIGHT;
GameRoom.default = GameRoom;

module.exports = GameRoom;
module.exports.GameRoom = GameRoom;
module.exports.MAX_PLAYERS = MAX_PLAYERS;
module.exports.COLORS = COLORS;
module.exports.default = GameRoom;

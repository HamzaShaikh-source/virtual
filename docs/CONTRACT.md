# Flappy Royale Contract (frozen)

## Run
- PORT env var, default 3000. Server serves static files from /public.
- Routes: GET /display.html, GET /controller.html, GET /api/join-info -> {"url":"http://<lanIp>:<port>/controller.html","qrDataUrl":"data:image/png;base64,..."}

## Socket.io events
Client -> Server:
- 'join' {name:string} -> server replies 'joined' {id, color, isHost}
- 'flap' {} (no payload; server reads socket's playerId)
- 'startRound' {} (host only)
- 'restart' {} (host only)

Server -> Clients (broadcast):
- 'state' {status: 'lobby'|'playing'|'ended', players: [{id, name, color, y, vy, alive}], pipes: [{x, gapY, gapHeight}], eliminated: [id,...] (order eliminated), winnerId: string|null}

## server/game.js exports (owned by T2, imported ONLY by server/index.js)
- class GameRoom {
    addPlayer(socketId, name) -> {id, color, isHost}  // first player joining is isHost=true
    removePlayer(id) -> void
    flap(id) -> void
    startRound() -> void
    tick(dtMs) -> void   // advances physics, detects collisions/elimination, sets status
    reset() -> void
    getState() -> StateObject  // shape matches 'state' event above
  }
- MAX_PLAYERS = 8
- COLORS = array of 8 distinct hex color strings, assigned in join order

## server/pipes.js exports (owned by T2)
- generatePipes(seed:number) -> array of {x, gapY, gapHeight} used by GameRoom

## File layout (fixed, do not rename)
server/index.js      - entry point, express+socket.io wiring, imports GameRoom from ./game.js
server/game.js        - GameRoom class, physics/collision/elimination
server/pipes.js        - pipe generation
server/qrcode.js       - exports getJoinInfo(port) -> {url, qrDataUrl}, used by server/index.js
public/display.html/js/css   - big screen view
public/controller.html/js/css - phone controller
public/host-controls.js       - loaded by display.html, host keyboard flap + start/restart buttons, emits 'flap'/'startRound'/'restart'
tests/game.test.js     - unit tests for GameRoom
tests/integration.test.js - starts server, connects socket.io-client, asserts state flow

## Env/Ports
- PORT=3000 (default). No other required env vars.
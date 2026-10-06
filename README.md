# Flappy Royale

> Real-Time Same-Room Multiplayer Flappy Bird with Live Elimination and Mobile QR Controllers.

**Flappy Royale** is a same-room competitive multiplayer Flappy Bird game designed for exhibition, demo, and party environments. Up to 8 players compete simultaneously on one shared big-screen display, each controlling a distinct colored bird. Built with server-authoritative physics, instant LAN QR joining, and responsive mobile-web controllers.

---

## Features

- **Real-Time Multiplayer Elimination:** 2 to 8 players compete on a single shared screen in real-time. Birds are eliminated upon hitting pipes or the ground, with the last surviving bird crowned the winner.
- **Server-Authoritative Physics:** All gravity, flap impulses, and pipe collisions are computed by the Node.js server loop (broadcasting at 50ms intervals). Clients only send lightweight flap inputs, preventing desync and cheating.
- **Instant LAN QR Code Joining:** Big screen displays a live QR code and direct URL pointing to the host machine's local IP. Mobile players join instantly by scanning the QR code—no app store downloads or venue Wi-Fi configuration required.
- **Built-in Host Fallback:** The host laptop automatically participates as the first player with keyboard controls (`Space` to flap, `S` or `Enter` to start/restart), ensuring the demo can run solo or scale seamlessly to 8 players.
- **Ultra-Responsive Mobile Controller:** A mobile-first controller web page (`/controller.html`) with zero touch-delay, rapid-tap debouncing, haptic feedback, assigned color theming, and real-time state overlays (`ELIMINATED`, `YOU WON`).
- **Deterministic Course Generation:** Pipe sequences are deterministically generated via seeded pseudo-random algorithms, guaranteeing an identical and fair obstacle course for all competitors.

---

## Demo Flow

```
+-------------------------------------------------------------------+
|                         SHARED BIG SCREEN                         |
|                     (http://localhost:3000/display.html)          |
|                                                                   |
|   +-------------------+    +----------------------------------+   |
|   |   JOIN QR CODE    |    |      LIVE CANVAS ARENA           |   |
|   |  Scan to join via |    |   [Host Bird] [Player 2] ...     |   |
|   |   phone hotspot   |    |      Scrolling Pipes ===>        |   |
|   +-------------------+    +----------------------------------+   |
|                                                                   |
+-------------------------------------------------------------------+
        ^                                        ^
        | Socket.io                              | Socket.io
        v                                        v
+-----------------------+              +-----------------------+
|    HOST CONTROLLER    |              |   MOBILE CONTROLLER   |
| Built into Big Screen |              |  (Phones via QR code) |
| Space: Flap           |              | Single Tap: Flap      |
| S/Enter: Start/Restart|              | Real-time Overlays    |
+-----------------------+              +-----------------------+
```

1. **Host Setup:** Host starts the server and opens `/display.html` on the laptop connected to a projector or TV.
2. **Players Join:** Up to 7 additional visitors scan the displayed QR code on their smartphones, enter their nickname, and are assigned a distinct bird color.
3. **Round Start:** Host presses "Start Round" (or presses `S` on the keyboard). All birds enter the arena.
4. **Elimination:** As birds hit pipes or the ground, they are eliminated in real-time. Their controllers display an `ELIMINATED` overlay while spectating the live big screen.
5. **Victory & Restart:** The last remaining bird is crowned champion with a `VICTORY` banner. The host clicks "Restart Match" (or presses `R`/`Enter`) to reset back to the lobby for the next group.

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher (`v20+` or `v24+` recommended)
- **npm**: `v8.0.0` or higher

---

## Setup & Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/HamzaShaikh-source/virtual.git
cd virtual
npm install
```

---

## Running the Application

### 1. Start the Server

```bash
npm start
```

*By default, the server runs on port `3000`. You can configure a custom port via the `PORT` environment variable:*

```bash
PORT=8080 npm start
```

### 2. Open the Big-Screen Display

On the host machine, open the display view in any modern web browser:

```text
http://localhost:3000/display.html
```

### 3. Connect Mobile Controllers

Connect mobile phones to the same local Wi-Fi or laptop hotspot:
- Scan the QR code displayed on the top-right corner of `display.html`.
- Or directly navigate to:
  ```text
  http://<host-lan-ip>:3000/controller.html
  ```

---

## Testing

Run the full automated test suite using Node's built-in test runner:

```bash
npm test
```

### Run Specific Test Suites

- **Unit Tests (Game Physics & State Logic):**
  ```bash
  node --test tests/game.test.js
  ```
  Validates player join limits (`MAX_PLAYERS = 8`), color assignments, flap velocity impulses, ceiling clamping, ground and pipe collisions, elimination order tracking, and winner resolution.

- **Integration Smoke Test (Server & Sockets):**
  ```bash
  node --test tests/integration.test.js
  ```
  Starts the server module on an ephemeral port, establishes client connections via `socket.io-client`, emits `join` and `startRound`, and asserts the complete state broadcast shape matching the frozen contract.

---

## Project Structure

This project follows the strict architecture specified in [docs/CONTRACT.md](docs/CONTRACT.md):

```text
.
├── docs/
│   └── CONTRACT.md           # Frozen contract defining Socket.io events and API signatures
├── public/
│   ├── display.html          # Shared big-screen HTML view
│   ├── display.js            # Canvas rendering engine, QR fetcher, and spectator UI
│   ├── style-display.css     # Styling for shared display and lobby layout
│   ├── controller.html       # Mobile tap-to-flap controller view
│   ├── controller.js         # Mobile controller touch handling, socket emit, state overlays
│   ├── style-controller.css  # Mobile-responsive controller styling and color theming
│   └── host-controls.js      # Host keyboard bindings (Space, S, R) and control panel
├── server/
│   ├── index.js              # Express HTTP server and Socket.io event wiring
│   ├── game.js               # Authoritative GameRoom physics, collision, and elimination logic
│   ├── pipes.js              # Deterministic seeded pipe obstacle generator
│   └── qrcode.js             # LAN IP detection and QR code data URL generator
├── tests/
│   ├── game.test.js          # Unit tests for GameRoom logic
│   └── integration.test.js   # Integration smoke tests with ephemeral port & sockets
├── package.json              # Project scripts and dependencies
└── README.md                 # Project documentation and guide
```

---

## Socket.io Event Specification

For full payload details and contract definitions, see [docs/CONTRACT.md](docs/CONTRACT.md).

### Client -> Server Events
- `join` `{ name: string }` &rarr; Server responds with `joined` `{ id, color, isHost }`
- `flap` `{}` &rarr; Trigger upward flap impulse for the player's bird
- `startRound` `{}` &rarr; Start the match (host only)
- `restart` `{}` &rarr; Reset match to lobby (host only)

### Server -> Clients Broadcast
- `state` Broadcasts every 50ms with the current game snapshot:
  ```json
  {
    "status": "lobby | playing | ended",
    "players": [
      { "id": "string", "name": "string", "color": "string", "y": 250, "vy": 0, "alive": true }
    ],
    "pipes": [
      { "x": 600, "gapY": 220, "gapHeight": 140 }
    ],
    "eliminated": ["id-1", "id-2"],
    "winnerId": "string | null"
  }
  ```

---

## License

ISC
